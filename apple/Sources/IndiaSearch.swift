import CFNetwork
import Foundation

struct IndiaSearch {
    enum Failure: Error { case unavailable, invalid, failed }
    struct Hit: Decodable {
        let title: String
        let url: String
        let snippet: String
    }
    private struct Response: Decodable { let results: [Hit] }

    static let maximumResponseBytes = 64 * 1024
    struct Deployment {
        let endpoint: URL
        let expiration: Date

        init?(info: [String: Any]?) {
            guard let description = info?["VaayvuIndiaSearch"] as? [String: Any],
                  description["country"] as? String == "IN",
                  let region = description["region"] as? String, region == region.trimmingCharacters(in: .whitespacesAndNewlines),
                  !region.isEmpty, region.unicodeScalars.count <= 80,
                  !region.unicodeScalars.contains(where: CharacterSet.controlCharacters.contains),
                  let endpoint = IndiaSearch.endpoint(for: description["origin"] as? String), let host = endpoint.host,
                  let date = description["expiresAt"] as? String,
                  date.range(of: #"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$"#, options: .regularExpression) != nil,
                  let expiration = ISO8601DateFormatter().date(from: date), ISO8601DateFormatter().string(from: expiration) == date,
                  let pins = description["spkiPins"] as? [String], (1...4).contains(pins.count), Set(pins).count == pins.count,
                  let ats = info?["NSAppTransportSecurity"] as? [String: Any],
                  let pinnedDomains = ats["NSPinnedDomains"] as? [String: Any],
                  let domain = pinnedDomains[host] as? [String: Any],
                  let leaf = domain["NSPinnedLeafIdentities"] as? [[String: String]] else { return nil }
            let digests = pins.compactMap { pin -> String? in
                guard pin.hasPrefix("sha256/") else { return nil }
                let base64 = String(pin.dropFirst(7))
                guard let data = Data(base64Encoded: base64), data.count == 32, data.base64EncodedString() == base64 else { return nil }
                return base64
            }
            guard digests.count == pins.count, leaf.count == pins.count,
                  Set(leaf.compactMap { $0["SPKI-SHA256-BASE64"] }) == Set(digests) else { return nil }
            self.endpoint = endpoint
            self.expiration = expiration
        }
    }

    let deployment: Deployment?
    var available: Bool { deployment.map { $0.expiration > Date() } ?? false }
    private let protocols: [AnyClass]?
    private let permitsDirectConnection: (URL) -> Bool

    init(deployment: Deployment? = Deployment(info: Bundle.main.infoDictionary), protocols: [AnyClass]? = nil,
         permitsDirectConnection: @escaping (URL) -> Bool = IndiaSearch.isDirect) {
        self.deployment = deployment
        self.protocols = protocols
        self.permitsDirectConnection = permitsDirectConnection
    }

    static func endpoint(for origin: String?) -> URL? {
        guard let origin, let components = URLComponents(string: origin),
              components.scheme?.lowercased() == "https", let host = components.host?.lowercased(),
              host.utf8.count <= 253, !host.hasSuffix(".local"), !host.hasSuffix(".localhost"),
              !host.hasSuffix(".internal"), let last = host.split(separator: ".").last,
              last.utf8.contains(where: { (97...122).contains($0) }),
              host.range(of: #"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$"#,
                         options: .regularExpression) != nil else { return nil }
        // Comparing the entire origin also excludes escaped hosts, userinfo, queries,
        // fragments and paths. The chrome bridge never accepts an endpoint.
        let allowed = "https://" + host
        guard [allowed, allowed + "/", allowed + ":443", allowed + ":443/"].contains(origin.lowercased()) else { return nil }
        return URL(string: allowed + "/v1/search")
    }

    static func isDirect(_ endpoint: URL) -> Bool {
        guard let settings = CFNetworkCopySystemProxySettings()?.takeRetainedValue() else { return false }
        let proxies = CFNetworkCopyProxiesForURL(endpoint as CFURL, settings).takeRetainedValue() as NSArray
        return proxies.count > 0 && proxies.allSatisfy { value in
            (value as? NSDictionary)?[kCFProxyTypeKey] as? String == kCFProxyTypeNone as String
        }
    }

    func configuration() -> URLSessionConfiguration {
        let config = URLSessionConfiguration.ephemeral
        config.urlCache = nil
        config.httpCookieStorage = nil
        config.urlCredentialStorage = nil
        config.httpShouldSetCookies = false
        config.httpCookieAcceptPolicy = .never
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.connectionProxyDictionary = ["HTTPEnable": 0, "HTTPSEnable": 0, "SOCKSEnable": 0,
                                            "ProxyAutoConfigEnable": 0, "ProxyAutoDiscoveryEnable": 0]
        config.waitsForConnectivity = false
        config.timeoutIntervalForRequest = 8
        config.timeoutIntervalForResource = 12
        if let protocols { config.protocolClasses = protocols }
        return config
    }

    func search(_ input: String) async throws -> [Hit] {
        guard let deployment, deployment.expiration > Date() else { throw Failure.unavailable }
        let endpoint = deployment.endpoint
        let query = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty, query.unicodeScalars.count <= 256,
              !query.unicodeScalars.contains(where: CharacterSet.controlCharacters.contains) else { throw Failure.invalid }
        guard permitsDirectConnection(endpoint) else { throw Failure.unavailable }
        try Task.checkCancellation()
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("no-store", forHTTPHeaderField: "Cache-Control")
        request.httpShouldHandleCookies = false
        request.httpBody = try JSONEncoder().encode(["q": query])
        let session = URLSession(configuration: configuration(), delegate: DirectSearchDelegate(), delegateQueue: nil)
        defer { session.invalidateAndCancel() }
        return try await withTaskCancellationHandler {
            let (bytes, response) = try await session.bytes(for: request)
            guard let http = response as? HTTPURLResponse, http.url == endpoint, http.statusCode == 200,
                  http.mimeType?.lowercased() == "application/json",
                  http.expectedContentLength <= Self.maximumResponseBytes else { throw Failure.failed }
            var data = Data()
            for try await byte in bytes {
                guard data.count < Self.maximumResponseBytes else { throw Failure.failed }
                data.append(byte)
            }
            try Task.checkCancellation()
            guard deployment.expiration > Date() else { throw Failure.unavailable }
            let results = try JSONDecoder().decode(Response.self, from: data).results
            guard results.count <= 20 else { throw Failure.failed }
            return results.filter { item in
                guard !item.title.isEmpty, item.title.utf8.count <= 2048, item.snippet.utf8.count <= 4096,
                      let url = WebAddress.parse(item.url), url.scheme?.lowercased() == "https" else { return false }
                return true
            }
        } onCancel: { session.invalidateAndCancel() }
    }
}

final class DirectSearchDelegate: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) {
        completionHandler(nil)
    }
    func urlSession(_ session: URLSession, task: URLSessionTask, didReceive challenge: URLAuthenticationChallenge,
                    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        completionHandler(challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust
                          ? .performDefaultHandling : .cancelAuthenticationChallenge, nil)
    }
}

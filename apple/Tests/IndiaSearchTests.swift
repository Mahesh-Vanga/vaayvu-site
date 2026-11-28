import XCTest
import WebKit
@testable import VaayvuPhone

private final class SearchProtocol: URLProtocol {
    static var respond: ((URLRequest) -> (Int, [String: String], Data))?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        guard let result = Self.respond?(request), let url = request.url,
              let response = HTTPURLResponse(url: url, statusCode: result.0, httpVersion: "HTTP/1.1", headerFields: result.1)
        else { client?.urlProtocol(self, didFailWithError: URLError(.badServerResponse)); return }
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: result.2)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

@MainActor
final class IndiaSearchTests: XCTestCase {
    private let host = "search.fixture.example"
    private let digest = Data(repeating: 7, count: 32).base64EncodedString()
    private func settings(patch: [String: Any] = [:], actualPin: String? = nil) -> [String: Any] {
        var entry: [String: Any] = ["origin":"https://" + host, "region":"Mumbai", "country":"IN",
                                   "spkiPins":["sha256/" + digest], "expiresAt":"2099-01-01T00:00:00Z"]
        for (key,value) in patch { entry[key] = value }
        return ["VaayvuIndiaSearch":entry, "NSAppTransportSecurity":["NSPinnedDomains":[host:["NSPinnedLeafIdentities":[["SPKI-SHA256-BASE64":actualPin ?? digest]]]]]]
    }

    func testProvisioningRequiresSignedATSPinsRegionAndExpiry() throws {
        let valid = try XCTUnwrap(IndiaSearch.Deployment(info: settings()))
        XCTAssertEqual(valid.endpoint.absoluteString, "https://" + host + "/v1/search")
        XCTAssertTrue(IndiaSearch(deployment: valid).available)
        for patch: [String: Any] in [["origin":"https://user@" + host],["origin":"https://" + host + ":8443"],
                                     ["origin":"https://" + host + "/v1"],["origin":"http://" + host],["origin":"https://127.0.0.1"],
                                     ["country":"US"],["region":""],["spkiPins":[]],["spkiPins":["sha256/invalid"]],
                                     ["spkiPins":["sha256/" + digest,"sha256/" + digest]],["expiresAt":"March 15, 2099"]] {
            XCTAssertNil(IndiaSearch.Deployment(info: settings(patch: patch)))
        }
        XCTAssertNil(IndiaSearch.Deployment(info: settings(actualPin: "different")))
        let expired = IndiaSearch(deployment: IndiaSearch.Deployment(info: settings(patch:["expiresAt":"2001-01-01T00:00:00Z"])))
        XCTAssertFalse(expired.available)
        XCTAssertNil(IndiaSearch.Deployment(info: [:]))
    }

    func testTransportIsBoundedCookieFreeAndFailsClosed() async throws {
        let valid = try XCTUnwrap(IndiaSearch.Deployment(info: settings()))
        let transport = IndiaSearch(deployment:valid, protocols:[SearchProtocol.self], permitsDirectConnection:{ _ in true })
        let config = transport.configuration()
        XCTAssertNil(config.urlCache)
        XCTAssertNil(config.httpCookieStorage)
        XCTAssertNil(config.urlCredentialStorage)
        XCTAssertFalse(config.httpShouldSetCookies)
        XCTAssertEqual(config.connectionProxyDictionary?["HTTPSEnable"] as? Int, 0)
        let body = Data(#"{"results":[{"title":"A result","url":"https://result.example/page","snippet":"Some text"},{"title":"Bad destination","url":"https://secret@result.example","snippet":""}]}"#.utf8)
        var requests = 0
        defer { SearchProtocol.respond = nil }
        SearchProtocol.respond = { request in
            requests += 1
            XCTAssertEqual(request.url, valid.endpoint)
            XCTAssertEqual(request.httpMethod, "POST")
            XCTAssertEqual(request.value(forHTTPHeaderField:"Content-Type"), "application/json")
            XCTAssertNil(request.value(forHTTPHeaderField:"Cookie"))
            XCTAssertNil(request.value(forHTTPHeaderField:"Authorization"))
            XCTAssertNil(request.value(forHTTPHeaderField:"Referer"))
            var submitted = request.httpBody
            if submitted == nil, let stream = request.httpBodyStream {
                stream.open()
                defer { stream.close() }
                var bytes = [UInt8](repeating:0,count:4096)
                let size = stream.read(&bytes,maxLength:bytes.count)
                if size > 0 { submitted = Data(bytes.prefix(size)) }
            }
            if let submitted {
                XCTAssertEqual(try? JSONDecoder().decode([String:String].self, from:submitted), ["q":"नदी"])
            } else { XCTFail("Missing JSON body") }
            return (200,["Content-Type":"application/json"],body)
        }
        let hits = try await transport.search(" नदी ")
        XCTAssertEqual(hits.map(\.url),["https://result.example/page"])
        XCTAssertEqual(requests,1)
        let absent = IndiaSearch(deployment:nil, protocols:[SearchProtocol.self], permitsDirectConnection:{ _ in XCTFail(); return true })
        let proxy = IndiaSearch(deployment:valid, protocols:[SearchProtocol.self], permitsDirectConnection:{ _ in false })
        for blocked in [absent, proxy] {
            do { _ = try await blocked.search("query"); XCTFail("Search was permitted") }
            catch IndiaSearch.Failure.unavailable {}
        }
        do { _ = try await transport.search(String(repeating:"क",count:257)); XCTFail("Long query was sent") }
        catch IndiaSearch.Failure.invalid {}
        XCTAssertEqual(requests,1)
        for (status,headers,bytes) in [
            (307, ["Location":"https://other.example/path"], Data()),
            (200, ["Content-Type":"text/html"], body),
            (200, ["Content-Type":"application/json"], Data(repeating:32,count:IndiaSearch.maximumResponseBytes + 1))
        ] {
            SearchProtocol.respond = { request in
                XCTAssertEqual(request.url,valid.endpoint)
                return (status,headers,bytes)
            }
            do { _ = try await transport.search("check"); XCTFail("Unexpected response accepted") }
            catch IndiaSearch.Failure.failed {}
        }
        let delegate = DirectSearchDelegate()
        let session = URLSession(configuration:.ephemeral)
        defer { session.invalidateAndCancel() }
        let redirect = try XCTUnwrap(HTTPURLResponse(url:valid.endpoint,statusCode:308,httpVersion:nil,headerFields:nil))
        var refused = false
        delegate.urlSession(session,task:session.dataTask(with:valid.endpoint),willPerformHTTPRedirection:redirect,
                            newRequest:URLRequest(url:valid.endpoint)) { refused = $0 == nil }
        XCTAssertTrue(refused)
    }

    func testStrictHostHasNoWebsiteOrExternalQueryFallback() async throws {
        let host = BrowserHost()
        host.indiaSearch = IndiaSearch(deployment: nil)
        host.profileID = UUID().uuidString
        host.chromeStore = .nonPersistent()
        host.siteStore = .nonPersistent()
        _ = host.view
        defer { host.dismissWindow() }
        for _ in 0..<220 where host.chrome?.url == nil || host.chrome?.isLoading == true { try await Task.sleep(nanoseconds:40_000_000) }
        let chrome = try XCTUnwrap(host.chrome)
        for _ in 0..<150 {
            if (try? await chrome.evaluateJavaScript("typeof nativeReady !== 'undefined' && nativeReady")) as? Bool == true { break }
            try await Task.sleep(nanoseconds:20_000_000)
        }
        _ = try await chrome.evaluateJavaScript("VaayvuPreferences.commit({ordinaryWeb:false});true")
        for _ in 0..<100 where host.websiteAccess { try await Task.sleep(nanoseconds:20_000_000) }
        XCTAssertFalse(host.websiteAccess)
        let consent = try await chrome.evaluateJavaScript("""
            document.querySelector('#address').value = 'google';
            document.querySelector('#address-form').requestSubmit();
            document.querySelector('[data-result-url="https://www.google.com/"]')?.click();
            document.querySelector('#dialog[open] [data-confirm-visit]')?.dataset.confirmVisit || ''
            """)
        XCTAssertEqual(consent as? String, "https://www.google.com/")
        XCTAssertTrue(host.tabs.isEmpty)
        _ = try await chrome.evaluateJavaScript("closeDialog(); true")
        host.handle(["type":"open","id":"blocked","url":"https://fixture.example/"])
        XCTAssertTrue(host.tabs.isEmpty)
        _ = try await chrome.evaluateJavaScript("window.searchEvents=[];const previous=vaayvuEvent;window.vaayvuEvent=e=>{searchEvents.push(e);previous(e)};true")
        host.handle(["type":"indiaSearch","id":"internal-tab","requestId":"offline","q":"private needle","url":"https://different.example"])
        for _ in 0..<80 {
            let error = try await chrome.evaluateJavaScript("searchEvents.find(e=>e.requestId==='offline')?.error || ''") as? String
            if error == "unavailable" { break }
            try await Task.sleep(nanoseconds:25_000_000)
        }
        let echoed = try await chrome.evaluateJavaScript("searchEvents.some(e=>e.error==='unavailable'&&e.id==='internal-tab')")
        XCTAssertEqual(echoed as? Bool,true)
        XCTAssertTrue(host.tabs.isEmpty)
        let server = try NavigationServer()
        for _ in 0..<100 where server.listener.state != .ready || (server.listener.port?.rawValue ?? 0) == 0 {
            try await Task.sleep(nanoseconds:20_000_000)
        }
        let probe = "http://127.0.0.1:" + String(try XCTUnwrap(server.listener.port).rawValue) + "/network-test"
        let fetch = "try { await fetch(url,{mode:'no-cors',cache:'no-store'});return true } catch { return false }"
        let denied = try await chrome.callAsyncJavaScript(fetch, arguments:["url":probe], in:nil, contentWorld:.page)
        XCTAssertEqual(denied as? Bool,false)
        host.handle(["type":"open","id":"background","url":probe,"userApprovedVisit":true,"background":true])
        host.handle(["type":"open","id":"invalid","url":"file:///etc/hosts","userApprovedVisit":true])
        XCTAssertTrue(host.tabs.isEmpty)
        host.handle(["type":"open","id":"visit","url":probe,"userApprovedVisit":true])
        let visit = try XCTUnwrap(host.tabs["visit"])
        for _ in 0..<150 where visit.web.title != "GET fixture" || visit.web.isLoading { try await Task.sleep(nanoseconds:30_000_000) }
        XCTAssertEqual(visit.web.title, "GET fixture")
        XCTAssertFalse(visit.web.configuration.websiteDataStore.isPersistent)
        XCTAssertFalse(host.websiteAccess)
        let stillDenied = try await chrome.callAsyncJavaScript(fetch, arguments:["url":probe], in:nil, contentWorld:.page)
        XCTAssertEqual(stillDenied as? Bool, false)
        _ = try await visit.web.evaluateJavaScript("document.getElementById('new').click();document.getElementById('same').click();true")
        for _ in 0..<100 where visit.web.url?.path != "/next" || visit.web.isLoading { try await Task.sleep(nanoseconds:30_000_000) }
        XCTAssertEqual(visit.web.url?.path, "/next")
        XCTAssertEqual(Set(host.tabs.keys), ["visit"])
        host.handle(["type":"back","id":"visit"])
        for _ in 0..<100 where visit.web.url?.path != "/network-test" { try await Task.sleep(nanoseconds:30_000_000) }
        XCTAssertEqual(visit.web.url?.path, "/network-test")
        host.handle(["type":"close","id":"visit"])
        host.handle(["type":"open","id":"visit","url":probe])
        XCTAssertTrue(host.tabs.isEmpty)
        host.handle(["type":"open","id":"next-visit","url":probe,"userApprovedVisit":true])
        try await allowOrdinaryWebForFixture(host)
        XCTAssertNil(host.tabs["next-visit"])
        let permitted = try await chrome.callAsyncJavaScript(fetch, arguments:["url":probe], in:nil, contentWorld:.page)
        XCTAssertEqual(permitted as? Bool,true)
        host.handle(["type":"open","id":"temporary","private":true])
        XCTAssertNotNil(host.tabs["temporary"])
        host.handle(["type":"websiteAccess","enabled":false])
        XCTAssertTrue(host.tabs.isEmpty)
        XCTAssertNil(host.privateStore)
    }
}

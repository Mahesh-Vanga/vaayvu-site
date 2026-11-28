import WebKit

@MainActor
enum ChromeStorage {
    static let identifier = UUID(uuidString: "3E6B6AC2-D553-4BEC-AAB2-27E3F6C6F5A2")!
    private static var migration: Task<Bool, Never>?

    static func migrate(index: URL, into store: WKWebsiteDataStore) async -> Bool {
        let marker = "Vaayvu.separateChromeStore.v1"
        if UserDefaults.standard.bool(forKey: marker) {
            return true
        }
        if let migration { return await migration.value }
        let work = Task {
            do {
                try await copy(index: index, from: .default(), into: store)
                UserDefaults.standard.set(true, forKey: marker)
                return true
            } catch { return false }
        }
        migration = work
        let result = await work.value
        migration = nil
        return result
    }
    static func copy(index: URL, from previous: WKWebsiteDataStore, into destination: WKWebsiteDataStore) async throws {
        let source = StoragePage(store: previous)
        let target = StoragePage(store: destination)
        try await source.load(index)
        let values = try await source.web.callAsyncJavaScript(
            "return Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('vaayvu.')).map(k=>[k,localStorage.getItem(k)]))",
            arguments: [:], in: nil, contentWorld: .defaultClient)
        guard let values = values as? [String: String] else { throw CocoaError(.coderReadCorrupt) }
        try await target.load(index)
        _ = try await target.web.callAsyncJavaScript(
            "for (const [k,v] of Object.entries(items)) if(localStorage.getItem(k)===null) localStorage.setItem(k,v); return true",
            arguments: ["items": values], in: nil, contentWorld: .defaultClient)
    }

    static func clearRecords(index: URL, in store: WKWebsiteDataStore, history: Bool, downloads: Bool) async throws {
        let page = StoragePage(store: store)
        try await page.load(index)
        let script = """
        if (history) {
            localStorage.removeItem('vaayvu.history');
            for (const key of Object.keys(localStorage)) {
                if (key === 'vaayvu.recentlyClosed' || key.startsWith('vaayvu.recentlyClosed.')) localStorage.removeItem(key);
            }
        }
        if (downloads) {
            localStorage.removeItem('vaayvu.downloads');
        }
        return true;
        """
        _ = try await page.web.callAsyncJavaScript(script, arguments: ["history": history, "downloads": downloads],
                                                    in: nil, contentWorld: .defaultClient)
    }
}

@MainActor
private final class StoragePage: NSObject, WKNavigationDelegate {
    let web: WKWebView
    private var continuation: CheckedContinuation<Void, Error>?

    init(store: WKWebsiteDataStore) {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = store
        config.defaultWebpagePreferences.allowsContentJavaScript = false
        web = WKWebView(frame: .zero, configuration: config)
        super.init()
        web.navigationDelegate = self
    }

    func load(_ url: URL) async throws {
        try await withCheckedThrowingContinuation { pending in
            continuation = pending
            web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
    }

    private func finish(_ result: Result<Void, Error>) {
        continuation?.resume(with: result)
        continuation = nil
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { finish(.success(())) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { finish(.failure(error)) }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { finish(.failure(error)) }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { finish(.failure(URLError(.cannotLoadFromNetwork))) }
}

@MainActor
enum ChromeNetworkPolicy {
    static let strict: Task<WKContentRuleList?, Never> = Task {
        let json = #"[{"trigger":{"url-filter":"^https?://"},"action":{"type":"block"}},{"trigger":{"url-filter":"^wss?://"},"action":{"type":"block"}}]"#
        return try? await WKContentRuleListStore.default().compileContentRuleList(forIdentifier: "VaayvuTrustedOffline", encodedContentRuleList: json)
    }
}

@MainActor
enum TrackingProtection {
    static private(set) var rules: WKContentRuleList?
    private static var loading: Task<WKContentRuleList?, Never>?

    static func validDomain(_ host: String) -> Bool {
        let labels = host.split(separator: ".", omittingEmptySubsequences: false)
        let letters: ClosedRange<UInt8> = 97...122
        func alphanumeric(_ byte: UInt8) -> Bool { letters.contains(byte) || (48...57).contains(byte) }
        guard host.utf8.count <= 253, labels.count >= 2, labels.last?.utf8.contains(where: letters.contains) == true else { return false }
        return labels.allSatisfy { label in
            let bytes = label.utf8
            guard bytes.count <= 63, let first = bytes.first, let last = bytes.last,
                  alphanumeric(first), alphanumeric(last) else { return false }
            return bytes.allSatisfy { alphanumeric($0) || $0 == 45 }
        }
    }

    static func compile(_ hosts: [String], identifier: String) async throws -> WKContentRuleList {
        let entries: [[String: Any]] = hosts.map { host in
            let pattern = "^https?://([^/]+\\.)?" + NSRegularExpression.escapedPattern(for: host) + "[:/]"
            return ["trigger": ["url-filter": pattern, "load-type": ["third-party"]], "action": ["type": "block"]]
        }
        let data = try JSONSerialization.data(withJSONObject: entries)
        guard let rule = try await WKContentRuleListStore.default().compileContentRuleList(forIdentifier: identifier, encodedContentRuleList: String(decoding: data, as: UTF8.self)) else { throw CocoaError(.coderInvalidValue) }
        return rule
    }

    private static func adSelectors(from resource: String) throws -> String {
        guard let css = Bundle.main.url(forResource: resource, withExtension: "css", subdirectory: "chrome")
        else { throw CocoaError(.fileNoSuchFile) }
        let stylesheet = try String(contentsOf: css, encoding: .utf8)
        return stylesheet.replacingOccurrences(of: #"/\*[\s\S]*?\*/"#, with: "", options: .regularExpression)
            .components(separatedBy: "{")[0].trimmingCharacters(in: .whitespacesAndNewlines)
    }

    // VAAYVU's own filter database, compiled by the UI into small flat lists.
    // Mirrors chrome/vfd.js precedence: strict custom hosts win, then paused
    // sites fall back to strict-only, then category hosts, URL tokens
    // (first-party tokens only when Aggressive, matching same-site loads),
    // then one cosmetic rule. Host-level exceptions are removed up front;
    // path-scoped exceptions are not expressible in content blockers and are
    // skipped (documented; v1 ships none).
    static func compileAdBlock(
        ads: Set<String>, trackers: Set<String>, social: Set<String>, strict: Set<String>,
        patterns: [String], trackerPatterns: [String], firstPartyPatterns: [String], aggressive: Bool,
        selectors: [String], exceptions: [(hosts: [String], paths: [String])], pausedSites: [String]
    ) async throws -> WKContentRuleList? {
        var dedicatedBlocked = ads.union(trackers)
        var socialBlocked = social.subtracting(dedicatedBlocked)
        var pathExceptions: [(hostPattern: String, path: String)] = []
        for ex in exceptions {
            let hosts = ex.hosts.filter { !$0.isEmpty }
            if ex.paths.isEmpty {
                for host in hosts {
                    dedicatedBlocked.remove(host)
                    dedicatedBlocked = Set(dedicatedBlocked.filter { !$0.hasSuffix("." + host) })
                    socialBlocked.remove(host)
                    socialBlocked = Set(socialBlocked.filter { !$0.hasSuffix("." + host) })
                }
            } else {
                let hostPattern = hosts.isEmpty ? ".*" : "(?:" + hosts.map(NSRegularExpression.escapedPattern(for:)) .joined(separator: "|") + ")"
                for path in ex.paths where !path.isEmpty {
                    pathExceptions.append((hostPattern, path.lowercased()))
                }
            }
        }
        let exempt = pausedSites.map { "^https?://([a-z0-9-]+\\.)*" + NSRegularExpression.escapedPattern(for: $0) + "[:/]" }
        func block(_ host: String, thirdPartyOnly: Bool, respectPaused: Bool) -> [String: Any] {
            let domain = NSRegularExpression.escapedPattern(for: host)
            var trigger: [String: Any] = ["url-filter": "^https?://([a-z0-9-]+\\.)*" + domain + "[:/]"]
            if thirdPartyOnly {
                trigger["load-type"] = ["third-party"]
            }
            if respectPaused, !exempt.isEmpty {
                trigger["unless-top-url"] = exempt
            }
            return ["trigger": trigger, "action": ["type": "block"]]
        }
        // Dedicated ad and tracker hosts (e.g. doubleclick.net, ads.youtube.com,
        // ads.google.com, adservice.google.com) block regardless of whether
        // WebKit classifies them as first-party or third-party, while still
        // honoring pausedSites via unless-top-url. Social hosts stay third-party.
        var entries = dedicatedBlocked.subtracting(strict).sorted().map { block($0, thirdPartyOnly: false, respectPaused: true) }
        entries += socialBlocked.subtracting(strict).sorted().map { block($0, thirdPartyOnly: true, respectPaused: true) }
        func tokenRule(_ token: String, firstParty: Bool) -> [String: Any] {
            var trigger: [String: Any] = ["url-filter": ".*" + NSRegularExpression.escapedPattern(for: token) + ".*",
                                          "load-type": [firstParty ? "first-party" : "third-party"]]
            if !exempt.isEmpty { trigger["unless-top-url"] = exempt }
            return ["trigger": trigger, "action": ["type": "block"]]
        }
        for token in patterns { entries.append(tokenRule(token, firstParty: false)) }
        if aggressive {
            for token in firstPartyPatterns { entries.append(tokenRule(token, firstParty: true)) }
        }
        for token in trackerPatterns {
            var trigger: [String: Any] = ["url-filter": ".*" + NSRegularExpression.escapedPattern(for: token) + ".*",
                                          "load-type": ["third-party"]]
            if !exempt.isEmpty { trigger["unless-top-url"] = exempt }
            entries.append(["trigger": trigger, "action": ["type": "block"]])
        }
        let cleanSelectors = selectors.filter { !$0.isEmpty && $0.count <= 256 && !$0.contains(":has(") }.prefix(256)
        if !cleanSelectors.isEmpty {
            var trigger: [String: Any] = ["url-filter": ".*"]
            if !exempt.isEmpty { trigger["unless-top-url"] = exempt }
            entries.append(["trigger": trigger, "action": ["type": "css-display-none", "selector": cleanSelectors.joined(separator: ",")]])
        }
        entries += strict.sorted().map { block($0, thirdPartyOnly: false, respectPaused: false) }
        // Path-scoped exceptions run last and undo earlier matches. The
        // pattern anchors the host, then requires the path later in the URL.
        for (hostPattern, path) in pathExceptions {
            let pattern = "^https?://([^/]+\\.)?" + hostPattern + "[/:?#].*" + NSRegularExpression.escapedPattern(for: path)
            var trigger: [String: Any] = ["url-filter": pattern]
            if !exempt.isEmpty { trigger["unless-top-url"] = exempt }
            entries.append(["trigger": trigger, "action": ["type": "ignore-previous-rules"]])
        }
        guard !entries.isEmpty else { return nil }
        let data = try JSONSerialization.data(withJSONObject: entries)
        let identifier = "VaayvuAdBlock-" + UUID().uuidString
        let store = WKContentRuleListStore.default()!
        guard let rule = try await store.compileContentRuleList(forIdentifier: identifier, encodedContentRuleList: String(decoding: data, as: UTF8.self)) else { throw CocoaError(.coderInvalidValue) }
        // The controller retains the compiled object until the user changes the policy.
        try? await store.removeContentRuleList(forIdentifier: identifier)
        return rule
    }

    static func prepare() async {
        if rules != nil { return }
        if let loading { rules = await loading.value; return }
        let task = Task { () -> WKContentRuleList? in
            guard let url = Bundle.main.url(forResource: "tracking", withExtension: "json", subdirectory: "chrome"),
                  let data = try? Data(contentsOf: url),
                  let hosts = try? JSONDecoder().decode([String].self, from: data).map({ $0.lowercased() }),
                  !hosts.isEmpty, hosts.allSatisfy(validDomain) else { return nil }
            if let store = WKContentRuleListStore.default() {
                // Best effort: drop the pre-0.0.15 compiled list after upgrading.
                try? await store.removeContentRuleList(forIdentifier: "VaayvuTracking")
            }
            return try? await compile(hosts, identifier: "VaayvuTracking")
        }
        loading = task
        rules = await task.value
        loading = nil
    }
}

@MainActor
final class ProfileProtection {
    private static let profiles = NSMapTable<NSString, ProfileProtection>.strongToWeakObjects()
    static func shared(for profile: String) -> ProfileProtection {
        if let existing = profiles.object(forKey: profile as NSString) { return existing }
        let policy = ProfileProtection()
        profiles.setObject(policy, forKey: profile as NSString)
        return policy
    }

    private let controllers = NSHashTable<WKUserContentController>.weakObjects()
    private(set) var enabled = true
    private(set) var domains: [String] = []
    private(set) var customRules: WKContentRuleList?
    private var revision = 0

    func attach(_ controller: WKUserContentController) {
        controllers.add(controller)
        if enabled {
            if let rules = TrackingProtection.rules { controller.add(rules) }
            if let customRules { controller.add(customRules) }
        }
    }

    func configure(enabled: Bool, domains: [String]?, onError: ((Error) -> Void)? = nil) -> Bool {
        if let domains, domains.count > 128 || !domains.allSatisfy(TrackingProtection.validDomain) { return false }
        if self.enabled != enabled {
            self.enabled = enabled
            for controller in controllers.allObjects {
                for rule in [TrackingProtection.rules, customRules].compactMap({ $0 }) {
                    if enabled { controller.add(rule) } else { controller.remove(rule) }
                }
            }
        }
        guard let domains else { return true }
        let next = Set(domains).sorted()
        guard next != self.domains else { return true }
        self.domains = next
        revision &+= 1
        if next.isEmpty { replaceCustomRules(nil); return true }
        let generation = revision
        let identifier = "VaayvuCustom-" + UUID().uuidString
        Task { [weak self] in
            do {
                let rule = try await TrackingProtection.compile(next, identifier: identifier)
                if let self, self.revision == generation { self.replaceCustomRules(rule) }
                // Attached lists retain their compiled data. Each compilation has an independent disk entry.
                try? await WKContentRuleListStore.default().removeContentRuleList(forIdentifier: identifier)
            } catch {
                if let self, self.revision == generation {
                    self.domains = []
                    self.replaceCustomRules(nil)
                    onError?(error)
                }
            }
        }
        return true
    }

    private func replaceCustomRules(_ rules: WKContentRuleList?) {
        if enabled {
            for controller in controllers.allObjects {
                if let customRules { controller.remove(customRules) }
                if let rules { controller.add(rules) }
            }
        }
        customRules = rules
    }
}

extension BrowserHost {
    func clearSiteData() {
        guard safeToClear else { notice("This system cannot clear website data separately from your browser profile."); return }
        let stores = isPrivateWindow ? [privateStore].compactMap { $0 } : [siteStore, privateStore].compactMap { $0 }
        Task {
            let types = WKWebsiteDataStore.allWebsiteDataTypes()
            for store in stores {
                if profileID == "default", !isPrivateWindow, store === siteStore {
                    // Older profiles kept their trusted file-origin preferences in this store.
                    let trusted = await chromeStore.dataRecords(ofTypes: [WKWebsiteDataTypeLocalStorage])
                    guard !trusted.isEmpty else { notice("Your browser profile is still loading. Try clearing site data again."); return }
                    let names = Set(trusted.map(\.displayName))
                    let records = await store.dataRecords(ofTypes: types).filter { !names.contains($0.displayName) }
                    await store.removeData(ofTypes: types, for: records)
                } else {
                    await store.removeData(ofTypes: types, modifiedSince: .distantPast)
                }
            }
            notice("Website cookies and site data cleared.")
        }
    }
}

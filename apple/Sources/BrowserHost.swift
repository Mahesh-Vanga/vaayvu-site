import WebKit
import UniformTypeIdentifiers
import UIKit

enum WebAddress {
    static func accepts(_ url: URL) -> Bool {
        ["https", "http"].contains(url.scheme?.lowercased() ?? "") && !(url.host ?? "").isEmpty
            && url.user == nil && url.password == nil && url.absoluteString.utf8.count <= 8192
    }

    static func parse(_ input: Any?) -> URL? {
        guard let string = input as? String, let url = URL(string: string), accepts(url) else { return nil }
        return url
    }
}

final class BrowserTab {
    let web: WKWebView
    let isPrivate: Bool
    var observers: [NSKeyValueObservation] = []
    var updatePending = false
    var failure: (url: URL, message: String)?
    var pendingURL: URL?
    var isPopup = false
    var desktopSite = false
    var previewRevision = 0

    init(web: WKWebView, isPrivate: Bool) {
        self.web = web
        self.isPrivate = isPrivate
    }
}

@MainActor
final class BrowserHost: UIViewController, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate {
    var windowID = "main"
    var profileID = "default"
    var profileName = "Personal"
    var isGuestWindow = false
    private var closed = false
    func storageID(_ nativeID: String) -> String { nativeID == profileID ? "main" : nativeID }
    var isPrivateWindow = false
    var regularWindowIDs = ["main"]
    lazy var protection = isPrivateWindow ? ProfileProtection() : ProfileProtection.shared(for: profileID)
    var safeToClear = false
    var canClearLegacyRecords: Bool {
        if #available(iOS 17, *) {
            return !isPrivateWindow && profileID == "default" && safeToClear && chromeStore.identifier == ChromeStorage.identifier
        }
        return false
    }
    var exportedFile: URL?
    private(set) var chrome: WKWebView!
    var visiblePage: WKWebView? {
        guard showsPage, let active else { return nil }
        return tabs[active]?.web
    }
    private(set) var tabs: [String: BrowserTab] = [:]
    private(set) var websiteAccess = false
    private var accessConfigured = false
    private var chromeNetworkBlock: WKContentRuleList?
    var indiaSearch = IndiaSearch()
    private var searchJobs: [String: (tab: String, task: Task<Void, Never>)] = [:]
    var pendingDownloads: [ObjectIdentifier: WKDownload] = [:]
    var privateStore: WKWebsiteDataStore?
    lazy var siteStore: WKWebsiteDataStore = .default()
    lazy var chromeStore: WKWebsiteDataStore = {
        if isPrivateWindow { return .nonPersistent() }
        if #available(iOS 17, *) { return WKWebsiteDataStore(forIdentifier: ChromeStorage.identifier) }
        return .default()
    }()
    private(set) var active: String?
    var previewSequence = 0
    weak var capturingPreview: WKWebView?
    private(set) weak var overviewSnapshot: WKWebView?
    private var snapshotTicket = 0
    weak var profileScene: SceneDelegate?
    lazy var phone = PhoneBrowserActions(host: self)
    var lightSystemContent = false
    override var preferredStatusBarStyle: UIStatusBarStyle { lightSystemContent ? .lightContent : .darkContent }
    private var viewport: CGRect = .zero
    private var splitRects: [String: CGRect] = [:]
    private var showsPage = false
    private var isReady = false
    private var queuedURLs: [URL] = []
    var downloads: [ObjectIdentifier: DownloadEntry] = [:]
    private var adBlockRules: WKContentRuleList?
    private var privateAdBlockRules: WKContentRuleList?
    private var adBlockCompilation: Task<Void, Never>?
    // Controllers created while a policy compilation is still in flight; they
    // receive the compiled rules as soon as it lands.
    private let pendingAdBlockControllers = NSHashTable<WKUserContentController>.weakObjects()
    private var strictAdDomains: Set<String> = []
    private var vfdAdHosts: Set<String> = []
    private var pausedAdSites: Set<String> = []
    private var vfdCosmeticCSS: String = ""
    private var adBlockEnabled = true
    private let index = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "chrome")!

    override func loadView() {
        view = UIView(frame: .zero)
        Task { [weak self] in
            guard let self else { return }
            await TrackingProtection.prepare()
            guard let strict = await ChromeNetworkPolicy.strict.value else {
                if !self.closed {
                    let offline = WKWebView(frame: self.view.bounds)
                    self.view.addSubview(offline)
                    offline.loadHTMLString("<meta name='viewport' content='width=device-width'><p>Network privacy controls could not start. Close and reopen the browser to try again.</p>", baseURL: nil)
                }
                return
            }
            self.chromeNetworkBlock = strict
            if self.isPrivateWindow || self.profileID != "default" {
                self.safeToClear = true
            } else if #available(iOS 17, *) {
                self.safeToClear = await ChromeStorage.migrate(index: self.index, into: self.chromeStore)
                if !self.safeToClear { self.chromeStore = .default() }
            }
            if !self.closed { self.installChrome() }
        }
    }

    private func installChrome() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = chromeStore
        if let chromeNetworkBlock { config.userContentController.add(chromeNetworkBlock) }
        if #available(iOS 18, *) { config.writingToolsBehavior = .none }
        let context: [String: Any] = ["id": storageID(windowID), "private": isPrivateWindow, "regularWindowIds": regularWindowIDs,
                                       "profileId": profileID, "profileName": profileName, "guest": isGuestWindow]
        if let json = try? JSONSerialization.data(withJSONObject: context), let text = String(data: json, encoding: .utf8) {
            config.userContentController.addUserScript(WKUserScript(source: "window.vaayvuWindow=Object.freeze(" + text + ")", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        config.userContentController.add(self, name: "vaayvu")
        chrome = WKWebView(frame: .zero, configuration: config)
        chrome.navigationDelegate = self
        chrome.allowsLinkPreview = false
        chrome.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(chrome)
        view.backgroundColor = .systemBackground
        chrome.scrollView.contentInsetAdjustmentBehavior = .never
        chrome.scrollView.bounces = false
        let guide = view.safeAreaLayoutGuide
        let bottom = chrome.bottomAnchor.constraint(equalTo: guide.bottomAnchor)
        bottom.priority = .defaultHigh
        chrome.bottomAnchor.constraint(lessThanOrEqualTo: guide.bottomAnchor).isActive = true
        chrome.bottomAnchor.constraint(lessThanOrEqualTo: view.keyboardLayoutGuide.topAnchor).isActive = true
        NSLayoutConstraint.activate([
            chrome.topAnchor.constraint(equalTo: guide.topAnchor), bottom,
            chrome.leadingAnchor.constraint(equalTo: guide.leadingAnchor), chrome.trailingAnchor.constraint(equalTo: guide.trailingAnchor)
        ])
        chrome.loadFileURL(index, allowingReadAccessTo: index.deletingLastPathComponent())
    }

    func dismissWindow() {
        closed = true
        cancelSearch()
        cancelDownloads()
        chrome?.configuration.userContentController.removeScriptMessageHandler(forName: "vaayvu")
        chrome?.stopLoading()
        discardNativeTabs()
        chrome?.navigationDelegate = nil
        chrome?.uiDelegate = nil
        chrome?.removeFromSuperview()
        chrome = nil
    }

    private func discardNativeTabs() {
        let oldTabs = Array(tabs.values)
        tabs.removeAll()
        active = nil
        showsPage = false
        viewport = .zero
        previewSequence &+= 1
        capturingPreview = nil
        overviewSnapshot = nil
        phone.reset()
        for tab in oldTabs {
            tab.observers.removeAll()
            tab.web.navigationDelegate = nil
            tab.web.uiDelegate = nil
            tab.web.stopLoading()
            tab.web.removeFromSuperview()
            tab.web.loadHTMLString("", baseURL: nil)
        }
        privateStore = nil
    }

    override func didReceiveMemoryWarning() {
        super.didReceiveMemoryWarning()
        phone.discardPreviews()
        let types: Set<String> = [WKWebsiteDataTypeMemoryCache, WKWebsiteDataTypeDiskCache]
        siteStore.removeData(ofTypes: types, modifiedSince: .distantPast) { }
        chromeStore.removeData(ofTypes: types, modifiedSince: .distantPast) { }
        privateStore?.removeData(ofTypes: types, modifiedSince: .distantPast) { }
    }

    override var keyCommands: [UIKeyCommand]? {
        var bindings: [(String, String, String, UIKeyModifierFlags)] = [
            ("New Tab", "newTab", "t", .command), ("New Private Tab", "privateTab", "n", [.command, .shift]),
            ("Close Tab", "closeTab", "w", .command), ("Reopen Closed Tab", "reopenTab", "t", [.command, .shift]),
            ("Open Location", "focusAddress", "l", .command), ("Find in Page", "find", "f", .command),
            ("Reload", "reload", "r", .command), ("Bookmark This Page", "bookmark", "d", .command),
            ("Back", "back", "[", .command), ("Forward", "forward", "]", .command),
            ("Next Tab", "nextTab", "\t", .control), ("Previous Tab", "previousTab", "\t", [.control, .shift])
        ]
        for number in 1...9 {
            bindings.append((number == 9 ? "Last Tab" : "Select Tab " + String(number), "selectTab" + String(number), String(number), .command))
        }
        return bindings.map { title, action, key, modifiers in
            let binding = UIKeyCommand(title: title, action: #selector(runKeyCommand(_:)), input: key,
                                       modifierFlags: modifiers, propertyList: action)
            binding.wantsPriorityOverSystemBehavior = true
            return binding
        }
    }

    @objc private func runKeyCommand(_ sender: UIKeyCommand) {
        if let name = sender.propertyList as? String { command(name) }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        layoutPage()
    }

    func openWhenReady(_ url: URL) {
        guard isReady && accessConfigured else { queuedURLs.append(url); return }
        guard websiteAccess else { notice("Website access is off."); return }
        emit(["type": "newtab", "url": url.absoluteString, "private": isPrivateWindow, "background": false])
    }

    private func updateWebsiteAccess(_ enabled: Bool) {
        accessConfigured = true
        let changed = websiteAccess != enabled
        if changed, let chrome, let rule = chromeNetworkBlock {
            if enabled { chrome.configuration.userContentController.remove(rule) }
            else { chrome.configuration.userContentController.add(rule) }
        }
        websiteAccess = enabled
        if !enabled || (changed && !tabs.isEmpty) {
            let mounted = Array(tabs.keys)
            cancelDownloads()
            discardNativeTabs()
            if !mounted.isEmpty { emit(["type": "resetWebTabs", "ids": mounted]) }
        }
        if isReady {
            let pending = queuedURLs
            queuedURLs.removeAll()
            for url in pending { openWhenReady(url) }
        }
    }

    private func cancelDownloads() {
        for download in pendingDownloads.values { download.cancel { _ in } }
        pendingDownloads.removeAll()
        downloads.removeAll()
    }

    private func cancelSearch(tab: String? = nil) {
        for (key, job) in searchJobs where tab == nil || tab == job.tab {
            job.task.cancel()
            searchJobs.removeValue(forKey: key)
        }
    }

    private func performIndiaSearch(_ message: [String: Any]) {
        guard let token = message["requestId"] as? String, !token.isEmpty, token.utf8.count <= 128,
              let id = message["id"] as? String, !id.isEmpty, id.utf8.count <= 128 else { return }
        cancelSearch(tab: id)
        guard searchJobs[token] == nil, searchJobs.count < 8 else {
            emit(["type":"indiaSearchResult", "id":id, "requestId":token, "error":"failed"])
            return
        }
        guard let q = message["q"] as? String else {
            emit(["type":"indiaSearchResult", "id":id, "requestId":token, "error":"invalid"])
            return
        }
        let transport = indiaSearch
        let work = Task { [weak self] in
            var event: [String: Any] = ["type":"indiaSearchResult", "id":id, "requestId":token]
            do {
                let hits = try await transport.search(q)
                event["results"] = hits.map { ["title": $0.title, "url": $0.url, "snippet": $0.snippet] }
            } catch IndiaSearch.Failure.unavailable { event["error"] = "unavailable" }
              catch IndiaSearch.Failure.invalid { event["error"] = "invalid" }
              catch { event["error"] = "failed" }
            guard let self, !Task.isCancelled, self.searchJobs[token]?.tab == id else { return }
            self.searchJobs.removeValue(forKey: token)
            self.emit(event)
        }
        searchJobs[token] = (id, work)
    }

    func command(_ name: String) {
        if ["focusAddress", "newTab", "privateTab", "find", "manageTabs", "tabSearch"].contains(name) {
            chrome.becomeFirstResponder()
        }
        emit(["type": "command", "command": name])
    }

    func emit(_ value: [String: Any]) {
        chrome?.callAsyncJavaScript("window.vaayvuEvent?.(event)", arguments: ["event": value], in: nil,
                                    in: .page, completionHandler: nil)
    }

    func notice(_ message: String) { emit(["type": "notice", "message": message]) }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.webView === chrome, message.frameInfo.isMainFrame,
              message.frameInfo.request.url?.standardizedFileURL == index.standardizedFileURL,
              let payload = message.body as? [String: Any] else { return }
        handle(payload)
    }

    func handle(_ data: [String: Any]) {
        guard let type = data["type"] as? String else { return }
        switch type {
        case "ready":
            isReady = true
            var ready = capabilities
            ready["type"] = "ready"
            ready["platform"] = "ios"
            emit(ready)
            phone.accessibilityChanged()
            profileScene?.sendProfiles(to: self)
            if accessConfigured { updateWebsiteAccess(websiteAccess) }
        case "websiteAccess":
            if let enabled = data["enabled"] as? Bool { updateWebsiteAccess(enabled) }
        case "requestDefaultBrowser":
            // iOS has no API to become default directly; deep-link to this
            // app's Settings pane where the system default-browser picker lives.
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url, options: [:], completionHandler: nil)
            }
        case "indiaSearch": performIndiaSearch(data)
        case "cancelIndiaSearch":
            if let token = data["requestId"] as? String { searchJobs.removeValue(forKey: token)?.task.cancel() }
        case "profiles": profileScene?.sendProfiles(to: self)
        case "newProfile":
            if let name = data["name"] as? String { profileScene?.createProfile(named: name, from: self) }
        case "switchProfile":
            if !isPrivateWindow, profileScene?.window?.rootViewController === self, let id = data["id"] as? String {
                profileScene?.host(for: id)
            }
        case "tabPreviews": phone.requestPreviews(data)
        case "readAloud": phone.readAloud(data)
        case "stopReading": if let id = data["id"] as? String { phone.stopReading(id: id) }
        case "pageDisplay": phone.changeDisplay(data)
        case "pageReminder": phone.remind(data)
        case "requestNotifications": phone.requestNotifications()
        case "mobileAppearance": phone.appearance(data)
        case "viewport":
            guard let x = data["x"] as? CGFloat, let y = data["y"] as? CGFloat,
                  let width = data["width"] as? CGFloat, let height = data["height"] as? CGFloat,
                  [x, y, width, height].allSatisfy({ $0.isFinite }) else { return }
            splitRects = [:]
            viewport = CGRect(x: x, y: y, width: max(0, width), height: max(0, height))
            if showsPage, data["visible"] as? Bool != true, let active { phone.capture(active) }
            showsPage = data["visible"] as? Bool == true
            layoutPage()
        case "panes":
            guard let raw = data["panes"] as? [[String: Any]] else {
                splitRects = [:]
                layoutPage()
                return
            }
            var rects: [String: CGRect] = [:]
            for pane in raw.prefix(2) {
                guard let id = pane["id"] as? String, tabs[id] != nil,
                      let x = pane["x"] as? CGFloat, let y = pane["y"] as? CGFloat,
                      let width = pane["width"] as? CGFloat, let height = pane["height"] as? CGFloat,
                      [x, y, width, height].allSatisfy({ $0.isFinite }) else { continue }
                rects[id] = CGRect(x: x, y: y, width: max(0, width), height: max(0, height))
            }
            splitRects = rects
            showsPage = data["visible"] as? Bool == true
            for id in rects.keys {
                if let tab = tabs[id], tab.web.superview == nil { view.addSubview(tab.web) }
            }
            layoutPage()
        case "protection":
            guard let enabled = data["enabled"] as? Bool else { return }
            if let raw = data["domains"], !(raw is [String]) { notice("Invalid custom domain list."); return }
            if !protection.configure(enabled: enabled, domains: data["domains"] as? [String], onError: { [weak self] error in
                self?.notice("Could not apply custom domains. " + error.localizedDescription)
            }) {
                notice("Use up to 128 lowercase DNS domain names.")
            }
        case "blocklist":
            guard let enabled = data["enabled"] as? Bool else { return }
            func hostSet(_ key: String) -> Set<String> {
                guard let list = data[key] as? [String], list.count <= 30000 else { return [] }
                return Set(list.compactMap { $0.lowercased() }.filter { $0.count >= 3 && $0.count <= 253 && !$0.contains(" ") })
            }
            func tokenList(_ key: String) -> [String] {
                guard let list = data[key] as? [String] else { return [] }
                let lowered: [String] = list.map { $0.lowercased() }
                let kept = lowered.filter { $0.count >= 2 && $0.count <= 64 }
                return Array(kept.prefix(512))
            }
            let strict = hostSet("strict")
            let pausedRaw: [String] = (data["pausedSites"] as? [String] ?? []).filter { TrackingProtection.validDomain($0) }
            let paused = Array(pausedRaw.prefix(256))
            var exceptions: [(hosts: [String], paths: [String])] = []
            if let raw = data["exceptions"] as? [[String: Any]] {
                for entry in raw.prefix(64) {
                    let hosts = (entry["hosts"] as? [String] ?? []).filter { TrackingProtection.validDomain($0) }
                    let paths = (entry["paths"] as? [String] ?? []).filter { !$0.isEmpty && $0.count <= 128 }
                    if !hosts.isEmpty || !paths.isEmpty { exceptions.append((hosts.map { $0.lowercased() }, paths.map { $0.lowercased() })) }
                }
            }
            configureAdBlock(enabled: enabled,
                             ads: hostSet("hostsAds"), trackers: hostSet("hostsTrackers"), social: hostSet("hostsSocial"),
                             strict: strict, patterns: tokenList("patterns"), trackerPatterns: tokenList("trackerPatterns"),
                             firstPartyPatterns: tokenList("firstPartyPatterns"), aggressive: (data["lists"] as? [String: Bool])?["aggressive"] == true,
                             selectors: Array((data["selectors"] as? [String] ?? []).filter { !$0.isEmpty && $0.count <= 256 && !$0.contains(":has(") }.prefix(256)),
                             exceptions: exceptions, pausedSites: Array(paused),
                             reloadActive: data["reloadActive"] as? Bool == true)
      case "adBlock":
            guard let id = data["id"] as? String, tabs[id] != nil else { return }
            // The UI is authoritative for the on/off state; the compiled rules
            // arrive separately via "blocklist" updates.
            if let enabled = data["enabled"] as? Bool {
                guard adBlockEnabled != enabled else {
                    emit(["type": "adBlock", "id": id, "enabled": adBlockEnabled])
                    return
                }
                adBlockEnabled = enabled
            } else {
                adBlockEnabled.toggle()
            }
            for tab in tabs.values {
                let controller = tab.web.configuration.userContentController
                if let rules = tab.isPrivate ? privateAdBlockRules : adBlockRules {
                    if adBlockEnabled { controller.add(rules) } else { controller.remove(rules) }
                }
                if !adBlockEnabled, let trackingRules = TrackingProtection.rules {
                    controller.remove(trackingRules)
                }
                syncTabAdScripts(tab)
                applyAdShield(to: tab)
            }
            emit(["type": "adBlock", "id": id, "enabled": adBlockEnabled])
        case "haptic":
            switch data["style"] as? String {
            case "selection": UISelectionFeedbackGenerator().selectionChanged()
            case "medium": UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            case "heavy": UIImpactFeedbackGenerator(style: .heavy).impactOccurred()
            default: UIImpactFeedbackGenerator(style: .light).impactOccurred()
            }
        case "clearLegacyRecords":
            let history = data["history"] as? Bool == true
            let downloads = data["downloads"] as? Bool == true
            guard history || downloads else { return }
            let request = String((data["requestId"] as? String ?? "").prefix(128))
            Task {
                var success = true
                if canClearLegacyRecords {
                    do { try await ChromeStorage.clearRecords(index: index, in: .default(), history: history, downloads: downloads) }
                    catch { success = false; notice("Could not clear the previous version’s browser records. Try again.") }
                }
                emit(["type": "legacyRecordsCleared", "history": history, "downloads": downloads, "success": success, "requestId": request])
            }
        case "clearSiteData": clearSiteData()
        case "clearCookies":
            Task {
                let types: Set<String> = [WKWebsiteDataTypeCookies]
                let store = isPrivateWindow ? privateStore : siteStore
                if let store {
                    await store.removeData(ofTypes: types, modifiedSince: .distantPast)
                }
                notice("Cookies cleared.")
            }
        case "importBookmarks": importBookmarks()
        case "exportBookmarks":
            guard websiteAccess else { notice("Enable ordinary websites to export through a file provider."); return }
            if let text = data["text"] as? String, text.utf8.count <= 2 * 1024 * 1024 {
                saveDocument(Data(text.utf8), filename: browserName + " Bookmarks.html", type: .html)
            } else { notice("Bookmarks exceed the 2 MB export limit.") }
        case "copy":
            guard let text = data["text"] as? String else { return }
            UIPasteboard.general.setItems([[UTType.utf8PlainText.identifier: text]], options: [.localOnly: !websiteAccess])
        case "external":
            guard websiteAccess, let url = WebAddress.parse(data["url"]) else { return }
            UIApplication.shared.open(url)
        default:
            guard let id = data["id"] as? String, !id.isEmpty else { return }
            switch type {
            case "open":
                let url = WebAddress.parse(data["url"])
                guard websiteAccess || (accessConfigured && data["userApprovedVisit"] as? Bool == true
                    && data["background"] as? Bool != true && url != nil) else { return }
                if tabs[id] == nil {
                    let tab = createTab(id: id, isPrivate: isPrivateWindow || data["private"] as? Bool == true)
                    tab.desktopSite = data["desktopSite"] as? Bool == true
                    if let url { tab.web.load(URLRequest(url: url)) }
                }
                if data["background"] as? Bool != true { select(id) }
            case "select": select(id)
            case "close":
                cancelSearch(tab: id)
                phone.forget(id)
                if let tab = tabs.removeValue(forKey: id) {
                    tab.observers.removeAll()
                    tab.web.navigationDelegate = nil
                    tab.web.uiDelegate = nil
                    tab.web.stopLoading()
                    tab.web.removeFromSuperview()
                    tab.web.loadHTMLString("", baseURL: nil)
                }
                if active == id { active = nil }
                if !tabs.values.contains(where: { $0.isPrivate }) { privateStore = nil }
            default:
                guard let tab = tabs[id], websiteAccess || ["navigate", "back", "forward", "reload", "stop", "find", "zoom"].contains(type) else { return }
                let web = tab.web
                switch type {
                case "navigate":
                    if let url = WebAddress.parse(data["url"]) {
                        tab.failure = nil
                        web.load(URLRequest(url: url))
                    }
                case "back":
                    if tab.failure != nil, web.url != nil { tab.failure = nil; schedulePageEvent(for: id) }
                    else if web.canGoBack { web.goBack() }
                case "forward": if web.canGoForward { web.goForward() }
                case "reload":
                    if let failed = tab.failure { tab.failure = nil; web.load(URLRequest(url: failed.url)) }
                    else { web.reload() }
                case "stop": web.stopLoading()
                case "find":
                    let options = WKFindConfiguration()
                    options.backwards = data["backwards"] as? Bool == true
                    let query = data["query"] as? String ?? ""
                    web.find(query, configuration: options) { [weak self] result in
                        if !query.isEmpty && !result.matchFound { self?.notice("No matches on this page.") }
                    }
                case "extract":
                    guard active == id, let url = web.url, WebAddress.accepts(url),
                          let scriptURL = Bundle.main.url(forResource: "extract", withExtension: "js", subdirectory: "chrome"),
                          let script = try? String(contentsOf: scriptURL, encoding: .utf8) else { return }
                    web.evaluateJavaScript(script, in: nil, in: .defaultClient) { [weak self, weak web] result in
                        guard let self, let web, self.active == id, self.tabs[id]?.web === web, web.url == url else { return }
                        if case let .success(value) = result, let text = value as? String {
                            self.emit(["type": "text", "id": id, "url": url.absoluteString,
                                       "title": web.title ?? "", "text": String(text.prefix(18_000))])
                        } else { self.notice("This page could not be read.") }
                    }
                case "menuPreview":
                    if id == active, !tab.isPrivate, !isPrivateWindow, let request = data["requestId"],
                       request is NSNumber || ((request as? String)?.count ?? 129) <= 128 {
                        previewMenu(web, id: id, request: request)
                    }
                case "userStyles":
                    guard !isPrivateWindow, !tab.isPrivate, let expected = WebAddress.parse(data["url"]),
                          web.url?.absoluteString == expected.absoluteString, let css = data["css"] as? String,
                          css.utf8.count <= 128 * 1024, css.isEmpty || expected.scheme?.lowercased() == "https" else { return }
                    applyUserStyle(css, to: web, url: expected)
                case "desktopSite":
                    guard let enabled = data["enabled"] as? Bool, tab.desktopSite != enabled else { return }
                    tab.desktopSite = enabled
                    if let url = web.url, WebAddress.accepts(url) { web.reload() }
                case "editPage":
                    if id == active, let action = data["action"] as? String { editPage(web, action: action) }
                case "inspection":
                    if #available(iOS 16.4, *), id == active, !isPrivateWindow, !isGuestWindow,
                       !tab.isPrivate, let url = web.url, WebAddress.accepts(url), let enabled = data["enabled"] as? Bool {
                        web.isInspectable = enabled
                        notice(enabled ? "Inspection enabled for this tab in Safari’s Develop menu." : "Inspection disabled.")
                    }
                case "zoom":
                    if let percent = (data["percent"] as? NSNumber)?.doubleValue, percent.isFinite { web.pageZoom = max(0.25, min(5, percent / 100)) }
                case "print": if id == active { printPage(web) }
                case "savePDF", "savePage", "capture", "shortcut": if id == active { exportPage(web, action: type) }
                case "share":
                    if let url = web.url, WebAddress.accepts(url) { share(url) }
                default: break
                }
            }
        }
    }

    @discardableResult
    private func createTab(id: String, isPrivate: Bool, related: WKWebViewConfiguration? = nil) -> BrowserTab {
        let configuration = related ?? WKWebViewConfiguration()
        if related == nil {
            if !websiteAccess {
                // An explicitly opened site gets temporary storage for this visit only.
                configuration.websiteDataStore = .nonPersistent()
            } else if isPrivate {
                let store = privateStore ?? WKWebsiteDataStore.nonPersistent()
                privateStore = store
                configuration.websiteDataStore = store
            } else { configuration.websiteDataStore = siteStore }
        }
        // Popups share their opener's site session, while content rules belong to each tab's controller.
        configuration.userContentController = WKUserContentController()
        if adBlockEnabled {
            configuration.userContentController.addUserScript(WKUserScript(
                source: Self.youtubeDocumentStartShield,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: false
            ))
        }
        protection.attach(configuration.userContentController)
        if adBlockEnabled, let rules = isPrivate ? privateAdBlockRules : adBlockRules {
            configuration.userContentController.add(rules)
        } else if adBlockEnabled, adBlockCompilation != nil {
            // The compiled list may still be assembling (first launch or a
            // fresh policy); the pending compilation attaches it when ready.
            pendingAdBlockControllers.add(configuration.userContentController)
        }
        configuration.allowsInlineMediaPlayback = true
        configuration.allowsAirPlayForMediaPlayback = true
        let web = WKWebView(frame: .zero, configuration: configuration)
        web.allowsBackForwardNavigationGestures = true
        web.navigationDelegate = self
        web.uiDelegate = self
        let tab = BrowserTab(web: web, isPrivate: isPrivate)
        tabs[id] = tab
        web.scrollView.panGestureRecognizer.addTarget(phone, action: #selector(PhoneBrowserActions.panned(_:)))
        func watch<T>(_ key: KeyPath<WKWebView, T>) -> NSKeyValueObservation {
            web.observe(key, options: [.new]) { [weak self] _, _ in
                DispatchQueue.main.async { self?.schedulePageEvent(for: id) }
            }
        }
        tab.observers = [watch(\.url), watch(\.title), watch(\.isLoading), watch(\.canGoBack),
                         watch(\.canGoForward), watch(\.estimatedProgress)]
        return tab
    }

    private func schedulePageEvent(for id: String) {
        guard let tab = tabs[id], !tab.updatePending else { return }
        tab.updatePending = true
        DispatchQueue.main.async { [weak self, weak tab] in
            guard let self, let tab, self.tabs[id] === tab else { return }
            tab.updatePending = false
            let web = tab.web
            let failed = tab.failure
            self.emit(["type": "page", "id": id, "url": (failed?.url ?? web.url)?.absoluteString ?? "",
                       "title": failed != nil ? "Page couldn’t load" : (web.title ?? ""), "loading": failed == nil && web.isLoading,
                       "canBack": web.canGoBack || (failed != nil && web.url != nil), "canForward": web.canGoForward,
                       "blank": failed == nil && web.url?.absoluteString == "about:blank", "progress": web.estimatedProgress, "failed": failed != nil, "error": failed?.message ?? ""])
        }
    }

    private func select(_ id: String) {
        if let active, active != id {
            phone.capture(active)
            phone.stopReading(id: active)
            phone.resetScroll()
            tabs[active]?.web.removeFromSuperview()
        }
        active = id
        guard let tab = tabs[id] else { return }
        if tab.web.superview == nil { view.addSubview(tab.web) }
        layoutPage()
        if !tab.isPrivate { phone.captureWhenSettled(id) }
        schedulePageEvent(for: id)
    }

    // A restored page can finish loading after the user has already opened the overview.
    // Keep the live page below the opaque browser UI while WebKit draws its first thumbnail.
    func prepareOverviewSnapshot(_ web: WKWebView, id: String) -> Int? {
        guard !showsPage, active == id, let tab = tabs[id], !isPrivateWindow, !tab.isPrivate, tab.web === web,
              web.superview === view, web.isHidden, let chrome, chrome.isOpaque else { return nil }
        let frame = viewport.intersection(chrome.bounds)
        if !frame.isNull && !frame.isEmpty { web.frame = chrome.convert(frame, to: view) }
        guard web.bounds.width > 4, web.bounds.height > 4 else { return nil }
        snapshotTicket &+= 1
        overviewSnapshot = web
        view.insertSubview(web, belowSubview: chrome)
        web.isUserInteractionEnabled = false
        web.isHidden = false
        return snapshotTicket
    }

    func finishOverviewSnapshot(_ web: WKWebView, ticket: Int) {
        guard overviewSnapshot === web, snapshotTicket == ticket else { return }
        overviewSnapshot = nil
        guard web.superview === view, let active, tabs[active]?.web === web else { return }
        web.isHidden = true
        view.bringSubviewToFront(web)
        layoutPage()
    }

    func layoutPage() {
        guard let chrome else { return }
        if splitRects.count == 2, let active {
            for (id, raw) in splitRects {
                guard let tab = tabs[id] else { continue }
                layout(tab, id: id, raw: raw, focused: id == active, chrome: chrome)
            }
            return
        }
        guard let active, let tab = tabs[active] else { return }
        layout(tab, id: active, raw: viewport, focused: true, chrome: chrome)
    }

    private func layout(_ tab: BrowserTab, id: String, raw: CGRect, focused: Bool, chrome: WKWebView) {
        var frame = raw
        frame = frame.intersection(chrome.bounds)
        let hidden = !showsPage || frame.isNull || frame.isEmpty
        tab.web.isUserInteractionEnabled = !hidden && focused
        // Keep WebKit's rendering surface alive until the menu's preview is captured.
        if hidden, capturingPreview === tab.web || overviewSnapshot === tab.web { return }
        if !hidden, overviewSnapshot === tab.web {
            overviewSnapshot = nil
            view.bringSubviewToFront(tab.web)
        }
        tab.web.isHidden = hidden
        if !tab.web.isHidden {
            tab.web.frame = chrome.convert(frame, to: view)
        }
    }

    private func share(_ url: URL) {
        let picker = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        picker.popoverPresentationController?.sourceView = view
        picker.popoverPresentationController?.sourceRect = CGRect(x: view.bounds.midX, y: 8, width: 1, height: 1)
        presentBrowserSheet(picker)
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if webView !== chrome, let pending = adBlockCompilation {
            Task {
                await pending.value
                self.webView(webView, decidePolicyFor: action, decisionHandler: decisionHandler)
            }
            return
        }
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if webView === chrome {
            decisionHandler(url.standardizedFileURL == index.standardizedFileURL && action.targetFrame?.isMainFrame == true ? .allow : .cancel)
        } else if tab(for: webView) == nil || (!websiteAccess && (action.targetFrame == nil || action.shouldPerformDownload)) {
            decisionHandler(.cancel)
        } else if action.targetFrame?.isMainFrame == true, adBlockEnabled, let hostname = url.host?.lowercased(),
                  let (id, tab) = tab(for: webView), strictAdDomains.contains(where: { hostname == $0 || hostname.hasSuffix("." + $0) }) {
            tab.failure = (url, "Blocked by " + browserName + "’s ad blocker.")
            schedulePageEvent(for: id)
            decisionHandler(.cancel)
        } else if WebAddress.accepts(url) || (url.absoluteString == "about:blank" && (action.targetFrame?.isMainFrame != true || webView.url == nil || webView.url?.absoluteString == "about:blank")) {
            if !action.shouldPerformDownload, action.targetFrame != nil,
               let background = Self.openLinkInBackground(action), let (_, opener) = tab(for: webView) {
                decisionHandler(.cancel)
                guard websiteAccess else { return }
                let target = announceTab(opener: opener, url: url, background: background)
                target.web.load(action.request)
                return
            }
            if action.targetFrame?.isMainFrame == true, let (_, tab) = tab(for: webView), WebAddress.accepts(url) {
                tab.pendingURL = url
                syncTabAdScripts(tab, targetHost: url.host?.lowercased())
            }
            decisionHandler(action.shouldPerformDownload ? .download : .allow)
        } else if ["data", "blob", "about"].contains(url.scheme ?? "") && action.targetFrame?.isMainFrame == false {
            decisionHandler(.allow)
        } else if url.scheme == "blob" && action.shouldPerformDownload {
            decisionHandler(.download)
        } else {
            decisionHandler(.cancel)
        }
    }

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, preferences: WKWebpagePreferences,
                 decisionHandler: @escaping (WKNavigationActionPolicy, WKWebpagePreferences) -> Void) {
        if let (_, tab) = tab(for: webView), action.targetFrame?.isMainFrame == true {
            preferences.preferredContentMode = tab.desktopSite ? .desktop : .recommended
        }
        self.webView(webView, decidePolicyFor: action) { decisionHandler($0, preferences) }
    }

    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        guard webView === chrome || tab(for: webView) != nil else { decisionHandler(.cancel); return }
        let disposition = (response.response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Disposition") ?? ""
        let shouldDownload = response.isForMainFrame && (!response.canShowMIMEType || disposition.lowercased().hasPrefix("attachment"))
        if webView !== chrome && shouldDownload { decisionHandler(websiteAccess ? .download : .cancel) }
        else { decisionHandler(.allow) }
    }

    private func tab(for web: WKWebView) -> (String, BrowserTab)? {
        tabs.first(where: { $0.value.web === web }).map { ($0.key, $0.value) }
    }

    static func openLinkInBackground(_ action: WKNavigationAction) -> Bool? {
        guard action.navigationType == .linkActivated else { return nil }
        if #available(iOS 18.4, *), action.modifierFlags.contains(.command) || action.buttonNumber.rawValue == 4 {
            return !action.modifierFlags.contains(.shift)
        }
        return nil
    }

    private func announceTab(opener: BrowserTab, url: URL, background: Bool?, related: WKWebViewConfiguration? = nil) -> BrowserTab {
        let id = UUID().uuidString
        let tab = createTab(id: id, isPrivate: opener.isPrivate, related: related)
        tab.isPopup = related != nil
        var event: [String: Any] = ["type": "newtab", "id": id, "adopted": true, "private": opener.isPrivate,
                                    "url": WebAddress.accepts(url) ? url.absoluteString : ""]
        tab.desktopSite = opener.desktopSite
        event["desktopSite"] = tab.desktopSite
        if let background { event["background"] = background }
        emit(event)
        return tab
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard websiteAccess, isReady, action.targetFrame == nil, let url = action.request.url,
              WebAddress.accepts(url) || url.absoluteString == "about:blank", let (_, opener) = tab(for: webView) else { return nil }
        if adBlockEnabled, let host = url.host?.lowercased() {
            if strictAdDomains.contains(where: { host == $0 || host.hasSuffix("." + $0) }) { return nil }
            let openerHost = webView.url?.host?.lowercased() ?? ""
            let openerPaused = !opener.isPrivate && pausedAdSites.contains(where: { openerHost == $0 || openerHost.hasSuffix("." + $0) })
            if !openerPaused && vfdAdHosts.contains(where: { host == $0 || host.hasSuffix("." + $0) }) { return nil }
        }
        return announceTab(opener: opener, url: url, background: Self.openLinkInBackground(action), related: configuration).web
    }

    func webView(_ webView: WKWebView, contextMenuConfigurationForElement element: WKContextMenuElementInfo,
                 completionHandler: @escaping (UIContextMenuConfiguration?) -> Void) {
        let link = element.linkURL
        completionHandler(UIContextMenuConfiguration(identifier: nil, previewProvider: nil) { [weak self, weak webView] suggested in
            guard let self, let webView, let url = link, WebAddress.accepts(url), let (_, opener) = self.tab(for: webView) else {
                return UIMenu(children: suggested)
            }
            let options = [(false, "Open in New Tab"), (true, "Open in Background Tab")].map { background, title in
                UIAction(title: title) { [weak self, weak opener] _ in
                    guard let self, self.websiteAccess, let opener, self.tab(for: opener.web) != nil else { return }
                    let target = self.announceTab(opener: opener, url: url, background: background)
                    target.web.load(URLRequest(url: url))
                }
            }
            return UIMenu(children: options + suggested)
        })
    }

    func webViewDidClose(_ webView: WKWebView) {
        if let (id, tab) = tab(for: webView), tab.isPopup { emit(["type": "tabclosed", "id": id]) }
    }

    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        if let (_, tab) = tab(for: webView) {
            applyAdShield(to: tab)
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if let (id, tab) = tab(for: webView) {
            applyAdShield(to: tab)
            phone.captureWhenSettled(id)
        }
    }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        if let (id, _) = tab(for: webView) {
            phone.forget(id)
            if id == active { phone.resetScroll() }
        }
        if let (id, tab) = tab(for: webView) { tab.failure = nil; schedulePageEvent(for: id) }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        navigationFailed(webView, error: error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        navigationFailed(webView, error: error)
    }

    private func configureAdBlock(enabled: Bool,
                                  ads: Set<String>, trackers: Set<String>, social: Set<String>, strict: Set<String>,
                                  patterns: [String], trackerPatterns: [String], firstPartyPatterns: [String], aggressive: Bool,
                                  selectors: [String], exceptions: [(hosts: [String], paths: [String])], pausedSites: [String],
                                  reloadActive: Bool = false) {
        adBlockCompilation?.cancel()
        adBlockCompilation = nil
        strictAdDomains = strict
        vfdAdHosts = ads
        pausedAdSites = Set(pausedSites)
        let cleanSelectors = selectors.filter { !$0.isEmpty && $0.count <= 256 && !$0.contains(":has(") }.prefix(256)
        vfdCosmeticCSS = cleanSelectors.isEmpty ? "" : cleanSelectors.joined(separator: ",") + "{display:none!important}"
        if !enabled {
            adBlockEnabled = false
            replaceAdBlockRules(regular: nil, privateTabs: nil, reloadActive: reloadActive)
            return
        }
        adBlockEnabled = true
        for tab in tabs.values {
            syncTabAdScripts(tab)
            applyAdShield(to: tab)
        }
        adBlockCompilation = Task { [weak self] in
            do {
                let regular = try await TrackingProtection.compileAdBlock(
                    ads: ads, trackers: trackers, social: social, strict: strict,
                    patterns: patterns, trackerPatterns: trackerPatterns,
                    firstPartyPatterns: aggressive ? firstPartyPatterns : [], aggressive: aggressive,
                    selectors: selectors, exceptions: exceptions, pausedSites: pausedSites)
                guard !Task.isCancelled else { return }
                let privateTabs = pausedSites.isEmpty ? regular :
                    try await TrackingProtection.compileAdBlock(
                        ads: ads, trackers: trackers, social: social, strict: strict,
                        patterns: patterns, trackerPatterns: trackerPatterns,
                        firstPartyPatterns: aggressive ? firstPartyPatterns : [], aggressive: aggressive,
                        selectors: selectors, exceptions: exceptions, pausedSites: [])
                guard !Task.isCancelled else { return }
                self?.replaceAdBlockRules(regular: regular, privateTabs: privateTabs, reloadActive: reloadActive)
            } catch {
                guard !Task.isCancelled else { return }
                self?.notice("Could not apply the updated ad blocker settings.")
            }
            self?.adBlockCompilation = nil
        }
    }

    private func syncTabAdScripts(_ tab: BrowserTab, targetHost: String? = nil) {
        let controller = tab.web.configuration.userContentController
        controller.removeAllUserScripts()
        let pageHost = (targetHost ?? (tab.web.url ?? tab.pendingURL)?.host?.lowercased()) ?? ""
        let paused = !tab.isPrivate && !pageHost.isEmpty && pausedAdSites.contains(where: { pageHost == $0 || pageHost.hasSuffix("." + $0) })
        if adBlockEnabled && !paused {
            controller.addUserScript(WKUserScript(
                source: Self.youtubeDocumentStartShield,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: false
            ))
        }
        if !adBlockEnabled || paused {
            if let trackingRules = TrackingProtection.rules {
                controller.remove(trackingRules)
            }
        }
    }

    private func replaceAdBlockRules(regular: WKContentRuleList?, privateTabs: WKContentRuleList?, reloadActive: Bool = false) {
        for tab in tabs.values {
            let controller = tab.web.configuration.userContentController
            if let old = tab.isPrivate ? privateAdBlockRules : adBlockRules { controller.remove(old) }
            if adBlockEnabled, let next = tab.isPrivate ? privateTabs : regular { controller.add(next) }
            if !adBlockEnabled, let trackingRules = TrackingProtection.rules { controller.remove(trackingRules) }
            syncTabAdScripts(tab)
            applyAdShield(to: tab)
        }
        if adBlockEnabled, let next = regular {
            for controller in pendingAdBlockControllers.allObjects {
                controller.add(next)
            }
        }
        pendingAdBlockControllers.removeAllObjects()
        adBlockRules = regular
        privateAdBlockRules = privateTabs
        if reloadActive, let active, let tab = tabs[active], let url = tab.web.url, WebAddress.accepts(url) {
            tab.web.reload()
        }
    }

    private static let youtubeDocumentStartShield = """
    (()=>{try{
    if(!/(^|\\.)(www\\.youtube\\.com|m\\.youtube\\.com|youtu\\.be)$/i.test(location.hostname))return;
    if(window.__vaayvuYtShieldInstalled)return;
    window.__vaayvuYtShieldInstalled=true;
    const AD_KEYS=['adPlacements','playerAds','adSlots','adBreakHeartbeatParams'];
    function strip(obj,depth=0){
      if(document.documentElement&&document.documentElement.dataset.vaayvuAdShield==='off')return obj;
      if(!obj||typeof obj!=='object'||depth>4)return obj;
      for(const k of AD_KEYS){if(k in obj){try{delete obj[k];}catch{}}}
      if(obj.playerResponse&&typeof obj.playerResponse==='object')strip(obj.playerResponse,depth+1);
      return obj;
    }
    let ytipr=window.ytInitialPlayerResponse;
    if(ytipr)strip(ytipr);
    try{Object.defineProperty(window,'ytInitialPlayerResponse',{configurable:true,enumerable:true,get(){return ytipr;},set(v){ytipr=strip(v);}});}catch{}
    const origJson=Response.prototype.json;
    Response.prototype.json=async function(){const d=await origJson.apply(this,arguments);return strip(d);};
    const origParse=JSON.parse;
    JSON.parse=function(){const d=origParse.apply(this,arguments);return strip(d);};
    }catch{}})();
    """

    private func applyAdShield(to tab: BrowserTab) {
        guard let url = tab.web.url, WebAddress.accepts(url) else { return }
        let pageHost = url.host?.lowercased() ?? ""
        let paused = !tab.isPrivate && pausedAdSites.contains(where: { pageHost == $0 || pageHost.hasSuffix("." + $0) })
        let active = adBlockEnabled && !paused
        let css = active ? vfdCosmeticCSS : ""
        let script = """
        (()=>{try{
        const on=activeFlag,css=cssText;
        if(document.documentElement)document.documentElement.dataset.vaayvuAdShield=on?'on':'off';
        const k=Symbol.for('vaayvu.vfdShield');
        let st=document.getElementById('vaayvu-vfd-cosmetic');
        if(!on||!css){if(st)st.remove();}else{if(!st){st=document.createElement('style');st.id='vaayvu-vfd-cosmetic';(document.head||document.documentElement).appendChild(st);}if(st.textContent!==css)st.textContent=css;}
        const prev=window[k];if(!on){if(prev&&prev.stop)prev.stop();delete window[k];return;}if(prev&&prev.active)return;
        const yt=/(^|\\.)(www\\.youtube\\.com|m\\.youtube\\.com|youtu\\.be)$/i.test(location.hostname);
        if(yt&&!window.__vaayvuYtShieldInstalled){window.__vaayvuYtShieldInstalled=true;
        const AD_KEYS=['adPlacements','playerAds','adSlots','adBreakHeartbeatParams'];
        function strip(obj,depth=0){if(!document.documentElement||document.documentElement.dataset.vaayvuAdShield==='off'||!obj||typeof obj!=='object'||depth>4)return obj;for(const k of AD_KEYS){if(k in obj){try{delete obj[k];}catch{}}}if(obj.playerResponse&&typeof obj.playerResponse==='object')strip(obj.playerResponse,depth+1);return obj;}
        let ytipr=window.ytInitialPlayerResponse;if(ytipr)strip(ytipr);
        try{Object.defineProperty(window,'ytInitialPlayerResponse',{configurable:true,enumerable:true,get(){return ytipr;},set(v){ytipr=strip(v);}});}catch{}
        const origJson=Response.prototype.json;Response.prototype.json=async function(){const d=await origJson.apply(this,arguments);return strip(d);};
        const origParse=JSON.parse;JSON.parse=function(){const d=origParse.apply(this,arguments);return strip(d);};}
        function cleanDOM(){if(!document.documentElement||document.documentElement.dataset.vaayvuAdShield==='off')return;
        for(const f of document.querySelectorAll('iframe[src*="doubleclick"],iframe[src*="googlesyndication"],iframe[src*="googleadservices"],iframe[src*="amazon-adsystem"],iframe[src*="taboola"],iframe[src*="outbrain"],iframe[src*="adnxs"],iframe[src*="criteo"],iframe[src*="exoclick"],iframe[src*="popads"],iframe[id^="google_ads_"]')){f.style.setProperty('display','none','important');const box=f.closest('.ad-slot,.ad-container,.ad-wrapper,.ad-unit,.dfp-ad,[id^="div-gpt-ad"]');if(box)box.style.setProperty('display','none','important');}
        if(yt){for(const el of document.querySelectorAll('ytd-ad-slot-renderer,ytd-in-feed-ad-layout-renderer,ytd-display-ad-renderer,ytd-promoted-sparkles-web-renderer,ytd-promoted-video-renderer,ytd-companion-slot-renderer,ytd-action-companion-ad-renderer,ytd-banner-promo-renderer,ytd-statement-banner-renderer,ytd-video-masthead-ad-v3-renderer,ytm-promoted-sparkles-web-renderer,ytm-promoted-video-renderer,ytm-companion-ad-renderer,ytm-ad-slot-renderer,ytm-in-feed-ad-layout-renderer')){el.style.setProperty('display','none','important');const cell=el.closest('ytd-rich-item-renderer,ytd-rich-section-renderer,ytm-rich-item-renderer');if(cell)cell.style.setProperty('display','none','important');}
        for(const reel of document.querySelectorAll('ytd-reel-video-renderer[is-ad],ytd-reel-video-renderer ytd-ad-slot-renderer')){const r=reel.closest('ytd-reel-video-renderer')||reel;r.style.setProperty('display','none','important');}
        const player=document.getElementById('movie_player')||document.querySelector('.html5-video-player');
        if(player){const adShowing=player.classList.contains('ad-showing')||player.classList.contains('ad-interrupting')||!!player.querySelector('.ytp-ad-player-overlay,.ytp-ad-player-overlay-layout');
        const v=player.querySelector('video.html5-main-video')||player.querySelector('video');
        if(adShowing){try{if(typeof player.skipAd==='function')player.skipAd();}catch{}for(const b of player.querySelectorAll('.ytp-ad-skip-button,.ytp-ad-skip-button-modern,.ytp-skip-ad-button,.ytp-ad-skip-button-container,.ytp-ad-skip-button-slot button,.ytp-ad-overlay-close-button')){try{b.click();}catch{}}
        if(v){if(v.__vaayvuPreAdMuted===undefined)v.__vaayvuPreAdMuted=v.muted;if(v.__vaayvuPreAdRate===undefined&&v.playbackRate<=2)v.__vaayvuPreAdRate=v.playbackRate;try{v.muted=true;}catch{}try{if(Number.isFinite(v.duration)&&v.duration>0&&v.duration<600)v.currentTime=Math.max(0,v.duration-0.05);else v.playbackRate=16;}catch{}}}
        else if(v&&v.__vaayvuPreAdMuted!==undefined){try{v.muted=v.__vaayvuPreAdMuted;}catch{}try{if(v.__vaayvuPreAdRate)v.playbackRate=v.__vaayvuPreAdRate;}catch{}delete v.__vaayvuPreAdMuted;delete v.__vaayvuPreAdRate;}}}}
        cleanDOM();const mo=new MutationObserver(()=>{cleanDOM();});if(document.documentElement)mo.observe(document.documentElement,{childList:true,subtree:true,attributes:yt,attributeFilter:yt?['class','is-ad']:undefined});
        window[k]={active:true,stop(){try{mo.disconnect();}catch{}}};}catch{}})();
        """
        tab.web.callAsyncJavaScript(script, arguments: ["activeFlag": active, "cssText": css], in: nil, in: .page, completionHandler: nil)
    }
    private func navigationFailed(_ web: WKWebView, error: Error) {
        let error = error as NSError
        guard !(error.domain == NSURLErrorDomain && error.code == NSURLErrorCancelled),
              !(error.domain == "WebKitErrorDomain" && error.code == 102),
              let (id, tab) = tab(for: web) else { return }
        let failed = (error.userInfo[NSURLErrorFailingURLErrorKey] as? URL) ?? tab.pendingURL
        guard let url = failed, WebAddress.accepts(url) else { return }
        tab.failure = (url, error.localizedDescription)
        schedulePageEvent(for: id)
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        if webView === chrome {
            isReady = false
            if websiteAccess, let rule = chromeNetworkBlock { chrome.configuration.userContentController.add(rule) }
            websiteAccess = false
            accessConfigured = false
            cancelSearch()
            cancelDownloads()
            discardNativeTabs()
            chrome.loadFileURL(index, allowingReadAccessTo: index.deletingLastPathComponent())
        } else if tab(for: webView) != nil { webView.reload() }
    }
}

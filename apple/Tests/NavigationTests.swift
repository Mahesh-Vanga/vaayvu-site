import XCTest
import Network
import WebKit
@testable import VaayvuPhone

final class NavigationServer {
    let listener: NWListener
    private let queue = DispatchQueue(label: "vaayvu.tests.navigation")

    init(responseDelay: TimeInterval = 0) throws {
        let parameters = NWParameters.tcp
        parameters.requiredInterfaceType = .loopback
        listener = try NWListener(using: parameters, on: .any)
        listener.newConnectionHandler = { [queue] connection in
            connection.start(queue: queue)
            connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { bytes, _, _, _ in
                let request = bytes.flatMap { String(data: $0, encoding: .utf8) } ?? ""
                let method = request.hasPrefix("POST ") ? "POST" : "GET"
                let backdrop = request.hasPrefix("GET /cold-preview ") ? "<style>html{background:#39a56c}</style>" : ""
                let html = """
                <title>\(method) fixture</title>\(backdrop)<body>
                <a id="same" href="/next">Same tab</a><a id="new" href="/popup" target="_blank">New tab</a>
                <form method="POST" action="/receipt" target="_blank"><input name="example" value="safe"><button>Send</button></form>
                </body>
                """
                let response = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: \(html.utf8.count)\r\nConnection: close\r\n\r\n" + html
                queue.asyncAfter(deadline: .now() + responseDelay) {
                    connection.send(content: Data(response.utf8), completion: .contentProcessed { _ in connection.cancel() })
                }
            }
        }
        listener.start(queue: queue)
    }

    deinit { listener.cancel() }
}

@MainActor
final class NavigationTests: XCTestCase {
    private func waitFor(file: StaticString = #filePath, line: UInt = #line, _ condition: @escaping () -> Bool) async throws {
        for _ in 0..<240 {
            if condition() { return }
            try await Task.sleep(nanoseconds: 25_000_000)
        }
        XCTAssertTrue(condition(), "Timed out waiting for browser state", file: file, line: line)
    }

    private func testingHost() async throws -> BrowserHost {
        let host = BrowserHost()
        host.profileID = UUID().uuidString
        host.chromeStore = .nonPersistent()
        host.siteStore = .nonPersistent()
        _ = host.view
        try await waitFor { host.chrome?.url != nil && host.chrome?.isLoading == false }
        try await allowOrdinaryWebForFixture(host, persist:true)
        return host
    }

    func testNativeLinksPostsAndNavigationFailure() async throws {
        let server = try NavigationServer()
        try await waitFor { server.listener.state == .ready && (server.listener.port?.rawValue ?? 0) != 0 }
        let base = "http://127.0.0.1:" + String(try XCTUnwrap(server.listener.port).rawValue)
        let host = try await testingHost()
        defer { host.dismissWindow() }
        _ = try await host.chrome.evaluateJavaScript("window.nativeEvents=[];window.vaayvuEvent=e=>{window.nativeEvents.push(e)};true")
        host.handle(["type":"ready"])
        host.handle(["type":"open","id":"origin","private":true,"url":base + "/"])
        let opener = try XCTUnwrap(host.tabs["origin"])
        try await waitFor { opener.web.title == "GET fixture" && !opener.web.isLoading }
        _ = try await opener.web.evaluateJavaScript("document.getElementById('same').click();true")
        try await waitFor { opener.web.url?.path == "/next" && !opener.web.isLoading }
        XCTAssertTrue(opener.web.canGoBack)
        host.handle(["type":"back","id":"origin"])
        try await waitFor { opener.web.url?.path == "/" && !opener.web.isLoading }
        host.handle(["type":"forward","id":"origin"])
        try await waitFor { opener.web.url?.path == "/next" && !opener.web.isLoading }

        _ = try await opener.web.evaluateJavaScript("document.getElementById('new').click();true")
        try await waitFor { host.tabs.values.contains { $0.web.url?.path == "/popup" && !$0.web.isLoading } }
        let linkTab = try XCTUnwrap(host.tabs.values.first { $0.web.url?.path == "/popup" })
        XCTAssertTrue(linkTab.isPrivate)
        XCTAssertFalse(linkTab.web.configuration.websiteDataStore.isPersistent)
        XCTAssertTrue(linkTab.web.configuration.websiteDataStore === opener.web.configuration.websiteDataStore)
        XCTAssertTrue(linkTab.web.allowsBackForwardNavigationGestures)
        let bridge = try await linkTab.web.evaluateJavaScript("typeof window.webkit?.messageHandlers?.vaayvu")
        XCTAssertEqual(bridge as? String, "undefined")
        _ = try await opener.web.evaluateJavaScript("document.querySelector('button').click();true")
        try await waitFor { host.tabs.values.contains { $0.web.url?.path == "/receipt" && !$0.web.isLoading } }
        XCTAssertEqual(host.tabs.values.first { $0.web.url?.path == "/receipt" }?.web.title, "POST fixture")
        let adopted = try await host.chrome.evaluateJavaScript("nativeEvents.filter(e=>e.type==='newtab'&&e.adopted&&e.private&&!('background' in e)).length")
        XCTAssertEqual(adopted as? Int, 2)
        XCTAssertEqual(opener.web.url?.path, "/next")

        // A plaintext fixture cannot complete this TLS handshake. The browser must preserve its own error page.
        let failedURL = base.replacingOccurrences(of: "http:", with: "https:") + "/offline"
        host.handle(["type":"navigate","id":"origin","url":failedURL])
        try await waitFor { opener.failure?.url.path == "/offline" }
        var event = ""
        for _ in 0..<50 {
            event = try await host.chrome.evaluateJavaScript("nativeEvents.filter(e=>e.id==='origin'&&e.failed).at(-1)?.url || ''") as? String ?? ""
            if !event.isEmpty { break }
            try await Task.sleep(nanoseconds:20_000_000)
        }
        XCTAssertEqual(event, failedURL)
        host.handle(["type":"reload","id":"origin"])
        try await waitFor { opener.failure?.url.path == "/offline" }
        host.handle(["type":"back","id":"origin"])
        XCTAssertNil(opener.failure)
        XCTAssertEqual(opener.web.url?.path, "/next")
    }

    func testIsolatedUserStylesAndDesktopPreference() async throws {
        let url = "https://en.wikipedia.org/vaayvu-style-test"
        let host = try await testingHost()
        defer { host.dismissWindow() }
        for id in ["normal","private"] {
            host.handle(["type":"open","id":id,"private":id == "private","desktopSite":true])
            let tab = try XCTUnwrap(host.tabs[id])
            let fixture = URLRequest(url: try XCTUnwrap(URL(string: url)))
            tab.web.loadSimulatedRequest(fixture, responseHTML: "<title>Style fixture</title><body>Sample article</body>")
            try await waitFor { tab.web.title == "Style fixture" && !tab.web.isLoading }
            XCTAssertTrue(tab.desktopSite)
            let userAgent = try await tab.web.evaluateJavaScript("navigator.userAgent") as? String
            XCTAssertTrue(userAgent?.contains("Macintosh") == true, userAgent ?? "")
            let style = "body { color: rgb(24, 48, 72) !important; }"
            let color = "getComputedStyle(document.body).color"
            let baseline = try await tab.web.evaluateJavaScript(color) as? String
            host.handle(["type":"userStyles","id":id,"url":url + "?stale","css":style])
            let stale = try await tab.web.evaluateJavaScript(color) as? String
            XCTAssertEqual(stale,baseline)
            host.handle(["type":"userStyles","id":id,"url":url,"css":style])
            try await Task.sleep(nanoseconds: 150_000_000)
            let applied = try await tab.web.evaluateJavaScript(color) as? String
            XCTAssertEqual(applied, id == "normal" ? "rgb(24, 48, 72)" : baseline)
            host.handle(["type":"userStyles","id":id,"url":url,"css":""])
            let reverted = try await tab.web.evaluateJavaScript(color) as? String
            XCTAssertEqual(reverted,baseline)
        }
        XCTAssertNil(host.capabilities["canDefaultBrowser"])
        XCTAssertEqual(host.capabilities["canDesktopSite"] as? Bool, true)
        let commands = try XCTUnwrap(host.keyCommands).compactMap { $0.propertyList as? String }
        XCTAssertTrue(commands.contains("focusAddress"))
        XCTAssertTrue(commands.contains("selectTab9"))
    }

    func testInstallStyleExtensionFromZIPAndDisableIt() async throws {
        let host = try await testingHost()
        defer { host.dismissWindow() }
        let chrome = try XCTUnwrap(host.chrome)
        let file = try XCTUnwrap(Bundle(for: Self.self).url(forResource: "Wikipedia-Reading-Type", withExtension: "zip"))
        let bytes = try Data(contentsOf: file)
        let id = UUID().uuidString
        let url = try XCTUnwrap(URL(string: "https://en.wikipedia.org/wiki/Vaayvu_Test"))
        host.handle(["type":"open","id":id])
        let tab = try XCTUnwrap(host.tabs[id])
        host.emit(["type":"newtab","id":id,"adopted":true,"url":url.absoluteString,"private":false,"background":false])
        tab.web.loadSimulatedRequest(URLRequest(url: url), responseHTML: "<title>Local article</title><article class='mw-parser-output'><p>Text</p></article>")
        try await waitFor { tab.web.title == "Local article" && !tab.web.isLoading }
        let style = "getComputedStyle(document.querySelector('p')).lineHeight"
        let baseline = try await tab.web.evaluateJavaScript(style) as? String
        host.command("extensions")
        let imported = """
        const transfer = new DataTransfer();
        const bytes = Uint8Array.from(atob(payload), c => c.charCodeAt(0));
        transfer.items.add(new File([bytes], 'Wikipedia-Reading-Type.zip', { type: 'application/zip' }));
        const picker = document.querySelector('#extension-file');
        picker.files = transfer.files;
        picker.dispatchEvent(new Event('change',{bubbles:true}));
        return true;
        """
        _ = try await chrome.callAsyncJavaScript(imported, arguments:["payload":bytes.base64EncodedString()], in:nil, contentWorld:.page)
        var review = false
        for _ in 0..<100 {
            review = try await chrome.evaluateJavaScript("!!document.querySelector('[data-install-ext]')") as? Bool == true
            if review { break }
            try await Task.sleep(nanoseconds:20_000_000)
        }
        XCTAssertTrue(review)
        _ = try await chrome.evaluateJavaScript("document.querySelector('[data-install-ext]').click();true")
        var applied = baseline
        for _ in 0..<100 {
            applied = try await tab.web.evaluateJavaScript(style) as? String
            if applied != baseline { break }
            try await Task.sleep(nanoseconds:20_000_000)
        }
        XCTAssertNotEqual(applied,baseline)
        _ = try await chrome.evaluateJavaScript("document.querySelector('[data-enable-ext]').click();true")
        var restored = applied
        for _ in 0..<100 {
            restored = try await tab.web.evaluateJavaScript(style) as? String
            if restored == baseline { break }
            try await Task.sleep(nanoseconds:20_000_000)
        }
        XCTAssertEqual(restored,baseline)
    }

    func testTrustedRendererRecoveryDiscardsPrivateCookiesAndRemountsRegularTab() async throws {
        let server = try NavigationServer()
        try await waitFor { server.listener.state == .ready && (server.listener.port?.rawValue ?? 0) != 0 }
        let url = "http://127.0.0.1:" + String(try XCTUnwrap(server.listener.port).rawValue) + "/restore"
        let host = try await testingHost()
        defer { host.dismissWindow() }
        let chrome = try XCTUnwrap(host.chrome)
        let submit = "document.querySelector('#address').value=url;document.querySelector('#address-form').requestSubmit();return true"
        _ = try await chrome.callAsyncJavaScript(submit, arguments:["url":url], in:nil, contentWorld:.page)
        try await waitFor { host.tabs.values.contains { $0.web.url?.path == "/restore" && !$0.web.isLoading } }
        let (regularID, regular) = try XCTUnwrap(host.tabs.first { !$0.value.isPrivate })
        host.handle(["type":"open","id":"before-recovery","private":true])
        let oldStore = try XCTUnwrap(host.privateStore)
        let cookie = try XCTUnwrap(HTTPCookie(properties:[.domain:"vaayvu.example",.path:"/",.name:"private-session",.value:"fixture"]))
        await oldStore.httpCookieStore.setCookie(cookie)
        host.webViewWebContentProcessDidTerminate(chrome)
        XCTAssertTrue(host.tabs.isEmpty)
        XCTAssertNil(host.privateStore)
        try await waitFor { host.tabs[regularID]?.web.url?.path == "/restore" }
        XCTAssertFalse(host.tabs[regularID] === regular)
        XCTAssertNil(host.tabs["before-recovery"])
        host.handle(["type":"open","id":"after-recovery","private":true])
        let newStore = try XCTUnwrap(host.privateStore)
        XCTAssertFalse(newStore === oldStore)
        let cookies = await newStore.httpCookieStore.allCookies()
        XCTAssertTrue(cookies.isEmpty)
    }

    func testBlocklistStrictHostsAndCosmeticHiding() async throws {
        let host = try await testingHost()
        defer { host.dismissWindow() }
        let source = try XCTUnwrap(URL(string: "https://reader.example.test/article"))
        host.handle(["type": "blocklist", "enabled": true,
                     "hostsAds": ["ads.example.test"], "hostsTrackers": [], "hostsSocial": [],
                     "strict": ["blocked.example.test"], "patterns": ["pagead"],
                     "trackerPatterns": [], "firstPartyPatterns": [], "aggressive": false,
                     "selectors": [".ad-slot", "#banner-ad"],
                     "pausedSites": ["paused.example.test"]])
        for id in ["regular", "private"] {
            let secret = id == "private"
            host.handle(["type": "open", "id": id, "private": secret])
            let tab = try XCTUnwrap(host.tabs[id])
            tab.web.loadSimulatedRequest(URLRequest(url: source), responseHTML:
                "<title>Banner fixture</title><div id='banner-ad'>Consent</div><div class='ad-slot'>Ads</div>")
            try await waitFor { !tab.web.isLoading && tab.web.title == "Banner fixture" }
            let banner = try await tab.web.evaluateJavaScript("getComputedStyle(document.getElementById('banner-ad')).display") as? String
            XCTAssertEqual(banner, "none")
            let slot = try await tab.web.evaluateJavaScript("getComputedStyle(document.querySelector('.ad-slot')).display") as? String
            XCTAssertEqual(slot, "none")
            if #available(iOS 16.4, *) {
                host.handle(["type": "inspection", "id": id, "enabled": true])
                XCTAssertEqual(tab.web.isInspectable, !secret)
            }
            let blocked = "https://sub.blocked.example.test/"
            host.handle(["type": "navigate", "id": id, "url": blocked])
            try await waitFor { tab.failure?.url.absoluteString == blocked }
            XCTAssertEqual(tab.failure?.message, "Blocked by Vaayvu\u{2019}s ad blocker.")
        }
    }

    func testProfileRuleCompilationAndReplacement() async throws {
        await TrackingProtection.prepare()
        XCTAssertNotNil(TrackingProtection.rules)
        let id = UUID().uuidString
        let policy = ProfileProtection.shared(for: id)
        XCTAssertTrue(policy === ProfileProtection.shared(for: id))
        XCTAssertFalse(policy === ProfileProtection.shared(for: UUID().uuidString))
        let controller = WKUserContentController()
        policy.attach(controller)
        XCTAssertTrue(policy.configure(enabled: true, domains: ["first.example"]))
        XCTAssertTrue(policy.configure(enabled: false, domains: ["third.example","second.example"]))
        XCTAssertFalse(policy.configure(enabled: true, domains: ["first.example","*.example.net"]))
        XCTAssertFalse(policy.enabled)
        XCTAssertEqual(policy.domains, ["second.example","third.example"])
        try await waitFor { policy.customRules != nil }
        let enabled = policy.configure(enabled: true, domains: nil)
        XCTAssertTrue(enabled)
        XCTAssertTrue(policy.enabled)
        XCTAssertTrue(policy.configure(enabled: true, domains: ["last.example"]))
        XCTAssertTrue(policy.configure(enabled: true, domains: []))
        try await Task.sleep(nanoseconds: 200_000_000)
        XCTAssertNil(policy.customRules)
        XCTAssertTrue(policy.domains.isEmpty)
        for domain in ["UPPER.example","127.0.0.1",".example.com","wrong..domain","https://example.com",
                       "first.example:80","-bad.example","bad-.example",String(repeating:"a",count:64)+".example"] {
            XCTAssertFalse(TrackingProtection.validDomain(domain))
        }
        XCTAssertFalse(policy.configure(enabled: false, domains: Array(repeating: "same.example",count:129)))
        XCTAssertTrue(policy.enabled)
    }
}

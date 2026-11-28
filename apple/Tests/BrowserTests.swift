import XCTest
import WebKit
import Network
@testable import VaayvuPhone

@MainActor
func allowOrdinaryWebForFixture(_ host: BrowserHost, persist: Bool = false) async throws {
    for _ in 0..<150 {
        if let chrome = host.chrome, chrome.url != nil, !chrome.isLoading,
           (try? await chrome.evaluateJavaScript("typeof nativeReady !== 'undefined' && nativeReady")) as? Bool == true {
            _ = try await chrome.callAsyncJavaScript("""
                settings.ordinaryWeb = true;
                if (persist) write('settings',settings);
                updateWebsiteAccess();
                return true;
                """, arguments:["persist": persist], in:nil, contentWorld:.page)
            for _ in 0..<80 where !host.websiteAccess { try await Task.sleep(nanoseconds:20_000_000) }
            XCTAssertTrue(host.websiteAccess)
            return
        }
        try await Task.sleep(nanoseconds:40_000_000)
    }
    XCTFail("The browser settings did not load.")
}

@MainActor
final class BrowserTests: XCTestCase {
    @discardableResult
    private func waitForChrome(_ host: BrowserHost, _ description: String = "the browser bridge to become ready",
                               condition: String = "true", arguments: [String: Any] = [:],
                               file: StaticString = #filePath, line: UInt = #line) async throws -> WKWebView {
        let check = """
        if (typeof window.vaayvuEvent !== 'function' || typeof nativeReady === 'undefined' || !nativeReady) return false;
        return (\(condition));
        """
        var ready: WKWebView?
        var detail = "The page has not finished loading."
        for _ in 0..<300 {
            if let web = host.chrome, web.url?.lastPathComponent == "index.html", !web.isLoading {
                do {
                    let observed = try await web.callAsyncJavaScript(check, arguments: arguments, in: nil, contentWorld: .page)
                    if observed as? Bool == true { ready = web; break }
                    detail = "The expected state has not arrived."
                } catch { detail = error.localizedDescription }
            }
            try await Task.sleep(nanoseconds: 50_000_000)
        }
        return try XCTUnwrap(ready, "Timed out waiting for " + description + ". " + detail, file: file, line: line)
    }

    func testWebAddresses() {
        XCTAssertNotNil(WebAddress.parse("https://example.com/a?q=2"))
        XCTAssertNotNil(WebAddress.parse("http://127.0.0.1:8080"))
        for input in ["file:///etc/hosts", "javascript:history.back()", "about:blank", "https://", "https://user:secret@example.com",
                      "https://example.com/" + String(repeating: "x", count: 8200), "data:text/plain,x"] {
            XCTAssertNil(WebAddress.parse(input))
        }
    }

    func testTrustedChromeCanOpenPrivateTabAndRemotePageHasNoBridge() async throws {
        let host = BrowserHost()
        _ = host.view
        for _ in 0..<300 where host.chrome?.url == nil || host.chrome?.isLoading == true {
            try await Task.sleep(nanoseconds: 50_000_000)
        }
        XCTAssertEqual(host.chrome.url?.lastPathComponent, "index.html")
        try await allowOrdinaryWebForFixture(host)
        let command = "window.webkit.messageHandlers.vaayvu.postMessage({type:'open', id:'integration-private', private:true});true"
        _ = try await host.chrome.evaluateJavaScript(command)
        for _ in 0..<100 where host.tabs["integration-private"] == nil {
            try await Task.sleep(nanoseconds: 50_000_000)
        }
        let tab = try XCTUnwrap(host.tabs["integration-private"])
        defer { host.handle(["type": "close", "id": "integration-private"]) }
        XCTAssertFalse(tab.web.configuration.websiteDataStore.isPersistent)
        tab.web.loadHTMLString("<p>Local test document</p>", baseURL: nil)
        for _ in 0..<100 where tab.web.isLoading || tab.web.url == nil {
            try await Task.sleep(nanoseconds: 50_000_000)
        }
        let value = try await tab.web.evaluateJavaScript("typeof window.webkit?.messageHandlers?.vaayvu")
        XCTAssertEqual(value as? String, "undefined")
        _ = try await host.chrome.evaluateJavaScript("location.href='https://example.com'; true")
        try await Task.sleep(nanoseconds: 300_000_000)
        XCTAssertEqual(host.chrome.url?.lastPathComponent, "index.html")
    }

    func testLocalPageNavigationAndVisibleTextExtraction() async throws {
        let parameters = NWParameters.tcp
        parameters.requiredInterfaceType = .loopback
        let server = try NWListener(using: parameters, on: .any)
        let queue = DispatchQueue(label: "VaayvuTestHTTP")
        server.newConnectionHandler = { connection in
            connection.start(queue: queue)
            connection.receive(minimumIncompleteLength: 1, maximumLength: 8192) { _, _, _, _ in
                let html = "<title>Fixture</title><p>Visible article.</p><textarea>Private draft</textarea>"
                let headers = "HTTP/1.1 200 OK\r\nContent-Type: text/html\r\nContent-Length: \(html.utf8.count)\r\nConnection: close\r\n\r\n"
                connection.send(content: Data((headers + html).utf8), completion: .contentProcessed { _ in connection.cancel() })
            }
        }
        server.start(queue: queue)
        defer { server.cancel() }
        for _ in 0..<100 where server.state != .ready || server.port?.rawValue == 0 { try await Task.sleep(nanoseconds: 50_000_000) }
        let port = try XCTUnwrap(server.port)
        XCTAssertNotEqual(port.rawValue, 0)
        let windows = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.flatMap(\.windows)
        let host = try XCTUnwrap(windows.compactMap { $0.rootViewController as? BrowserHost }.first)
        for _ in 0..<300 where host.chrome?.url == nil || host.chrome?.isLoading == true { try await Task.sleep(nanoseconds: 50_000_000) }
        let previousAccess = host.websiteAccess
        try await allowOrdinaryWebForFixture(host)
        defer {
            if !previousAccess { host.chrome.evaluateJavaScript("settings.ordinaryWeb=false;updateWebsiteAccess();true", completionHandler:nil) }
        }
        let script = """
        window.testNotices=[]; const original=window.vaayvuEvent;
        window.vaayvuEvent = event => {
          if(event.type==='notice') window.testNotices.push(event.message);
          if(event.type==='text') window.testText=event.text;
          original(event);
        };
        window.vaayvuEvent({type:'command',command:'privateTab'});
        document.querySelector('#address').value='http://127.0.0.1:\(port.rawValue)/';
        document.querySelector('#address-form').requestSubmit();
        true;
        """
        defer { host.command("closeTab") }
        _ = try await host.chrome.evaluateJavaScript(script)
        for _ in 0..<100 where !host.tabs.values.contains(where: { $0.isPrivate }) { try await Task.sleep(nanoseconds: 50_000_000) }
        let (id, tab) = try XCTUnwrap(host.tabs.first(where: { $0.value.isPrivate }))
        for _ in 0..<200 where tab.web.title != "Fixture" || tab.web.isLoading { try await Task.sleep(nanoseconds: 50_000_000) }
        let diagnostics = try await host.chrome.evaluateJavaScript("window.testNotices.join(', ')") as? String ?? ""
        XCTAssertEqual(tab.web.title, "Fixture", "Navigation to \(String(describing: tab.web.url)) emitted \(diagnostics)")
        XCTAssertFalse(tab.web.isHidden)
        _ = try await host.chrome.evaluateJavaScript("document.querySelector('.sidebar-open').click();true")
        for _ in 0..<100 where !tab.web.isHidden { try await Task.sleep(nanoseconds: 20_000_000) }
        XCTAssertTrue(tab.web.isHidden)
        _ = try await host.chrome.evaluateJavaScript("document.querySelector('.rail-out').click();true")
        for _ in 0..<100 where tab.web.isHidden { try await Task.sleep(nanoseconds: 20_000_000) }
        XCTAssertFalse(tab.web.isHidden)
        host.handle(["type":"extract","id":id])
        var extracted = ""
        for _ in 0..<100 {
            extracted = (try await host.chrome.evaluateJavaScript("window.testText || ''") as? String) ?? ""
            if !extracted.isEmpty { break }
            try await Task.sleep(nanoseconds: 50_000_000)
        }
        XCTAssertEqual(extracted, "Visible article.")
        host.handle(["type": "zoom", "id": id, "percent": 150])
        for _ in 0..<50 where tab.web.pageZoom != 1.5 { try await Task.sleep(nanoseconds: 20_000_000) }
        XCTAssertEqual(tab.web.pageZoom, 1.5)
        host.handle(["type": "zoom", "id": id, "percent": 100])
        let pdf = try await BrowserHost.renderPage(tab.web, action: "savePDF").0
        XCTAssertTrue(pdf.starts(with: Data("%PDF".utf8)))
        let png = try await BrowserHost.renderPage(tab.web, action: "capture").0
        XCTAssertTrue(png.starts(with: [137,80,78,71]))
        let archive = try await BrowserHost.renderPage(tab.web, action: "savePage").0
        let payload = try PropertyListSerialization.propertyList(from: archive, format: nil) as? [String: Any]
        XCTAssertNotNil(payload?["WebMainResource"])
        _ = try await tab.web.evaluateJavaScript("document.activeElement.blur(); getSelection().removeAllRanges();true")
        host.handle(["type": "editPage", "id": id, "action": "selectAll"])
        var selection = ""
        for _ in 0..<50 {
            selection = try await tab.web.evaluateJavaScript("String(getSelection())") as? String ?? ""
            if !selection.isEmpty { break }
            try await Task.sleep(nanoseconds: 20_000_000)
        }
        XCTAssertTrue(selection.contains("Visible article."))

        let recordPreview = "let old=window.vaayvuEvent;window.vaayvuEvent=m=>{if(m.type==='menuPreview')window.preview=m;old(m)};true"
        _ = try await host.chrome.evaluateJavaScript(recordPreview)
        host.handle(["type": "menuPreview", "id": id, "requestId": "private-check"])
        try await Task.sleep(nanoseconds: 100_000_000)
        let privatePreview = try await host.chrome.evaluateJavaScript("!!window.preview") as? Bool
        XCTAssertEqual(privatePreview, false)
        let normalID = "fixture-for-menu-preview"
        host.handle(["type": "open", "id": normalID, "private": false, "url": try XCTUnwrap(tab.web.url).absoluteString])
        defer { host.handle(["type": "close", "id": normalID]) }
        let normal = try XCTUnwrap(host.tabs[normalID])
        for _ in 0..<200 where normal.web.title != "Fixture" || normal.web.isLoading { try await Task.sleep(nanoseconds: 50_000_000) }
        host.handle(["type": "menuPreview", "id": normalID, "requestId": "public-check"])
        var image = ""
        for _ in 0..<100 {
            image = try await host.chrome.evaluateJavaScript("window.preview?.requestId === 'public-check' ? window.preview.image : ''") as? String ?? ""
            if !image.isEmpty { break }
            try await Task.sleep(nanoseconds: 30_000_000)
        }
        XCTAssertTrue(image.hasPrefix("data:image/jpeg;base64,/9j/"))
    }

    func testPrivateWindowAndProfileStorageBoundaries() async throws {
        let host = BrowserHost()
        host.windowID = "private-test"
        host.isPrivateWindow = true
        _ = host.view
        defer { host.dismissWindow() }
        for _ in 0..<300 where host.chrome?.url == nil || host.chrome?.isLoading == true { try await Task.sleep(nanoseconds: 50_000_000) }
        let chrome = try XCTUnwrap(host.chrome)
        XCTAssertFalse(chrome.configuration.websiteDataStore.isPersistent)
        XCTAssertNotNil(TrackingProtection.rules)
        try await allowOrdinaryWebForFixture(host)
        host.handle(["type": "open", "id": "private-site", "private": false])
        let tab = try XCTUnwrap(host.tabs["private-site"])
        XCTAssertTrue(tab.isPrivate)
        XCTAssertFalse(tab.web.configuration.websiteDataStore.isPersistent)
        XCTAssertFalse(tab.web.configuration.websiteDataStore === chrome.configuration.websiteDataStore)
    }

    func testLegacyChromeMigrationAndSiteDataRemoval() async throws {
        let host = BrowserHost()
        host.profileID = "migration-test"
        host.chromeStore = .nonPersistent()
        host.siteStore = .nonPersistent()
        _ = host.view
        let destination = BrowserHost()
        destination.profileID = "migration-destination"
        destination.chromeStore = .nonPersistent()
        destination.siteStore = .nonPersistent()
        _ = destination.view
        defer { host.dismissWindow(); destination.dismissWindow() }
        let chrome = try await waitForChrome(host)
        let target = try await waitForChrome(destination)
        _ = try await chrome.evaluateJavaScript("localStorage.setItem('vaayvu.testMigration','saved');true")
        try await ChromeStorage.copy(index: try XCTUnwrap(chrome.url), from: host.chromeStore, into: destination.chromeStore)
        // WebKit propagates localStorage changes asynchronously to other running renderers.
        try await waitForChrome(destination, "the destination to observe the migrated value",
                                condition: "localStorage.getItem('vaayvu.testMigration') === 'saved'")
        let cookie = try XCTUnwrap(HTTPCookie(properties: [.domain:"example.test",.path:"/",.name:"vaayvu-fixture",.value:"ok"]))
        await destination.siteStore.httpCookieStore.setCookie(cookie)
        destination.profileID = "default"
        destination.clearSiteData()
        for _ in 0..<100 {
            if await destination.siteStore.httpCookieStore.allCookies().isEmpty { break }
            try await Task.sleep(nanoseconds: 30_000_000)
        }
        let cookies = await destination.siteStore.httpCookieStore.allCookies()
        XCTAssertTrue(cookies.isEmpty)
        let keys = ["vaayvu.history","vaayvu.recentlyClosed","vaayvu.recentlyClosed.closed-window","vaayvu.downloads","vaayvu.bookmarks","other.history"]
        _ = try await chrome.callAsyncJavaScript("for(const k of keys)localStorage.setItem(k,'fixture')", arguments:["keys":keys], in:nil, contentWorld:.defaultClient)
        let index = try XCTUnwrap(chrome.url)
        try await ChromeStorage.clearRecords(index: index, in: host.chromeStore, history: true, downloads: false)
        let keysMatch = "keys.every(k => (localStorage.getItem(k) !== null) === kept.includes(k))"
        try await waitForChrome(host, "history and closed tabs to be erased", condition: keysMatch,
                                arguments: ["keys": keys, "kept": ["vaayvu.downloads", "vaayvu.bookmarks", "other.history"]])
        _ = try await chrome.evaluateJavaScript("localStorage.setItem('vaayvu.history','new');true")
        try await ChromeStorage.clearRecords(index: index, in: host.chromeStore, history: false, downloads: true)
        try await waitForChrome(host, "downloads to be erased independently", condition: keysMatch,
                                arguments: ["keys": keys, "kept": ["vaayvu.history", "vaayvu.bookmarks", "other.history"]])
        let retained = try await target.evaluateJavaScript("localStorage.getItem('vaayvu.testMigration')")
        XCTAssertEqual(retained as? String, "saved")
    }

}

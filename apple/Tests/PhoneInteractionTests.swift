import UIKit
import XCTest
import WebKit
@testable import VaayvuPhone

@MainActor
final class PhoneInteractionTests: XCTestCase {
    private func eventually(file: StaticString = #filePath, line: UInt = #line,
                            _ observation: () async throws -> Bool) async throws {
        for _ in 0..<320 {
            if try await observation() { return }
            try await Task.sleep(nanoseconds: 40_000_000)
        }
        XCTFail("Timed out waiting for iPhone browser state", file: file, line: line)
    }

    func testBackgroundPrivacyAndNativeShareMaterial() async throws {
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous = scene.keyWindow
        let coordinator = SceneDelegate()
        let window = UIWindow(windowScene: scene)
        coordinator.window = window
        let host = BrowserHost()
        host.profileID = UUID().uuidString
        host.siteStore = .nonPersistent()
        host.chromeStore = .nonPersistent()
        window.rootViewController = host
        window.makeKeyAndVisible()
        defer { host.dismissWindow(); window.isHidden = true; previous?.makeKeyAndVisible() }
        try await eventually { host.chrome?.url != nil && host.chrome?.isLoading == false }
        let app = try XCTUnwrap(UIApplication.shared.delegate as? VaayvuApp)
        app.excludeBrowserFilesFromBackup()
        var library = try XCTUnwrap(FileManager.default.urls(for:.libraryDirectory,in:.userDomainMask).first)
        library.removeAllCachedResourceValues()
        XCTAssertEqual(try library.resourceValues(forKeys:[.isExcludedFromBackupKey]).isExcludedFromBackup, true)
        coordinator.sceneWillResignActive(scene)
        let cover = try XCTUnwrap(window.subviews.last)
        XCTAssertEqual(cover.accessibilityLabel, browserName)
        XCTAssertEqual(browserName, "Vaayvu")
        let coverMarkView = try XCTUnwrap(cover.subviews.compactMap { $0 as? UIImageView }.first)
        let launchScreen = try XCTUnwrap(Bundle.main.object(forInfoDictionaryKey: "UILaunchScreen") as? [String: Any])
        let launchImageName = try XCTUnwrap(launchScreen["UIImageName"] as? String)
        XCTAssertEqual(coverMarkView.image, UIImage(named: launchImageName))
        coverMarkView.layoutIfNeeded()
        XCTAssertEqual(coverMarkView.frame.size, CGSize(width: 64, height: 64))
        XCTAssertEqual(cover.frame, window.bounds)
        XCTAssertTrue(cover.isOpaque)
        XCTAssertFalse(cover.subviews.contains { $0 is WKWebView })
        XCTAssertNil(coordinator.stateRestorationActivity(for: scene))
        coordinator.sceneDidBecomeActive(scene)
        XCTAssertNil(cover.superview)
        guard #available(iOS 26.1, *) else { return }
        let picker = UIActivityViewController(activityItems:["Fixture"], applicationActivities:nil)
        picker.popoverPresentationController?.sourceView = host.view
        picker.popoverPresentationController?.sourceRect = CGRect(x: host.view.bounds.midX, y: 8, width: 1, height: 1)
        host.presentBrowserSheet(picker)
        try await eventually { host.presentedViewController === picker }
        if !UIAccessibility.isReduceTransparencyEnabled {
            XCTAssertTrue(picker.presentationController?.backgroundEffect is UIGlassEffect)
        }
        picker.dismiss(animated:false)
    }

    @available(iOS 17, *)
    func testPhoneProfileSwitchRestoresSeparateChromeAndSiteStores() async throws {
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous = scene.keyWindow
        let suite = "VaayvuProfileTest." + UUID().uuidString
        let coordinator = SceneDelegate()
        coordinator.defaults = try XCTUnwrap(UserDefaults(suiteName: suite))
        let window = UIWindow(windowScene: scene)
        coordinator.window = window
        let personal = try XCTUnwrap(coordinator.host(for: "default"))
        window.makeKeyAndVisible()
        defer {
            (window.rootViewController as? BrowserHost)?.dismissWindow()
            window.isHidden = true
            previous?.makeKeyAndVisible()
            coordinator.defaults.removePersistentDomain(forName: suite)
        }
        try await eventually { personal.chrome?.url != nil && personal.chrome?.isLoading == false }
        personal.handle(["type": "newProfile", "name": "Work"])
        let work = try XCTUnwrap(window.rootViewController as? BrowserHost)
        XCTAssertEqual(work.profileName, "Work")
        XCTAssertFalse(work === personal)
        XCTAssertNotEqual(work.siteStore.identifier, work.chromeStore.identifier)
        try await eventually { work.chrome?.url != nil && work.chrome?.isLoading == false }
        let profile = try await work.chrome.evaluateJavaScript("window.vaayvuWindow.profileId") as? String
        XCTAssertEqual(profile, work.profileID)
        _ = try await work.chrome.evaluateJavaScript("localStorage.setItem('vaayvu.fixture','work');true")
        let cookie = try XCTUnwrap(HTTPCookie(properties: [.domain:"fixture.example", .path:"/", .name:"work", .value:"session"]))
        await work.siteStore.httpCookieStore.setCookie(cookie)
        try await allowOrdinaryWebForFixture(work)
        work.handle(["type":"open","id":"temporary-private","private":true])
        let privateStore = try XCTUnwrap(work.privateStore)
        await privateStore.httpCookieStore.setCookie(cookie)
        work.handle(["type":"newProfile","name":"Research"])
        let research = try XCTUnwrap(window.rootViewController as? BrowserHost)
        XCTAssertNotEqual(research.profileID, work.profileID)
        XCTAssertTrue(work.tabs.isEmpty)
        XCTAssertNil(work.privateStore)
        try await eventually { research.chrome?.url != nil && research.chrome?.isLoading == false }
        let separateChrome = try await research.chrome.evaluateJavaScript("localStorage.getItem('vaayvu.fixture') === null")
        XCTAssertEqual(separateChrome as? Bool, true)
        let separateCookies = await research.siteStore.httpCookieStore.allCookies()
        XCTAssertTrue(separateCookies.isEmpty)
        research.handle(["type":"switchProfile","id":work.profileID])
        let restored = try XCTUnwrap(window.rootViewController as? BrowserHost)
        XCTAssertEqual(restored.profileID, work.profileID)
        XCTAssertEqual(coordinator.defaults.string(forKey:"Vaayvu.activeProfile"), work.profileID)
        try await eventually { restored.chrome?.url != nil && restored.chrome?.isLoading == false }
        let restoredChrome = try await restored.chrome.evaluateJavaScript("localStorage.getItem('vaayvu.fixture')")
        XCTAssertEqual(restoredChrome as? String, "work")
        let restoredCookies = await restored.siteStore.httpCookieStore.allCookies()
        XCTAssertTrue(restoredCookies.contains { $0.name == "work" })
        try await allowOrdinaryWebForFixture(restored)
        restored.handle(["type":"open","id":"fresh-private","private":true])
        XCTAssertFalse(restored.privateStore === privateStore)
        let freshCookies = await restored.privateStore?.httpCookieStore.allCookies()
        XCTAssertEqual(freshCookies?.count, 0)
    }

    func testPageFinishingBehindOverviewReceivesItsFirstPreview() async throws {
        let server = try NavigationServer(responseDelay: 1.5)
        try await eventually { server.listener.state == .ready && (server.listener.port?.rawValue ?? 0) != 0 }
        let url = "http://127.0.0.1:" + String(try XCTUnwrap(server.listener.port).rawValue) + "/cold-preview"
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous = scene.keyWindow
        let window = UIWindow(windowScene: scene)
        let host = BrowserHost()
        host.profileID = UUID().uuidString
        host.chromeStore = .nonPersistent()
        host.siteStore = .nonPersistent()
        window.rootViewController = host
        window.makeKeyAndVisible()
        defer { host.dismissWindow(); window.isHidden = true; previous?.makeKeyAndVisible() }
        try await eventually { host.chrome?.isLoading == false && host.chrome?.url != nil }
        let chrome = try XCTUnwrap(host.chrome)
        try await eventually { try await chrome.evaluateJavaScript("typeof nativeReady==='boolean' && nativeReady") as? Bool == true }
        try await allowOrdinaryWebForFixture(host)
        // Sample the fixture's own background independent of the simulator's light or dark theme.
        _ = try await chrome.evaluateJavaScript("VaayvuPreferences.commit({siteAppearance:'website'});true")
        _ = try await chrome.callAsyncJavaScript("const box=document.querySelector('#address');box.value=url;box.form.requestSubmit();return true",
                                                 arguments:["url": url], in:nil, contentWorld:.page)
        try await eventually { host.active != nil && host.visiblePage?.isLoading == true }
        let id = try XCTUnwrap(host.active)
        let tab = try XCTUnwrap(host.tabs[id])
        host.command("tabOverview")
        try await eventually { try await chrome.evaluateJavaScript("modal==='tabOverview'") as? Bool == true }
        XCTAssertTrue(tab.web.isLoading)
        try await eventually { tab.web.title == "GET fixture" && !tab.web.isLoading }
        try await eventually {
            try await chrome.evaluateJavaScript("!!document.querySelector('#ov-grid .ov-tile > img')?.naturalWidth") as? Bool == true
        }
        let sampledBackdrop = try await chrome.evaluateJavaScript("""
            (() => {
                const image = document.querySelector('#ov-grid .ov-tile > img');
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                context.drawImage(image, 0, 0, 1, 1);
                const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
                return g > r + 50 && g > b + 25;
            })()
            """)
        XCTAssertEqual(sampledBackdrop as? Bool, true)
        try await eventually { tab.web.isHidden }
        XCTAssertNil(host.visiblePage)
        _ = try await chrome.evaluateJavaScript("document.querySelector('[data-overview=done]').click();true")
        try await eventually { host.visiblePage === tab.web && !tab.web.isHidden }
        XCTAssertTrue(tab.web.isUserInteractionEnabled)
    }

    func testCardPreviewsDisplayAndPrivateBoundaries() async throws {
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let previous = scene.keyWindow
        let window = UIWindow(windowScene: scene)
        let host = BrowserHost()
        host.profileID = UUID().uuidString
        host.chromeStore = .nonPersistent()
        host.siteStore = .nonPersistent()
        window.rootViewController = host
        window.makeKeyAndVisible()
        defer { host.dismissWindow(); window.isHidden = true; previous?.makeKeyAndVisible() }
        try await eventually { host.chrome?.url?.isFileURL == true && host.chrome?.isLoading == false }
        let chrome = try XCTUnwrap(host.chrome)
        try await eventually {
            try await chrome.evaluateJavaScript("typeof nativeReady !== 'undefined' && nativeReady") as? Bool == true
        }
        try await allowOrdinaryWebForFixture(host)
        let original = "const receiver=window.vaayvuEvent; window.testEvents=[]; window.vaayvuEvent=e=>{window.testEvents.push(e);receiver(e)};true"
        _ = try await chrome.evaluateJavaScript(original)
        let url = try XCTUnwrap(URL(string: "https://fixture.example/reading"))
        let id = "regular-fixture"
        host.handle(["type": "open", "id": id])
        let tab = try XCTUnwrap(host.tabs[id])
        host.emit(["type": "newtab", "id": id, "adopted": true, "url": url.absoluteString, "private": false, "background": false])
        let html = "<meta name='viewport' content='width=device-width'><title>Reading fixture</title><body style='background:#fdbb67'><h1>Reading fixture</h1><p>Text to read aloud.</p></body>"
        tab.web.loadSimulatedRequest(URLRequest(url: url), responseHTML: html)
        try await eventually { tab.web.title == "Reading fixture" && !tab.web.isLoading && host.visiblePage === tab.web && !tab.web.isHidden }
        XCTAssertGreaterThanOrEqual(chrome.frame.minY, host.view.safeAreaInsets.top)
        XCTAssertLessThanOrEqual(chrome.frame.maxY, host.view.bounds.height - host.view.safeAreaInsets.bottom + 1)

        host.handle(["type":"tabPreviews","requestId":"regular","tabs":[["id":id,"url":url.absoluteString]]])
        try await eventually {
            try await chrome.evaluateJavaScript("testEvents.some(e=>e.type==='tabPreview'&&e.requestId==='regular'&&e.image.startsWith('data:image/jpeg;base64,/9j/'))") as? Bool == true
        }
        host.command("tabOverview")
        try await eventually {
            try await chrome.evaluateJavaScript("!!document.querySelector('[data-ov-tab=regular-fixture] > img')?.naturalWidth") as? Bool == true
        }
        try await eventually { tab.web.isHidden }
        XCTAssertFalse(tab.web.isUserInteractionEnabled)
        _ = try await chrome.evaluateJavaScript("document.querySelector('[data-overview=done]').click();true")
        try await eventually { !tab.web.isHidden }

        host.handle(["type":"pageDisplay","id":id,"url":url.absoluteString,"action":"dark"])
        try await eventually {
            try await tab.web.evaluateJavaScript("document.documentElement.style.colorScheme === 'dark'") as? Bool == true
        }
        host.handle(["type":"pageDisplay","id":id,"url":url.absoluteString+"?other","action":"light"])
        let stillDark = try await tab.web.evaluateJavaScript("document.documentElement.style.colorScheme === 'dark'")
        XCTAssertEqual(stillDark as? Bool, true)
        host.handle(["type":"pageDisplay","id":id,"url":url.absoluteString,"action":"light"])
        try await eventually {
            try await tab.web.evaluateJavaScript("document.documentElement.style.colorScheme !== 'dark'") as? Bool == true
        }

        host.handle(["type":"readAloud","id":id,"url":url.absoluteString,"text":"This is a short test of the page reader."])
        host.handle(["type":"stopReading","id":id])
        try await eventually {
            try await chrome.evaluateJavaScript("testEvents.filter(e=>e.type==='readingState'&&e.id==='regular-fixture').map(e=>e.active).join(',')==='true,false'") as? Bool == true
        }

        host.handle(["type":"open","id":"private-fixture","private":true])
        let privateTab = try XCTUnwrap(host.tabs["private-fixture"])
        privateTab.web.loadSimulatedRequest(URLRequest(url: url), responseHTML: html)
        try await eventually { privateTab.web.title == "Reading fixture" && !privateTab.web.isLoading }
        host.handle(["type":"tabPreviews","requestId":"private","tabs":[["id":"private-fixture","url":url.absoluteString]]])
        host.handle(["type":"tabPreviews","requestId":"mismatch","tabs":[["id":id,"url":url.absoluteString+"?other"]]])
        try await Task.sleep(nanoseconds:200_000_000)
        let leaks = try await chrome.evaluateJavaScript("testEvents.filter(e=>e.type==='tabPreview'&&['private','mismatch'].includes(e.requestId)).length")
        XCTAssertEqual(leaks as? Int, 0)
    }
}

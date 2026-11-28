import AVFAudio
import UIKit
import UserNotifications
import WebKit

@MainActor
final class PhoneBrowserActions: NSObject, AVSpeechSynthesizerDelegate {
    private weak var host: BrowserHost?
    private let previews = NSCache<NSString, Preview>()
    private var previewGeneration = 0
    private var requestToken: String?
    private var requests: [String: (token: String, url: String)] = [:]
    private var scrollAnchor: CGFloat?
    private var lastScrollDirection: Bool?
    private lazy var speaker: AVSpeechSynthesizer = {
        let synthesizer = AVSpeechSynthesizer()
        synthesizer.delegate = self
        return synthesizer
    }()
    private var reading: (id: String, utterance: AVSpeechUtterance)?
    static let displayScript = Bundle.main.url(forResource: "page-display", withExtension: "js", subdirectory: "chrome")
        .flatMap { try? String(contentsOf: $0, encoding: .utf8) }

    private final class Preview {
        let url: URL
        let jpeg: Data
        init(_ url: URL, _ jpeg: Data) { self.url = url; self.jpeg = jpeg }
    }

    init(host: BrowserHost) {
        self.host = host
        super.init()
        previews.countLimit = 24
        previews.totalCostLimit = 3 * 1024 * 1024
        let center = NotificationCenter.default
        center.addObserver(self, selector: #selector(accessibilityChanged), name: UIAccessibility.reduceMotionStatusDidChangeNotification, object: nil)
        center.addObserver(self, selector: #selector(accessibilityChanged), name: UIAccessibility.reduceTransparencyStatusDidChangeNotification, object: nil)
        center.addObserver(self, selector: #selector(discardPreviews), name: UIApplication.didEnterBackgroundNotification, object: nil)
        center.addObserver(self, selector: #selector(discardPreviews), name: UIApplication.protectedDataWillBecomeUnavailableNotification, object: nil)
    }

    @objc func accessibilityChanged() {
        guard let host else { return }
        if #available(iOS 26.1, *), let controller = host.presentedViewController,
           controller is UIActivityViewController || controller is UIDocumentPickerViewController,
           let sheet = controller.presentationController {
            sheet.backgroundEffect = UIAccessibility.isReduceTransparencyEnabled ? nil : UIGlassEffect(style: .regular)
        }
        host.emit(["type": "accessibility", "reduceMotion": UIAccessibility.isReduceMotionEnabled,
                   "reduceTransparency": UIAccessibility.isReduceTransparencyEnabled])
    }

    @objc func discardPreviews() {
        previewGeneration &+= 1
        requestToken = nil
        previews.removeAllObjects()
        requests.removeAll()
    }

    func reset() {
        discardPreviews()
        if let reading { stopReading(id: reading.id) }
        resetScroll()
    }

    func forget(_ id: String) {
        previews.removeObject(forKey: id as NSString)
        requests[id] = nil
        host?.tabs[id]?.previewRevision &+= 1
        stopReading(id: id)
    }

    func requestPreviews(_ data: [String: Any]) {
        guard let host, !host.isPrivateWindow, !host.isGuestWindow, UIApplication.shared.isProtectedDataAvailable,
              let token = data["requestId"] as? String, !token.isEmpty, token.utf8.count <= 128,
              let list = data["tabs"] as? [[String: Any]], list.count <= 12 else { return }
        if requestToken != token { requests.removeAll(); requestToken = token }
        for entry in list {
            guard let id = entry["id"] as? String, let page = WebAddress.parse(entry["url"]),
                  let tab = host.tabs[id], !tab.isPrivate, tab.failure == nil, tab.web.url?.absoluteString == page.absoluteString else { continue }
            requests[id] = (token, page.absoluteString)
            if let existing = previews.object(forKey: id as NSString), existing.url == page { deliver(existing, id: id) }
            else { capture(id) }
        }
    }

    private func deliver(_ preview: Preview, id: String) {
        guard let request = requests[id], request.url == preview.url.absoluteString else { return }
        requests[id] = nil
        host?.emit(["type": "tabPreview", "requestId": request.token, "id": id, "url": request.url,
                    "image": "data:image/jpeg;base64," + preview.jpeg.base64EncodedString()])
    }

    func captureWhenSettled(_ id: String) {
        guard let host, let tab = host.tabs[id], !tab.isPrivate, !host.isPrivateWindow else { return }
        let url = tab.web.url
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self, weak tab] in
            if tab?.web.url == url { self?.capture(id) }
        }
    }

    func capture(_ id: String) {
        guard let host, !host.isPrivateWindow, !host.isGuestWindow,
              UIApplication.shared.isProtectedDataAvailable, UIApplication.shared.applicationState != .background, let tab = host.tabs[id],
              !tab.isPrivate, tab.failure == nil, !tab.web.isLoading, tab.web.window != nil,
              let url = tab.web.url, WebAddress.accepts(url) else { return }
        guard host.overviewSnapshot !== tab.web else { return }
        var ticket: Int?
        if tab.web.isHidden {
            guard requests[id]?.url == url.absoluteString, let issued = host.prepareOverviewSnapshot(tab.web, id: id) else { return }
            ticket = issued
        }
        guard tab.web.bounds.width > 4, tab.web.bounds.height > 4 else { return }
        let config = WKSnapshotConfiguration()
        let maxWidth = 320 / max(1, tab.web.traitCollection.displayScale)
        config.snapshotWidth = NSNumber(value: min(maxWidth, tab.web.bounds.width))
        config.afterScreenUpdates = ticket != nil
        if let ticket {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) { [weak host, weak tab] in
                if let web = tab?.web { host?.finishOverviewSnapshot(web, ticket: ticket) }
            }
        }
        tab.previewRevision &+= 1
        let revision = tab.previewRevision
        let generation = previewGeneration
        tab.web.takeSnapshot(with: config) { [weak self, weak tab] image, _ in
            if let ticket, let web = tab?.web { self?.host?.finishOverviewSnapshot(web, ticket: ticket) }
            guard let self, let host = self.host, let tab, let image, self.previewGeneration == generation,
                  host.tabs[id] === tab, tab.previewRevision == revision, tab.web.url == url,
                  UIApplication.shared.isProtectedDataAvailable, UIApplication.shared.applicationState != .background, let jpeg = image.jpegData(compressionQuality: 0.54),
                  jpeg.count <= 145_000 else { return }
            if (tab.web.isHidden || tab.web.window == nil), let prior = self.previews.object(forKey: id as NSString), prior.url == url {
                self.deliver(prior, id: id)
                return
            }
            let preview = Preview(url, jpeg)
            self.previews.setObject(preview, forKey: id as NSString, cost: jpeg.count)
            self.deliver(preview, id: id)
        }
    }

    func resetScroll() {
        scrollAnchor = nil
        lastScrollDirection = nil
    }

    @objc func panned(_ pan: UIPanGestureRecognizer) {
        guard let host, let id = host.active, let web = host.visiblePage, pan === web.scrollView.panGestureRecognizer else { return }
        let scroll = web.scrollView
        let offset = scroll.contentOffset.y + scroll.adjustedContentInset.top
        switch pan.state {
        case .began:
            scrollAnchor = offset
            lastScrollDirection = nil
        case .changed:
            guard scroll.contentSize.height > scroll.bounds.height + 48, let anchor = scrollAnchor else { return }
            let shouldCollapse = offset > anchor + 42 && offset > 24
            let shouldExpand = offset < anchor - 28 || offset <= 2
            if shouldCollapse || shouldExpand {
                scrollAnchor = offset
                let next = shouldCollapse && !shouldExpand
                if lastScrollDirection != next {
                    lastScrollDirection = next
                    host.emit(["type": "pageScroll", "id": id, "collapsed": next])
                }
            }
        case .ended, .cancelled:
            scrollAnchor = nil
            captureWhenSettled(id)
        default: break
        }
    }

    func appearance(_ data: [String: Any]) {
        guard let host, let raw = data["background"] as? String, raw.count == 7, raw.first == "#",
              let rgb = UInt32(raw.dropFirst(), radix: 16), let light = data["lightContent"] as? Bool else { return }
        host.view.backgroundColor = UIColor(red: CGFloat((rgb >> 16) & 255) / 255, green: CGFloat((rgb >> 8) & 255) / 255,
                                            blue: CGFloat(rgb & 255) / 255, alpha: 1)
        if host.lightSystemContent != light {
            host.lightSystemContent = light
            host.setNeedsStatusBarAppearanceUpdate()
        }
    }

    private func selectedPage(_ data: [String: Any]) -> (BrowserHost, String, BrowserTab, URL)? {
        guard let host, let id = data["id"] as? String, host.active == id, let tab = host.tabs[id], tab.failure == nil,
              let url = WebAddress.parse(data["url"]), tab.web.url?.absoluteString == url.absoluteString else { return nil }
        return (host, id, tab, url)
    }

    func readAloud(_ data: [String: Any]) {
        guard let (host, id, _, _) = selectedPage(data), let text = data["text"] as? String,
              !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, text.utf8.count <= 76_000 else { return }
        if let reading { stopReading(id: reading.id) }
        let utterance = AVSpeechUtterance(string: String(text.prefix(18_000)))
        reading = (id, utterance)
        speaker.speak(utterance)
        host.emit(["type": "readingState", "id": id, "active": true])
    }

    func stopReading(id: String) {
        guard reading?.id == id else { return }
        reading = nil
        speaker.stopSpeaking(at: .immediate)
        host?.emit(["type": "readingState", "id": id, "active": false])
    }

    private func finished(_ utterance: ObjectIdentifier) {
        guard let current = reading, ObjectIdentifier(current.utterance) == utterance else { return }
        reading = nil
        host?.emit(["type": "readingState", "id": current.id, "active": false])
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        let id = ObjectIdentifier(utterance)
        Task { @MainActor [weak self] in self?.finished(id) }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        let id = ObjectIdentifier(utterance)
        Task { @MainActor [weak self] in self?.finished(id) }
    }

    func changeDisplay(_ data: [String: Any]) {
        guard let (host, id, tab, url) = selectedPage(data), let script = Self.displayScript,
              let action = data["action"] as? String, ["pick", "undo", "dark", "light"].contains(action) else { return }
        let body = "if (location.href !== expected) return null; const apply = " + script + ";return apply(action);"
        tab.web.callAsyncJavaScript(body, arguments: ["expected": url.absoluteString, "action": action], in: nil, in: .defaultClient) { [weak host, weak tab] result in
            guard let host, let tab, host.active == id, tab.web.url == url else { return }
            if case .failure = result { host.notice("Page appearance could not be changed.") }
        }
    }

    func requestNotifications() {
        guard let host else { return }
        Task {
            let center = UNUserNotificationCenter.current()
            let settings = await center.notificationSettings()
            if settings.authorizationStatus == .denied {
                host.notice("Allow " + browserName + " notifications in Settings to receive page reminders.")
                return
            }
            do {
                let granted = try await center.requestAuthorization(options: [.alert, .sound])
                host.notice(granted
                    ? "Notifications enabled for page reminders."
                    : "Notifications stay off. You can enable them in Settings.")
            } catch {
                host.notice("Notifications could not be enabled. " + error.localizedDescription)
            }
        }
    }

    func remind(_ data: [String: Any]) {
        guard let (host, id, tab, url) = selectedPage(data), !host.isPrivateWindow, !tab.isPrivate,
              let seconds = data["seconds"] as? Int, [3600, 86400, 604800].contains(seconds) else { return }
        Task {
            let center = UNUserNotificationCenter.current()
            do {
                guard try await center.requestAuthorization(options: [.alert, .sound]) else {
                    host.notice("Allow " + browserName + " notifications in Settings to receive page reminders.")
                    return
                }
                guard host.active == id, host.tabs[id] === tab, tab.web.url == url else { return }
                let content = UNMutableNotificationContent()
                content.title = browserName + " page reminder"
                content.body = url.host ?? "Open your saved page."
                content.sound = .default
                content.categoryIdentifier = "VaayvuPageReminder"
                content.userInfo = ["url": url.absoluteString, "profile": host.profileID]
                let trigger = UNTimeIntervalNotificationTrigger(timeInterval: TimeInterval(seconds), repeats: false)
                try await center.add(UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: trigger))
                host.notice("Page reminder scheduled.")
            } catch { host.notice("Could not schedule this reminder. " + error.localizedDescription) }
        }
    }
}

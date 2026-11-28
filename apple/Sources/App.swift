import UIKit
import UserNotifications
import WebKit

let browserName = Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String ?? ProcessInfo.processInfo.processName

struct BrowserProfile: Codable {
    let id: UUID
    let chromeID: UUID
    let name: String
}

@main
@MainActor
final class VaayvuApp: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    private var handledReminders: [String] = []
    private var pendingURLs: [(String, URL)] = []

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        excludeBrowserFilesFromBackup()
        // Cap the shared URL cache so media/file responses can't pile up RAM.
        URLCache.shared = URLCache(memoryCapacity: 8 * 1024 * 1024, diskCapacity: 50 * 1024 * 1024)
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func application(_ application: UIApplication, shouldAllowExtensionPointIdentifier identifier: UIApplication.ExtensionPointIdentifier) -> Bool {
        guard identifier == .keyboard else { return true }
        let scenes = application.connectedScenes.compactMap { $0 as? UIWindowScene }
        guard let host = scenes.filter({ $0.activationState == .foregroundActive })
            .compactMap({ $0.keyWindow?.rootViewController as? BrowserHost }).first, host.websiteAccess,
              let page = host.visiblePage else { return false }
        func hasInputFocus(_ view: UIView) -> Bool { view.isFirstResponder || view.subviews.contains(where: hasInputFocus) }
        return hasInputFocus(page)
    }

    func excludeBrowserFilesFromBackup() {
        let files = FileManager.default
        var directories = files.urls(for: .libraryDirectory, in: .userDomainMask)
        if let documents = files.urls(for: .documentDirectory, in: .userDomainMask).first {
            directories.append(documents.appendingPathComponent("Downloads", isDirectory: true))
        }
        for directory in directories where files.fileExists(atPath: directory.path) {
            var url = directory
            var attributes = URLResourceValues()
            attributes.isExcludedFromBackup = true
            try? url.setResourceValues(attributes)
        }
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        [.banner, .list, .sound]
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let windows = scenes.sorted { $0.activationState == .foregroundActive && $1.activationState != .foregroundActive }.flatMap(\.windows)
        receive(response, in: windows.compactMap { $0.rootViewController as? BrowserHost }.first)
    }

    func receive(_ response: UNNotificationResponse?, in host: BrowserHost?) {
        if let response, response.actionIdentifier == UNNotificationDefaultActionIdentifier {
            let request = response.notification.request
            if request.content.categoryIdentifier == "VaayvuPageReminder", request.trigger is UNTimeIntervalNotificationTrigger,
               !handledReminders.contains(request.identifier), let url = WebAddress.parse(request.content.userInfo["url"]) {
                handledReminders.append(request.identifier)
                if handledReminders.count > 128 { handledReminders.removeFirst() }
                pendingURLs.append((request.content.userInfo["profile"] as? String ?? "default", url))
            }
        }
        if let scene = host?.profileScene {
            for (profile, url) in pendingURLs { scene.host(for: profile)?.openWhenReady(url) }
            pendingURLs.removeAll()
        }
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?
    private var privacyCover: UIView?

    func sceneWillResignActive(_ scene: UIScene) {
        guard let window, privacyCover == nil else { return }
        let cover = UIView(frame: window.bounds)
        cover.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        cover.backgroundColor = .systemBackground
        cover.accessibilityViewIsModal = true
        cover.accessibilityLabel = browserName
        if let image = UIImage(named: "VaayvuSplash") {
            let mark = UIImageView(image: image)
            mark.translatesAutoresizingMaskIntoConstraints = false
            mark.contentMode = .scaleAspectFit
            cover.addSubview(mark)
            NSLayoutConstraint.activate([mark.centerXAnchor.constraint(equalTo: cover.centerXAnchor),
                                         mark.centerYAnchor.constraint(equalTo: cover.centerYAnchor),
                                         mark.widthAnchor.constraint(equalToConstant: 64),
                                         mark.heightAnchor.constraint(equalToConstant: 64)])
        }
        window.addSubview(cover)
        privacyCover = cover
    }

    func sceneDidEnterBackground(_ scene: UIScene) {
        sceneWillResignActive(scene)
        scene.session.stateRestorationActivity = nil
        UIApplication.shared.ignoreSnapshotOnNextApplicationLaunch()
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        privacyCover?.removeFromSuperview()
        privacyCover = nil
    }

    func stateRestorationActivity(for scene: UIScene) -> NSUserActivity? { nil }

    var defaults = UserDefaults.standard
    private var profiles: [BrowserProfile] {
        guard let data = defaults.data(forKey: "Vaayvu.profiles"),
              let saved = try? JSONDecoder().decode([BrowserProfile].self, from: data) else { return [] }
        return saved
    }

    @discardableResult
    func host(for id: String) -> BrowserHost? {
        guard let window else { return nil }
        let current = window.rootViewController as? BrowserHost
        if let current, current.profileID == id { return current }
        let replacement = BrowserHost()
        if id != "default" {
            guard #available(iOS 17, *), let profile = profiles.first(where: { $0.id.uuidString == id }) else { return nil }
            replacement.profileID = id
            replacement.profileName = profile.name
            replacement.siteStore = WKWebsiteDataStore(forIdentifier: profile.id)
            replacement.chromeStore = WKWebsiteDataStore(forIdentifier: profile.chromeID)
        }
        replacement.profileScene = self
        current?.dismissWindow()
        window.rootViewController = replacement
        defaults.set(id, forKey: "Vaayvu.activeProfile")
        return replacement
    }

    func sendProfiles(to host: BrowserHost) {
        guard #available(iOS 17, *), window?.rootViewController === host, !host.isPrivateWindow else { return }
        let choices = [["id": "default", "name": "Personal"]] + profiles.map { ["id": $0.id.uuidString, "name": $0.name] }
        host.emit(["type": "profiles", "profiles": choices, "active": host.profileID, "guest": false])
    }

    func createProfile(named text: String, from current: BrowserHost) {
        guard #available(iOS 17, *), window?.rootViewController === current, !current.isPrivateWindow else { return }
        let name = String(text.trimmingCharacters(in: .whitespacesAndNewlines).prefix(60))
        var saved = profiles
        guard !name.isEmpty else { current.notice("Enter a profile name."); return }
        guard name.caseInsensitiveCompare("Personal") != .orderedSame && !saved.contains(where: { $0.name.caseInsensitiveCompare(name) == .orderedSame }) else {
            current.notice("This profile name is already in use.")
            return
        }
        let profile = BrowserProfile(id: UUID(), chromeID: UUID(), name: name)
        saved.append(profile)
        guard let data = try? JSONEncoder().encode(saved) else { return }
        defaults.set(data, forKey: "Vaayvu.profiles")
        host(for: profile.id.uuidString)
    }

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
        guard let scene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: scene)
        self.window = window
        let host = host(for: defaults.string(forKey: "Vaayvu.activeProfile") ?? "default") ?? host(for: "default")
        window.makeKeyAndVisible()
        (UIApplication.shared.delegate as? VaayvuApp)?.receive(options.notificationResponse, in: host)
    }
}

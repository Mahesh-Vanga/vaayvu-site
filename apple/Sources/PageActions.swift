import UniformTypeIdentifiers
import WebKit
import UIKit

extension BrowserHost {
    var capabilities: [String: Any] {
        var flags: [String: Any] = [
            "canIndiaSearch": indiaSearch.available,
            "canClearLegacyRecords": canClearLegacyRecords, "canClearSiteData": safeToClear, "canSavePage": true, "canCapture": true,
            "canImportBookmarks": !isPrivateWindow, "canExportBookmarks": !isPrivateWindow,
            "canImportPasswords": !isPrivateWindow,
            "canUserStyles": !isPrivateWindow, "canCustomBlock": TrackingProtection.rules != nil,
            "canSavePDF": true, "canZoom": true, "canEditPage": true, "canProtect": TrackingProtection.rules != nil, "canCopy": true, "canAdBlock": true, "canSitePermissions": false, "canBlockImages": false, "canBlockPopups": false, "canHaptic": true
        ]
        if #available(iOS 16.4, *) { flags["canInspect"] = true }
        if #available(iOS 17, *) { flags["canProfiles"] = !isPrivateWindow && profileScene != nil }
        flags["reduceMotion"] = UIAccessibility.isReduceMotionEnabled
        flags["reduceTransparency"] = UIAccessibility.isReduceTransparencyEnabled
        flags["canTabPreviews"] = !isPrivateWindow
        flags["canReadAloud"] = true
        flags["canPageDisplay"] = PhoneBrowserActions.displayScript != nil
        flags["canPageReminder"] = !isPrivateWindow
        flags["canDesktopSite"] = true
        flags["canPrint"] = UIPrintInteractionController.isPrintingAvailable
        return flags
    }

    func presentBrowserSheet(_ controller: UIViewController) {
        if #available(iOS 26.1, *), !UIAccessibility.isReduceTransparencyEnabled {
            controller.presentationController?.backgroundEffect = UIGlassEffect(style: .regular)
        }
        present(controller, animated: !UIAccessibility.isReduceMotionEnabled)
    }

    func applyUserStyle(_ css: String, to web: WKWebView, url: URL) {
        let script = """
        if (location.href !== expected || !document.documentElement) return;
        const key = Symbol.for('vaayvu.extensionStyle');
        const sheet = globalThis[key];
        if (!css) {
            if (sheet) document.adoptedStyleSheets = document.adoptedStyleSheets.filter(value => value !== sheet);
            delete globalThis[key];
        } else if ('adoptedStyleSheets' in document && typeof CSSStyleSheet.prototype.replaceSync === 'function') {
            const next = sheet || new CSSStyleSheet();
            next.replaceSync(css);
            if (!document.adoptedStyleSheets.includes(next)) document.adoptedStyleSheets = [...document.adoptedStyleSheets, next];
            globalThis[key] = next;
        } else {
            const old = globalThis.vaayvuFallbackStyle;
            if (old) old.remove();
            const node = document.createElement('style');
            node.textContent = css;
            (document.head || document.documentElement).appendChild(node);
            globalThis.vaayvuFallbackStyle = node;
        }
        if (!css && globalThis.vaayvuFallbackStyle) {
            globalThis.vaayvuFallbackStyle.remove();
            delete globalThis.vaayvuFallbackStyle;
        }
        """
        web.callAsyncJavaScript(script, arguments: ["expected": url.absoluteString, "css": css], in: nil, in: .defaultClient, completionHandler: nil)
    }

    func previewMenu(_ web: WKWebView, id: String, request: Any) {
        guard web.bounds.width > 0, web.bounds.height > 0, let url = web.url, WebAddress.accepts(url) else { return }
        previewSequence &+= 1
        let sequence = previewSequence
        let scale = web.traitCollection.displayScale
        let config = WKSnapshotConfiguration()
        let largest = max(web.bounds.width, web.bounds.height)
        config.snapshotWidth = NSNumber(value: Double(web.bounds.width * min(1, 900 / (largest * max(1, scale)))))
        config.afterScreenUpdates = true
        capturingPreview = web
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.6) { [weak self] in
            guard let self, self.previewSequence == sequence, self.capturingPreview != nil else { return }
            self.capturingPreview = nil
            self.layoutPage()
        }
        web.takeSnapshot(with: config) { [weak self, weak web] image, _ in
            guard let self else { return }
            if self.previewSequence == sequence {
                self.capturingPreview = nil
                self.layoutPage()
            }
            guard let web, let image, self.previewSequence == sequence, self.active == id, !self.isPrivateWindow,
                  self.tabs[id]?.isPrivate == false, self.tabs[id]?.web === web, web.url == url else { return }
            let jpeg = image.jpegData(compressionQuality: 0.66)
            guard let jpeg else { return }
            self.emit(["type": "menuPreview", "id": id, "requestId": request, "image": "data:image/jpeg;base64," + jpeg.base64EncodedString()])
        }
    }

    func editPage(_ web: WKWebView, action: String) {
        guard ["cut", "copy", "paste", "selectAll"].contains(action), !web.isHidden, web.superview != nil else { return }
        let selector = NSSelectorFromString(action + ":")
        func hasFocus(_ view: UIView) -> Bool { view.isFirstResponder || view.subviews.contains(where: hasFocus) }
        guard hasFocus(web) || web.becomeFirstResponder() else { return }
        let handled = UIApplication.shared.sendAction(selector, to: nil, from: web, for: nil)
        if !handled { notice("This editing action is unavailable for the current selection.") }
    }

    func printPage(_ web: WKWebView) {
        guard presentedViewController == nil, UIPrintInteractionController.isPrintingAvailable else { return }
        let printer = UIPrintInteractionController.shared
        let info = UIPrintInfo(dictionary: nil)
        info.jobName = web.title ?? (browserName + " Page")
        info.outputType = .general
        printer.printInfo = info
        printer.printFormatter = web.viewPrintFormatter()
        printer.present(from: CGRect(x: view.bounds.midX, y: 8, width: 1, height: 1), in: view, animated: true)
    }

    func exportPage(_ web: WKWebView, action: String) {
        let raw = web.title?.isEmpty == false ? web.title! : (web.url?.host ?? (browserName + " Page"))
        let cleaned = raw.components(separatedBy: CharacterSet(charactersIn: "/:\\").union(.controlCharacters)).joined(separator: "-")
        let name = String(cleaned.prefix(100)).trimmingCharacters(in: CharacterSet(charactersIn: ". "))
        let base = name.isEmpty ? browserName + " Page" : name
        Task {
            do {
                let (data, type) = try await Self.renderPage(web, action: action)
                saveDocument(data, filename: base + "." + (type.preferredFilenameExtension ?? "webarchive"), type: type)
            } catch { notice("Could not export the page. " + error.localizedDescription) }
        }
    }

    static func renderPage(_ web: WKWebView, action: String) async throws -> (Data, UTType) {
        switch action {
        case "savePDF": return (try await web.pdf(), .pdf)
        case "savePage":
            let data: Data = try await withCheckedThrowingContinuation { pending in
                web.createWebArchiveData { pending.resume(with: $0) }
            }
            return (data, .webArchive)
        case "capture":
            let image = try await web.takeSnapshot(configuration: nil)
            let png = image.pngData()
            guard let png else { throw CocoaError(.fileWriteUnknown) }
            return (png, .png)
        default: throw CocoaError(.featureUnsupported)
        }
    }

    func saveDocument(_ data: Data, filename: String, type: UTType) {
        guard presentedViewController == nil else { return }
        let folder = FileManager.default.temporaryDirectory.appendingPathComponent("vaayvu-export-" + UUID().uuidString, isDirectory: true)
        let file = folder.appendingPathComponent(filename)
        do {
            try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false)
            try data.write(to: file, options: .atomic)
            let picker = UIDocumentPickerViewController(forExporting: [file], asCopy: true)
            exportedFile = file
            picker.delegate = self
            presentBrowserSheet(picker)
        } catch {
            try? FileManager.default.removeItem(at: folder)
            notice(error.localizedDescription)
        }
    }

    func importBookmarks() {
        guard !isPrivateWindow else { return }
        guard presentedViewController == nil else { return }
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.html], asCopy: false)
        picker.delegate = self
        presentBrowserSheet(picker)
    }

    func readBookmarks(_ url: URL) {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        do {
            let file = try FileHandle(forReadingFrom: url)
            defer { try? file.close() }
            let limit = 2 * 1024 * 1024
            let data = try file.read(upToCount: limit + 1) ?? Data()
            guard data.count <= limit else { notice("Choose a bookmarks file smaller than 2 MB."); return }
            guard let html = String(data: data, encoding: .utf8) else { notice("Choose a UTF-8 HTML bookmarks file."); return }
            emit(["type": "bookmarkFile", "text": html])
        } catch { notice(error.localizedDescription) }
    }
}

extension BrowserHost: UIDocumentPickerDelegate {
    private func cleanExport() {
        guard let file = exportedFile else { return }
        try? FileManager.default.removeItem(at: file.deletingLastPathComponent())
        exportedFile = nil
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        if exportedFile != nil { cleanExport(); notice("Saved to Files.") }
        else if let url = urls.first { readBookmarks(url) }
    }

    func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) { cleanExport() }
}

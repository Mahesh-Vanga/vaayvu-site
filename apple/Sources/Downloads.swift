import WebKit
import UIKit

struct DownloadEntry {
    let destination: URL
    let originalURL: String
    let isPrivate: Bool
}

extension BrowserHost: WKDownloadDelegate {
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        guard websiteAccess else { download.cancel { _ in }; return }
        pendingDownloads[ObjectIdentifier(download)] = download
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        guard websiteAccess else { download.cancel { _ in }; return }
        pendingDownloads[ObjectIdentifier(download)] = download
        download.delegate = self
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String,
                  completionHandler: @escaping (URL?) -> Void) {
        guard websiteAccess, pendingDownloads[ObjectIdentifier(download)] != nil else { completionHandler(nil); return }
        let component = (suggestedFilename as NSString).lastPathComponent
        let name = component.isEmpty || component.hasPrefix(".") || component == "/" ? "Download" : component
        let isPrivate = download.webView?.configuration.websiteDataStore.isPersistent != true
        func save(_ destination: URL) {
            let key = ObjectIdentifier(download)
            guard websiteAccess, pendingDownloads[key] != nil else { completionHandler(nil); return }
            downloads[key] = DownloadEntry(destination: destination, originalURL: response.url?.absoluteString ?? "", isPrivate: isPrivate)
            completionHandler(destination)
        }
        let files = FileManager.default
        do {
            let folder = try files.url(for: .documentDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
                .appendingPathComponent("Downloads", isDirectory: true)
            try files.createDirectory(at: folder, withIntermediateDirectories: true)
            var storage = folder
            var attributes = URLResourceValues()
            attributes.isExcludedFromBackup = true
            try storage.setResourceValues(attributes)
            var destination = folder.appendingPathComponent(name)
            if files.fileExists(atPath: destination.path) || downloads.values.contains(where: { $0.destination == destination }) {
                destination = folder.appendingPathComponent("\(UUID().uuidString.prefix(8))-\(name)")
            }
            save(destination)
        } catch {
            notice("The download folder could not be created.")
            completionHandler(nil)
        }
    }

    func downloadDidFinish(_ download: WKDownload) {
        pendingDownloads.removeValue(forKey: ObjectIdentifier(download))
        guard let entry = downloads.removeValue(forKey: ObjectIdentifier(download)) else { return }
        if entry.isPrivate { notice("Download saved.") }
        else { emit(["type": "download", "private": false, "name": entry.destination.lastPathComponent, "url": entry.originalURL]) }
    }

    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        pendingDownloads.removeValue(forKey: ObjectIdentifier(download))
        downloads.removeValue(forKey: ObjectIdentifier(download))
        if (error as NSError).code != NSURLErrorCancelled { notice("Download failed. " + error.localizedDescription) }
    }
}

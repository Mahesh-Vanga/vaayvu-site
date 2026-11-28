import WebKit
import UIKit

extension BrowserHost {
    private func dialog(in web: WKWebView, frame: WKFrameInfo, text: String, cancel: Bool, input: String?,
                        completion: @escaping (Bool, String?) -> Void) {
        guard web.superview != nil, !web.isHidden, view.window != nil else { completion(false, nil); return }
        let site = frame.securityOrigin.host.isEmpty ? "Website" : frame.securityOrigin.host
        guard presentedViewController == nil else { completion(false, nil); return }
        let alert = UIAlertController(title: site, message: text, preferredStyle: .alert)
        if let input { alert.addTextField { $0.text = input } }
        if cancel { alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completion(false, nil) }) }
        alert.addAction(UIAlertAction(title: "OK", style: .default) { [weak alert] _ in completion(true, alert?.textFields?.first?.text) })
        present(alert, animated: true)
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        dialog(in: webView, frame: frame, text: message, cancel: false, input: nil) { _, _ in completionHandler() }
    }

    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        dialog(in: webView, frame: frame, text: message, cancel: true, input: nil) { accepted, _ in completionHandler(accepted) }
    }

    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String,
                 defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        dialog(in: webView, frame: frame, text: prompt, cancel: true, input: defaultText ?? "") { accepted, value in
            completionHandler(accepted ? value : nil)
        }
    }
}

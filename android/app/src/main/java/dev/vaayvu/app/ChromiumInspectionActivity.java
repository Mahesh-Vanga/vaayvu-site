package dev.vaayvu.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.RemoteException;
import android.os.ResultReceiver;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.webkit.ProfileStore;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.util.UUID;
import org.json.JSONObject;

/** The Android WebView debug switch is process-wide. Only the explicitly opened site copy lives here. */
public final class ChromiumInspectionActivity extends Activity {
    private static final String PROFILE_PREFIX = "inspect-";
    private static boolean directoryConfigured;
    private IInspectionPolicy policy;
    private final IBinder.DeathRecipient hostDied = () -> runOnUiThread(this::finish);
    private WebView page;
    private String profileName;
    private volatile String documentHost;

    static final class Session extends IInspectionPolicy.Stub {
        private volatile BrowserActivity browser;
        private ResultReceiver revoked;

        Session(BrowserActivity browser) { this.browser = browser; }

        @Override public synchronized void onRevoked(ResultReceiver callback) {
            if (browser == null) callback.send(0, null);
            else revoked = callback;
        }

        synchronized void revoke() {
            browser = null;
            if (revoked != null) revoked.send(0, null);
            revoked = null;
        }

        @Override public boolean permits(String document, String url, String fetchSite, boolean mainFrame) {
            BrowserActivity owner = browser;
            if (owner == null) return false;
            if (!BrowserActivity.webUrl(url)) {
                String scheme = Uri.parse(url).getScheme();
                return !mainFrame && ("data".equals(scheme) || "blob".equals(scheme) || "about".equals(scheme));
            }
            String host = Uri.parse(url).getHost();
            return mainFrame ? !owner.blocksDestination(host)
                : !owner.blocksTracker(document, host, fetchSite) && !owner.blocksAdBlock(document, host, false);
        }

        @Override public String bannerStyles(String document) {
            return "";
        }
    }

    static void open(BrowserActivity owner, Session policy, BrowserTab tab, String url) {
        WebSettings settings = tab.view.getSettings();
        Bundle extras = new Bundle();
        extras.putBinder("policy", policy);
        extras.putString("agent", settings.getUserAgentString());
        extras.putBoolean("javascript", settings.getJavaScriptEnabled());
        extras.putBoolean("images", settings.getLoadsImagesAutomatically());
        owner.startActivity(new Intent(owner, ChromiumInspectionActivity.class).setData(Uri.parse(url)).putExtras(extras));
    }

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        String url = getIntent().getDataString();
        Bundle extras = getIntent().getExtras();
        if (extras == null || !BrowserActivity.webUrl(url)) { finish(); return; }
        policy = IInspectionPolicy.Stub.asInterface(extras.getBinder("policy"));
        if (policy == null) { finish(); return; }
        try {
            policy.asBinder().linkToDeath(hostDied, 0);
            policy.onRevoked(new ResultReceiver(new Handler(Looper.getMainLooper())) {
                @Override protected void onReceiveResult(int result, Bundle data) { finish(); }
            });
            if (!policy.permits("", url, "", true)) { finish(); return; }
        } catch (RemoteException closed) { finish(); return; }
        if (!directoryConfigured) {
            WebView.setDataDirectorySuffix("chromium-inspection");
            directoryConfigured = true;
        }
        WebView.setWebContentsDebuggingEnabled(false);
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE)) { finish(); return; }
        ProfileStore store = ProfileStore.getInstance();
        for (String profile : store.getAllProfileNames()) {
            if (profile.startsWith(PROFILE_PREFIX)) deleteProfile(profile);
        }
        page = new WebView(this);
        profileName = PROFILE_PREFIX + UUID.randomUUID();
        WebViewCompat.setProfile(page, profileName);
        CookieManager.getInstance().setAcceptThirdPartyCookies(page, false);
        WebSettings settings = page.getSettings();
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setGeolocationEnabled(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setJavaScriptEnabled(extras.getBoolean("javascript"));
        settings.setLoadsImagesAutomatically(extras.getBoolean("images"));
        settings.setDomStorageEnabled(true);
        settings.setUserAgentString(extras.getString("agent"));
        page.setWebChromeClient(new WebChromeClient());
        page.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return request.isForMainFrame() && !BrowserActivity.webUrl(request.getUrl().toString());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                try {
                    if (!policy.permits(documentHost, request.getUrl().toString(),
                            request.getRequestHeaders().get("Sec-Fetch-Site"), request.isForMainFrame())) return BrowserActivity.denied();
                    if (request.isForMainFrame()) documentHost = request.getUrl().getHost();
                    return null;
                } catch (RemoteException closed) { return BrowserActivity.denied(); }
            }
            @Override public void onPageStarted(WebView view, String next, Bitmap icon) {
                documentHost = Uri.parse(next).getHost();
            }
            @Override public void onPageFinished(WebView view, String next) {
                if (!BrowserActivity.webUrl(next) || !next.equals(view.getUrl())) return;
                try {
                    String css = policy.bannerStyles(Uri.parse(next).getHost());
                    if (!css.isEmpty()) view.evaluateJavascript("(()=>{if(location.href!==" + JSONObject.quote(next)
                        + ")return;const sheet=new CSSStyleSheet();sheet.replaceSync(" + JSONObject.quote(css)
                        + ");document.adoptedStyleSheets=[...document.adoptedStyleSheets,sheet]})()", null);
                } catch (RemoteException closed) { finish(); }
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                finish();
                return true;
            }
        });
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        LinearLayout header = new LinearLayout(this);
        int pad = Math.round(12 * getResources().getDisplayMetrics().density);
        header.setPadding(pad, pad, pad, pad);
        TextView instructions = new TextView(this);
        instructions.setText("Inspecting a fresh copy. Connect this device with USB debugging, then open chrome://inspect/#devices on your computer and choose Inspect.");
        header.addView(instructions, new LinearLayout.LayoutParams(0, -2, 1));
        Button done = new Button(this);
        done.setText("Done");
        done.setOnClickListener(v -> finish());
        header.addView(done);
        layout.addView(header);
        layout.addView(page, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(layout);
        page.loadUrl(url);
    }

    @Override protected void onStart() {
        super.onStart();
        if (page != null && !isFinishing()) WebView.setWebContentsDebuggingEnabled(true);
    }

    @Override protected void onStop() {
        if (page != null) WebView.setWebContentsDebuggingEnabled(false);
        super.onStop();
    }

    @Override protected void onDestroy() {
        if (policy != null) policy.asBinder().unlinkToDeath(hostDied, 0);
        if (page != null) {
            WebView.setWebContentsDebuggingEnabled(false);
            ((ViewGroup)page.getParent()).removeView(page);
            page.destroy();
            deleteProfile(profileName);
        }
        super.onDestroy();
    }

    private static void deleteProfile(String name) {
        try { ProfileStore.getInstance().deleteProfile(name); }
        catch (IllegalStateException inUse) { /* Retry any abandoned inspection profile on the next launch. */ }
    }
}

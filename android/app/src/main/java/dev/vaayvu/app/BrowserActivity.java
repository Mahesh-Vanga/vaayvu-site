package dev.vaayvu.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.app.DownloadManager;
import android.app.NotificationManager;
import android.app.role.RoleManager;
import android.content.ClipboardManager;
import android.content.pm.ShortcutInfo;
import android.content.pm.ShortcutManager;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ComponentName;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Insets;
import android.graphics.Rect;
import android.graphics.drawable.Icon;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.SystemClock;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.Settings;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.WindowInsetsController;
import android.webkit.URLUtil;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.TextView;
import androidx.webkit.ProfileStore;
import androidx.webkit.Profile;
import androidx.webkit.WebStorageCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONArray;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.ArrayList;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.LinkedHashSet;
import java.util.UUID;

public final class BrowserActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final String START = ORIGIN + "/assets/index.html";
    private static final String PRIVATE_PREFIX = "vaayvu-private-";
    private static final String REGULAR_PREFIX = "vaayvu-web";
    private final Map<String, BrowserTab> tabs = new LinkedHashMap<>();
    private String privateProfile, regularProfile;
    private BrowserProfiles catalog;
    private String profileID = BrowserProfiles.PERSONAL;
    private boolean switching;
    private FrameLayout surface;
    private WebView chrome;
    private BrowserTab selected;
    private BrowserTab paneRightTab;
    private Rect paneLeft, paneRight;
    private BrowserTab videoTab;
    private View video;
    private WebChromeClient.CustomViewCallback videoCallback;
    private boolean viewportVisible, ready, profiles, fullscreen;
    private volatile boolean protection = true;
    private volatile boolean adBlockEnabled = true;
    private volatile boolean vfdAds = true;
    private volatile boolean vfdTrackers = true;
    private volatile boolean vfdSocial = true;
    private volatile boolean vfdCosmetic = true;
    private volatile boolean vfdAggressive = true;
    private List<String> trackerDomains = Collections.emptyList();
    private volatile List<String> customDomains = Collections.emptyList();
    private volatile Set<String> strictBlockHosts = Collections.emptySet();
    private volatile Set<String> vfdHostsAds = Collections.emptySet();
    private volatile Set<String> vfdHostsTrackers = Collections.emptySet();
    private volatile Set<String> vfdHostsSocial = Collections.emptySet();
    private volatile Set<String> vfdPatterns = Collections.emptySet();
    private volatile Set<String> vfdTrackerPatterns = Collections.emptySet();
    private volatile Set<String> vfdFirstParty = Collections.emptySet();
    private volatile java.util.List<TrackerProtection.VfdException> vfdExceptions = Collections.emptyList();
    private volatile String vfdCosmeticCSS = "";
    private volatile Set<String> pausedSites = Collections.emptySet();
    final SitePermissions sites = new SitePermissions(this);
    private BrowserFiles files;
    private final TabThumbnails thumbnails = new TabThumbnails(this);
    private final PageSpeech speech = new PageSpeech(this);
    private String pageDisplayScript;
    private IndiaSearch indiaSearch;
    private SystemAppearance appearance;
    private volatile boolean websiteAccess;
    private boolean websitePolicyKnown, consumedIncomingIntent;
    private FrameLayout root;
    private BrowserTab reminderTab;
    private String reminderUrl;
    private int reminderSeconds;
    private boolean previewBusy;
    private Runnable queuedPreview;
    private int left, top, width, height;
    private String pendingUrl, extractor, pendingBookmarkImport;
    private ChromiumInspectionActivity.Session inspection;
    private ValueCallback<Uri[]> uploadCallback;
    private WebView uploadOwner;
    private String uploadUrl;
    private SharedPreferences pendingDownloads;
    private final BroadcastReceiver downloadsFinished = new BroadcastReceiver() {
        @Override public void onReceive(Context context, Intent intent) { collectDownloads(); }
    };

    @Override public void onCreate(Bundle state) {
        setTheme(R.style.VaayvuTheme);
        super.onCreate(state);
        WebView.setWebContentsDebuggingEnabled(false);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        if (Build.VERSION.SDK_INT >= 33) setRecentsScreenshotEnabled(false);
        profiles = WebViewFeature.isFeatureSupported(WebViewFeature.MULTI_PROFILE);
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            TextView explanation = new TextView(this);
            explanation.setText("Update Android System WebView or Chrome in Google Play to run Vaayvu.");
            explanation.setTextSize(18);
            explanation.setPadding(48, 80, 48, 48);
            setContentView(explanation);
            return;
        }
        catalog = new BrowserProfiles(this);
        if (profiles) {
            String requested = reminderProfile(getIntent());
            if (requested != null) catalog.select(requested);
            profileID = catalog.active();
        }
        regularProfile = profilePrefs("browser").getString("regularProfile", sitesPrefix());
        protection = profilePrefs("browser").getBoolean("protection", true);
        customDomains = TrackerProtection.customDomains(profilePrefs("browser")
            .getStringSet("customDomains", Collections.emptySet()));
        trackerDomains = readTrackerDomains();
        android.content.SharedPreferences filters = profilePrefs("browser");
        adBlockEnabled = filters.getBoolean("adBlockEnabled", true);
        strictBlockHosts = filters.getStringSet("adBlockStrict", Collections.emptySet());
        pausedSites = filters.getStringSet("adBlockPausedSites", Collections.emptySet());
        files = new BrowserFiles(this, state != null && profileID.equals(state.getString("profileID",BrowserProfiles.PERSONAL)) ? state : null);
        if (profiles) {
            for (String name : ProfileStore.getInstance().getAllProfileNames()) {
                if (name.startsWith(PRIVATE_PREFIX) || ((name.equals(sitesPrefix()) || name.startsWith(sitesPrefix() + "-"))
                        && !regularProfile.equals(name))) deleteProfile(name);
            }
        }
        root = new FrameLayout(this);
        root.setBackgroundColor(getColor(R.color.browser_launch_background));
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, windowInsets) -> {
                Insets insets = windowInsets.getInsets(WindowInsets.Type.systemBars()
                    | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(insets.left, insets.top, insets.right, insets.bottom);
                return WindowInsets.CONSUMED;
            });
        }
        surface = new FrameLayout(this);
        root.addView(surface, -1, -1);
        setContentView(root);
        chrome = new WebView(this) {
            @Override public android.view.inputmethod.InputConnection onCreateInputConnection(android.view.inputmethod.EditorInfo editor) {
                android.view.inputmethod.InputConnection connection = super.onCreateInputConnection(editor);
                editor.imeOptions |= android.view.inputmethod.EditorInfo.IME_FLAG_NO_PERSONALIZED_LEARNING;
                return connection;
            }
        };
        chrome.setSaveEnabled(false);
        chrome.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
        if (Build.VERSION.SDK_INT >= 29) chrome.setImportantForContentCapture(View.IMPORTANT_FOR_CONTENT_CAPTURE_NO_EXCLUDE_DESCENDANTS);
        indiaSearch = new IndiaSearch(BuildConfig.INDIA_SEARCH_DEPLOYMENT, (id, token, rows, error) -> {
            if (!ready || switching || isDestroyed() || !START.equals(chrome.getUrl())) return;
            if (error == null) event("indiaSearchResult", "id", id, "requestId", token, "results", rows);
            else event("indiaSearchResult", "id", id, "requestId", token, "error", error);
        });
        appearance = new SystemAppearance(this, () -> {
            if (ready) event("accessibility", "reduceMotion", appearance.reduceMotion(), "reduceTransparency", appearance.reduceTransparency());
        });
        if (profiles && !BrowserProfiles.PERSONAL.equals(profileID)) WebViewCompat.setProfile(chrome, "vaayvu-interface-" + profileID);
        blockWebsiteWorkers(true);
        surface.addView(chrome, -1, -1);
        chrome.setBackgroundColor(getColor(R.color.browser_launch_background));
        chrome.getSettings().setSafeBrowsingEnabled(false); // The trusted view only navigates to packaged resources.
        chrome.getSettings().setJavaScriptEnabled(true);
        chrome.getSettings().setDomStorageEnabled(true);
        chrome.getSettings().setAllowFileAccess(false);
        chrome.getSettings().setAllowContentAccess(false);
        chrome.getSettings().setUseWideViewPort(true);
        WebViewAssetLoader assets = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        chrome.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return true;
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (request.isForMainFrame() && !START.equals(url.toString())) return denied();
                if (WebViewAssetLoader.DEFAULT_DOMAIN.equalsIgnoreCase(url.getHost())) {
                    WebResourceResponse asset = assets.shouldInterceptRequest(url);
                    return asset != null ? asset : denied();
                }
                return websiteAccess ? super.shouldInterceptRequest(view, request) : denied();
            }
        });
        chrome.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (!START.equals(view.getUrl())) { callback.onReceiveValue(null); return true; }
                return chooseFile(view, callback, params);
            }
        });
        WebViewCompat.addWebMessageListener(chrome, "VaayvuNative", Collections.singleton(ORIGIN),
            (view, message, origin, mainFrame, proxy) -> {
                if (!mainFrame || view != chrome || !START.equals(view.getUrl()) || !ORIGIN.equals(origin.toString())) return;
                String data = message.getData();
                if (data == null || data.length() > BrowserFiles.MAX_HTML_BYTES * 4) return;
                try { handle(new JSONObject(data)); }
                catch (JSONException ignored) { notice("Vaayvu received an unreadable browser command."); }
            });
        consumedIncomingIntent = state != null && state.getBoolean("consumedIncomingIntent")
            && profileID.equals(state.getString("profileID"));
        pendingUrl = !consumedIncomingIntent && allowReminder(getIntent()) ? intentUrl(getIntent()) : null;
        pendingDownloads = profilePrefs("downloads");
        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(downloadsFinished, filter, Context.RECEIVER_EXPORTED);
        else registerReceiver(downloadsFinished, filter);
        chrome.loadUrl(START);
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
            android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::onBackPressed);
    }

    static boolean webUrl(String value) {
        if (value == null || value.isEmpty() || value.length() > 8192) return false;
        try {
            java.net.URI url = java.net.URI.create(value);
            return ("https".equalsIgnoreCase(url.getScheme()) || "http".equalsIgnoreCase(url.getScheme()))
                && url.getRawUserInfo() == null && url.getHost() != null
                && !WebViewAssetLoader.DEFAULT_DOMAIN.equalsIgnoreCase(url.getHost());
        } catch (IllegalArgumentException ignored) { return false; }
    }

    static WebResourceResponse denied() {
        return new WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", Collections.emptyMap(), null);
    }

    private static String intentUrl(Intent intent) {
        String url = intent.getDataString();
        return Intent.ACTION_VIEW.equals(intent.getAction()) && webUrl(url) ? url : null;
    }

    String storageName(String base) { return BrowserProfiles.PERSONAL.equals(profileID) ? base : base + "." + profileID; }
    SharedPreferences profilePrefs(String base) { return getSharedPreferences(storageName(base), MODE_PRIVATE); }
    private String sitesPrefix() { return BrowserProfiles.PERSONAL.equals(profileID) ? REGULAR_PREFIX : "vaayvu-sites-" + profileID; }
    private String reminderProfile(Intent intent) {
        ComponentName component = intent.getComponent();
        if (component == null || !component.getClassName().equals(getPackageName() + ".ReminderLink")) return null;
        return intent.getStringExtra("profile");
    }
    private boolean allowReminder(Intent intent) {
        String id = reminderProfile(intent);
        return id == null || (id.equals(profileID) && catalog.name(id) != null);
    }
    private void switchProfile(String next, Intent pending) {
        if (!profiles || switching || next.equals(profileID) || !catalog.select(next)) return;
        switching = true;
        ready = false;
        indiaSearch.cancel(null, null);
        setWebsiteAccess(false);
        setIntent(pending != null ? pending : new Intent(this, BrowserActivity.class).setAction(Intent.ACTION_MAIN));
        recreate();
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        String id = reminderProfile(intent);
        if (id != null && !id.equals(profileID)) {
            if (profiles && catalog.name(id) != null) switchProfile(id, intent);
            else notice("Update Android System WebView to open this reminder in its browser profile.");
            return;
        }
        setIntent(intent);
        String url = intentUrl(intent);
        if (url != null) {
            consumedIncomingIntent = false;
            pendingUrl = url;
            deliverIntent();
        }
    }

    private void deliverIntent() {
        if (ready && websitePolicyKnown && pendingUrl != null) {
            if (websiteAccess) newTab(pendingUrl, false, false);
            else notice("Website access is turned off in Search settings.");
            pendingUrl = null;
            consumedIncomingIntent = true;
        }
    }

    boolean websiteAccess() { return websiteAccess; }

    private void blockWebsiteWorkers(boolean block) {
        if (!profiles) {
            android.webkit.ServiceWorkerController.getInstance().getServiceWorkerWebSettings().setBlockNetworkLoads(block);
            return;
        }
        ProfileStore store = ProfileStore.getInstance();
        for (String name : store.getAllProfileNames()) {
            Profile profile = store.getProfile(name);
            if (profile != null) profile.getServiceWorkerController().getServiceWorkerWebSettings().setBlockNetworkLoads(true);
        }
        if (!block) {
            Profile profile = store.getOrCreateProfile(regularProfile);
            profile.getServiceWorkerController().getServiceWorkerWebSettings().setBlockNetworkLoads(false);
        }
    }

    private void setWebsiteAccess(boolean enabled) {
        websitePolicyKnown = true;
        for (BrowserTab tab : tabs.values()) tab.userApprovedVisit = false;
        websiteAccess = enabled;
        blockWebsiteWorkers(!enabled);
        if (!enabled) {
            cancelActiveWebsiteDownloads();
            if (files != null) files.discardExport();
            queuedPreview = null;
            JSONArray ids = new JSONArray(tabs.keySet());
            for (String tabID : new ArrayList<>(tabs.keySet())) {
                WebView site = tabs.get(tabID).view;
                site.getSettings().setBlockNetworkLoads(true);
                site.stopLoading();
                closeTab(tabID);
            }
            if (ready && ids.length() > 0) event("resetWebTabs", "ids", ids);
        }
        if (enabled) collectDownloads();
        deliverIntent();
    }

    void newTab(String url, boolean privateTab, boolean background) {
        if (websiteAccess && webUrl(url)) event("newtab", "url", url, "private", privateTab, "background", background);
    }

    BrowserTab adoptPopup(BrowserTab opener, String profile) {
        String id = UUID.randomUUID().toString();
        BrowserTab popup = new BrowserTab(this, id, opener.privateTab, profile, true);
        popup.setDesktopSite(opener.desktopSite, false);
        tabs.put(id, popup);
        event("newtab", "id", id, "url", "", "private", opener.privateTab, "desktopSite", opener.desktopSite, "adopted", true);
        return popup;
    }

    void popupClosed(WebView window) {
        for (BrowserTab tab : tabs.values()) {
            if (tab.view != window || !tab.popupWindow) continue;
            closeTab(tab.id); event("tabclosed", "id", tab.id); return;
        }
    }

    boolean supportsPrivate() { return profiles; }

    void event(String type, Object... fields) {
        if (isDestroyed() || chrome == null) return;
        JSONObject payload = new JSONObject();
        try {
            payload.put("type", type);
            for (int i = 0; i < fields.length; i += 2) payload.put((String)fields[i], fields[i + 1]);
        } catch (JSONException e) { throw new IllegalArgumentException(e); }
        chrome.evaluateJavascript("window.vaayvuEvent && window.vaayvuEvent(" + payload + ")", null);
    }

    void notice(String text) { event("notice", "message", text); }

    private List<String> readTrackerDomains() {
        try (InputStream stream = getAssets().open("tracking.json");
             java.util.Scanner scanner = new java.util.Scanner(stream, StandardCharsets.UTF_8.name())) {
            JSONArray domains = new JSONArray(scanner.useDelimiter("\\A").next());
            List<String> rules = new ArrayList<>(domains.length());
            for (int i = 0; i < domains.length(); i++) rules.add(domains.getString(i).toLowerCase(java.util.Locale.ROOT));
            return rules;
        } catch (IOException | JSONException | java.util.NoSuchElementException e) { return Collections.emptyList(); }
    }

    boolean blocksTracker(String page, String resource, String fetchSite) {
        return adBlockEnabled && protection && (TrackerProtection.blocks(page, resource, fetchSite, trackerDomains)
            || TrackerProtection.blocks(page, resource, fetchSite, customDomains));
    }

    synchronized boolean blocksDestination(String host) { return adBlockEnabled && adBlockMatch(host, strictBlockHosts); }

    synchronized boolean blocksMainFrameAd(String documentHost, String resourceHost, boolean privateTab) {
        if (!adBlockEnabled || resourceHost == null) return false;
        if (adBlockMatch(resourceHost, strictBlockHosts)) return true;
        if (TrackerProtection.paused(documentHost, privateTab, pausedSites)) return false;
        return vfdAds && adBlockMatch(resourceHost, vfdHostsAds);
    }

    synchronized boolean isAdShieldActive(String document, boolean privateTab) {
        if (!adBlockEnabled) return false;
        return !TrackerProtection.paused(document, privateTab, pausedSites);
    }

    // VAAYVU filter decision. Mirrors chrome/vfd.js precedence; the message
    // carries small compiled sets, so nothing is truncated. Returns the
    // matching kind, or null to allow.
    synchronized String blockingKind(String document, String url, String resource, boolean privateTab) {
        if (!adBlockEnabled || url == null) return null;
        if (blocksDestination(resource)) return "strict";
        return TrackerProtection.vfdVerdict(url, document, privateTab,
            Collections.<String>emptySet(), pausedSites,
            vfdHostsAds, vfdHostsTrackers, vfdHostsSocial,
            vfdPatterns, vfdTrackerPatterns, vfdFirstParty, vfdExceptions,
            true, adBlockEnabled && vfdAds, adBlockEnabled && vfdTrackers, vfdSocial, vfdAggressive);
    }

    synchronized boolean blocksAdBlock(String document, String resource, boolean privateTab) {
        return blockingKind(document, resource, resource, privateTab) != null;
    }

    synchronized String vfdCosmeticCSS(String document, boolean privateTab) {
        if (!adBlockEnabled || !vfdCosmetic || vfdCosmeticCSS.isEmpty()) return "";
        if (TrackerProtection.paused(document, privateTab, pausedSites)) return "";
        return vfdCosmeticCSS;
    }

    private static Set<String> hostSet(org.json.JSONArray values) {
        Set<String> out = new LinkedHashSet<>();
        if (values != null) for (int i = 0; i < Math.min(values.length(), 30000); i++) {
            if (values.opt(i) instanceof String) {
                String h = values.optString(i).toLowerCase(java.util.Locale.ROOT);
                if (h.length() >= 3 && h.length() <= 253 && !h.contains(" ")) out.add(h);
            }
        }
        return out;
    }

    private static Set<String> tokenSet(org.json.JSONArray values) {
        Set<String> out = new LinkedHashSet<>();
        if (values != null) for (int i = 0; i < Math.min(values.length(), 512); i++) {
            if (values.opt(i) instanceof String) {
                String t = values.optString(i).toLowerCase(java.util.Locale.ROOT);
                if (t.length() >= 2 && t.length() <= 64) out.add(t);
            }
        }
        return out;
    }

    private static Set<String> tokenPatSet(org.json.JSONArray values) {
        Set<String> out = new LinkedHashSet<>();
        if (values != null) for (int i = 0; i < Math.min(values.length(), 128); i++) {
            if (values.opt(i) instanceof String) {
                String t = values.optString(i).toLowerCase(java.util.Locale.ROOT);
                if ((t.length() >= 5 || !t.contains("/")) && t.length() >= 2 && t.length() <= 64) out.add(t);
            }
        }
        return out;
    }

    private static java.util.List<TrackerProtection.VfdException> parseExceptions(org.json.JSONArray values) {
        java.util.List<TrackerProtection.VfdException> out = new java.util.ArrayList<>();
        if (values == null) return out;
        for (int i = 0; i < Math.min(values.length(), 256); i++) {
            org.json.JSONObject rule = values.optJSONObject(i);
            if (rule == null) continue;
            java.util.Set<String> hosts = hostSet(rule.optJSONArray("hosts"));
            java.util.List<String> paths = new java.util.ArrayList<>();
            org.json.JSONArray raw = rule.optJSONArray("paths");
            if (raw != null) for (int j = 0; j < Math.min(raw.length(), 64); j++) {
                String t = raw.optString(j, "").toLowerCase(java.util.Locale.ROOT);
                if (!t.isEmpty() && t.length() <= 128) paths.add(t);
            }
            out.add(new TrackerProtection.VfdException(hosts, paths));
        }
        return out;
    }

    private static Set<String> blockHosts(JSONArray values) {
        Set<String> hosts = new LinkedHashSet<>();
        if (values != null) for (int i = 0; i < Math.min(values.length(), 8000); i++) {
            if (values.opt(i) instanceof String && values.optString(i).length() <= 253) hosts.add(values.optString(i).toLowerCase(java.util.Locale.ROOT));
        }
        return hosts;
    }

    private static final java.util.Set<String> MULTI_PART = new java.util.HashSet<>(java.util.Arrays.asList(
        "co.uk", "com.au", "co.jp", "co.nz", "com.br", "co.in", "com.mx",
        "co.za", "com.tr", "co.kr", "com.sg", "com.hk", "com.tw", "co.il"));

    static String adBlockSite(String host) {
        if (host == null) return "";
        String lower = host.toLowerCase(java.util.Locale.ROOT).replaceFirst("\\.$", "");
        String[] parts = lower.split("\\.");
        if (parts.length <= 2) return lower;
        String last = parts[parts.length - 2] + "." + parts[parts.length - 1];
        return MULTI_PART.contains(last) ? parts[parts.length - 3] + "." + last : last;
    }

    static boolean adBlockMatch(String host, Set<String> adBlockHosts) {
        if (host == null || adBlockHosts == null || adBlockHosts.isEmpty()) return false;
        String lower = host.toLowerCase(java.util.Locale.ROOT);
        if (lower.endsWith(".")) lower = lower.substring(0, lower.length() - 1);
        if (adBlockHosts.contains(lower)) return true;
        int dot = lower.indexOf('.');
        while (dot != -1) {
            if (adBlockHosts.contains(lower.substring(dot + 1))) return true;
            dot = lower.indexOf('.', dot + 1);
        }
        return false;
    }

    private void handle(JSONObject msg) {
        if (switching || isDestroyed()) return;
        String id = msg.optString("id");
        BrowserTab tab = tabs.get(id);
        String url = msg.optString("url");
        switch (msg.optString("type")) {
            case "ready":
                ready = true;
                event("ready", "platform", "android", "privateSupported", profiles,
                    "canProfiles", profiles, "profileId", profileID, "profileName", catalog.name(profileID),
                    "canClearSiteData", profiles, "canSavePage", true, "canCapture", true,
                    "canImportBookmarks", true, "canExportBookmarks", true, "canPrint", true,
                    "canSavePDF", true, "canZoom", true, "canProtect", !trackerDomains.isEmpty(),
                    "canCopy", true, "canEditPage", true, "canFullscreen", true, "canSystemPasswords", true,
                    "canImportPasswords", true,
                    "canCustomBlock", true, "canOpenDownloads", true, "canOpenDownload", true,
                    "canDesktopSite", true, "canUserStyles", true, "canInspect", profiles, "canNativeInspector", profiles,
                    "canTabPreviews", true, "canPrivacyReport", true, "canPageDisplay", true, "canPageReminder", true,
                    "canReadAloud", speech.available(), "canVoiceSearch", false, "canIndiaSearch", indiaSearch.available(),
                    "reduceMotion", appearance.reduceMotion(), "reduceTransparency", appearance.reduceTransparency(),
                    "canDefaultBrowser", getSystemService(RoleManager.class).isRoleAvailable(RoleManager.ROLE_BROWSER),
                    "canDnsSettings", true,
                    "canSystemVPN", true, "canShortcut", getSystemService(ShortcutManager.class).isRequestPinShortcutSupported(),
                    "canAdBlock", true, "canSitePermissions", true, "canBlockImages", true, "canBlockPopups", true,
                    "canHaptic", true);
                collectDownloads();
                if (profiles) event("profiles","profiles",catalog.catalog(),"active",profileID,"guest",false);
                deliverIntent();
                if (pendingBookmarkImport != null) importedBookmarks(pendingBookmarkImport);
                break;
            case "websiteAccess":
                setWebsiteAccess(Boolean.TRUE.equals(msg.opt("enabled")));
                break;
            case "mobileAppearance":
                appearance.apply(root, msg.optString("background"), msg.optBoolean("lightContent"));
                break;
            case "indiaSearch":
                indiaSearch.start(id, msg.optString("requestId"), msg.opt("q") instanceof String ? msg.optString("q") : "");
                break;
            case "cancelIndiaSearch":
                if (msg.opt("requestId") instanceof String) indiaSearch.cancel(msg.has("id") ? id : null, msg.optString("requestId"));
                break;
            case "newProfile":
                if (profiles) {
                    try { switchProfile(catalog.create(msg.optString("name")), null); }
                    catch (IllegalArgumentException e) { notice(e.getMessage()); }
                }
                break;
            case "switchProfile":
                if (profiles) switchProfile(id, null);
                break;
            case "viewport":
                if (viewportVisible && !msg.optBoolean("visible")) {
                    thumbnails.remember(selected); thumbnails.remember(paneRightTab);
                }
                left = pixels(msg, "x"); top = pixels(msg, "y");
                width = pixels(msg, "width"); height = pixels(msg, "height");
                viewportVisible = msg.optBoolean("visible");
                setSplit(null);
                paneLeft = null; paneRight = null;
                layoutTab();
                break;
            case "panes": {
                JSONArray panes = msg.optJSONArray("panes");
                if (panes == null || panes.length() != 2) { setSplit(null); paneLeft = null; paneRight = null; break; }
                JSONObject leftPane = panes.optJSONObject(0), rightPane = panes.optJSONObject(1);
                BrowserTab leftTab = tabs.get(leftPane.optString("id"));
                BrowserTab rightTab = tabs.get(rightPane.optString("id"));
                if (leftTab == null || rightTab == null || leftTab == rightTab) {
                    setSplit(null); paneLeft = null; paneRight = null; break;
                }
                if (viewportVisible && !msg.optBoolean("visible")) {
                    thumbnails.remember(selected); thumbnails.remember(paneRightTab);
                }
                select(leftTab);
                setSplit(rightTab);
                paneLeft = paneRect(leftPane);
                paneRight = paneRect(rightPane);
                viewportVisible = msg.optBoolean("visible");
                layoutTab();
                break;
            }
            case "open":
                boolean approvedVisit = Boolean.TRUE.equals(msg.opt("userApprovedVisit"));
                if (!websiteAccess && !approvedVisit) break;
                if (id.isEmpty() || id.length() > 256) return;
                if (!webUrl(url)) { event("openfailed", "id", id, "message", "This address cannot be opened in Vaayvu."); return; }
                boolean secret = msg.optBoolean("private");
                if (secret && !profiles) {
                    event("openfailed", "id", id, "message", "Update Android System WebView to enable isolated private tabs.");
                    return;
                }
                if (tab == null) {
                    if (secret && privateProfile == null) privateProfile = PRIVATE_PREFIX + UUID.randomUUID();
                    String profile = secret ? privateProfile : profiles ? regularProfile : null;
                    tab = new BrowserTab(this, id, secret, profile, false);
                    tabs.put(id, tab);
                    if (!websiteAccess && profile != null) ProfileStore.getInstance().getOrCreateProfile(profile)
                        .getServiceWorkerController().getServiceWorkerWebSettings().setBlockNetworkLoads(true);
                }
                tab.userApprovedVisit = !websiteAccess && approvedVisit;
                tab.setDesktopSite(msg.optBoolean("desktopSite"), false);
                if (!msg.optBoolean("background")) select(tab);
                tab.view.loadUrl(url);
                break;
            case "select": select(tab); break;
            case "close": indiaSearch.cancel(id, null); closeTab(id); break;
            case "navigate":
                if (tab == null || !tab.canLoadWebsite()) break;
                if (tab != null && webUrl(url)) tab.view.loadUrl(url);
                else if (tab != null) tabFailed(tab, "This address cannot be opened in Vaayvu.");
                break;
            case "back": if (tab != null && tab.view.canGoBack()) tab.view.goBack(); break;
            case "forward": if (tab != null && tab.view.canGoForward()) tab.view.goForward(); break;
            case "reload": if (tab != null) tab.reload(); break;
            case "stop": if (tab != null) { tab.view.stopLoading(); tab.loading = false; tab.update(); } break;
            case "find": if (tab != null) tab.find(msg.optString("query"), msg.optBoolean("backwards")); break;
            case "extract": if (tab != null && tab == selected) extract(tab); break;
            case "openDeveloperTools":
                if (profiles && tab != null && selected == tab && tab.canInspect(url)) {
                    endInspection();
                    inspection = new ChromiumInspectionActivity.Session(this);
                    ChromiumInspectionActivity.open(this, inspection, tab, url);
                }
                break;
            case "tabPreviews": thumbnails.respond(msg.opt("requestId"), msg.optJSONArray("tabs")); break;
            case "privacyReport":
                if (tab != null && tab == selected && !tab.privateTab && (url.isEmpty() || url.equals(tab.view.getUrl()))) {
                    tab.privacy.report(msg.opt("requestId"), tab.view.getUrl());
                }
                break;
            case "readAloud":
                if (tab != null && tab == selected) speech.start(tab, url, msg.optString("text"));
                break;
            case "stopReading": if (tab != null) speech.stop(tab); break;
            case "pageDisplay":
                if (tab != null && tab == selected && tab.hasDrawablePage() && url.equals(tab.view.getUrl())) {
                    pageDisplay(tab, url, msg.optString("action"));
                }
                break;
            case "pageReminder":
                if (tab != null && tab == selected && !tab.privateTab && tab.hasDrawablePage() && url.equals(tab.view.getUrl())) {
                    startReminder(tab, url, msg.optInt("seconds"));
                }
                break;
            case "requestNotifications":
                requestNotificationPermission();
                break;
            case "zoom": if (tab != null) tab.zoom(msg.optInt("percent", 100)); break;
            case "desktopSite": if (tab != null) tab.setDesktopSite(msg.optBoolean("enabled"), true); break;
            case "userStyles": if (tab != null) tab.userStyles(url, msg.optString("css")); break;
            case "print": case "savePDF":
                if (websiteAccess && tab != null && tab == selected) print(tab, msg.optString("type").equals("savePDF"));
                break;
            case "savePage": if (websiteAccess && tab != null && tab == selected) files.archive(tab.view); break;
            case "capture": if (websiteAccess && tab != null && tab == selected) files.capture(tab.view); break;
            case "menuPreview": requestPreview(tab, msg.opt("requestId")); break;
            case "importBookmarks": files.importBookmarks(); break;
            case "exportBookmarks":
                if (websiteAccess) files.exportBookmarks(msg.optString("text"));
                else notice("Enable ordinary websites to export through Android’s document providers.");
                break;
            case "fullscreen": toggleFullscreen(); break;
            case "clearSiteData": clearSiteData(); break;
            case "clearCookies": {
                if (!profiles) { notice("Update Android System WebView to clear website cookies separately from your Vaayvu ID."); break; }
                Profile regular = ProfileStore.getInstance().getProfile(regularProfile);
                if (regular != null) regular.getCookieManager().removeAllCookies(removed -> notice("Cleared this profile’s website cookies."));
                else notice("This profile has no website cookies.");
                break;
            }
            case "protection":
                protection = msg.optBoolean("enabled", true);
                JSONArray pList = msg.optJSONArray("domains");
                if (pList != null) {
                    List<String> entries = new ArrayList<>();
                    for (int i = 0; i < Math.min(128, pList.length()); i++) if (pList.opt(i) instanceof String) entries.add(pList.optString(i));
                    customDomains = TrackerProtection.customDomains(entries);
                }
                profilePrefs("browser").edit().putBoolean("protection", protection)
                    .putStringSet("customDomains", new java.util.HashSet<>(customDomains)).apply();
                break;
            case "blocklist":
                // VAAYVU's own filter database, compiled by the UI into small
                // flat lists. No giant downloads, no truncation.
                synchronized (this) {
                    adBlockEnabled = msg.optBoolean("enabled", true);
                    org.json.JSONObject lists = msg.optJSONObject("lists");
                    vfdAds = lists == null || lists.optBoolean("ads", true);
                    vfdTrackers = lists == null || lists.optBoolean("trackers", true);
                    vfdSocial = lists == null || lists.optBoolean("social", true);
                    vfdCosmetic = lists == null || lists.optBoolean("cosmetic", true);
                    vfdAggressive = lists == null || lists.optBoolean("aggressive", true);
                    vfdHostsAds = hostSet(msg.optJSONArray("hostsAds"));
                    vfdHostsTrackers = hostSet(msg.optJSONArray("hostsTrackers"));
                    vfdHostsSocial = hostSet(msg.optJSONArray("hostsSocial"));
                    strictBlockHosts = hostSet(msg.optJSONArray("strict"));
                    pausedSites = blockHosts(msg.optJSONArray("pausedSites"));
                    vfdPatterns = tokenSet(msg.optJSONArray("patterns"));
                    vfdTrackerPatterns = tokenSet(msg.optJSONArray("trackerPatterns"));
                    vfdFirstParty = tokenPatSet(msg.optJSONArray("firstPartyPatterns"));
                    vfdExceptions = parseExceptions(msg.optJSONArray("exceptions"));
                    StringBuilder css = new StringBuilder();
                    org.json.JSONArray selectors = msg.optJSONArray("selectors");
                    if (vfdCosmetic && selectors != null) {
                        for (int i = 0; i < Math.min(selectors.length(), 256); i++) {
                            String sel = selectors.optString(i, "");
                            if (!sel.isEmpty() && sel.length() <= 256 && !sel.contains(":has(")) {
                                if (css.length() > 0) css.append(',');
                                css.append(sel);
                            }
                        }
                    }
                    vfdCosmeticCSS = css.length() == 0 ? "" : css.toString() + "{display:none!important}";
                    profilePrefs("browser").edit().putBoolean("adBlockEnabled", adBlockEnabled).apply();
                }
                for (BrowserTab t : tabs.values()) t.applyAdShield();
                if (msg.optBoolean("reloadActive", false) && selected != null && webUrl(selected.view.getUrl())) {
                    selected.reload();
                }
                break;
            case "openDownloads": if (websiteAccess) openDownloads(); break;
            case "haptic":
                if (selected != null) selected.view.performHapticFeedback(android.view.HapticFeedbackConstants.KEYBOARD_TAP);
                break;
            case "openDownload": if (websiteAccess) openDownload(msg.optString("downloadId")); break;
            case "requestDefaultBrowser": requestDefaultBrowser(); break;
            case "dnsSettings":
                // Private DNS lives under network settings on Android.
                try { startActivity(new Intent("android.settings.WIRELESS_SETTINGS")); }
                catch (ActivityNotFoundException e) { openSettings(Settings.ACTION_WIRELESS_SETTINGS); }
                break;
            case "systemPasswords": openSettings(Build.VERSION.SDK_INT >= 35 ? Settings.ACTION_CREDENTIAL_PROVIDER : Settings.ACTION_SYNC_SETTINGS); break;
            case "systemVPN": openSettings(Settings.ACTION_VPN_SETTINGS); break;
            case "sitePermissions": notice("Website permissions are requested when a site needs them. Android manages them in Settings > Apps > " + getString(R.string.app_name) + " > Permissions."); break;
            case "contentSettings": {
                boolean blockImages = msg.optBoolean("blockImages", false);
                boolean blockPopups = msg.optBoolean("blockPopups", true);
                profilePrefs("browser").edit()
                    .putBoolean("blockImages", blockImages)
                    .putBoolean("blockPopups", blockPopups).apply();
                for (BrowserTab t : tabs.values()) {
                    t.view.getSettings().setLoadsImagesAutomatically(!blockImages);
                    t.view.getSettings().setJavaScriptCanOpenWindowsAutomatically(!blockPopups);
                }
                break;
            }
            case "shortcut": if (websiteAccess && tab != null && tab == selected && !tab.privateTab) pinShortcut(tab); break;
            case "copy":
                if (!websiteAccess) { notice("Clipboard sharing is off in India-only mode."); break; }
                String text = msg.optString("text");
                if (!text.isEmpty() && text.length() <= 100000) {
                    getSystemService(ClipboardManager.class).setPrimaryClip(ClipData.newPlainText("Vaayvu", text));
                    notice("Copied to clipboard.");
                }
                break;
            case "editPage": if (websiteAccess && tab != null && tab == selected) editPage(tab, msg.optString("action")); break;
            case "share": if (websiteAccess && tab != null && webUrl(tab.view.getUrl())) share(tab.view.getUrl()); break;
            case "external":
                if (websiteAccess && webUrl(url)) {
                    Intent chooser = Intent.createChooser(new Intent(Intent.ACTION_VIEW, Uri.parse(url)), "Open in");
                    chooser.putExtra(Intent.EXTRA_EXCLUDE_COMPONENTS, new ComponentName[]{getComponentName()});
                    startActivity(chooser);
                }
                break;
        }
    }

    private void requestPreview(BrowserTab tab, Object token) {
        if (tab == null || tab != selected || tab.privateTab || !(token instanceof Number || token instanceof String)) return;
        if (previewBusy) { queuedPreview = () -> requestPreview(tab, token); return; }
        String url = tab.view.getUrl();
        if (!webUrl(url)) return;
        previewBusy = true;
        files.preview(tab.view, image -> {
            previewBusy = false;
            if (image != null && !isDestroyed() && selected == tab && url.equals(tab.view.getUrl())) {
                event("menuPreview", "id", tab.id, "requestId", token, "image", image);
            }
            if (queuedPreview != null && !isDestroyed()) { Runnable next = queuedPreview; queuedPreview = null; next.run(); }
        });
    }

    void importedBookmarks(String html) {
        if (ready) { pendingBookmarkImport = null; event("bookmarkFile", "text", html); }
        else pendingBookmarkImport = html;
    }

    @Override protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        out.putString("profileID", profileID);
        out.putBoolean("consumedIncomingIntent", consumedIncomingIntent);
        if (files != null) files.saveState(out);
    }

    private void clearSiteData() {
        if (!profiles) { notice("Update Android System WebView to clear website data separately from your Vaayvu ID."); return; }
        String old = regularProfile;
        String fresh = sitesPrefix() + "-" + UUID.randomUUID();
        if (!profilePrefs("browser").edit().putString("regularProfile", fresh).commit()) {
            notice("Android could not reset website storage. Try again."); return;
        }
        regularProfile = fresh;
        JSONArray ids = new JSONArray();
        for (BrowserTab tab : new ArrayList<>(tabs.values())) {
            if (!tab.privateTab) { ids.put(tab.id); closeTab(tab.id); }
        }
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DELETE_BROWSING_DATA)) {
            Profile previous = ProfileStore.getInstance().getProfile(old);
            if (previous != null) {
                WebStorageCompat.deleteBrowsingData(previous.getWebStorage(), () -> {
                    deleteProfile(old);
                    notice("Cleared regular websites’ cookies, storage and cache.");
                });
            } else notice("Regular website storage is empty.");
        } else if (deleteProfile(old)) notice("Cleared regular websites’ cookies, storage and cache.");
        else notice("Regular tabs now use clean storage. Restart Vaayvu to finish removing older site data.");
        event("resetWebTabs", "ids", ids);
    }

    private void editPage(BrowserTab tab, String action) {
        int code;
        switch (action) {
            case "cut": code = KeyEvent.KEYCODE_X; break;
            case "copy": code = KeyEvent.KEYCODE_C; break;
            case "paste": code = KeyEvent.KEYCODE_V; break;
            case "selectAll": code = KeyEvent.KEYCODE_A; break;
            default: return;
        }
        tab.view.requestFocus();
        long when = SystemClock.uptimeMillis();
        for (int phase : new int[]{KeyEvent.ACTION_DOWN, KeyEvent.ACTION_UP}) {
            tab.view.dispatchKeyEvent(new KeyEvent(when, when, phase, code, 0, KeyEvent.META_CTRL_ON));
        }
    }

    private void openSettings(String action) {
        try {
            Intent intent = new Intent(action);
            if (Build.VERSION.SDK_INT >= 35 && Settings.ACTION_CREDENTIAL_PROVIDER.equals(action)) {
                intent.setData(Uri.parse("package:" + getPackageName()));
            }
            startActivity(intent);
        }
        catch (ActivityNotFoundException e) {
            try { startActivity(new Intent(Settings.ACTION_SETTINGS)); notice("Find the relevant option in Android Settings."); }
            catch (ActivityNotFoundException missing) { notice("Android Settings is unavailable."); }
        }
    }

    private void pinShortcut(BrowserTab tab) {
        String url = tab.view.getUrl();
        if (!webUrl(url)) return;
        ShortcutManager manager = getSystemService(ShortcutManager.class);
        if (!manager.isRequestPinShortcutSupported()) { notice("This launcher does not support website shortcuts."); return; }
        String title = BrowserFiles.pageName(tab.view);
        ShortcutInfo shortcut = new ShortcutInfo.Builder(this, UUID.nameUUIDFromBytes(url.getBytes(StandardCharsets.UTF_8)).toString())
            .setShortLabel(title).setIcon(Icon.createWithResource(this, R.drawable.vaayvu_logo))
            .setIntent(new Intent(this, BrowserActivity.class).setAction(Intent.ACTION_VIEW).setData(Uri.parse(url))).build();
        if (!manager.requestPinShortcut(shortcut, null)) notice("The launcher could not add this shortcut.");
    }

    private void print(BrowserTab tab, boolean pdf) {
        String title = BrowserFiles.pageName(tab.view);
        try {
            getSystemService(PrintManager.class).print(title, tab.view.createPrintDocumentAdapter(title), new PrintAttributes.Builder().build());
            notice(pdf ? "Choose Save as PDF in the Android print sheet." : "Opened Android print options.");
        } catch (RuntimeException e) { notice("Android could not open print options for this page."); }
    }

    private void toggleFullscreen() {
        fullscreen = !fullscreen;
        setSystemFullscreen(fullscreen || video != null);
        notice(fullscreen ? "Entered fullscreen." : "Exited fullscreen.");
    }

    private void setSystemFullscreen(boolean enabled) {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controls = getWindow().getInsetsController();
            if (controls != null) {
                controls.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                if (enabled) controls.hide(WindowInsets.Type.systemBars()); else controls.show(WindowInsets.Type.systemBars());
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(enabled ? View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY : View.SYSTEM_UI_FLAG_VISIBLE);
        }
    }

    void showVideo(BrowserTab owner, View content, WebChromeClient.CustomViewCallback callback) {
        if (video != null || !isShowing(owner)) { callback.onCustomViewHidden(); return; }
        video = content; videoTab = owner; videoCallback = callback;
        content.setBackgroundColor(Color.BLACK);
        surface.addView(content, -1, -1);
        setSystemFullscreen(true);
    }

    void hideVideo(BrowserTab owner) {
        if (video == null || videoTab != owner) return;
        surface.removeView(video);
        WebChromeClient.CustomViewCallback callback = videoCallback;
        video = null; videoTab = null; videoCallback = null;
        setSystemFullscreen(fullscreen);
        callback.onCustomViewHidden();
    }

    private void extract(BrowserTab tab) {
        if (extractor == null) {
            try (InputStream stream = getAssets().open("extract.js");
                 java.util.Scanner scanner = new java.util.Scanner(stream, StandardCharsets.UTF_8.name())) {
                extractor = scanner.useDelimiter("\\A").next();
            } catch (IOException e) { notice("The page reader could not start."); return; }
        }
        String url = tab.view.getUrl();
        if (!webUrl(url)) return;
        tab.view.evaluateJavascript(extractor, encoded -> {
            if (selected != tab || !url.equals(tab.view.getUrl())) return;
            try {
                Object value = new org.json.JSONTokener(encoded).nextValue();
                String text = value instanceof String ? (String)value : "";
                event("text", "id", tab.id, "url", url, "title", tab.view.getTitle(),
                    "text", text.substring(0, Math.min(text.length(), 18000)));
            } catch (JSONException ignored) { notice("Could not read this page."); }
        });
    }

    private void endInspection() {
        if (inspection != null) inspection.revoke();
        inspection = null;
    }

    BrowserTab lookupTab(String id) { return tabs.get(id); }

    void documentChanged(BrowserTab tab) {
        if (tab == selected) endInspection();
        thumbnails.forget(tab.id); speech.stop(tab);
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 98);
            return;
        }
        NotificationManager notifications = getSystemService(NotificationManager.class);
        if (notifications != null && notifications.areNotificationsEnabled())
            notice("Notifications are enabled for Vaayvu.");
        else
            notice("Enable notifications for Vaayvu in Android’s app settings.");
    }

    private void startReminder(BrowserTab tab, String url, int seconds) {
        if (!PageReminders.validDelay(seconds)) return;
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            if (reminderTab != null) return;
            reminderTab = tab; reminderUrl = url; reminderSeconds = seconds;
            requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 97);
            return;
        }
        finishReminder(url, seconds);
    }

    private void finishReminder(String url, int seconds) {
        if (PageReminders.schedule(this, url, seconds, profileID)) notice("Page reminder scheduled.");
        else notice("Check Android’s notification settings for Vaayvu to schedule page reminders.");
    }

    private void pageDisplay(BrowserTab tab, String url, String action) {
        if (!java.util.Arrays.asList("pick","undo","dark","light").contains(action)) return;
        if (pageDisplayScript == null) {
            try (InputStream stream = getAssets().open("page-display.js");
                 java.util.Scanner scanner = new java.util.Scanner(stream, StandardCharsets.UTF_8.name())) {
                pageDisplayScript = scanner.useDelimiter("\\A").next();
            } catch (IOException | java.util.NoSuchElementException e) { notice("Page appearance is unavailable."); return; }
        }
        String code = "(()=>{if(location.href!==" + JSONObject.quote(url) + ")return;(" + pageDisplayScript +
            ")(" + JSONObject.quote(action) + ")})()";
        tab.view.evaluateJavascript(code, null);
    }

    private int pixels(JSONObject msg, String key) {
        return Math.max(0, Math.round((float)msg.optDouble(key, 0) * getResources().getDisplayMetrics().density));
    }

    private Rect paneRect(JSONObject pane) {
        return new Rect(
            pixels(pane, "x"), pixels(pane, "y"),
            pixels(pane, "x") + pixels(pane, "width"), pixels(pane, "y") + pixels(pane, "height"));
    }

    private void setSplit(BrowserTab tab) {
        if (paneRightTab == tab) return;
        if (paneRightTab != null && paneRightTab != selected) {
            thumbnails.remember(paneRightTab); surface.removeView(paneRightTab.view);
        }
        paneRightTab = tab;
        if (tab != null && tab != selected && surface.indexOfChild(tab.view) < 0) surface.addView(tab.view);
    }

    private void select(BrowserTab tab) {
        if (selected != tab) {
            if (selected != null) { endInspection(); thumbnails.remember(selected); speech.stop(selected); selected.resetScroll(); }
            if (selected != null) hideVideo(selected);
            if (selected != null) sites.cancel(selected);
            if (selected != null && selected != paneRightTab) surface.removeView(selected.view);
            selected = tab;
            if (tab != null && surface.indexOfChild(tab.view) < 0) surface.addView(tab.view);
        }

        layoutTab();
        if (tab != null) tab.update();
    }

    private void layoutTab() {
        if (selected == null) return;
        if (paneRightTab != null && paneLeft != null && paneRight != null) {
            placeTab(selected.view, paneLeft);
            placeTab(paneRightTab.view, paneRight);
            return;
        }
        FrameLayout.LayoutParams frame = new FrameLayout.LayoutParams(
            Math.max(0, Math.min(width, surface.getWidth() - left)),
            Math.max(0, Math.min(height, surface.getHeight() - top)));
        frame.leftMargin = left;
        frame.topMargin = top;
        selected.view.setLayoutParams(frame);
        selected.view.setVisibility(viewportVisible && frame.width > 0 && frame.height > 0 ? View.VISIBLE : View.GONE);
    }

    private void placeTab(WebView view, Rect rect) {
        int w = Math.max(0, Math.min(rect.width(), surface.getWidth() - rect.left));
        int h = Math.max(0, Math.min(rect.height(), surface.getHeight() - rect.top));
        FrameLayout.LayoutParams frame = new FrameLayout.LayoutParams(w, h);
        frame.leftMargin = rect.left;
        frame.topMargin = rect.top;
        view.setLayoutParams(frame);
        view.setVisibility(viewportVisible && w > 0 && h > 0 ? View.VISIBLE : View.GONE);
    }

    private void closeTab(String id) {
        BrowserTab tab = tabs.remove(id);
        if (tab == null) return;
        sites.cancel(tab);
        if (paneRightTab == tab) {
            surface.removeView(tab.view);
            paneRightTab = null;
            paneLeft = null;
            paneRight = null;
        }
        if (tab == selected) select(null);
        thumbnails.forget(id); speech.stop(tab);
        tab.destroy();
        if (tab.privateTab && tabs.values().stream().noneMatch(item -> item.privateTab)) {
            deleteProfile(privateProfile);
            privateProfile = null;
        }
    }

    boolean isShowing(BrowserTab tab) { return selected == tab && viewportVisible; }

    void tabFailed(BrowserTab tab, String message) {
        if (tabs.get(tab.id) != tab) return;
        closeTab(tab.id);
        event("openfailed", "id", tab.id, "message", message);
    }

    private boolean deleteProfile(String name) {
        try { ProfileStore.getInstance().deleteProfile(name); return true; }
        catch (IllegalStateException ignored) { return false; }
    }

    @Override protected void onStop() {
        super.onStop();
        if (indiaSearch != null) indiaSearch.suspend();
        for (BrowserTab tab : tabs.values()) {
            if (!tab.privateTab) {
                CookieManager cookies = profiles ? WebViewCompat.getProfile(tab.view).getCookieManager() : CookieManager.getInstance();
                new Thread(cookies::flush, "Vaayvu website cookies").start();
                break;
            }
        }
    }

    @Override protected void onPause() {
        super.onPause();
        if (chrome != null) chrome.onPause();
        for (BrowserTab tab : tabs.values()) if (tab.view != null) tab.view.onPause();
    }

    @Override protected void onResume() {
        super.onResume();
        if (chrome != null) chrome.onResume();
        for (BrowserTab tab : tabs.values()) if (tab.view != null) tab.view.onResume();
    }

    @Override public void onTrimMemory(int level) {
        super.onTrimMemory(level);
        if (level >= android.content.ComponentCallbacks2.TRIM_MEMORY_MODERATE) {
            if (chrome != null) chrome.clearCache(true);
            for (BrowserTab tab : tabs.values()) if (tab.view != null) tab.view.clearCache(true);
            System.gc();
        }
    }

    void share(String url) {
        if (!websiteAccess || !webUrl(url)) return;
        startActivity(Intent.createChooser(new Intent(Intent.ACTION_SEND).setType("text/plain")
            .putExtra(Intent.EXTRA_TEXT, url), "Share page"));
    }

    private void openDownloads() {
        try { startActivity(new Intent(DownloadManager.ACTION_VIEW_DOWNLOADS)); }
        catch (ActivityNotFoundException ignored) { notice("Open Downloads in the Android Files app."); }
    }

    private void requestDefaultBrowser() {
        RoleManager manager = getSystemService(RoleManager.class);
        if (manager.isRoleHeld(RoleManager.ROLE_BROWSER)) { notice("Vaayvu is already your default browser."); return; }
        if (!manager.isRoleAvailable(RoleManager.ROLE_BROWSER)) { notice("The default browser setting is unavailable on this device."); return; }
        try { startActivityForResult(manager.createRequestRoleIntent(RoleManager.ROLE_BROWSER), 91); }
        catch (ActivityNotFoundException e) { openSettings(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS); }
    }

    private void openDownload(String value) {
        try {
            long id = Long.parseLong(value);
            String owner = getSharedPreferences("download-owners",MODE_PRIVATE).getString(value, BrowserProfiles.PERSONAL);
            if (!profileID.equals(owner)) { notice("This download belongs to a different browser profile."); return; }
            DownloadManager manager = getSystemService(DownloadManager.class);
            Uri file = manager.getUriForDownloadedFile(id);
            if (file == null) { notice("Android could not find that download."); return; }
            String mime = manager.getMimeTypeForDownloadedFile(id);
            startActivity(new Intent(Intent.ACTION_VIEW).setDataAndType(file, mime == null ? "*/*" : mime)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
        } catch (NumberFormatException | SecurityException e) { notice("Android could not open that download."); }
        catch (ActivityNotFoundException e) { openDownloads(); }
    }

    void offerDownload(String url, String disposition, String mime, boolean secret) {
        if (!websiteAccess) return;
        if (!webUrl(url)) { notice("This download requires an HTTP or HTTPS file link."); return; }
        String proposed = URLUtil.guessFileName(url, disposition, mime).replaceAll("[^\\p{L}\\p{N}._ -]", "_");
        String name = proposed.replaceFirst("^\\.+", "");
        String filename = name.trim().isEmpty() ? "download" : name.substring(0, Math.min(name.length(), 180));
        new AlertDialog.Builder(this).setTitle("Save to Downloads?")
            .setMessage(filename + "\n" + Uri.parse(url).getHost())
            .setNegativeButton("Cancel", null).setPositiveButton("Download", (dialog, button) -> {
                if (!websiteAccess) return;
                try {
                    DownloadManager manager = getSystemService(DownloadManager.class);
                    String destination = unusedDownloadName(manager, filename);
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url))
                        .setTitle(destination).setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                        .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, destination);
                    if (mime != null && mime.matches("[a-zA-Z0-9.+_-]+/[a-zA-Z0-9.+_-]+")) request.setMimeType(mime);
                    long downloadId = manager.enqueue(request);
                    getSharedPreferences("download-owners",MODE_PRIVATE).edit().putString(Long.toString(downloadId), secret ? "private" : profileID).apply();
                    if (!secret) {
                        String metadata = new org.json.JSONArray().put(destination).put(url).toString();
                        pendingDownloads.edit().putString(Long.toString(downloadId), metadata).apply();
                        collectDownloads();
                    }
                    notice("Download queued. Android shows progress in notifications.");
                } catch (RuntimeException error) { notice("Android could not queue this download."); }
            }).show();
    }

    private void cancelActiveWebsiteDownloads() {
        DownloadManager manager = getSystemService(DownloadManager.class);
        int inProgress = DownloadManager.STATUS_PENDING | DownloadManager.STATUS_RUNNING | DownloadManager.STATUS_PAUSED;
        // DownloadManager.query is scoped to transfers owned by this application.
        // A remembered ID can belong to another profile or to a finished file.
        try (Cursor rows = manager.query(new DownloadManager.Query().setFilterByStatus(inProgress))) {
            if (rows == null) return;
            while (rows.moveToNext()) {
                long id = rows.getLong(rows.getColumnIndexOrThrow(DownloadManager.COLUMN_ID));
                try (Cursor active = manager.query(new DownloadManager.Query().setFilterById(id).setFilterByStatus(inProgress))) {
                    if (active != null && active.moveToFirst()) manager.remove(id);
                }
            }
        } catch (RuntimeException e) { notice("Android could not cancel an active download. Check Downloads."); }
    }

    private String unusedDownloadName(DownloadManager manager, String proposed) {
        java.util.Set<String> names = new java.util.HashSet<>();
        int active = DownloadManager.STATUS_SUCCESSFUL | DownloadManager.STATUS_PENDING | DownloadManager.STATUS_RUNNING | DownloadManager.STATUS_PAUSED;
        try (Cursor rows = manager.query(new DownloadManager.Query().setFilterByStatus(active))) {
            if (rows != null) while (rows.moveToNext()) {
                String uri = rows.getString(rows.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI));
                if (uri != null) names.add(Uri.parse(uri).getLastPathSegment());
                names.add(rows.getString(rows.getColumnIndexOrThrow(DownloadManager.COLUMN_TITLE)));
            }
        }
        java.io.File downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        return distinctName(proposed, name -> names.contains(name) || new java.io.File(downloads, name).exists());
    }

    static String distinctName(String proposed, java.util.function.Predicate<String> exists) {
        int dot = proposed.lastIndexOf('.');
        String ext = dot > 0 && proposed.length() - dot <= 16 ? proposed.substring(dot) : "";
        String stem = proposed.substring(0, proposed.length() - ext.length());
        while (stem.getBytes(StandardCharsets.UTF_8).length > 180) {
            stem = stem.substring(0, stem.offsetByCodePoints(stem.length(), -1));
        }
        String result = stem + ext;
        for (int suffix = 2; exists.test(result); suffix++) result = stem + " (" + suffix + ")" + ext;
        return result;
    }

    private void collectDownloads() {
        if (!ready || !websiteAccess || pendingDownloads == null) return;
        DownloadManager manager = getSystemService(DownloadManager.class);
        for (Map.Entry<String, ?> entry : pendingDownloads.getAll().entrySet()) {
            long id = Long.parseLong(entry.getKey());
            try (Cursor rows = manager.query(new DownloadManager.Query().setFilterById(id))) {
                if (rows == null) continue;
                if (rows.moveToFirst()) {
                    int status = rows.getInt(rows.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                    if (status == DownloadManager.STATUS_SUCCESSFUL) {
                        org.json.JSONArray item = new org.json.JSONArray((String)entry.getValue());
                        event("download", "name", item.getString(0), "url", item.getString(1), "downloadId", entry.getKey(), "private", false);
                    } else if (status == DownloadManager.STATUS_FAILED) notice("Android could not finish the download.");
                    else continue;
                }
            } catch (JSONException ignored) { /* Discard an unreadable queue entry. */ }
            pendingDownloads.edit().remove(entry.getKey()).apply();
        }
    }

    boolean chooseFile(WebView owner, ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {
        if (uploadCallback != null) { callback.onReceiveValue(null); return true; }
        uploadCallback = callback;
        uploadOwner = owner; uploadUrl = owner.getUrl();
        Intent open = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
        open.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE);
        String[] accept = params.getAcceptTypes();
        java.util.LinkedHashSet<String> mimeTypes = new java.util.LinkedHashSet<>();
        if (accept != null) for (String group : accept) for (String value : group.split(",")) {
            String mime = value.trim().toLowerCase(java.util.Locale.ROOT);
            if (mime.equals(".zip") || mime.equals("application/zip")) {
                mimeTypes.add("application/zip"); mimeTypes.add("application/x-zip-compressed"); mimeTypes.add("application/octet-stream");
            } else if (mime.contains("/")) mimeTypes.add(mime);
        }
        if (!mimeTypes.isEmpty()) open.putExtra(Intent.EXTRA_MIME_TYPES, mimeTypes.toArray(new String[0]));
        try { startActivityForResult(open, 7); }
        catch (ActivityNotFoundException e) { finishUpload(null); }
        return true;
    }

    @Override protected void onActivityResult(int code, int resultCode, Intent data) {
        super.onActivityResult(code, resultCode, data);
        if (code == 91) { notice(resultCode == RESULT_OK ? "Vaayvu is your default browser." : "Default browser selection was canceled."); return; }
        if (files != null && files.onResult(code, resultCode, data)) return;
        if (code != 7 || uploadCallback == null) return;
        java.util.List<Uri> files = new java.util.ArrayList<>();
        if (resultCode == RESULT_OK && data != null) {
            ClipData clip = data.getClipData();
            if (clip != null) {
                for (int i = 0; i < clip.getItemCount(); i++) addContentUri(files, clip.getItemAt(i).getUri());
            } else addContentUri(files, data.getData());
        }
        boolean samePage = (uploadOwner == chrome || (selected != null && selected.view == uploadOwner))
            && uploadUrl != null && uploadUrl.equals(uploadOwner.getUrl());
        finishUpload(samePage && !files.isEmpty() ? files.toArray(new Uri[0]) : null);
    }

    private void finishUpload(Uri[] files) {
        ValueCallback<Uri[]> callback = uploadCallback;
        uploadCallback = null; uploadOwner = null; uploadUrl = null;
        if (callback != null) callback.onReceiveValue(files);
    }

    private static void addContentUri(java.util.List<Uri> list, Uri uri) {
        if (uri != null && "content".equals(uri.getScheme())) list.add(uri);
    }

    @Override public boolean onKeyShortcut(int keyCode, KeyEvent event) {
        if (event.isAltPressed() && (keyCode == KeyEvent.KEYCODE_DPAD_LEFT || keyCode == KeyEvent.KEYCODE_DPAD_RIGHT)) {
            event("command", "command", keyCode == KeyEvent.KEYCODE_DPAD_LEFT ? "back" : "forward"); return true;
        }
        if (!event.isAltPressed() && (event.isCtrlPressed() || event.isMetaPressed())) {
            String name = null;
            switch (keyCode) {
                case KeyEvent.KEYCODE_T: name = event.isShiftPressed() ? "reopenTab" : "newTab"; break;
                case KeyEvent.KEYCODE_W: name = "closeTab"; break;
                case KeyEvent.KEYCODE_L: name = "focusAddress"; break;
                case KeyEvent.KEYCODE_F: name = "find"; break;
                case KeyEvent.KEYCODE_R: name = "reload"; break;
                case KeyEvent.KEYCODE_D: name = "bookmark"; break;
                case KeyEvent.KEYCODE_A: if (event.isShiftPressed()) name = "manageTabs"; break;
                case KeyEvent.KEYCODE_J: name = "downloads"; break;
                case KeyEvent.KEYCODE_H: name = "history"; break;
                case KeyEvent.KEYCODE_P: name = event.isShiftPressed() ? "quick" : "print"; break;
                case KeyEvent.KEYCODE_EQUALS: case KeyEvent.KEYCODE_PLUS: name = "zoomIn"; break;
                case KeyEvent.KEYCODE_MINUS: name = "zoomOut"; break;
                case KeyEvent.KEYCODE_0: name = "zoomReset"; break;
                case KeyEvent.KEYCODE_TAB: name = event.isShiftPressed() ? "previousTab" : "nextTab"; break;
            }
            if (name != null) { event("command", "command", name); return true; }
        }
        return super.onKeyShortcut(keyCode, event);
    }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(code, permissions, grants);
        if (code == 98) {
            notice(grants.length > 0 && grants[0] == android.content.pm.PackageManager.PERMISSION_GRANTED
                ? "Notifications enabled for page reminders."
                : "Notifications stay off. You can enable them in Android settings.");
            return;
        }
        if (code == 97) {
            BrowserTab tab = reminderTab;
            String url = reminderUrl;
            reminderTab = null; reminderUrl = null;
            if (tab != null && tab == selected && tab.hasDrawablePage() && url.equals(tab.view.getUrl())) {
                if (grants.length > 0 && grants[0] == android.content.pm.PackageManager.PERMISSION_GRANTED)
                    finishReminder(url, reminderSeconds);
                else notice("Enable notifications for Vaayvu to receive page reminders.");
            }
            return;
        }
        sites.result(code);
    }

    @Override public void onBackPressed() {
        if (video != null) { hideVideo(videoTab); return; }
        if (chrome == null) { super.onBackPressed(); return; }
        chrome.evaluateJavascript("Boolean(window.vaayvuBack && window.vaayvuBack(true))", handled -> {
            if ("true".equals(handled)) return;
            if (viewportVisible && selected != null && selected.view.canGoBack()) selected.view.goBack();
            else if (viewportVisible && selected != null) event("command", "command", "closeTab");
            else moveTaskToBack(true);
        });
    }

    @Override protected void onDestroy() {
        endInspection();
        if (indiaSearch != null) indiaSearch.close();
        if (appearance != null) appearance.close();
        thumbnails.close(); speech.dispose();
        if (files != null) files.dispose(isFinishing());
        if (pendingDownloads != null) unregisterReceiver(downloadsFinished);
        for (String id : new java.util.ArrayList<>(tabs.keySet())) closeTab(id);
        finishUpload(null);
        if (chrome != null) { surface.removeView(chrome); chrome.destroy(); chrome = null; }
        super.onDestroy();
    }
}

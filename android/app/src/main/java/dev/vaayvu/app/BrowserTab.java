package dev.vaayvu.app;

import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Message;
import android.os.Handler;
import android.os.Looper;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import java.util.Set;

final class BrowserTab {
    final WebView view;
    final String id;
    final boolean privateTab, popupWindow;
    volatile boolean userApprovedVisit;
    boolean loading;
    private final BrowserActivity host;
    final PagePrivacy privacy;
    private final String profile;
    private final String mobileAgent;
    private String findText = "";
    private String location, failure = "";
    private int zoomPercent = 100;
    boolean desktopSite;
    private String styleUrl = "", styleCss = "";
    private volatile String documentHost;
    private boolean closed, failed;
    int documentVersion;
    private int scrollAnchor, scrollDirection, reportedDirection;
    private long lastTouchMove;

    BrowserTab(BrowserActivity host, String id, boolean privateTab, String profile, boolean popupWindow) {
        this.host = host;
        this.id = id;
        this.privateTab = privateTab;
        this.popupWindow = popupWindow;
        this.profile = profile;
        privacy = new PagePrivacy(host, this);
        view = new WebView(host);
        if (profile != null) WebViewCompat.setProfile(view, profile);
        WebSettings settings = view.getSettings();
        mobileAgent = settings.getUserAgentString();
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setGeolocationEnabled(true);
        settings.setSafeBrowsingEnabled(true);
        settings.setSupportMultipleWindows(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        // Never pre-raster offscreen pages into RAM. Autoplay is left to the
        // website so playback behavior never changes.
        settings.setOffscreenPreRaster(false);
        android.content.SharedPreferences prefs = host.profilePrefs("browser");
        settings.setLoadsImagesAutomatically(!prefs.getBoolean("blockImages", false));
        settings.setJavaScriptCanOpenWindowsAutomatically(!prefs.getBoolean("blockPopups", true));
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        // Third-party cookies start disabled on supported Android versions.
        if (privateTab) settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        view.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !canLoadWebsite() || (request.isForMainFrame() &&
                    (!allowedLocation(request.getUrl().toString()) || host.blocksMainFrameAd(documentHost, request.getUrl().getHost(), privateTab)));
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (!canLoadWebsite() || (request.isForMainFrame() && !allowedLocation(request.getUrl().toString()))
                    || WebViewAssetLoader.DEFAULT_DOMAIN.equalsIgnoreCase(request.getUrl().getHost())) return BrowserActivity.denied();
                String resource = request.getUrl().getHost();
                if (request.isForMainFrame()) {
                    if (host.blocksMainFrameAd(documentHost, resource, privateTab)) {
                        privacy.blocked(resource, host.blocksDestination(resource) ? "strict" : "ads");
                        return BrowserActivity.denied();
                    }
                    documentHost = resource;
                    privacy.begin(request.getUrl().toString());
                } else {
                    String kind = host.blockingKind(documentHost, request.getUrl().toString(), resource, privateTab);
                    if (kind == null && host.blocksTracker(documentHost, resource, request.getRequestHeaders().get("Sec-Fetch-Site"))) kind = "trackers";
                    if (kind != null) {
                        privacy.blocked(resource, kind);
                        return BrowserActivity.denied();
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }
            @Override public void onPageStarted(WebView view, String url, Bitmap icon) {
                host.sites.cancel(BrowserTab.this);
                documentVersion++;
                host.documentChanged(BrowserTab.this);
                resetScroll();
                loading = true; failed = false; failure = "";
                documentHost = Uri.parse(url).getHost(); updateLocation(url);
                applyAdShield();
            }
            @Override public void onPageCommitVisible(WebView view, String url) {
                privacy.committed(url); updateLocation(view.getUrl()); if (zoomPercent != 100) zoom(zoomPercent);
                applyAdShield();
            }
            @Override public void onPageFinished(WebView view, String url) {
                loading = false; updateLocation(view.getUrl());
                if (!styleCss.isEmpty() && styleUrl.equals(view.getUrl())) applyStyles();
                applyAdShield();
            }
            @Override public void doUpdateVisitedHistory(WebView view, String url, boolean reloaded) {
                updateLocation(view.getUrl());
                applyAdShield();
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                String attempted = request.getUrl().toString();
                if (request.isForMainFrame() && !closed && BrowserActivity.webUrl(attempted)) {
                    failed(attempted, error.getDescription().toString());
                }
            }
            @Override public void onReceivedSslError(WebView view, android.webkit.SslErrorHandler handler, android.net.http.SslError error) {
                handler.cancel();
                if (!closed && location != null && location.equals(error.getUrl())) failed(location, "The website’s security certificate could not be verified.");
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
                host.tabFailed(BrowserTab.this, "Android closed this web page. Open it in a new tab to retry.");
                return true;
            }
        });
        view.setWebChromeClient(new WebChromeClient() {
            @Override public void onReceivedTitle(WebView view, String title) { update(); }
            @Override public void onProgressChanged(WebView view, int progress) { update(); }
            @Override public boolean onCreateWindow(WebView source, boolean dialog, boolean userGesture, Message transport) {
                if (!host.websiteAccess() || !userGesture || !host.isShowing(BrowserTab.this)) return false;
                BrowserTab child = host.adoptPopup(BrowserTab.this, profile);
                ((WebView.WebViewTransport)transport.obj).setWebView(child.view);
                transport.sendToTarget();
                return true;
            }
            @Override public void onCloseWindow(WebView window) { host.popupClosed(window); }
            @Override public void onPermissionRequest(PermissionRequest request) { if (host.websiteAccess()) host.sites.requestMedia(BrowserTab.this, request); else request.deny(); }
            @Override public void onPermissionRequestCanceled(PermissionRequest request) { host.sites.mediaCanceled(request); }
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (host.websiteAccess()) host.sites.requestLocation(BrowserTab.this, origin, callback);
                else callback.invoke(origin, false, false);
            }
            @Override public void onGeolocationPermissionsHidePrompt() { host.sites.locationCanceled(BrowserTab.this); }
            @Override public void onShowCustomView(android.view.View content, CustomViewCallback callback) { host.showVideo(BrowserTab.this, content, callback); }
            @Override public void onHideCustomView() { host.hideVideo(BrowserTab.this); }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (!host.websiteAccess() || !host.isShowing(BrowserTab.this)) { callback.onReceiveValue(null); return true; }
                return host.chooseFile(view, callback, params);
            }
        });
        view.setDownloadListener((url, agent, disposition, mime, size) -> {
            if (host.isShowing(this)) host.offerDownload(url, disposition, mime, privateTab);
        });
        view.setOnTouchListener((v, touch) -> {
            if (touch.getActionMasked() == android.view.MotionEvent.ACTION_DOWN || touch.getPointerCount() != 1) resetScroll();
            else if (touch.getActionMasked() == android.view.MotionEvent.ACTION_MOVE) lastTouchMove = android.os.SystemClock.uptimeMillis();
            return false;
        });
        view.setOnScrollChangeListener((v, x, y, oldX, oldY) -> {
            if (y == oldY || lastTouchMove == 0 || android.os.SystemClock.uptimeMillis() - lastTouchMove > 1000 || !host.isShowing(this)) return;
            int threshold = Math.round(48 * view.getResources().getDisplayMetrics().density);
            int direction = Integer.compare(y, oldY);
            if (scrollDirection != direction) { scrollDirection = direction; scrollAnchor = oldY; }
            if (reportedDirection != direction && (y == 0 || Math.abs(y - scrollAnchor) >= threshold)) {
                reportedDirection = direction;
                host.event("pageScroll", "id", id, "collapsed", direction > 0);
            }
        });
        view.setOnLongClickListener(v -> {
            WebView.HitTestResult hit = view.getHitTestResult();
            if (hit == null) return false;
            int kind = hit.getType();
            if (kind != WebView.HitTestResult.SRC_ANCHOR_TYPE && kind != WebView.HitTestResult.IMAGE_TYPE
                && kind != WebView.HitTestResult.SRC_IMAGE_ANCHOR_TYPE) return false;
            Handler result = new Handler(Looper.getMainLooper(), message -> {
                if (!closed && host.isShowing(this)) linkMenu(message.getData().getString("url"), message.getData().getString("src"));
                return true;
            });
            view.requestFocusNodeHref(result.obtainMessage());
            return true;
        });
    }

    boolean canLoadWebsite() { return host.websiteAccess() || userApprovedVisit; }

    boolean canInspect(String expected) {
        return canLoadWebsite() && !privateTab && !closed && !loading && !failed &&
            BrowserActivity.webUrl(expected) && expected.equals(view.getUrl());
    }

    private void linkMenu(String href, String src) {
        if (!host.websiteAccess()) return;
        boolean hasLink = BrowserActivity.webUrl(href), hasImage = BrowserActivity.webUrl(src);
        if (!hasLink && !hasImage) return;
        String url = hasLink ? href : src;
        java.util.LinkedHashMap<String, Runnable> actions = new java.util.LinkedHashMap<>();
        actions.put("Open in new tab", () -> host.newTab(url, privateTab, false));
        actions.put("Open in background tab", () -> host.newTab(url, privateTab, true));
        if (!privateTab && host.supportsPrivate()) actions.put("Open in private tab", () -> host.newTab(url, true, false));
        if (hasLink && hasImage) actions.put("Open image in new tab", () -> host.newTab(src, privateTab, false));
        if (hasImage) actions.put("Download image", () -> host.offerDownload(src, null, null, privateTab));
        actions.put(hasLink ? "Copy link" : "Copy image address", () -> host.getSystemService(android.content.ClipboardManager.class)
            .setPrimaryClip(android.content.ClipData.newPlainText("Link", url)));
        actions.put(hasLink ? "Share link" : "Share image address", () -> host.share(url));
        String[] names = actions.keySet().toArray(new String[0]);
        new android.app.AlertDialog.Builder(host).setTitle(Uri.parse(url).getHost())
            .setItems(names, (dialog, index) -> { if (!closed && host.isShowing(this)) actions.get(names[index]).run(); }).show();
    }

    void reload() {
        if (failed && BrowserActivity.webUrl(location)) view.loadUrl(location);
        else view.reload();
    }

    void resetScroll() {
        scrollDirection = 0; reportedDirection = 0; lastTouchMove = 0; scrollAnchor = view.getScrollY();
    }

    boolean hasDrawablePage() {
        return !closed && !failed && !loading && BrowserActivity.webUrl(location) && location.equals(view.getUrl());
    }

    void setDesktopSite(boolean enabled, boolean reloadPage) {
        if (desktopSite == enabled) return;
        desktopSite = enabled;
        String agent = enabled ? mobileAgent.replaceFirst("\\([^)]*\\)", "(X11; Linux x86_64)")
            .replace(" Version/4.0", "").replace(" Mobile Safari/", " Safari/") : mobileAgent;
        view.getSettings().setUserAgentString(agent);
        if (reloadPage && !loading && BrowserActivity.webUrl(view.getUrl())) reload();
    }

    void userStyles(String url, String css) {
        if (privateTab || !BrowserActivity.webUrl(url) || (!css.isEmpty() && !"https".equalsIgnoreCase(Uri.parse(url).getScheme()))
            || !url.equals(view.getUrl()) || css.length() > 131072
            || css.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 131072) return;
        if (url.equals(styleUrl) && css.equals(styleCss)) return;
        styleUrl = url; styleCss = css;
        applyStyles();
    }

    void applyAdShield() {
        String currentUrl = view.getUrl();
        if (currentUrl == null || currentUrl.isEmpty()) currentUrl = location;
        if (!BrowserActivity.webUrl(currentUrl)) return;
        String pageHost = Uri.parse(currentUrl).getHost();
        boolean active = host.isAdShieldActive(pageHost, privateTab);
        String cosmetic = active ? host.vfdCosmeticCSS(pageHost, privateTab) : "";
        String css = org.json.JSONObject.quote(cosmetic);
        view.evaluateJavascript("(()=>{try{"
            + "const on=" + (active ? "true" : "false") + ",css=" + css + ";"
            + "if(document.documentElement)document.documentElement.dataset.vaayvuAdShield=on?'on':'off';"
            + "const k=Symbol.for('vaayvu.vfdShield');"
            + "let st=document.getElementById('vaayvu-vfd-cosmetic');"
            + "if(!on||!css){if(st)st.remove();}else{if(!st){st=document.createElement('style');st.id='vaayvu-vfd-cosmetic';(document.head||document.documentElement).appendChild(st);}if(st.textContent!==css)st.textContent=css;}"
            + "const prev=window[k];if(!on){if(prev&&prev.stop)prev.stop();delete window[k];return;}if(prev&&prev.active)return;"
            + "const yt=/(^|\\.)(www\\.youtube\\.com|m\\.youtube\\.com|youtu\\.be)$/i.test(location.hostname);"
            + "if(yt&&!window.__vaayvuYtShieldInstalled){window.__vaayvuYtShieldInstalled=true;"
            + "const AD_KEYS=['adPlacements','playerAds','adSlots','adBreakHeartbeatParams'];"
            + "function strip(obj,depth=0){if(!document.documentElement||document.documentElement.dataset.vaayvuAdShield==='off'||!obj||typeof obj!=='object'||depth>4)return obj;for(const k of AD_KEYS){if(k in obj){try{delete obj[k];}catch{}}}if(obj.playerResponse&&typeof obj.playerResponse==='object')strip(obj.playerResponse,depth+1);return obj;}"
            + "let ytipr=window.ytInitialPlayerResponse;if(ytipr)strip(ytipr);"
            + "try{Object.defineProperty(window,'ytInitialPlayerResponse',{configurable:true,enumerable:true,get(){return ytipr;},set(v){ytipr=strip(v);}});}catch{}"
            + "const origJson=Response.prototype.json;Response.prototype.json=async function(){const d=await origJson.apply(this,arguments);return strip(d);};"
            + "const origParse=JSON.parse;JSON.parse=function(){const d=origParse.apply(this,arguments);return strip(d);};}"
            + "function cleanDOM(){if(!document.documentElement||document.documentElement.dataset.vaayvuAdShield==='off')return;"
            + "for(const f of document.querySelectorAll('iframe[src*=\"doubleclick\"],iframe[src*=\"googlesyndication\"],iframe[src*=\"googleadservices\"],iframe[src*=\"amazon-adsystem\"],iframe[src*=\"taboola\"],iframe[src*=\"outbrain\"],iframe[src*=\"adnxs\"],iframe[src*=\"criteo\"],iframe[src*=\"exoclick\"],iframe[src*=\"popads\"],iframe[id^=\"google_ads_\"]')){f.style.setProperty('display','none','important');const box=f.closest('.ad-slot,.ad-container,.ad-wrapper,.ad-unit,.dfp-ad,[id^=\"div-gpt-ad\"]');if(box)box.style.setProperty('display','none','important');}"
            + "if(yt){for(const el of document.querySelectorAll('ytd-ad-slot-renderer,ytd-in-feed-ad-layout-renderer,ytd-display-ad-renderer,ytd-promoted-sparkles-web-renderer,ytd-promoted-video-renderer,ytd-companion-slot-renderer,ytd-action-companion-ad-renderer,ytd-banner-promo-renderer,ytd-statement-banner-renderer,ytd-video-masthead-ad-v3-renderer,ytm-promoted-sparkles-web-renderer,ytm-promoted-video-renderer,ytm-companion-ad-renderer,ytm-ad-slot-renderer,ytm-in-feed-ad-layout-renderer')){el.style.setProperty('display','none','important');const cell=el.closest('ytd-rich-item-renderer,ytd-rich-section-renderer,ytm-rich-item-renderer');if(cell)cell.style.setProperty('display','none','important');}"
            + "for(const reel of document.querySelectorAll('ytd-reel-video-renderer[is-ad],ytd-reel-video-renderer ytd-ad-slot-renderer')){const r=reel.closest('ytd-reel-video-renderer')||reel;r.style.setProperty('display','none','important');}"
            + "const player=document.getElementById('movie_player')||document.querySelector('.html5-video-player');"
            + "if(player){const adShowing=player.classList.contains('ad-showing')||player.classList.contains('ad-interrupting')||!!player.querySelector('.ytp-ad-player-overlay,.ytp-ad-player-overlay-layout');"
            + "const v=player.querySelector('video.html5-main-video')||player.querySelector('video');"
            + "if(adShowing){try{if(typeof player.skipAd==='function')player.skipAd();}catch{}for(const b of player.querySelectorAll('.ytp-ad-skip-button,.ytp-ad-skip-button-modern,.ytp-skip-ad-button,.ytp-ad-skip-button-container,.ytp-ad-skip-button-slot button,.ytp-ad-overlay-close-button')){try{b.click();}catch{}}"
            + "if(v){if(v.__vaayvuPreAdMuted===undefined)v.__vaayvuPreAdMuted=v.muted;if(v.__vaayvuPreAdRate===undefined&&v.playbackRate<=2)v.__vaayvuPreAdRate=v.playbackRate;try{v.muted=true;}catch{}try{if(Number.isFinite(v.duration)&&v.duration>0&&v.duration<600)v.currentTime=Math.max(0,v.duration-0.05);else v.playbackRate=16;}catch{}}}"
            + "else if(v&&v.__vaayvuPreAdMuted!==undefined){try{v.muted=v.__vaayvuPreAdMuted;}catch{}try{if(v.__vaayvuPreAdRate)v.playbackRate=v.__vaayvuPreAdRate;}catch{}delete v.__vaayvuPreAdMuted;delete v.__vaayvuPreAdRate;}}}}"
            + "cleanDOM();const mo=new MutationObserver(()=>{cleanDOM();});if(document.documentElement)mo.observe(document.documentElement,{childList:true,subtree:true,attributes:yt,attributeFilter:yt?['class','is-ad']:undefined});"
            + "window[k]={active:true,stop(){try{mo.disconnect();}catch{}}};}catch{}})()", null);
    }

    private void applyStyles() {
        String url = org.json.JSONObject.quote(styleUrl), css = org.json.JSONObject.quote(styleCss);
        view.evaluateJavascript("(()=>{if(location.href!==" + url + ")return;const css=" + css
            + ",key=Symbol.for('dev.vaayvu.userStyles'),doc=document;if(!doc.documentElement)return;"
            + "if('adoptedStyleSheets' in doc && typeof CSSStyleSheet.prototype.replaceSync==='function'){"
            + "let sheet=doc[key];if(!css){if(sheet){doc.adoptedStyleSheets=doc.adoptedStyleSheets.filter(s=>s!==sheet);delete doc[key]}return}"
            + "if(!sheet)sheet=doc[key]=new CSSStyleSheet();sheet.replaceSync(css);if(!doc.adoptedStyleSheets.includes(sheet))doc.adoptedStyleSheets=[...doc.adoptedStyleSheets,sheet];"
            + "}else{let node=doc[key];if(!css){if(node)node.remove();delete doc[key];return}if(!node){node=doc[key]=doc.createElement('style');doc.documentElement.appendChild(node)}node.textContent=css}})()", null);
    }

    private static boolean adBlockMatch(String host, Set<String> adBlockHosts) {
        if (host == null || adBlockHosts == null || adBlockHosts.isEmpty()) return false;
        String lower = host.toLowerCase(java.util.Locale.ROOT);
        if (adBlockHosts.contains(lower)) return true;
        int dot = lower.indexOf('.');
        while (dot != -1) {
            if (adBlockHosts.contains(lower.substring(dot + 1))) return true;
            dot = lower.indexOf('.', dot + 1);
        }
        return false;
    }

    private boolean allowedLocation(String url) { return BrowserActivity.webUrl(url) || (popupWindow && "about:blank".equals(url)); }

    private void failed(String attempted, String message) {
        loading = false; failed = true; location = attempted; failure = message; update();
    }

    void find(String text, boolean backwards) {
        if (text.isEmpty()) view.clearMatches();
        else if (text.equals(findText)) view.findNext(!backwards);
        else view.findAllAsync(text);
        findText = text;
    }

    void zoom(int percent) {
        if (percent < 50 || percent > 200) return;
        zoomPercent = percent;
        // Keep the website's original inline zoom so resetting restores its own layout.
        String script = "(()=>{const d=document.documentElement;if(!d)return;const s=d.style,k=Symbol.for('dev.vaayvu.pageZoom');"
            + "if(" + percent + "===100){if(d[k]){s.setProperty('zoom',d[k][0],d[k][1]);delete d[k]}}"
            + "else{if(!d[k])d[k]=[s.getPropertyValue('zoom'),s.getPropertyPriority('zoom')];"
            + "s.setProperty('zoom','" + percent + "%','important')}})()";
        view.evaluateJavascript(script, null);
    }

    void update() {
        if (closed || location == null) return;
        String title = failed ? Uri.parse(location).getHost() : view.getTitle();
        host.event("page", "id", id, "url", location, "blank", "about:blank".equals(location),
            "title", title == null ? "" : title, "failed", failed, "error", failure,
            "loading", loading, "canBack", view.canGoBack(), "canForward", view.canGoForward(),
            "progress", view.getProgress() / 100.0);
    }

    private void updateLocation(String url) {
        if (closed || url == null) return;
        if (failed) { update(); return; }
        if (allowedLocation(url)) { location = url; update(); return; }
        view.setVisibility(android.view.View.GONE);
        view.stopLoading();
        view.post(() -> host.tabFailed(this, "Vaayvu blocked an unsupported page address."));
    }

    void destroy() {
        closed = true;
        userApprovedVisit = false;
        view.getSettings().setBlockNetworkLoads(true);
        view.stopLoading();
        privacy.close();
        view.destroy();
    }
}

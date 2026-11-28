package dev.vaayvu.app;

import android.os.Handler;
import android.os.Looper;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/** Receives WebView network callbacks off the main thread. Discard all details with the document. */
final class PagePrivacy {
    private final BrowserActivity host;
    private final BrowserTab tab;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Map<String,Integer> domains = new LinkedHashMap<>();
    private final Map<String,Integer> kinds = new LinkedHashMap<>();
    private int pageCount, tabCount;
    private boolean queued, closed;
    private String pageUrl = "";
    private final Runnable publish = this::publish;

    PagePrivacy(BrowserActivity host, BrowserTab tab) { this.host = host; this.tab = tab; }

    synchronized void begin(String url) {
        pageUrl = url; pageCount = 0; domains.clear();
    }

    synchronized void committed(String url) {
        if (url == null) return;
        if (!sameOrigin(pageUrl, url)) begin(url);
        else pageUrl = url;
    }

    synchronized void blocked(String domain, String kind) {
        if (closed || tab.privateTab || domain == null) return;
        String name = domain.toLowerCase(Locale.ROOT);
        if (name.endsWith(".")) name = name.substring(0, name.length()-1);
        if (domains.containsKey(name) || domains.size() < 64) domains.put(name, domains.getOrDefault(name, 0) + 1);
        String bucket = kind == null ? "unknown" : kind;
        kinds.put(bucket, kinds.getOrDefault(bucket, 0) + 1);
        pageCount++; tabCount++;
        if (!queued) { queued = true; main.postDelayed(publish, 180); }
    }

    private synchronized void publish() {
        queued = false;
        if (closed || tab.privateTab) return;
        Object[] stats = new Object[kinds.size() * 2];
        int i = 0;
        for (Map.Entry<String, Integer> entry : kinds.entrySet()) {
            stats[i++] = entry.getKey();
            stats[i++] = entry.getValue();
        }
        Object[] message = new Object[2 + stats.length];
        message[0] = "id"; message[1] = tab.id;
        System.arraycopy(stats, 0, message, 2, stats.length);
        host.event("protectionStats", message);
    }

    synchronized void report(Object request, String url) {
        if (closed || !BrowserActivity.webUrl(url)) return;
        JSONArray hosts = new JSONArray();
        if (sameOrigin(url, pageUrl)) {
            domains.entrySet().stream().sorted((a, b) -> Integer.compare(b.getValue(), a.getValue())).forEach(entry -> {
                JSONObject item = new JSONObject();
                try { item.put("host", entry.getKey()); item.put("count", entry.getValue()); }
                catch (org.json.JSONException ignored) { return; }
                hosts.put(item);
            });
        }
        host.event("privacyReport", "requestId", request, "id", tab.id, "url", url,
            "blocked", sameOrigin(url, pageUrl) ? pageCount : 0, "domains", hosts);
    }

    private static boolean sameOrigin(String a, String b) {
        if (!BrowserActivity.webUrl(a) || !BrowserActivity.webUrl(b)) return false;
        java.net.URI ua = java.net.URI.create(a), ub = java.net.URI.create(b);
        return ua.getScheme().equalsIgnoreCase(ub.getScheme()) && ua.getRawAuthority().equalsIgnoreCase(ub.getRawAuthority());
    }

    synchronized void close() { closed = true; domains.clear(); main.removeCallbacks(publish); }
}

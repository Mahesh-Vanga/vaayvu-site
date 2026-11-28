package dev.vaayvu.app;

import android.graphics.Bitmap;
import android.util.Base64;
import android.util.LruCache;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;
import org.json.JSONArray;
import org.json.JSONObject;

/** Only previously displayed regular tabs have thumbnails, held entirely in memory. */
final class TabThumbnails {
    private static final class Entry {
        final String url;
        final int version;
        Bitmap bitmap;
        String encoded;
        final List<Consumer<String>> pending = new ArrayList<>();
        Entry(String url, int version, Bitmap bitmap) { this.url = url; this.version = version; this.bitmap = bitmap; }
    }
    private final BrowserActivity host;
    private final LruCache<String, Entry> entries = new LruCache<>(12);
    private final ExecutorService encoder = Executors.newSingleThreadExecutor();
    private boolean closed;

    TabThumbnails(BrowserActivity host) { this.host = host; }
    void forget(String id) { entries.remove(id); }
    void close() { closed = true; entries.evictAll(); encoder.shutdownNow(); }

    void remember(BrowserTab tab) {
        if (tab == null || !tab.view.isShown()) return;
        snapshot(tab);
    }

    private void snapshot(BrowserTab tab) {
        if (closed || tab.privateTab || !tab.hasDrawablePage() || !tab.view.isAttachedToWindow()
            || tab.view.getWidth() <= 0 || tab.view.getHeight() <= 0) return;
        entries.put(tab.id, new Entry(tab.view.getUrl(), tab.documentVersion, BrowserFiles.snapshot(tab.view, 384)));
    }

    void respond(Object request, JSONArray requested) {
        if (closed || !(request instanceof String) || ((String)request).length() > 128 || requested == null) return;
        for (int i = 0; i < Math.min(12, requested.length()); i++) {
            JSONObject item = requested.optJSONObject(i);
            if (item == null) continue;
            BrowserTab tab = host.lookupTab(item.optString("id"));
            String url = item.optString("url");
            if (tab == null || tab.privateTab || !tab.hasDrawablePage() || !url.equals(tab.view.getUrl())) continue;
            // A selected WebView may finish its first load behind the overview.
            // Its viewport is still attached and has a real layout even while hidden.
            if (tab.view.isShown() || entries.get(tab.id) == null) snapshot(tab);
            Entry entry = entries.get(tab.id);
            if (entry == null || !entry.url.equals(url)) continue;
            encode(entry, image -> {
                if (!closed && image != null && host.lookupTab(tab.id) == tab && tab.documentVersion == entry.version
                        && tab.hasDrawablePage() && url.equals(tab.view.getUrl()))
                    host.event("tabPreview", "requestId", request, "id", tab.id, "url", url, "image", image);
            });
        }
    }

    private void encode(Entry entry, Consumer<String> callback) {
        if (entry.encoded != null) { callback.accept(entry.encoded); return; }
        if (entry.pending.size() >= 8) return;
        entry.pending.add(callback);
        if (entry.pending.size() > 1) return;
        encoder.execute(() -> {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            boolean saved = entry.bitmap.compress(Bitmap.CompressFormat.JPEG, 66, bytes);
            String image = saved && bytes.size() <= 150000 ?
                "data:image/jpeg;base64," + Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP) : null;
            host.runOnUiThread(() -> {
                if (closed) return;
                entry.encoded = image;
                if (image != null) { entry.bitmap.recycle(); entry.bitmap = null; }
                for (Consumer<String> consumer : entry.pending) consumer.accept(image);
                entry.pending.clear();
            });
        });
    }
}

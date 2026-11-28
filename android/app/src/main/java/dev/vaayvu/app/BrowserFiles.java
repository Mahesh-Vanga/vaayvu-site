package dev.vaayvu.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.WebView;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.function.Consumer;

final class BrowserFiles {
    static final int MAX_HTML_BYTES = 2 * 1024 * 1024;
    private static final int IMPORT_BOOKMARKS = 81, SAVE_DOCUMENT = 82;
    private final BrowserActivity host;
    private final File staging;
    private File pending;
    private boolean waitingForPicker;

    BrowserFiles(BrowserActivity host, Bundle restoredState) {
        this.host = host;
        staging = new File(host.getCacheDir(), host.storageName("vaayvu-exports"));
        File[] abandoned = staging.listFiles((dir, name) -> name.startsWith("pending-"));
        String restoreName = restoredState == null ? null : restoredState.getString("pendingExport");
        if (abandoned != null) for (File file : abandoned) {
            if (file.getName().equals(restoreName)) { pending = file; waitingForPicker = true; }
            else file.delete();
        }
    }

    static String pageName(WebView view) {
        String title = view.getTitle();
        if ((title == null || title.trim().isEmpty()) && view.getUrl() != null) title = Uri.parse(view.getUrl()).getHost();
        if (title == null) return "Vaayvu page";
        String clean = title.replaceAll("[\\p{Cntrl}/\\\\:*?\"<>|]", "_").trim();
        return clean.isEmpty() ? "Vaayvu page" : clean.substring(0, Math.min(96, clean.length()));
    }

    private File startFile() {
        if (pending != null) { host.notice("Finish the current save first."); return null; }
        try {
            Files.createDirectories(staging.toPath());
            pending = File.createTempFile("pending-", ".tmp", staging);
            return pending;
        } catch (IOException e) { host.notice("Android could not prepare the file."); return null; }
    }

    private void selectDestination(File file, String mime, String name) {
        if (file != pending || host.isDestroyed() || !host.websiteAccess()) return;
        if (file.length() == 0) { close(); host.notice("The page did not produce a file."); return; }
        Intent pick = new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime)
            .putExtra(Intent.EXTRA_TITLE, name);
        try { waitingForPicker = true; host.startActivityForResult(pick, SAVE_DOCUMENT); }
        catch (ActivityNotFoundException e) { close(); host.notice("Android’s file picker is unavailable."); }
    }

    void archive(WebView view) {
        File file = startFile();
        if (file == null) return;
        String name = pageName(view) + ".mht";
        view.saveWebArchive(file.getAbsolutePath(), false, path -> selectDestination(file, "multipart/related", name));
    }

    void capture(WebView view) {
        if (view.getWidth() <= 0 || view.getHeight() <= 0) { host.notice("Wait for the page to finish drawing."); return; }
        File file = startFile();
        if (file == null) return;
        String name = pageName(view) + ".png";
        Bitmap bitmap = snapshot(view, 3200);
        new Thread(() -> {
            try (OutputStream output = Files.newOutputStream(file.toPath())) {
                if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) throw new IOException();
            } catch (IOException e) { file.delete(); }
            finally { bitmap.recycle(); }
            host.runOnUiThread(() -> selectDestination(file, "image/png", name));
        }, "Vaayvu screenshot").start();
    }

    static Bitmap snapshot(WebView view, int maxEdge) {
        int width = view.getWidth(), height = view.getHeight();
        float scale = Math.min(1f, maxEdge / (float)Math.max(width, height));
        Bitmap bitmap = Bitmap.createBitmap(Math.max(1, Math.round(width * scale)),
            Math.max(1, Math.round(height * scale)), Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        canvas.scale(scale, scale);
        canvas.translate(-view.getScrollX(), -view.getScrollY());
        view.draw(canvas);
        return bitmap;
    }

    void preview(WebView view, Consumer<String> callback) {
        if (view.getWidth() <= 0 || view.getHeight() <= 0) { callback.accept(null); return; }
        Bitmap image = snapshot(view, 900);
        new Thread(() -> {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            boolean saved = image.compress(Bitmap.CompressFormat.JPEG, 72, bytes);
            image.recycle();
            String result = saved ? "data:image/jpeg;base64," + Base64.encodeToString(bytes.toByteArray(), Base64.NO_WRAP) : null;
            host.runOnUiThread(() -> callback.accept(result));
        }, "Vaayvu menu preview").start();
    }

    void exportBookmarks(String html) {
        byte[] bytes = html.getBytes(StandardCharsets.UTF_8);
        if (bytes.length == 0 || bytes.length > MAX_HTML_BYTES) { host.notice("Bookmark HTML must fit within 2 MB."); return; }
        File file = startFile();
        if (file == null) return;
        try { Files.write(file.toPath(), bytes); selectDestination(file, "text/html", "Vaayvu bookmarks.html"); }
        catch (IOException e) { close(); host.notice("Could not prepare the bookmarks file."); }
    }

    void importBookmarks() {
        Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*")
            .putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"text/html", "application/xhtml+xml", "text/plain"});
        try { host.startActivityForResult(pick, IMPORT_BOOKMARKS); }
        catch (ActivityNotFoundException e) { host.notice("Android’s file picker is unavailable."); }
    }

    boolean onResult(int code, int result, Intent data) {
        if (code != IMPORT_BOOKMARKS && code != SAVE_DOCUMENT) return false;
        Uri uri = result == Activity.RESULT_OK && data != null ? data.getData() : null;
        boolean selected = uri != null && "content".equals(uri.getScheme());
        if (code == IMPORT_BOOKMARKS) {
            if (selected) new Thread(() -> readBookmarks(uri), "Vaayvu bookmark import").start();
        } else {
            File file = pending;
            pending = null;
            waitingForPicker = false;
            if (file != null) {
                if (selected && host.websiteAccess()) new Thread(() -> save(file, uri), "Vaayvu document export").start();
                else file.delete();
            }
        }
        return true;
    }

    private void readBookmarks(Uri uri) {
        try (InputStream input = host.getContentResolver().openInputStream(uri)) {
            if (input == null) throw new IOException();
            String html = readHTML(input);
            host.runOnUiThread(() -> host.importedBookmarks(html));
        } catch (IOException | SecurityException e) {
            host.runOnUiThread(() -> host.notice("Choose a readable bookmark HTML file no larger than 2 MB."));
        }
    }

    static String readHTML(InputStream input) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        for (int read; (read = input.read(buffer)) != -1; ) {
            if (output.size() + read > MAX_HTML_BYTES) throw new IOException("Bookmark file too large");
            output.write(buffer, 0, read);
        }
        return output.toString(StandardCharsets.UTF_8.name());
    }

    private void save(File file, Uri destination) {
        if (!host.websiteAccess()) { file.delete(); return; }
        try (OutputStream output = host.getContentResolver().openOutputStream(destination, "wt");
             InputStream input = Files.newInputStream(file.toPath())) {
            if (output == null) throw new IOException();
            byte[] buffer = new byte[8192];
            for (int n; (n = input.read(buffer)) != -1; ) {
                if (!host.websiteAccess()) return;
                output.write(buffer, 0, n);
            }
        } catch (IOException | SecurityException e) {
            host.runOnUiThread(() -> host.notice("Android could not finish writing the selected file."));
            return;
        } finally { file.delete(); }
        host.runOnUiThread(() -> host.notice("Saved to the selected location."));
    }

    void saveState(Bundle state) { if (waitingForPicker && pending != null) state.putString("pendingExport", pending.getName()); }
    void discardExport() { close(); }
    void dispose(boolean finishing) { if (finishing || !waitingForPicker) close(); }
    private void close() { waitingForPicker = false; if (pending != null) { pending.delete(); pending = null; } }
}

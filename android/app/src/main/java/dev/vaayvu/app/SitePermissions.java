package dev.vaayvu.app;

import android.Manifest;
import android.app.AlertDialog;
import android.content.pm.PackageManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/** Website consent and Android permissions are checked separately for the visible origin. */
final class SitePermissions {
    private final BrowserActivity host;
    private BrowserTab owner;
    private String origin;
    private PermissionRequest media;
    private GeolocationPermissions.Callback location;
    private String locationOrigin;
    private AlertDialog prompt;
    private int requestCode = 2000;
    private boolean waitingForSystem;
    private List<String> permissions;

    SitePermissions(BrowserActivity host) { this.host = host; }

    static String secureOrigin(String address) {
        if (!BrowserActivity.webUrl(address)) return "";
        URI uri = URI.create(address);
        String scheme = uri.getScheme().toLowerCase(Locale.ROOT);
        String hostname = uri.getHost().toLowerCase(Locale.ROOT);
        if (!"https".equals(scheme) && !Arrays.asList("localhost", "127.0.0.1", "[::1]").contains(hostname)) return "";
        int port = uri.getPort();
        String suffix = port == -1 || ("https".equals(scheme) ? port == 443 : port == 80) ? "" : ":" + port;
        return scheme + "://" + hostname + suffix;
    }

    private boolean available(BrowserTab tab, String requested) {
        return !requested.isEmpty() && host.isShowing(tab) && requested.equals(secureOrigin(tab.view.getUrl()));
    }

    void requestMedia(BrowserTab tab, PermissionRequest request) {
        String requested = secureOrigin(request.getOrigin().toString());
        List<String> resources = Arrays.asList(request.getResources());
        List<String> needed = new ArrayList<>(), labels = new ArrayList<>();
        if (resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) { needed.add(Manifest.permission.CAMERA); labels.add("camera"); }
        if (resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) { needed.add(Manifest.permission.RECORD_AUDIO); labels.add("microphone"); }
        if (owner != null || !available(tab, requested) || needed.isEmpty()) { request.deny(); return; }
        media = request;
        begin(tab, requested, needed, String.join(" and ", labels));
    }

    void requestLocation(BrowserTab tab, String address, GeolocationPermissions.Callback callback) {
        String requested = secureOrigin(address);
        if (owner != null || !available(tab, requested)) { callback.invoke(address, false, false); return; }
        location = callback;
        locationOrigin = address;
        begin(tab, requested, Arrays.asList(Manifest.permission.ACCESS_COARSE_LOCATION), "approximate location");
    }

    private void begin(BrowserTab tab, String requested, List<String> needed, String label) {
        owner = tab; origin = requested; permissions = needed;
        prompt = new AlertDialog.Builder(host).setTitle("Website permission")
            .setMessage(requested + " wants to use your " + label + ".")
            .setPositiveButton("Allow", (d, b) -> allow())
            .setNegativeButton("Deny", (d, b) -> finish(false))
            .setOnCancelListener(d -> finish(false)).show();
    }

    private void allow() {
        if (owner == null || !available(owner, origin)) { finish(false); return; }
        List<String> missing = new ArrayList<>();
        for (String permission : permissions) if (!granted(permission)) missing.add(permission);
        if (missing.isEmpty()) { finish(true); return; }
        requestCode = requestCode == 65000 ? 2000 : requestCode + 1;
        waitingForSystem = true;
        host.requestPermissions(missing.toArray(new String[0]), requestCode);
    }

    private boolean granted(String permission) { return host.checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED; }
    void result(int code) { if (owner != null && waitingForSystem && code == requestCode) finish(true); }
    void cancel(BrowserTab tab) { if (owner == tab) finish(false); }
    void mediaCanceled(PermissionRequest request) { if (media == request) { media = null; finish(false); } }
    void locationCanceled(BrowserTab tab) { if (owner == tab && location != null) finish(false); }

    private void finish(boolean allowed) {
        if (owner == null) return;
        allowed = allowed && available(owner, origin);
        PermissionRequest request = media;
        GeolocationPermissions.Callback callback = location;
        String site = locationOrigin;
        List<String> needed = permissions;
        owner = null; media = null; location = null; permissions = null; locationOrigin = null; origin = null; waitingForSystem = false;
        if (prompt != null) { prompt.dismiss(); prompt = null; }
        if (callback != null) callback.invoke(site, allowed && granted(Manifest.permission.ACCESS_COARSE_LOCATION), false);
        if (request != null) {
            List<String> resources = new ArrayList<>();
            if (allowed && needed.contains(Manifest.permission.CAMERA) && granted(Manifest.permission.CAMERA)) resources.add(PermissionRequest.RESOURCE_VIDEO_CAPTURE);
            if (allowed && needed.contains(Manifest.permission.RECORD_AUDIO) && granted(Manifest.permission.RECORD_AUDIO)) resources.add(PermissionRequest.RESOURCE_AUDIO_CAPTURE);
            if (resources.isEmpty()) request.deny(); else request.grant(resources.toArray(new String[0]));
        }
    }
}

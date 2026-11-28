package dev.vaayvu.app;

import android.app.Instrumentation;
import android.content.Intent;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class UserStylesDeviceTest {
    @Test public void appliesAndRemovesSamePageHttpsStylesWithoutCrossingPrivateOrNavigationBoundaries() throws Exception {
        Instrumentation device = InstrumentationRegistry.getInstrumentation();
        BrowserActivity host = (BrowserActivity) device.startActivitySync(new Intent(device.getTargetContext(), BrowserActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        String url = "https://fixture.example/page";
        String css = "h1 {color: rgb(41, 72, 19) !important}";
        String initial = "rgb(0, 0, 0)";
        for (boolean secret : new boolean[]{false,true}) {
            AtomicReference<BrowserTab> tab = new AtomicReference<>();
            device.runOnMainSync(() -> {
                tab.set(new BrowserTab(host, "fixture", secret, null, false));
                android.webkit.WebView view = tab.get().view;
                host.addContentView(view, new android.view.ViewGroup.LayoutParams(300, 200));
                view.setWebViewClient(new android.webkit.WebViewClient() {
                    @Override public android.webkit.WebResourceResponse shouldInterceptRequest(android.webkit.WebView view, android.webkit.WebResourceRequest request) {
                        String html = url.equals(request.getUrl().toString()) ? "<h1 style='color:black'>Local fixture</h1>" : "";
                        return new android.webkit.WebResourceResponse("text/html", "UTF-8",
                            new java.io.ByteArrayInputStream(html.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
                    }
                });
                view.loadUrl(url);
            });
            try {
                awaitColor(device, tab.get(), initial);
                device.runOnMainSync(() -> tab.get().userStyles(url + "?wrong", css));
                assertEquals(initial, color(device, tab.get()));
                device.runOnMainSync(() -> tab.get().userStyles(url, css));
                awaitColor(device, tab.get(), secret ? initial : "rgb(41, 72, 19)");
                device.runOnMainSync(() -> tab.get().userStyles(url, ""));
                awaitColor(device, tab.get(), initial);
            } finally {
                device.runOnMainSync(() -> {
                    ((android.view.ViewGroup)tab.get().view.getParent()).removeView(tab.get().view);
                    tab.get().destroy();
                });
            }
        }
        device.runOnMainSync(host::finish);
    }

    private static String color(Instrumentation device, BrowserTab tab) throws InterruptedException {
        ArrayBlockingQueue<String> result = new ArrayBlockingQueue<>(1);
        device.runOnMainSync(() -> tab.view.evaluateJavascript("document.querySelector('h1') ? getComputedStyle(document.querySelector('h1')).color : ''", result::offer));
        return String.valueOf(result.poll(5, TimeUnit.SECONDS)).replace("\"", "");
    }

    private static void awaitColor(Instrumentation device, BrowserTab tab, String expected) throws InterruptedException {
        long deadline = android.os.SystemClock.elapsedRealtime() + 8000;
        String actual;
        do {
            actual = color(device, tab);
            if (expected.equals(actual)) return;
            Thread.sleep(80);
        } while (android.os.SystemClock.elapsedRealtime() < deadline);
        assertEquals(expected, actual);
    }
}

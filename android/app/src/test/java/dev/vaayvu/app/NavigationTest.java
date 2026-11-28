package dev.vaayvu.app;

import org.junit.Test;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class NavigationTest {
    @Test public void allowsWebPagesAndReservesTheLocalBrowserOrigin() {
        assertTrue(BrowserActivity.webUrl("https://example.org/search?q=vaayvu"));
        assertTrue(BrowserActivity.webUrl("http://127.0.0.1:8080/test"));
        for (String value : new String[]{null, "", "about:blank", "https:example.org",
            "file:///sdcard/a.html", "data:text/plain,hello", "content://provider/item",
            "javascript:void(0)", "https://user:password@example.org/", "https://example.org/" + "x".repeat(8192),
            "https://APPASSETS.ANDROIDPLATFORM.NET/assets/index.html",
            "https://example.org@appassets.androidplatform.net/assets/index.html"}) {
            assertFalse(value, BrowserActivity.webUrl(value));
        }
    }
}

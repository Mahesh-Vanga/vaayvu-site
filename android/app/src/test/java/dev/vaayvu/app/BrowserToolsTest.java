package dev.vaayvu.app;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;
import org.junit.Test;
import static org.junit.Assert.*;

public class BrowserToolsTest {
    @Test public void protectionMatchesWholeTrackerDomainsInThirdPartyRequests() {
        List<String> rules = Collections.singletonList("doubleclick.net");
        assertTrue(TrackerProtection.blocks("example.org", "Ads.DoubleClick.Net.", null, rules));
        assertFalse(TrackerProtection.blocks("example.org", "notdoubleclick.net", null, rules));
        assertFalse(TrackerProtection.blocks("example.org", "doubleclick.net.example.org", null, rules));
        assertFalse(TrackerProtection.blocks("www.doubleclick.net", "ads.doubleclick.net", null, rules));
        assertFalse(TrackerProtection.blocks("example.org", "doubleclick.net", "same-site", rules));
        assertFalse(TrackerProtection.blocks(null, "doubleclick.net", null, rules));
    }

    @Test public void readsUtf8BookmarkFilesAndBoundsActualStreamSize() throws Exception {
        String html = "<a href='https://example.org'>Café</a>";
        assertEquals(html, BrowserFiles.readHTML(new ByteArrayInputStream(html.getBytes(StandardCharsets.UTF_8))));
        assertEquals(BrowserFiles.MAX_HTML_BYTES, BrowserFiles.readHTML(
            new ByteArrayInputStream(new byte[BrowserFiles.MAX_HTML_BYTES])).length());
        assertThrows(IOException.class, () -> BrowserFiles.readHTML(
            new ByteArrayInputStream(new byte[BrowserFiles.MAX_HTML_BYTES + 1])));
    }

    @Test public void acceptsOnlyBoundedCustomDnsDomains() {
        List<String> rules = TrackerProtection.customDomains(java.util.Arrays.asList("ad.example.test", "ad.example.test",
            "*.test", "top-level", "-bad.test", "bad-.test", "EXAMPLE.ORG", "example.org/path", "1.2.3.4", "test..net"));
        assertEquals(Collections.singletonList("ad.example.test"), rules);
        assertTrue(TrackerProtection.blocks("example.org", "xy.ad.example.test", null, rules));
        assertFalse(TrackerProtection.blocks("example.org", "notad.example.test", null, rules));
        List<String> many = new java.util.ArrayList<>();
        for (int i=0; i<135; i++) many.add("t"+i+".test");
        assertEquals(128, TrackerProtection.customDomains(many).size());
    }

    @Test public void grantsApplyOnlyToSecureExactOrigins() {
        assertEquals("https://example.org", SitePermissions.secureOrigin("https://EXAMPLE.org:443/map"));
        assertEquals("https://example.org:7443", SitePermissions.secureOrigin("https://example.org:7443/page"));
        assertEquals("http://127.0.0.1:8900", SitePermissions.secureOrigin("http://127.0.0.1:8900/qa"));
        for (String input : new String[]{"http://example.org/", "http://localhost.bad/", "https://name:pass@example.org/", "file:///camera"}) {
            assertEquals("", SitePermissions.secureOrigin(input));
        }
    }

    @Test public void repeatedDownloadsKeepTheirExtensionAndFitAndroidFilesystems() {
        assertEquals("report (3).pdf", BrowserActivity.distinctName("report.pdf", name ->
            name.equals("report.pdf") || name.equals("report (2).pdf")));
        String name = BrowserActivity.distinctName("山".repeat(160) + ".pdf", n -> false);
        assertTrue(name.endsWith(".pdf"));
        assertTrue(name.getBytes(StandardCharsets.UTF_8).length <= 200);
    }

    @Test public void pageSpeechChunksPreserveTextAndEmojiAcrossAndroidLimits() {
        String article = "The first sentence. " + "🦜".repeat(35) + " The final sentence.";
        List<String> parts = PageSpeech.chunks(article, 15);
        assertEquals(article, String.join("", parts));
        for (String part : parts) {
            assertFalse(part.isEmpty());
            assertTrue(part.length() <= 15);
            assertFalse(Character.isLowSurrogate(part.charAt(0)));
            assertFalse(Character.isHighSurrogate(part.charAt(part.length()-1)));
        }
    }

    @Test public void remindersSupportOnlyTheIntervalsInThePageMenu() {
        for (int delay : new int[]{3600,86400,604800}) assertTrue(PageReminders.validDelay(delay));
        for (int delay : new int[]{-1,0,3599,86500,Integer.MAX_VALUE}) assertFalse(PageReminders.validDelay(delay));
    }
}

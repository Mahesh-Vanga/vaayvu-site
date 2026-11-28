package dev.vaayvu.app;

import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import org.junit.Test;
import static org.junit.Assert.*;

public class VfdTest {
    private static java.util.Set<String> set(String... hosts) {
        return new HashSet<>(Arrays.asList(hosts));
    }

    private static String decide(String url, String doc, boolean ads, boolean trackers, boolean aggressive) {
        return TrackerProtection.vfdVerdict(url, doc, false,
            set("evil.example"), Collections.singleton("paused.example"),
            set("ad.doubleclick.net"), set("google-analytics.com"), set("connect.facebook.com"),
            set("doubleclick", "pagead"), set("collect?", "mc.yandex"), set("/pagead/"),
            Collections.emptyList(), true, ads, trackers, false, aggressive);
    }

    @Test public void blocksThirdPartyAdsAndTrackersByHost() {
        assertEquals("ads", decide("https://ad.doubleclick.net/x", "https://news.example/", true, true, false));
        assertEquals("trackers", decide("https://google-analytics.com/x", "https://news.example/", true, true, false));
        assertNull(decide("https://cdn.example/app.js", "https://news.example/", true, true, false));
    }

    @Test public void pausedSitesFallBackToStrictOnly() {
        assertNull(decide("https://ad.doubleclick.net/x", "https://paused.example/", true, true, false));
        assertNull(decide("https://ad.doubleclick.net/x", "https://www.paused.example/article", true, true, false));
        assertEquals("strict", decide("https://evil.example/x", "https://paused.example/", true, true, false));
        assertEquals("ads", decide("https://ads.news.example/x.js", "https://www.news.example/", true, true, false));
    }

    @Test public void categorySwitchesGateMatching() {
        assertNull(decide("https://ad.doubleclick.net/x", "https://news.example/", false, true, false));
        assertEquals("trackers", decide("https://google-analytics.com/x", "https://news.example/", false, true, false));
        assertEquals("token", decide("https://x.example/pagead/x.js", "https://news.example/", true, false, false));
        assertEquals("tokentracker", decide("https://x.example/collect?v=1", "https://news.example/", false, true, false));
        assertNull(decide("https://x.example/pagead/x.js", "https://news.example/", false, true, false));
    }

    @Test public void sameSiteRequestsNeedAggressiveMode() {
        assertNull(decide("https://news.example/pagead/x.js", "https://news.example/", true, true, false));
        assertEquals("firstparty", decide("https://news.example/pagead/x.js", "https://news.example/", true, true, true));
    }

    @Test public void exceptionsAllowMatches() {
        java.util.List<TrackerProtection.VfdException> exceptions = Collections.singletonList(
            new TrackerProtection.VfdException(Collections.singleton("allowed.example"), Collections.<String>emptyList()));
        String verdict = TrackerProtection.vfdVerdict("https://allowed.example/x.js", "https://news.example/", false,
            Collections.emptySet(), Collections.emptySet(), set("allowed.example"), Collections.emptySet(), Collections.emptySet(),
            Collections.singleton("doubleclick"), Collections.emptySet(), Collections.emptySet(), exceptions,
            true, true, false, false, false);
        assertNull(verdict);
    }

    @Test public void rejectsMalformedUrlsAndNonWebSchemes() {
        assertNull(decide("not a url", "https://news.example/", true, true, false));
        assertNull(decide("data:text/html,hi", "https://news.example/", true, true, false));
        assertNull(decide("ftp://files.example/x.js", "https://news.example/", true, true, false));
    }
}

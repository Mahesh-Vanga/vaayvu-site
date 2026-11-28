package dev.vaayvu.app;

import java.util.List;
import java.util.Locale;

final class TrackerProtection {
    static List<String> customDomains(Iterable<String> entries) {
        java.util.Set<String> clean = new java.util.LinkedHashSet<>();
        for (String host : entries) {
            if (host == null || host.length() > 253 ||
                !host.matches("(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+(?=[a-z0-9-]*[a-z])[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?")) continue;
            clean.add(host);
            if (clean.size() == 128) break;
        }
        return new java.util.ArrayList<>(clean);
    }
    static boolean blocks(String documentHost, String resourceHost, String fetchSite, List<String> trackers) {
        if (documentHost == null || resourceHost == null || "same-origin".equals(fetchSite) || "same-site".equals(fetchSite)) return false;
        String page = hostname(documentHost), resource = hostname(resourceHost);
        if (page.startsWith("www.")) page = page.substring(4);
        if (matches(resource, page)) return false;
        for (String rule : trackers) {
            if (matches(resource, rule) && !matches(page, rule)) return true;
        }
        return false;
    }

    static boolean paused(String document, boolean privateTab, java.util.Set<String> pauses) {
        return !privateTab && document != null && matches(hostname(document), pauses);
    }

    private static boolean hasAdSubdomainPrefix(String host) {
        return host.startsWith("ads.") || host.startsWith("adserver.") || host.startsWith("adservice.")
            || host.startsWith("adsystem.") || host.startsWith("adbanner.") || host.startsWith("adtrack.")
            || host.startsWith("doubleclick.") || host.matches("^pagead\\d*\\..*");
    }

    private static boolean hasTrackerSubdomainPrefix(String host) {
        return host.startsWith("telemetry.") || host.startsWith("metrics.") || host.startsWith("pixel.")
            || host.startsWith("beacon.") || host.startsWith("analytics.") || host.startsWith("stat.")
            || host.startsWith("stats.") || host.startsWith("tracker.") || host.startsWith("tracking.");
    }

    static boolean matchesAdUrl(String url, java.util.Set<String> tokens) {
        if (url == null || tokens == null || tokens.isEmpty() || url.length() > 8192) return false;
        String lower = url.toLowerCase(java.util.Locale.ROOT);
        for (String token : tokens) {
            if (token != null && token.length() >= 2 && lower.contains(token)) return true;
        }
        return false;
    }

    static final class VfdException {
        final java.util.Set<String> hosts;
        final java.util.List<String> paths;
        VfdException(java.util.Set<String> hosts, java.util.List<String> paths) {
            this.hosts = hosts;
            this.paths = paths;
        }
    }

    static boolean matchesException(String url, String host, java.util.List<VfdException> rules) {
        if (rules == null || rules.isEmpty() || url == null || host == null) return false;
        String lowerUrl = url.toLowerCase(java.util.Locale.ROOT);
        for (VfdException rule : rules) {
            if (rule == null) continue;
            if (!rule.hosts.isEmpty()) {
                boolean hostHit = false;
                for (String h : rule.hosts) {
                    if (!h.isEmpty() && (host.equals(h) || host.endsWith("." + h))) { hostHit = true; break; }
                }
                if (!hostHit) continue;
            }
            if (rule.paths.isEmpty()) return true;
            for (String path : rule.paths) {
                if (!path.isEmpty() && lowerUrl.contains(path)) return true;
            }
        }
        return false;
    }

    static String siteOf(String value) {
        String host = hostname(value == null ? "" : value);
        int dot = host.indexOf('.');
        if (dot < 0) return host;
        String[] parts = host.split("\\.");
        if (parts.length <= 2) return host;
        String last = parts[parts.length - 2] + "." + parts[parts.length - 1];
        java.util.Set<String> multi = new java.util.HashSet<>(java.util.Arrays.asList(
            "co.uk", "com.au", "co.jp", "co.nz", "com.br", "co.in", "com.mx",
            "co.za", "com.tr", "co.kr", "com.sg", "com.hk", "com.tw", "co.il"));
        return multi.contains(last) ? parts[parts.length - 3] + "." + last : last;
    }

    /**
     * VAAYVU filter decision. Mirrors chrome/vfd.js decide(): strict custom
     * hosts win, then paused-site fallback, then exceptions, then category
     * hosts and URL tokens (first-party tokens only when aggressive on the
     * same site). Returns the matching kind, or null to allow.
     */
    static String vfdVerdict(String url, String document, boolean privateTab,
            java.util.Set<String> strict, java.util.Set<String> paused,
            java.util.Set<String> ads, java.util.Set<String> trackers, java.util.Set<String> social,
            java.util.Set<String> patterns, java.util.Set<String> trackerPatterns,
            java.util.Set<String> firstParty, java.util.List<VfdException> exceptions,
            boolean enabled, boolean adsOn, boolean trackersOn, boolean socialOn, boolean aggressive) {
        if (!enabled || url == null) return null;
        String lower = url.toLowerCase(java.util.Locale.ROOT);
        String host;
        try {
            java.net.URI parsed = new java.net.URI(url);
            String scheme = parsed.getScheme();
            if (scheme == null || (!scheme.equalsIgnoreCase("http") && !scheme.equalsIgnoreCase("https"))) return null;
            host = parsed.getHost();
        } catch (Exception invalid) { return null; }
        if (host == null) return null;
        host = hostname(host);
        if (host.isEmpty()) return null;
        if (matches(host, strict)) return "strict";
        String documentHost = "";
        if (document != null && !document.isEmpty()) {
            try {
                String raw = document;
                if (!raw.contains("://")) raw = "https://" + raw;
                String parsed = new java.net.URI(raw).getHost();
                documentHost = parsed == null ? "" : hostname(parsed);
            } catch (Exception invalid) { documentHost = hostname(document); }
        }
        boolean sameSite = !documentHost.isEmpty() && siteOf(host).equals(siteOf(documentHost));
        if (!privateTab && paused != null && matches(documentHost, paused)) return null;
        if (matchesException(lower, host, exceptions)) return null;
        if (adsOn && (matches(host, ads) || hasAdSubdomainPrefix(host))) return "ads";
        if (trackersOn && (matches(host, trackers) || (!sameSite && hasTrackerSubdomainPrefix(host)))) return "trackers";
        if (sameSite) {
            if (aggressive && adsOn && matchesAdUrl(url, firstParty)) return "firstparty";
            if (aggressive && trackersOn && hasTrackerSubdomainPrefix(host)) return "trackers";
            return null;
        }
        if (socialOn && matches(host, social)) return "social";
        if (adsOn && matchesAdUrl(url, patterns)) return "token";
        if (trackersOn && matchesAdUrl(url, trackerPatterns)) return "tokentracker";
        return null;
    }

    private static String hostname(String input) {
        String lower = input.toLowerCase(Locale.ROOT);
        return lower.endsWith(".") ? lower.substring(0, lower.length() - 1) : lower;
    }

    private static boolean matches(String host, String domain) {
        return host.equals(domain) || host.endsWith("." + domain);
    }

    private static boolean matches(String host, java.util.Set<String> rules) {
        if (host == null || rules == null || rules.isEmpty()) return false;
        if (rules.contains(host)) return true;
        int dot = host.indexOf('.');
        while (dot != -1) {
            if (rules.contains(host.substring(dot + 1))) return true;
            dot = host.indexOf('.', dot + 1);
        }
        return false;
    }
}

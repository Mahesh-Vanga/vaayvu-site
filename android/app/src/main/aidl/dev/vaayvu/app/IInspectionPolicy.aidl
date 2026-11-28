package dev.vaayvu.app;

// A private inspection page asks the browser to apply the selected profile's existing site rules.
interface IInspectionPolicy {
    void onRevoked(in android.os.ResultReceiver callback);
    boolean permits(String documentHost, String url, String fetchSite, boolean mainFrame);
    String bannerStyles(String documentHost);
}

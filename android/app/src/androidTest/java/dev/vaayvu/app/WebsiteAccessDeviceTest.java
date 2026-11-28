package dev.vaayvu.app;

import android.app.DownloadManager;
import android.app.Instrumentation;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebView;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class WebsiteAccessDeviceTest {
    private final Instrumentation device = InstrumentationRegistry.getInstrumentation();
    private WebView chrome;

    @Test public void chromiumDevToolsIsolatedToRequestedRegularPage() throws Exception {
        BrowserActivity host = (BrowserActivity)device.startActivitySync(new Intent(device.getTargetContext(), BrowserActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        device.runOnMainSync(() -> chrome = firstWebView(host.findViewById(android.R.id.content)));
        final String app = device.getTargetContext().getPackageName();
        // Chromium on debug/userdebug builds forces all WebViews into its debugger regardless of the API switch.
        boolean systemForcesDebugging = !"user".equals(android.os.Build.TYPE) ||
            (device.getTargetContext().getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;
        final String cookie = "inspect" + System.nanoTime() + "=ordinary";
        final java.util.concurrent.CopyOnWriteArrayList<String> visits = new java.util.concurrent.CopyOnWriteArrayList<>();
        try (MockWebServer server = new MockWebServer()) {
            server.setDispatcher(new okhttp3.mockwebserver.Dispatcher() {
                @Override public MockResponse dispatch(okhttp3.mockwebserver.RecordedRequest request) {
                    if ("/inspect".equals(request.getPath())) visits.add(String.valueOf(request.getHeader("Cookie")));
                    return new MockResponse().setHeader("Content-Type","text/html; charset=utf-8").setBody(
                        "<title>Chromium inspection fixture</title><main>Local test</main><script>document.cookie='" + cookie + ";path=/'</script>");
                }
            });
            server.start();
            await(() -> "true".equals(eval("typeof nativeReady !== 'undefined' && nativeReady")));
            eval("VaayvuPreferences.commit({ordinaryWeb:true})");
            await(host::websiteAccess);
            String url = org.json.JSONObject.quote(server.url("/inspect").toString());
            eval("document.querySelector('#address').value=" + url + ";document.querySelector('#address-form').requestSubmit()");
            await(() -> "true".equals(eval("pageInspector.available() && current().title==='Chromium inspection fixture'")));
            String regular = eval("activeId");
            if (!systemForcesDebugging) assertFalse(readShell("cat /proc/net/unix").contains("webview_devtools_remote_" + android.os.Process.myPid() + "\n"));
            eval("addTab(true," + org.json.JSONObject.quote(server.url("/private").toString()) + ")");
            await(() -> "true".equals(eval("current().private && current().url.endsWith('/private') && !current().loading")));
            assertEquals("false",eval("pageInspector.available()"));
            eval("VaayvuNative.postMessage(JSON.stringify({type:'openDeveloperTools',id:activeId,url:current().url}))");
            assertFalse(readShell("dumpsys activity top").contains("ACTIVITY " + app + "/.ChromiumInspectionActivity"));
            eval("selectTab(" + regular + ")");
            await(() -> "true".equals(eval("pageInspector.available()")));
            eval("command('inspect')");
            await(() -> visits.size() >= 2);
            assertFalse("The inspected copy must not inherit the original tab's cookies", visits.get(1).contains(cookie));
            String inspectorPid = readShell("pidof " + app + ":inspection").trim();
            assertFalse(inspectorPid.isEmpty());
            String target = "webview_devtools_remote_" + inspectorPid + "\n";
            await(() -> readShell("cat /proc/net/unix").contains(target));
            if (!systemForcesDebugging) assertFalse(readShell("cat /proc/net/unix").contains("webview_devtools_remote_" + android.os.Process.myPid() + "\n"));
            assertTrue(device.getUiAutomation().performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK));
            if (!systemForcesDebugging) await(() -> !readShell("cat /proc/net/unix").contains(target));
            await(() -> !readShell("dumpsys activity top").contains("ACTIVITY " + app + "/.ChromiumInspectionActivity"));
            assertEquals("true",eval("activeId===" + regular + " && current().url===" + url));
        } finally {
            device.runOnMainSync(host::finish);
        }
    }

    private String readShell(String command) throws Exception {
        try (android.os.ParcelFileDescriptor pipe = device.getUiAutomation().executeShellCommand(command);
             java.io.InputStream input = new android.os.ParcelFileDescriptor.AutoCloseInputStream(pipe);
             java.util.Scanner scanner = new java.util.Scanner(input, "UTF-8").useDelimiter("\\A")) {
            return scanner.hasNext() ? scanner.next() : "";
        }
    }

    @Test public void trustedGateBlocksWebViewsAndCancelsOnlyUnfinishedTransfers() throws Exception {
        Context context = device.getTargetContext();
        BrowserActivity host = (BrowserActivity)device.startActivitySync(new Intent(context,BrowserActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        device.runOnMainSync(() -> chrome = firstWebView(host.findViewById(android.R.id.content)));
        DownloadManager downloads = context.getSystemService(DownloadManager.class);
        long finished = -1, unfinished = -1;
        try (MockWebServer server = new MockWebServer()) {
            server.start();
            await(() -> "true".equals(eval("typeof nativeReady !== 'undefined' && nativeReady")));
            eval("VaayvuPreferences.commit({ordinaryWeb:false})");
            await(() -> !host.websiteAccess());
            assertTrue((host.getWindow().getAttributes().flags & WindowManager.LayoutParams.FLAG_SECURE) != 0);
            String site = server.url("/ordinary").toString();
            eval("VaayvuNative.postMessage(JSON.stringify({type:'open',id:'fixture',url:'" + site + "'}))");
            assertNull(server.takeRequest(350,TimeUnit.MILLISECONDS));
            assertNull(host.lookupTab("fixture"));
            eval("VaayvuNative.postMessage(JSON.stringify({type:'websiteAccess',enabled:true}))");
            await(host::websiteAccess);
            server.enqueue(new MockResponse().setHeader("Content-Type","text/html").setBody("<title>Device fixture</title>"));
            eval("VaayvuNative.postMessage(JSON.stringify({type:'open',id:'fixture',url:'" + site + "'}))");
            assertEquals("/ordinary",server.takeRequest(8,TimeUnit.SECONDS).getPath());
            assertNotNull(host.lookupTab("fixture"));
            server.setDispatcher(new okhttp3.mockwebserver.Dispatcher() {
                @Override public MockResponse dispatch(okhttp3.mockwebserver.RecordedRequest request) {
                    if ("/partial".equals(request.getPath())) return new MockResponse().setBody("x".repeat(64000)).throttleBody(128,1,TimeUnit.SECONDS);
                    return new MockResponse().setBody("fixture");
                }
            });
            finished = downloads.enqueue(new DownloadManager.Request(Uri.parse(server.url("/finished").toString())));
            final long completedID = finished;
            await(() -> status(downloads,completedID) == DownloadManager.STATUS_SUCCESSFUL);
            unfinished = downloads.enqueue(new DownloadManager.Request(Uri.parse(server.url("/partial").toString())));
            final long runningID = unfinished;
            await(() -> status(downloads,runningID) == DownloadManager.STATUS_RUNNING);
            eval("VaayvuNative.postMessage(JSON.stringify({type:'websiteAccess',enabled:false}))");
            await(() -> !host.websiteAccess() && host.lookupTab("fixture") == null && status(downloads,runningID) == -1);
            assertEquals(DownloadManager.STATUS_SUCCESSFUL,status(downloads,completedID));
        } finally {
            if (finished >= 0) downloads.remove(finished);
            if (unfinished >= 0) downloads.remove(unfinished);
            device.runOnMainSync(host::finish);
        }
    }

    @Test public void approvedVisitPermitsOnlyOneTabUntilItCloses() throws Exception {
        Context context = device.getTargetContext();
        BrowserActivity host = (BrowserActivity)device.startActivitySync(new Intent(context, BrowserActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        device.runOnMainSync(() -> chrome = firstWebView(host.findViewById(android.R.id.content)));
        java.util.Set<String> requests = java.util.concurrent.ConcurrentHashMap.newKeySet();
        try (MockWebServer server = new MockWebServer()) {
            server.setDispatcher(new okhttp3.mockwebserver.Dispatcher() {
                @Override public MockResponse dispatch(okhttp3.mockwebserver.RecordedRequest request) {
                    requests.add(request.getPath());
                    return new MockResponse().setHeader("Content-Type", "text/html").setBody("<title>Visit</title>");
                }
            });
            server.start();
            await(() -> "true".equals(eval("typeof nativeReady !== 'undefined' && nativeReady")));
            eval("VaayvuNative.postMessage(JSON.stringify({type:'websiteAccess',enabled:false}))");
            String origin = server.url("/").toString();
            eval("VaayvuNative.postMessage(JSON.stringify({type:'open',id:'visit',userApprovedVisit:true,url:'" + origin + "allowed'}))");
            await(() -> requests.contains("/allowed"));
            assertFalse(host.websiteAccess());
            eval("VaayvuNative.postMessage(JSON.stringify({type:'open',id:'other',url:'" + origin + "denied'}))");
            eval("fetch('" + origin + "chrome-denied').catch(()=>{})");
            device.runOnMainSync(() -> host.lookupTab("visit").view.evaluateJavascript("window.open('/popup-denied')", null));
            eval("VaayvuNative.postMessage(JSON.stringify({type:'navigate',id:'visit',url:'" + origin + "follow'}))");
            await(() -> requests.contains("/follow"));
            eval("VaayvuNative.postMessage(JSON.stringify({type:'close',id:'visit'}))");
            await(() -> host.lookupTab("visit") == null);
            eval("VaayvuNative.postMessage(JSON.stringify({type:'open',id:'visit',url:'" + origin + "denied'}))");
            device.waitForIdleSync();
            assertNull(host.lookupTab("visit"));
            assertNull(host.lookupTab("other"));
            assertFalse(requests.contains("/denied") || requests.contains("/chrome-denied") || requests.contains("/popup-denied"));
        } finally {
            device.runOnMainSync(host::finish);
        }
    }

    @Test public void submittedWebSearchLoadsProviderInNativeTab() throws Exception {
        BrowserActivity host = (BrowserActivity)device.startActivitySync(new Intent(device.getTargetContext(), BrowserActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        device.runOnMainSync(() -> chrome = firstWebView(host.findViewById(android.R.id.content)));
        try {
            await(() -> "true".equals(eval("typeof nativeReady !== 'undefined' && nativeReady")));
            eval("VaayvuPreferences.commit({ordinaryWeb:true,searchProvider:'duckduckgo'})");
            await(host::websiteAccess);
            eval("document.querySelector('#address').value='web browser';document.querySelector('#address-form').requestSubmit()");
            String id = new org.json.JSONTokener(eval("activeId")).nextValue().toString();
            await(() -> host.lookupTab(id) != null);
            java.util.concurrent.atomic.AtomicReference<String> location = new java.util.concurrent.atomic.AtomicReference<>();
            await(() -> {
                device.runOnMainSync(() -> location.set(host.lookupTab(id).view.getOriginalUrl()));
                if (location.get() == null) return false;
                Uri url = Uri.parse(location.get());
                return "duckduckgo.com".equals(url.getHost()) && "web browser".equals(url.getQueryParameter("q"));
            });
        } finally {
            device.runOnMainSync(host::finish);
        }
    }

    private static int status(DownloadManager manager,long id) {
        try (Cursor row=manager.query(new DownloadManager.Query().setFilterById(id))) {
            return row != null && row.moveToFirst() ? row.getInt(row.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)) : -1;
        }
    }
    private static WebView firstWebView(View node) {
        if (node instanceof WebView) return (WebView)node;
        if (node instanceof ViewGroup) {
            ViewGroup group=(ViewGroup)node;
            for (int i=0;i<group.getChildCount();i++) { WebView match=firstWebView(group.getChildAt(i)); if (match!=null) return match; }
        }
        return null;
    }
    private String eval(String js) throws Exception {
        ArrayBlockingQueue<String> response=new ArrayBlockingQueue<>(1);
        device.runOnMainSync(() -> chrome.evaluateJavascript(js,response::offer));
        return response.poll(5,TimeUnit.SECONDS);
    }
    private interface Check { boolean get() throws Exception; }
    private void await(Check check) throws Exception {
        for (int i=0;i<120;i++) { if (check.get()) return; Thread.sleep(100); }
        fail("Timed out waiting for Android to apply the browser policy.");
    }
}

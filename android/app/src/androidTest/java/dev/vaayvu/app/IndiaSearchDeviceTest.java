package dev.vaayvu.app;

import android.app.Instrumentation;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.net.InetAddress;
import java.time.Instant;
import java.util.Collections;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import okhttp3.CertificatePinner;
import okhttp3.OkHttpClient;
import okhttp3.mockwebserver.MockResponse;
import okhttp3.mockwebserver.MockWebServer;
import okhttp3.mockwebserver.RecordedRequest;
import okhttp3.tls.HandshakeCertificates;
import okhttp3.tls.HeldCertificate;
import org.json.JSONArray;
import org.json.JSONObject;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class IndiaSearchDeviceTest {
    private static final String HOST = "search.vaayvu.test";
    private static final String ZERO = "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
    private final Instrumentation device = InstrumentationRegistry.getInstrumentation();
    private final LinkedBlockingQueue<String> events = new LinkedBlockingQueue<>();
    private void result(String id, String token, JSONArray rows, String error) {
        events.add(id + "/" + token + "/" + (error != null ? error : rows.length()));
    }
    private static JSONObject manifest() throws Exception {
        return new JSONObject().put("country","IN").put("region","Mumbai").put("origin","https://"+HOST)
            .put("spkiPins",new JSONArray().put(ZERO)).put("expiresAt","2099-01-01T00:00:00Z");
    }

    @Test public void unprovisionedAndInvalidDeploymentsFailClosed() throws Exception {
        assertNotNull(IndiaSearch.Deployment.parse(manifest().toString(),Instant.now()));
        for (String origin : new String[]{"http://"+HOST,"https://"+HOST+":443","https://"+HOST+"/","https://u@"+HOST,
                "https://127.0.0.1","https://bad.local","https://Search.vaayvu.test"})
            assertNull(origin, IndiaSearch.Deployment.parse(manifest().put("origin",origin).toString(), Instant.now()));
        assertNull(IndiaSearch.Deployment.parse(manifest().put("country","US").toString(),Instant.now()));
        assertNull(IndiaSearch.Deployment.parse(manifest().put("region","").toString(),Instant.now()));
        assertNull(IndiaSearch.Deployment.parse(manifest().put("spkiPins",new JSONArray().put(ZERO).put(ZERO)).toString(),Instant.now()));
        assertNull(IndiaSearch.Deployment.parse(manifest().put("expiresAt","2010-01-01T00:00:00Z").toString(),Instant.now()));
        device.runOnMainSync(() -> {
            IndiaSearch search = new IndiaSearch("{}", this::result);
            assertFalse(search.available());
            search.start("tab1","q1","local fixture"); search.close();
        });
        assertEquals("tab1/q1/unavailable", events.poll(2,TimeUnit.SECONDS));
    }

    @Test public void pinIsCheckedBeforePostAndRedirectsAndCookiesAreRejected() throws Exception {
        HeldCertificate cert = new HeldCertificate.Builder().commonName(HOST).addSubjectAlternativeName(HOST).build();
        HandshakeCertificates serverTLS = new HandshakeCertificates.Builder().heldCertificate(cert).build();
        HandshakeCertificates clientTLS = new HandshakeCertificates.Builder().addTrustedCertificate(cert.certificate()).build();
        try (MockWebServer server = new MockWebServer()) {
            server.useHttps(serverTLS.sslSocketFactory(),false);
            server.start(InetAddress.getByName("127.0.0.1"),0);
            String origin = "https://" + HOST + ":" + server.getPort();
            IndiaSearch search = client(origin, ZERO, clientTLS);
            try {
                start(search, "t", "bad");
                assertEquals("t/bad/failed", events.poll(8,TimeUnit.SECONDS));
                assertNull(server.takeRequest(200,TimeUnit.MILLISECONDS));
            } finally { device.runOnMainSync(search::close); }
            IndiaSearch good = client(origin, CertificatePinner.pin(cert.certificate()), clientTLS);
            try {
                server.enqueue(new MockResponse().setResponseCode(307).addHeader("Location", origin + "/unexpected")
                    .addHeader("Set-Cookie","secret=never"));
                start(good,"tabA","redirect");
                RecordedRequest first = server.takeRequest(8,TimeUnit.SECONDS);
                assertNotNull(first); assertEquals("POST",first.getMethod()); assertEquals("/v1/search",first.getPath());
                assertEquals("Vaayvu Search", first.getHeader("User-Agent"));
                assertEquals("test fixture",new JSONObject(first.getBody().readUtf8()).getString("q"));
                assertNull(first.getHeader("Cookie")); assertNull(first.getHeader("Referer"));
                assertEquals("tabA/redirect/failed",events.poll(5,TimeUnit.SECONDS));
                assertNull(server.takeRequest(150,TimeUnit.MILLISECONDS));
                server.enqueue(new MockResponse().addHeader("Content-Type","application/json").setBody("{\"results\":[]}"));
                start(good,"tabB","valid");
                assertEquals("tabB/valid/0",events.poll(5,TimeUnit.SECONDS));
                assertNull(server.takeRequest(1,TimeUnit.SECONDS).getHeader("Cookie"));
                server.enqueue(new MockResponse().addHeader("Content-Type","application/json").setBody("x".repeat(IndiaSearch.MAX_BODY+1)));
                start(good,"tabB","large");
                assertEquals("tabB/large/failed",events.poll(5,TimeUnit.SECONDS));
                server.takeRequest();
                server.enqueue(new MockResponse().addHeader("Content-Type","application/json").setBody("{\"results\":[]}")
                    .setBodyDelay(2,TimeUnit.SECONDS));
                start(good,"tabA","slow");
                assertNotNull(server.takeRequest(3,TimeUnit.SECONDS));
                server.enqueue(new MockResponse().addHeader("Content-Type","application/json").setBody("{\"results\":[]}"));
                start(good,"tabB","fresh");
                assertEquals("tabA/slow/failed",events.poll(2,TimeUnit.SECONDS));
                assertEquals("tabB/fresh/0",events.poll(5,TimeUnit.SECONDS));
                assertNull(events.poll(250,TimeUnit.MILLISECONDS));
            } finally { device.runOnMainSync(good::close); }
        }
    }

    private IndiaSearch client(String origin, String pin, HandshakeCertificates tls) {
        IndiaSearch.Deployment fixture = new IndiaSearch.Deployment(origin, HOST, Collections.singleton(pin), Instant.now().plusSeconds(90));
        OkHttpClient.Builder transport = new OkHttpClient.Builder()
            .dns(name -> Collections.singletonList(InetAddress.getByName("127.0.0.1")))
            .sslSocketFactory(tls.sslSocketFactory(),tls.trustManager());
        return new IndiaSearch(fixture, transport, this::result);
    }
    private void start(IndiaSearch search, String id, String request) {
        device.runOnMainSync(() -> search.start(id,request,"test fixture"));
    }
}

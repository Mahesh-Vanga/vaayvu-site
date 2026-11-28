package dev.vaayvu.app;

import android.os.Handler;
import android.os.Looper;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.Proxy;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.cert.X509Certificate;
import java.time.Instant;
import java.util.Base64;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.SSLSession;
import okhttp3.Authenticator;
import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.CookieJar;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Protocol;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** An isolated HTTPS client. The trusted interface supplies a query and never a destination. */
final class IndiaSearch {
    static final int MAX_BODY = 60 * 1024;
    private static final MediaType JSON = MediaType.get("application/json; charset=utf-8");

    static final class Deployment {
        final String origin, host;
        final Set<String> pins;
        final Instant expiresAt;
        Deployment(String origin, String host, Set<String> pins, Instant expiresAt) {
            this.origin = origin; this.host = host; this.pins = pins; this.expiresAt = expiresAt;
        }

        static Deployment parse(String manifest, Instant now) {
            if (manifest == null || manifest.length() > 8192) return null;
            try {
                JSONObject info = new JSONObject(manifest);
                String region = info.getString("region"), origin = info.getString("origin"), expires = info.getString("expiresAt");
                if (!"IN".equals(info.get("country")) || region.trim().isEmpty() || region.codePointCount(0,region.length()) > 80
                        || region.codePoints().anyMatch(Character::isISOControl)) return null;
                URI uri = URI.create(origin);
                String host = uri.getHost();
                if (host == null || !origin.equals("https://" + host) ||
                        !host.matches("(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?") ||
                        host.length() > 253 || host.endsWith(".localhost") || host.endsWith(".local")) return null;
                if (!expires.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z")) return null;
                Instant expiry = Instant.parse(expires);
                if (!expiry.isAfter(now)) return null;
                JSONArray list = info.getJSONArray("spkiPins");
                if (list.length()<1 || list.length()>4) return null;
                Set<String> pins = new LinkedHashSet<>();
                for (int i=0; i<list.length(); i++) {
                    String pin = list.getString(i);
                    if (!pin.startsWith("sha256/")) return null;
                    byte[] digest = Base64.getDecoder().decode(pin.substring(7));
                    if (digest.length != 32 || !pin.equals("sha256/"+Base64.getEncoder().encodeToString(digest)) || !pins.add(pin)) return null;
                }
                return new Deployment(origin,host,Collections.unmodifiableSet(pins),expiry);
            } catch (JSONException | IllegalArgumentException | java.time.DateTimeException ignored) { return null; }
        }

        boolean acceptsLeaf(String name, SSLSession session) {
            if (!host.equals(name) || !expiresAt.isAfter(Instant.now())) return false;
            try {
                X509Certificate leaf = (X509Certificate)session.getPeerCertificates()[0];
                byte[] fingerprint = MessageDigest.getInstance("SHA-256").digest(leaf.getPublicKey().getEncoded());
                return pins.contains("sha256/" + Base64.getEncoder().encodeToString(fingerprint));
            } catch (java.security.GeneralSecurityException | javax.net.ssl.SSLPeerUnverifiedException | RuntimeException e) { return false; }
        }
    }

    interface Listener { void result(String id, String requestId, JSONArray results, String error); }
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Deployment deployment;
    private final OkHttpClient client;
    private final Listener listener;
    private String owner, token;
    private Call current;
    private boolean closed;

    IndiaSearch(String manifest, Listener listener) {
        this(Deployment.parse(manifest, Instant.now()), new OkHttpClient.Builder(), listener);
    }

    IndiaSearch(Deployment deployment, OkHttpClient.Builder transport, Listener listener) {
        this.listener = listener;
        this.deployment = deployment;
        if (deployment == null) { client = null; return; }
        OkHttpClient.Builder config = transport.cookieJar(CookieJar.NO_COOKIES)
            .cache(null).proxy(Proxy.NO_PROXY).authenticator(Authenticator.NONE).proxyAuthenticator(Authenticator.NONE)
            .followRedirects(false).followSslRedirects(false).retryOnConnectionFailure(false)
            .protocols(Collections.singletonList(Protocol.HTTP_1_1)).callTimeout(12, TimeUnit.SECONDS)
            .connectTimeout(5, TimeUnit.SECONDS).readTimeout(6, TimeUnit.SECONDS)
            .addNetworkInterceptor(chain -> {
                if (!deployment.expiresAt.isAfter(Instant.now()) || !deployment.host.equals(chain.request().url().host()))
                    throw new IOException("Search deployment unavailable");
                return chain.proceed(chain.request());
            });
        HostnameVerifier systemVerifier = config.build().hostnameVerifier();
        client = config.hostnameVerifier((host, session) -> systemVerifier.verify(host,session) && deployment.acceptsLeaf(host,session)).build();
    }
    boolean available() { return !closed && deployment != null && deployment.expiresAt.isAfter(Instant.now()); }

    void start(String id, String requestId, String text) {
        if (closed || !validID(id) || !validID(requestId)) return;
        suspend();
        if (!available()) { listener.result(id,requestId,null,"unavailable"); return; }
        String query = text.trim();
        if (query.isEmpty() || query.codePointCount(0,query.length()) > 256 ||
                query.codePoints().noneMatch(Character::isLetterOrDigit) || query.codePoints().anyMatch(Character::isISOControl)) {
            listener.result(id,requestId,null,"invalid"); return;
        }
        String payload = "{\"q\":" + JSONObject.quote(query) + "}";
        Request request = new Request.Builder().url(deployment.origin + "/v1/search")
            .header("Accept","application/json").header("Accept-Encoding","identity")
            .header("Cache-Control","no-store").header("User-Agent","Vaayvu Search")
            .post(RequestBody.create(payload, JSON)).build();
        Call call = client.newCall(request);
        owner = id; token = requestId; current = call;
        call.enqueue(new Callback() {
            @Override public void onFailure(Call failed, IOException e) { finish(failed,id,requestId,null,"failed"); }
            @Override public void onResponse(Call done, Response response) {
                try (Response ignored = response) {
                    if (response.code() != 200) {
                        String error = response.code() == 400 ? "invalid" : response.code() == 503 ? "unavailable" : "failed";
                        finish(done,id,requestId,null,error); return;
                    }
                    ResponseBody body = response.body();
                    MediaType type = body.contentType();
                    if (type == null || !"application".equals(type.type()) || !"json".equals(type.subtype()) || body.contentLength() > MAX_BODY)
                        throw new IOException();
                    JSONArray rows = results(readBounded(body.byteStream()));
                    finish(done,id,requestId,rows,null);
                } catch (IOException | JSONException | RuntimeException e) { finish(done,id,requestId,null,"failed"); }
            }
        });
    }
    private static boolean validID(String id) { return id != null && id.matches("[a-zA-Z0-9._:-]{1,128}"); }

    private void finish(Call call, String id, String requestId, JSONArray rows, String error) {
        main.post(() -> {
            if (closed || call != current) return;
            current = null; owner = null; token = null;
            if (!available()) listener.result(id,requestId,null,"unavailable");
            else listener.result(id,requestId,rows,error);
        });
    }
    void cancel(String id, String requestId) {
        if (current == null || (id != null && !id.equals(owner)) || (requestId != null && !requestId.equals(token))) return;
        Call pending = current;
        current = null; owner = null; token = null;
        client.dispatcher().executorService().execute(pending::cancel);
    }
    void suspend() {
        if (current == null) return;
        String id = owner, request = token;
        cancel(null, null);
        listener.result(id, request, null, "failed");
    }

    void close() {
        closed = true; cancel(null,null);
        if (client != null) {
            client.dispatcher().executorService().execute(client.connectionPool()::evictAll);
            client.dispatcher().executorService().shutdown();
        }
    }

    static String readBounded(InputStream input) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        int count;
        while ((count=input.read(buffer)) != -1) {
            if (out.size()+count > MAX_BODY) throw new IOException();
            out.write(buffer,0,count);
        }
        return StandardCharsets.UTF_8.newDecoder().decode(java.nio.ByteBuffer.wrap(out.toByteArray())).toString();
    }

    static JSONArray results(String response) throws JSONException {
        JSONArray rows = new JSONObject(response).getJSONArray("results"), clean = new JSONArray();
        if (rows.length()>20) throw new JSONException("Too many rows");
        for (int i=0;i<rows.length();i++) {
            JSONObject item=rows.getJSONObject(i);
            if (!(item.get("url") instanceof String) || !(item.get("title") instanceof String) || !(item.get("snippet") instanceof String)) throw new JSONException("Invalid row");
            String url=item.getString("url"), title=item.getString("title"), snippet=item.getString("snippet");
            if (!BrowserActivity.webUrl(url) || !url.startsWith("https://") || title.trim().isEmpty() || title.length()>512 || snippet.length()>320)
                throw new JSONException("Invalid search result");
            clean.put(new JSONObject().put("title",title).put("url",url).put("snippet",snippet));
        }
        return clean;
    }
}

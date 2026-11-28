package dev.vaayvu.app;

import android.content.Intent;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** Reads an explicitly requested document using a voice available offline. */
final class PageSpeech {
    private final BrowserActivity host;
    private TextToSpeech engine;
    private BrowserTab owner;
    private String pageUrl, pendingText, lastUtterance;
    private int sequence;
    private boolean ready, disposed;

    PageSpeech(BrowserActivity host) { this.host = host; }
    boolean available() {
        return !host.getPackageManager().queryIntentServices(new Intent(TextToSpeech.Engine.INTENT_ACTION_TTS_SERVICE), 0).isEmpty();
    }
    void start(BrowserTab tab, String url, String text) {
        if (tab == null || !tab.hasDrawablePage() || !url.equals(tab.view.getUrl())) return;
        String article = text.trim();
        if (article.isEmpty() || article.length() > 64000) { host.notice("Readable page text is unavailable."); return; }
        stop(null);
        owner = tab; pageUrl = url; pendingText = article;
        if (engine == null) {
            android.os.Handler main = new android.os.Handler(android.os.Looper.getMainLooper());
            engine = new TextToSpeech(host, status -> main.post(() -> initialized(status)));
        } else if (ready) speak();
    }

    private void initialized(int status) {
        if (disposed || engine == null) return;
        if (status != TextToSpeech.SUCCESS) {
            engine.shutdown(); engine = null; fail("Android could not start its speech engine."); return;
        }
        engine.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) {}
            @Override public void onDone(String id) { host.runOnUiThread(() -> { if (id.equals(lastUtterance)) stop(null); }); }
            @Override public void onError(String id) {
                host.runOnUiThread(() -> { if (owner != null && id.startsWith(sequence + ":")) fail("Android could not read this page aloud."); });
            }
        });
        ready = true;
        if (owner != null) speak();
    }

    private void speak() {
        if (owner == null || !owner.hasDrawablePage() || !pageUrl.equals(owner.view.getUrl())) { stop(null); return; }
        String text = pendingText;
        if (text == null) return;
        pendingText = null;
        Voice voice = engine.getVoice();
        if (!offline(voice)) {
            Set<Voice> choices = engine.getVoices();
            Locale target = voice == null ? Locale.getDefault() : voice.getLocale();
            voice = choices == null ? null : choices.stream().filter(PageSpeech::offline)
                .filter(v -> v.getLocale().getLanguage().equals(target.getLanguage())).findFirst().orElse(null);
            if (voice == null || engine.setVoice(voice) != TextToSpeech.SUCCESS) {
                fail("Download an offline voice in Android’s text-to-speech settings to listen to this page."); return;
            }
        }
        List<String> parts = chunks(text, TextToSpeech.getMaxSpeechInputLength());
        lastUtterance = sequence + ":" + (parts.size() - 1);
        host.event("readingState", "id", owner.id, "active", true);
        for (int i=0; i<parts.size(); i++) {
            int result = engine.speak(parts.get(i), i == 0 ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD, null, sequence + ":" + i);
            if (result == TextToSpeech.ERROR) { fail("Android could not start reading this page."); return; }
        }
    }
    private static boolean offline(Voice voice) {
        return voice != null && !voice.isNetworkConnectionRequired() &&
            (voice.getFeatures() == null || !voice.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED));
    }
    static List<String> chunks(String text, int limit) {
        List<String> chunks = new ArrayList<>();
        for (int start=0; start<text.length();) {
            int end = Math.min(start + limit, text.length());
            if (end < text.length()) {
                int word = end;
                while (word > start + limit / 2 && !Character.isWhitespace(text.charAt(word - 1))) word--;
                if (word > start + limit / 2) end = word;
                if (Character.isHighSurrogate(text.charAt(end-1))) end--;
            }
            chunks.add(text.substring(start, end)); start = end;
        }
        return chunks;
    }
    private void fail(String message) { host.notice(message); stop(null); }
    void stop(BrowserTab tab) {
        if (owner == null || (tab != null && tab != owner)) return;
        String id = owner.id;
        owner = null; pendingText = null; pageUrl = null; lastUtterance = null; sequence++;
        if (engine != null && ready) engine.stop();
        host.event("readingState", "id", id, "active", false);
    }
    void dispose() { disposed = true; stop(null); if (engine != null) { engine.shutdown(); engine = null; } }
}

package dev.vaayvu.geckoviewspike;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import org.mozilla.geckoview.GeckoRuntime;
import org.mozilla.geckoview.GeckoSession;
import org.mozilla.geckoview.GeckoView;

/** Minimal GeckoView engine spike: open one session and load a page. */
public final class SpikeActivity extends Activity {
    private GeckoRuntime runtime;
    private GeckoSession session;
    private GeckoView view;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        runtime = GeckoRuntime.create(this);
        session = new GeckoSession();
        session.open(runtime);
        session.setContentDelegate(new GeckoSession.ContentDelegate() {
            @Override
            public void onTitleChange(GeckoSession session, String title) {
                Log.i("GeckoViewSpike", "SPIKE_TITLE=" + title);
            }
        });
        view = new GeckoView(this);
        view.setSession(session);
        setContentView(view);
        session.loadUri("https://example.com/");
    }

    @Override
    protected void onDestroy() {
        if (session != null) session.close();
        super.onDestroy();
    }
}

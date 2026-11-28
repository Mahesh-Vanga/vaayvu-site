package dev.vaayvu.app;

import android.content.Context;
import android.content.ContextWrapper;
import android.content.SharedPreferences;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.UUID;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class BrowserProfilesDeviceTest {
    @Test public void installedIdentityAndLauncherArtMatchTheRebrandedBrowser() {
        Context app = InstrumentationRegistry.getInstrumentation().getTargetContext();
        android.content.pm.ApplicationInfo info = app.getApplicationInfo();
        assertEquals("dev.vaayvu.app", app.getPackageName());
        assertEquals("Vaayvu", info.loadLabel(app.getPackageManager()).toString());
        assertEquals(R.drawable.vaayvu_logo, info.icon);
        android.graphics.drawable.Drawable icon = app.getDrawable(info.icon);
        assertTrue(icon instanceof android.graphics.drawable.AdaptiveIconDrawable);
        android.graphics.drawable.AdaptiveIconDrawable layers = (android.graphics.drawable.AdaptiveIconDrawable)icon;
        assertNotNull(layers.getForeground());
        assertNotNull(layers.getBackground());
        if (android.os.Build.VERSION.SDK_INT >= 33) assertNotNull(layers.getMonochrome());
    }

    @Test public void profileCatalogRetainsSelectionAndDisallowsAmbiguousOrUnknownProfiles() {
        Context test = InstrumentationRegistry.getInstrumentation().getTargetContext();
        String file = "profile-test-" + UUID.randomUUID();
        Context isolated = new ContextWrapper(test) {
            @Override public SharedPreferences getSharedPreferences(String name, int mode) {
                return test.getSharedPreferences(file, mode);
            }
        };
        try {
            BrowserProfiles catalog = new BrowserProfiles(isolated);
            assertEquals("default",catalog.active());
            String work = catalog.create("  Work  ");
            assertEquals("Work",catalog.name(work));
            assertEquals(work,new BrowserProfiles(isolated).active());
            assertThrows(IllegalArgumentException.class, () -> catalog.create("WORK"));
            assertThrows(IllegalArgumentException.class, () -> catalog.create("personal"));
            assertFalse(catalog.select("unknown"));
            assertTrue(catalog.select("default"));
            BrowserProfiles reopened = new BrowserProfiles(isolated);
            assertEquals("default",reopened.active());
            assertEquals(2,reopened.catalog().length());
            assertEquals("Work",reopened.name(work));
        } finally { test.deleteSharedPreferences(file); }
    }
}

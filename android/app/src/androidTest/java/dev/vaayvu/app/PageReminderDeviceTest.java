package dev.vaayvu.app;

import android.Manifest;
import android.app.Instrumentation;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.service.notification.StatusBarNotification;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.util.HashSet;
import java.util.Set;
import org.junit.Test;
import org.junit.runner.RunWith;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class PageReminderDeviceTest {
    @Test public void scheduledPagePostsARegularLinkNotificationWhenItsAlarmIsDelivered() throws Exception {
        Instrumentation device = InstrumentationRegistry.getInstrumentation();
        Context context = device.getTargetContext();
        NotificationManager notifications = context.getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= 33) device.getUiAutomation().grantRuntimePermission(context.getPackageName(), Manifest.permission.POST_NOTIFICATIONS);
        SharedPreferences store = context.getSharedPreferences("page-reminders", Context.MODE_PRIVATE);
        Set<String> before = new HashSet<>(store.getAll().keySet());
        String fixture = "http://127.0.0.1:9/reminder-fixture";
        assertTrue(PageReminders.schedule(context, fixture, 3600, BrowserProfiles.PERSONAL));
        Set<String> current = new HashSet<>(store.getAll().keySet());
        current.removeAll(before);
        assertEquals(1, current.size());
        String id = current.iterator().next();
        try {
            Intent delivered = new Intent(context, PageReminders.class).setAction("dev.vaayvu.app.REMIND")
                .setData(Uri.parse("vaayvu-reminder://local/" + id));
            new PageReminders().onReceive(context, delivered);
            assertFalse(store.contains(id));
            Notification note = null;
            for (int attempt=0; attempt<40 && note==null; attempt++) {
                for (StatusBarNotification item : notifications.getActiveNotifications()) if (id.equals(item.getTag())) note = item.getNotification();
                if (note==null) Thread.sleep(50);
            }
            assertNotNull(note);
            assertEquals(R.drawable.wind_mark, note.getSmallIcon().getResId());
            assertEquals("127.0.0.1", note.extras.getCharSequence(Notification.EXTRA_TEXT).toString());
            assertEquals(Notification.VISIBILITY_PRIVATE, note.visibility);
            assertNotNull(note.contentIntent);
            assertEquals(context.getPackageName(), note.contentIntent.getCreatorPackage());
            BrowserActivity browser = (BrowserActivity)device.startActivitySync(new Intent(context, BrowserActivity.class)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            try {
                note.contentIntent.send();
                for (int i=0; i<120 && !fixture.equals(browser.getIntent().getDataString()); i++) {
                    device.waitForIdleSync(); Thread.sleep(100);
                }
                assertEquals(Intent.ACTION_VIEW, browser.getIntent().getAction());
                assertEquals(fixture, browser.getIntent().getDataString());
            } finally { device.runOnMainSync(browser::finish); }
        } finally { notifications.cancel(id, 1); }
    }
}

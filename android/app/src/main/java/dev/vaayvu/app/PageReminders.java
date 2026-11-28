package dev.vaayvu.app;

import android.Manifest;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import java.util.UUID;
import org.json.JSONException;
import org.json.JSONObject;

/** Inexact user-requested page reminders. The non-exported receiver also restores alarms after reboot. */
public final class PageReminders extends BroadcastReceiver {
    private static final String CHANNEL = "page-reminders";
    private static final String DELIVER = "dev.vaayvu.app.REMIND";
    static boolean validDelay(int seconds) { return seconds == 3600 || seconds == 86400 || seconds == 604800; }

    private static SharedPreferences records(Context context) {
        return context.getSharedPreferences(CHANNEL, Context.MODE_PRIVATE);
    }
    static boolean schedule(Context context, String url, int seconds, String profile) {
        if (!validDelay(seconds) || !BrowserActivity.webUrl(url)) return false;
        NotificationManager notifications = context.getSystemService(NotificationManager.class);
        notifications.createNotificationChannel(new NotificationChannel(CHANNEL, "Page reminders", NotificationManager.IMPORTANCE_DEFAULT));
        if (!notifications.areNotificationsEnabled() || notifications.getNotificationChannel(CHANNEL).getImportance() == NotificationManager.IMPORTANCE_NONE) return false;
        String id = UUID.randomUUID().toString();
        long when = System.currentTimeMillis() + seconds * 1000L;
        try {
            String value = new JSONObject().put("url", url).put("time", when).put("profile",profile).toString();
            if (!records(context).edit().putString(id, value).commit()) return false;
            alarm(context, id, when);
            return true;
        } catch (JSONException | RuntimeException e) {
            records(context).edit().remove(id).apply(); return false;
        }
    }

    private static void alarm(Context context, String id, long when) {
        Intent intent = new Intent(context, PageReminders.class).setAction(DELIVER).setData(Uri.parse("vaayvu-reminder://local/" + id));
        PendingIntent pending = PendingIntent.getBroadcast(context, 0, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        context.getSystemService(AlarmManager.class).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, when, pending);
    }

    @Override public void onReceive(Context context, Intent intent) {
        SharedPreferences saved = records(context);
        if (Intent.ACTION_BOOT_COMPLETED.equals(intent.getAction()) || Intent.ACTION_MY_PACKAGE_REPLACED.equals(intent.getAction())) {
            for (String id : saved.getAll().keySet()) {
                try {
                    JSONObject info = new JSONObject(saved.getString(id, ""));
                    alarm(context, id, Math.max(System.currentTimeMillis(), info.getLong("time")));
                } catch (JSONException ignored) { saved.edit().remove(id).apply(); }
            }
            return;
        }
        if (!DELIVER.equals(intent.getAction()) || intent.getData() == null) return;
        String id = intent.getData().getLastPathSegment();
        if (id == null || !saved.contains(id)) return;
        String value = saved.getString(id, "");
        try {
            JSONObject info = new JSONObject(value);
            String url = info.getString("url");
            if (!BrowserActivity.webUrl(url)) return;
            if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return;
            Intent open = new Intent(Intent.ACTION_VIEW,Uri.parse(url)).setClassName(context,context.getPackageName() + ".ReminderLink")
                .putExtra("profile", info.optString("profile",BrowserProfiles.PERSONAL));
            PendingIntent tap = PendingIntent.getActivity(context, id.hashCode(), open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            Notification note = new Notification.Builder(context, CHANNEL).setContentTitle("Page reminder")
                .setContentText(Uri.parse(url).getHost()).setSmallIcon(R.drawable.wind_mark)
                .setVisibility(Notification.VISIBILITY_PRIVATE).setContentIntent(tap).setAutoCancel(true).build();
            context.getSystemService(NotificationManager.class).notify(id, 1, note);
        } catch (JSONException | SecurityException ignored) {
            // The user can disable notifications after scheduling.
        } finally { saved.edit().remove(id).apply(); }
    }
}

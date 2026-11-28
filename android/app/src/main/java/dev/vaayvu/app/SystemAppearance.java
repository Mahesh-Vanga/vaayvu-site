package dev.vaayvu.app;

import android.animation.ValueAnimator;
import android.app.Activity;
import android.app.UiModeManager;
import android.database.ContentObserver;
import android.graphics.Color;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.View;
import android.view.WindowInsetsController;
import java.util.function.Consumer;

final class SystemAppearance {
    private final Activity activity;
    private final ContentObserver motionObserver;
    private final Consumer<Boolean> blurListener;
    private final UiModeManager.ContrastChangeListener contrastListener;

    SystemAppearance(Activity activity, Runnable changes) {
        this.activity = activity;
        motionObserver = new ContentObserver(new Handler(Looper.getMainLooper())) {
            @Override public void onChange(boolean selfChange) { changes.run(); }
        };
        activity.getContentResolver().registerContentObserver(Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE), false, motionObserver);
        blurListener = ignored -> changes.run();
        if (Build.VERSION.SDK_INT >= 31) activity.getWindowManager().addCrossWindowBlurEnabledListener(activity.getMainExecutor(), blurListener);
        if (Build.VERSION.SDK_INT >= 34) {
            contrastListener = ignored -> changes.run();
            activity.getSystemService(UiModeManager.class).addContrastChangeListener(activity.getMainExecutor(), contrastListener);
        } else contrastListener = null;
    }

    boolean reduceMotion() {
        // The setting observer can run before WindowManager updates ValueAnimator’s process cache.
        return Settings.Global.getFloat(activity.getContentResolver(), Settings.Global.ANIMATOR_DURATION_SCALE,
            ValueAnimator.areAnimatorsEnabled() ? 1f : 0f) == 0f;
    }

    boolean reduceTransparency() {
        return (Build.VERSION.SDK_INT >= 31 && !activity.getWindowManager().isCrossWindowBlurEnabled())
            || (Build.VERSION.SDK_INT >= 34 && activity.getSystemService(UiModeManager.class).getContrast() > 0);
    }

    void apply(View root, String background, boolean lightContent) {
        if (!background.matches("#[a-fA-F0-9]{6}")) return;
        int color = Color.parseColor(background);
        root.setBackgroundColor(color);
        activity.getWindow().setStatusBarColor(color);
        activity.getWindow().setNavigationBarColor(color);
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController controller = activity.getWindow().getInsetsController();
            int flags = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
            if (controller != null) controller.setSystemBarsAppearance(lightContent ? 0 : flags, flags);
        } else {
            View decor = activity.getWindow().getDecorView();
            int flags = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
            int other = decor.getSystemUiVisibility() & ~flags;
            decor.setSystemUiVisibility(lightContent ? other : other | flags);
        }
    }

    void close() {
        activity.getContentResolver().unregisterContentObserver(motionObserver);
        if (Build.VERSION.SDK_INT >= 31) activity.getWindowManager().removeCrossWindowBlurEnabledListener(blurListener);
        if (Build.VERSION.SDK_INT >= 34) activity.getSystemService(UiModeManager.class).removeContrastChangeListener(contrastListener);
    }
}

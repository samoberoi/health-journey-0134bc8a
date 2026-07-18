package app.lovable.byebyediabetes;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.WebSettings;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String BBDO_PUSH_CHANNEL_ID = "bbdo-alerts-v7";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createBbdoNotificationChannel();
        WebSettings settings = getBridge().getWebView().getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
    }

    private void createBbdoNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;

        // Delete older channels so users don't see stale duplicates in system settings.
        try { manager.deleteNotificationChannel("bbdo-alerts-v6"); } catch (Exception ignored) {}
        try { manager.deleteNotificationChannel("bbdo-alerts-v5"); } catch (Exception ignored) {}

        if (manager.getNotificationChannel(BBDO_PUSH_CHANNEL_ID) != null) return;

        NotificationChannel channel = new NotificationChannel(
            BBDO_PUSH_CHANNEL_ID,
            "BBDO notifications",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Reminders, coach messages, and health nudges");
        channel.enableVibration(true);
        channel.enableLights(true);
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);

        // Use the bundled BBDO chime instead of the OS default tone.
        Uri bbdoSound = Uri.parse("android.resource://" + getPackageName() + "/raw/bbdo_chime");
        AudioAttributes attributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        channel.setSound(bbdoSound, attributes);

        manager.createNotificationChannel(channel);
    }
}

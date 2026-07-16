import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { toast } from "sonner";
import { createNotification } from "@/lib/notificationService";
import { getNotificationSoundSettings } from "@/lib/notificationSoundService";
import {
  playCriticalHealthAlert,
  playNotificationSound,
  playSuccess,
  getMasterVolume,
  setMasterVolume,
} from "@/lib/soundEngine";

export type HealthAlertLog = {
  user_id?: string;
  log_type: "diabetes" | "bp" | "weight" | "water";
  glucose_morning?: number | null;
  glucose_evening?: number | null;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  weight_kg?: number | null;
};

type HealthAlertResult = {
  level: "critical" | "alert" | "ok";
  title: string;
  message: string;
};

let localChannelReady = false;

export function evaluateHealthAlert(log: Partial<HealthAlertLog>, prevWeight?: number | null): HealthAlertResult | null {
  if (log.log_type === "weight" && log.weight_kg != null) {
    const weight = Number(log.weight_kg);
    if (!Number.isFinite(weight)) return null;

    if (prevWeight != null && Number.isFinite(Number(prevWeight))) {
      const delta = weight - Number(prevWeight);
      const absDelta = Math.abs(delta);
      if (absDelta >= 10) {
        return {
          level: "critical",
          title: "Critical weight change",
          message: `Weight ${delta > 0 ? "up" : "down"} ${absDelta.toFixed(1)} kg (${prevWeight} → ${weight})`,
        };
      }
      if (absDelta >= 2) {
        return {
          level: "alert",
          title: "Weight change alert",
          message: `Weight ${delta > 0 ? "up" : "down"} ${absDelta.toFixed(1)} kg (${prevWeight} → ${weight})`,
        };
      }
    }

    if (weight >= 150 || weight <= 35) {
      return { level: "alert", title: "Weight alert", message: `Weight logged: ${weight} kg` };
    }
    return { level: "ok", title: "Weight logged", message: `Weight logged: ${weight} kg` };
  }

  if (log.log_type === "diabetes") {
    const glucose = log.glucose_morning ?? log.glucose_evening;
    if (glucose == null) return null;
    const g = Number(glucose);
    if (!Number.isFinite(g)) return null;
    if (g >= 250) return { level: "critical", title: "Critical glucose alert", message: `Very high glucose: ${g} mg/dL` };
    if (g <= 54) return { level: "critical", title: "Critical glucose alert", message: `Very low glucose: ${g} mg/dL` };
    if (g >= 180) return { level: "alert", title: "High glucose alert", message: `High glucose: ${g} mg/dL` };
    if (g <= 70) return { level: "alert", title: "Low glucose alert", message: `Low glucose: ${g} mg/dL` };
    if (g >= 140) return { level: "alert", title: "Elevated glucose alert", message: `Elevated glucose: ${g} mg/dL` };
    return { level: "ok", title: "Glucose logged", message: `Glucose logged: ${g} mg/dL` };
  }

  if (log.log_type === "bp" && log.bp_systolic != null && log.bp_diastolic != null) {
    const s = Number(log.bp_systolic);
    const d = Number(log.bp_diastolic);
    if (!Number.isFinite(s) || !Number.isFinite(d)) return null;
    if (s >= 180 || d >= 120) return { level: "critical", title: "Critical BP alert", message: `Very high BP: ${s}/${d} mmHg` };
    if (s >= 140 || d >= 90) return { level: "alert", title: "High BP alert", message: `High BP: ${s}/${d} mmHg` };
    if (s <= 90 || d <= 60) return { level: "alert", title: "Low BP alert", message: `Low BP: ${s}/${d} mmHg` };
    return { level: "ok", title: "BP logged", message: `BP logged: ${s}/${d} mmHg` };
  }

  return null;
}

async function ensureLocalAlertPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    let perm = await LocalNotifications.checkPermissions();
    if (perm.display === "prompt" || perm.display === "prompt-with-rationale") {
      perm = await LocalNotifications.requestPermissions();
    }
    return perm.display === "granted";
  } catch (err) {
    console.warn("local alert permission failed", err);
    return false;
  }
}

async function ensureAndroidAlertChannel() {
  if (Capacitor.getPlatform() !== "android" || localChannelReady) return;
  localChannelReady = true;
  try {
    await LocalNotifications.createChannel({
      id: "health-alerts",
      name: "Health alerts",
      description: "Urgent BBDO health alerts",
      importance: 5,
      visibility: 1,
      sound: "default",
      vibration: true,
    });
  } catch (err) {
    console.warn("local alert channel failed", err);
  }
}

export async function sendLocalHealthAlert(title: string, body: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const granted = await ensureLocalAlertPermission();
  if (!granted) return false;
  await ensureAndroidAlertChannel();
  try {
    await LocalNotifications.schedule({
      notifications: [
        {
          id: Math.floor(Date.now() % 2_147_000_000),
          title,
          body,
          schedule: { at: new Date(Date.now() + 350) },
          sound: "default",
          channelId: "health-alerts",
          interruptionLevel: "active",
          relevanceScore: 1,
          autoCancel: true,
          extra: { kind: "health_alert" },
        },
      ],
    });
    return true;
  } catch (err) {
    console.warn("local health alert failed", err);
    return false;
  }
}

export async function fireHealthMetricFeedback(
  log: Partial<HealthAlertLog>,
  prevWeight?: number | null,
  opts: { createInboxNotification?: boolean } = {},
) {
  try {
    const result = evaluateHealthAlert(log, prevWeight);
    if (!result) return;

    const settings = await getNotificationSoundSettings().catch(() => ({
      enabled: true,
      variant: "bbdo_signature" as const,
      volume: 1,
    }));
    const isAlert = result.level === "alert" || result.level === "critical";

    if (isAlert) {
      // Health alerts should be loud enough to test confidently.
      const previousVolume = getMasterVolume();
      setMasterVolume(Math.max(settings.volume ?? 0.8, result.level === "critical" ? 1 : 0.9));
      playCriticalHealthAlert();
      setTimeout(() => playNotificationSound(settings.variant), 520);
      setTimeout(() => setMasterVolume(previousVolume), 1_800);
      void sendLocalHealthAlert(result.title, result.message);

      if (opts.createInboxNotification !== false && log.user_id) {
        void createNotification({
          user_id: log.user_id,
          title: result.title,
          body: result.message,
          type: "health_alert",
          icon: result.level === "critical" ? "🚨" : "⚠️",
          action_url: "/home?tab=profile",
        }).catch((err) => console.warn("health alert notification failed", err));
      }

      const notify = result.level === "critical" ? toast.error : toast.warning;
      notify(result.message);
    } else if (settings.enabled) {
      setMasterVolume(settings.volume ?? 0.8);
      playSuccess();
    }
  } catch (err) {
    console.warn("health metric feedback failed", err);
  }
}

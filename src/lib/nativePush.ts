/**
 * Native push registration for iOS (APNs) and Android (FCM).
 *
 * Web/PWA push is handled elsewhere via the Web Push subscription flow — this
 * module only runs on Capacitor native. It requests permission, registers
 * with the OS push service, and upserts the device token into
 * `device_push_tokens` so a server-side sender can target it later.
 *
 * The server-side APNs sender reads this token from `device_push_tokens`.
 */
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const APP_VERSION = (globalThis as any).__APP_VERSION__ ?? "1.0.0";
export const BBDO_PUSH_CHANNEL_ID = "bbdo-push-v2";
export const BBDO_PUSH_SOUND = "bbdo_chime.wav";

let registered = false;
let activeUserId: string | null = null;
let lastRegistrationToken: string | null = null;
let tokenWaiters: Array<(token: string) => void> = [];

export function isNativePushSupported(): boolean {
  // Both iOS (APNs) and Android (FCM via google-services.json) are wired up.
  return Capacitor.isNativePlatform();
}

export function currentPlatform(): "ios" | "android" | "web" {
  const p = Capacitor.getPlatform();
  if (p === "ios") return "ios";
  if (p === "android") return "android";
  return "web";
}

async function upsertToken(userId: string, token: string) {
  const platform = currentPlatform();
  const { error } = await (supabase as any)
    .from("device_push_tokens")
    .upsert(
      {
        user_id: userId,
        token,
        platform,
        app_version: APP_VERSION,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,token" },
    );
  if (error) throw error;
}

async function fetchStoredToken(userId: string): Promise<string | null> {
  const { data, error } = await (supabase as any)
    .from("device_push_tokens")
    .select("token")
    .eq("user_id", userId)
    .eq("platform", currentPlatform())
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[push] failed to read stored token", error);
    return null;
  }
  return (data as any)?.token ?? null;
}

function waitForToken(timeoutMs = 8_000): Promise<string | null> {
  if (lastRegistrationToken) return Promise.resolve(lastRegistrationToken);

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      tokenWaiters = tokenWaiters.filter((waiter) => waiter !== done);
      resolve(null);
    }, timeoutMs);

    const done = (token: string) => {
      window.clearTimeout(timer);
      resolve(token);
    };

    tokenWaiters.push(done);
  });
}

function resolveTokenWaiters(token: string) {
  const waiters = tokenWaiters;
  tokenWaiters = [];
  waiters.forEach((resolve) => resolve(token));
}

/**
 * Call once after the user is signed in. Safe to call again — listeners are
 * only attached the first time; permission is re-checked without prompting
 * if already granted.
 */
export async function registerNativePush(userId: string): Promise<
  { ok: true; token?: string } | { ok: false; reason: string }
> {
  if (!isNativePushSupported()) {
    return { ok: false, reason: "not_native" };
  }

  try {
    activeUserId = userId;
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") {
      return { ok: false, reason: "permission_denied" };
    }

    // Same iOS permission family, but request it explicitly so local health
    // alerts can show a banner + system beep immediately after an abnormal log.
    try {
      let localPerm = await LocalNotifications.checkPermissions();
      if (localPerm.display === "prompt" || localPerm.display === "prompt-with-rationale") {
        localPerm = await LocalNotifications.requestPermissions();
      }
    } catch (err) {
      console.warn("[push] local alert permission setup failed", err);
    }

    // Android channels are immutable after first creation. Use a fresh channel
    // id for the loud BBDO chime so previously-created silent channels do not
    // keep muting lock-screen pushes after an app update.
    if (currentPlatform() === "android") {
      try {
        await LocalNotifications.createChannel({
          id: BBDO_PUSH_CHANNEL_ID,
          name: "BBDO notifications",
          description: "Reminders, coach messages, and health nudges",
          importance: 5,
          visibility: 1,
          sound: BBDO_PUSH_SOUND,
          vibration: true,
          lights: true,
        });
      } catch (err) {
        console.warn("[push] android channel setup failed", err);
      }
    }

    if (!registered) {
      registered = true;

      PushNotifications.addListener("registration", async (t) => {
        try {
          lastRegistrationToken = t.value;
          resolveTokenWaiters(t.value);
          const uid = activeUserId;
          if (!uid) throw new Error("No active user for push token");
          await upsertToken(uid, t.value);
          // eslint-disable-next-line no-console
          console.log("[push] token registered:", t.value.slice(0, 12) + "…");
        } catch (err) {
          console.warn("[push] failed to store token", err);
        }
      });

      PushNotifications.addListener("registrationError", (err) => {
        console.warn("[push] registration error", err);
      });

      PushNotifications.addListener(
        "pushNotificationReceived",
        (n) => console.log("[push] received in-app:", n),
      );

      PushNotifications.addListener(
        "pushNotificationActionPerformed",
        (a) => console.log("[push] tapped:", a),
      );
    }

    await PushNotifications.register();
    const token = (await waitForToken()) ?? (await fetchStoredToken(userId));
    return { ok: true, token: token ?? undefined };
  } catch (err: any) {
    console.warn("[push] setup failed", err);
    return { ok: false, reason: err?.message ?? "setup_failed" };
  }
}

/** UI wrapper: registers and toasts the outcome. */
export async function registerNativePushWithToast(userId: string) {
  if (!isNativePushSupported()) {
    toast.info("Push notifications require the native mobile app.");
    return;
  }
  const res = await registerNativePush(userId);
  if (res.ok === true) {
    if (res.token) {
      toast.success("Push notifications enabled for this phone");
    } else {
      toast.warning("Permission is on, but the phone token has not arrived yet. Try again in a few seconds.");
    }
    return;
  }
  if (res.reason === "permission_denied") {
    toast.error("Permission denied — enable notifications in phone settings.");
    return;
  }
  toast.error(`Push setup failed: ${res.reason}`);
}

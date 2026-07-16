/**
 * Native push registration for iOS (APNs) and Android (FCM).
 *
 * Web/PWA push is handled elsewhere via the Web Push subscription flow — this
 * module only runs on Capacitor native. It requests permission, registers
 * with the OS push service, and upserts the device token into
 * `device_push_tokens` so a server-side sender can target it later.
 *
 * The server side (an APNs edge function) is intentionally not wired here —
 * the client just deposits the token. Add the sender once your APNs auth
 * key + Team ID are in place.
 */
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const APP_VERSION = (globalThis as any).__APP_VERSION__ ?? "1.0.0";

let registered = false;

export function isNativePushSupported(): boolean {
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
  await (supabase as any)
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
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") {
      return { ok: false, reason: "permission_denied" };
    }

    if (!registered) {
      registered = true;

      PushNotifications.addListener("registration", async (t) => {
        try {
          await upsertToken(userId, t.value);
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
    return { ok: true };
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
  if (res.ok) toast.success("Push notifications enabled");
  else if (res.reason === "permission_denied")
    toast.error("Permission denied — enable notifications in iOS Settings.");
  else toast.error(`Push setup failed: ${res.reason}`);
}

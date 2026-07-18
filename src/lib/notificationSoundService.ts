import { supabase } from "@/integrations/supabase/client";
import type { BbdoNotificationSound } from "@/lib/soundEngine";

/**
 * Notification sound preferences live in `app_settings` under a single JSON key
 * so admins can retune them without redeploying. Regular users read this row
 * (RLS allows authenticated SELECT); only admins write it.
 */
export const NOTIFICATION_SOUND_KEY = "notification_sound";

export interface NotificationSoundSettings {
  enabled: boolean;
  variant: BbdoNotificationSound;
  volume: number; // 0..1
}

export const DEFAULT_SOUND_SETTINGS: NotificationSoundSettings = {
  enabled: true,
  variant: "hummingbird",
  volume: 1,
};

let cached: NotificationSoundSettings | null = null;
let inflight: Promise<NotificationSoundSettings> | null = null;

function coerce(v: any): NotificationSoundSettings {
  const s = v && typeof v === "object" ? v : {};
  const vol = typeof s.volume === "number" ? s.volume : parseFloat(s.volume);
  return {
    enabled: typeof s.enabled === "boolean" ? s.enabled : DEFAULT_SOUND_SETTINGS.enabled,
    variant: (s.variant as BbdoNotificationSound) || DEFAULT_SOUND_SETTINGS.variant,
    volume: Number.isFinite(vol) ? Math.max(0, Math.min(1, vol)) : DEFAULT_SOUND_SETTINGS.volume,
  };
}

export async function getNotificationSoundSettings(): Promise<NotificationSoundSettings> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data } = await (supabase as any)
        .from("app_settings")
        .select("value")
        .eq("key", NOTIFICATION_SOUND_KEY)
        .maybeSingle();
      const settings = coerce(data?.value);
      cached = settings;
      return settings;
    } catch {
      cached = DEFAULT_SOUND_SETTINGS;
      return DEFAULT_SOUND_SETTINGS;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Admin-only. Persists the row and invalidates the in-memory cache. */
export async function saveNotificationSoundSettings(next: NotificationSoundSettings): Promise<void> {
  const clean = coerce(next);
  const { error } = await (supabase as any)
    .from("app_settings")
    .upsert(
      { key: NOTIFICATION_SOUND_KEY, value: clean as any },
      { onConflict: "key" },
    );
  if (error) throw error;
  cached = clean;
}

export function invalidateNotificationSoundCache() {
  cached = null;
}

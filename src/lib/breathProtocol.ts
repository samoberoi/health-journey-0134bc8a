// BBDO Daily Breath Protocol — 76-second 4-7-8 breathing ritual.
// Users complete 4 rounds per day; each tap of "Complete this round"
// records one row in user_breath_sessions.

import { supabase } from "@/integrations/supabase/client";

export const BREATH_DAILY_GOAL = 4;

// Reuses the existing admin-uploaded "The 4-7-8 Breathing Protocol" custom video.
// Can still be overridden via app_settings("bbdo_breath_protocol_youtube_id").
export const BREATH_DEFAULT_YOUTUBE_ID = "Pn8Qc0Lej7o";

export const BREATH_PROTOCOL_VIDEO = {
  id: "custom-0758e7e6",
  name: "The 4-7-8 Breathing Protocol",
  description: "BBDO 76 seconds daily breath protocol — the 4-7-8 breathing method. Complete 4 rounds every day to close the loop.",
  category: "BBDO Ritual · Pranayama",
  youtubeId: BREATH_DEFAULT_YOUTUBE_ID,
  durationSec: 76,
};

function startOfLocalDayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function fetchBreathSessionsToday(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("user_breath_sessions")
    .select("id", { head: true, count: "exact" })
    .eq("user_id", userId)
    .gte("session_at", startOfLocalDayISO());
  if (error) {
    console.warn("[breath] fetch failed", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function recordBreathSession(userId: string, source: "manual" | "video" = "manual"): Promise<boolean> {
  const { error } = await supabase
    .from("user_breath_sessions")
    .insert({ user_id: userId, source });
  if (error) {
    console.warn("[breath] insert failed", error.message);
    return false;
  }
  window.dispatchEvent(new CustomEvent("breath-session-saved"));
  return true;
}

export async function getBreathYoutubeId(): Promise<string> {
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "bbdo_breath_protocol_youtube_id")
      .maybeSingle();
    const v = (data as any)?.value;
    if (typeof v === "string" && v.length >= 6) return v;
    if (v && typeof v === "object" && typeof v.id === "string") return v.id;
  } catch {}
  return BREATH_DEFAULT_YOUTUBE_ID;
}

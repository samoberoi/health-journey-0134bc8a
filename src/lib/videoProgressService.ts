// Sync local video watch state with backend so it persists across logins/devices.
import { supabase } from "@/integrations/supabase/client";
import { getVideoProgressTodayKey, saveWatched, type WatchRecord } from "@/lib/videoProgressStore";

type Row = {
  video_id: string;
  youtube_id: string | null;
  progress_sec: number;
  duration_sec: number;
  completed: boolean;
  watched_at: string;
};

function todayStartMs() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return todayStart.getTime();
}

function isWatchedToday(watchedAt?: string | null) {
  if (!watchedAt) return false;
  return new Date(watchedAt).getTime() >= todayStartMs();
}

function todayProgressFromRecord(rec: WatchRecord) {
  if (rec.sessionDate === getVideoProgressTodayKey() && typeof rec.todayWatchedSec === "number" && rec.todayWatchedSec > 0) {
    return Math.round(rec.todayWatchedSec);
  }
  return Math.round(rec.progressSec || 0);
}

export async function fetchVideoProgress(userId: string): Promise<Record<string, WatchRecord>> {
  const { data, error } = await supabase
    .from("video_progress")
    .select("video_id,youtube_id,progress_sec,duration_sec,completed,watched_at")
    .eq("user_id", userId);
  if (error) {
    console.error("[videoProgress] fetch failed", error);
    return {};
  }
  const map: Record<string, WatchRecord> = {};
  const today = getVideoProgressTodayKey();
  for (const r of (data || []) as Row[]) {
    const watchedAt = new Date(r.watched_at).getTime();
    const watchedToday = watchedAt >= todayStartMs();
    map[r.video_id] = {
      watchedAt,
      progressSec: r.progress_sec || 0,
      durationSec: r.duration_sec || 0,
      completed: !!r.completed,
      sessionDate: watchedToday ? today : undefined,
      todayWatchedSec: watchedToday ? (r.progress_sec || 0) : 0,
    };
  }
  return map;
}

export async function pullVideoProgress(userId: string) {
  // Remote is the source of truth on login. We intentionally do NOT merge
  // pre-existing localStorage records here — those may belong to a previous
  // user on the same device and would leak into a new account's
  // "Continue Watching".
  const remote = await fetchVideoProgress(userId);
  saveWatched(remote);
}

export async function upsertVideoProgress(
  userId: string,
  videoId: string,
  rec: WatchRecord,
  youtubeId?: string,
) {
  const incomingTodayProgressSec = todayProgressFromRecord(rec);
  const { data: current } = await supabase
    .from("video_progress")
    .select("progress_sec, duration_sec, completed, watched_at")
    .eq("user_id", userId)
    .eq("video_id", videoId)
    .maybeSingle();
  const currentProgressSec = isWatchedToday((current as any)?.watched_at)
    ? Math.max(0, Number((current as any)?.progress_sec) || 0)
    : 0;
  const todayProgressSec = Math.max(currentProgressSec, incomingTodayProgressSec);
  const { error } = await supabase.from("video_progress").upsert(
    {
      user_id: userId,
      video_id: videoId,
      youtube_id: youtubeId ?? null,
      progress_sec: todayProgressSec,
      duration_sec: Math.max(Math.round(rec.durationSec || 0), Math.round(Number((current as any)?.duration_sec) || 0)),
      completed: !!rec.completed || !!(current as any)?.completed,
      watched_at: new Date(rec.watchedAt || Date.now()).toISOString(),
    },
    { onConflict: "user_id,video_id" },
  );
  if (error) console.error("[videoProgress] upsert failed", error);
}

export async function deleteVideoProgress(userId: string, videoId: string) {
  const { error } = await supabase
    .from("video_progress")
    .delete()
    .eq("user_id", userId)
    .eq("video_id", videoId);
  if (error) console.error("[videoProgress] delete failed", error);
}

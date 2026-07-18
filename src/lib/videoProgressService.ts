// Sync local video watch state with backend so it persists across logins/devices.
import { supabase } from "@/integrations/supabase/client";
import { loadWatched, saveWatched, type WatchRecord } from "@/lib/videoProgressStore";

type Row = {
  video_id: string;
  youtube_id: string | null;
  progress_sec: number;
  duration_sec: number;
  completed: boolean;
  watched_at: string;
};

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
  for (const r of (data || []) as Row[]) {
    map[r.video_id] = {
      watchedAt: new Date(r.watched_at).getTime(),
      progressSec: r.progress_sec || 0,
      durationSec: r.duration_sec || 0,
      completed: !!r.completed,
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
  const { error } = await supabase.from("video_progress").upsert(
    {
      user_id: userId,
      video_id: videoId,
      youtube_id: youtubeId ?? null,
      progress_sec: Math.round(rec.progressSec || 0),
      duration_sec: Math.round(rec.durationSec || 0),
      completed: !!rec.completed,
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

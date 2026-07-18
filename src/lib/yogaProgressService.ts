import { supabase } from "@/integrations/supabase/client";
import { videos } from "@/lib/exerciseData";

/** Video IDs that count as "yoga & stress" (Pranayama, Yoga Asana, Bandha). */
function yogaVideoIds(): Set<string> {
  return new Set(
    videos
      .filter((v) => v.group === "Pranayama" || v.group === "Yoga Asana" || v.group === "Bandha")
      .map((v) => v.id),
  );
}

function watchedSeconds(row: { progress_sec?: number | null; duration_sec?: number | null }) {
  const progress = Math.max(0, Number(row.progress_sec) || 0);
  const duration = Math.max(0, Number(row.duration_sec) || 0);
  return duration > 0 ? Math.min(progress, duration) : progress;
}

function secondsToMinutes(seconds: number): number {
  if (seconds <= 0) return 0;
  return Math.round((seconds / 60) * 10) / 10;
}

/**
 * Sum today's watched minutes across yoga-group videos. Uses video_progress.watched_at
 * as the "today" marker; each replay upserts watched_at → naturally resets daily.
 */
export async function getTodayYogaMinutes(userId: string): Promise<number> {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const { data, error } = await (supabase as any)
    .from("video_progress")
    .select("video_id, progress_sec, duration_sec, watched_at")
    .eq("user_id", userId)
    .gte("watched_at", start.toISOString());
  if (error || !data) return 0;
  const ids = yogaVideoIds();
  let totalSec = 0;
  for (const row of data as any[]) {
    if (!ids.has(row.video_id)) continue;
    totalSec += watchedSeconds(row);
  }
  return secondsToMinutes(totalSec);
}

/**
 * Sum today's watched minutes across exercise videos (video_id LIKE 'exercise:%').
 * Mirrors getTodayYogaMinutes so the Home exercise ring reflects watch time.
 */
export async function getTodayExerciseMinutes(userId: string): Promise<number> {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const [{ data: progressRows, error }, { data: logRows }] = await Promise.all([
    (supabase as any)
      .from("video_progress")
      .select("video_id, progress_sec, duration_sec, watched_at")
      .eq("user_id", userId)
      .like("video_id", "exercise:%")
      .gte("watched_at", start.toISOString()),
    (supabase as any)
      .from("user_exercise_logs")
      .select("exercise_id, sets_done, logged_at")
      .eq("user_id", userId)
      .gte("logged_at", start.toISOString()),
  ]);
  if (error || !progressRows) return 0;

  const secondsByExercise = new Map<string, number>();
  const durationByExercise = new Map<string, number>();
  for (const row of progressRows as any[]) {
    const exerciseId = String(row.video_id ?? "").replace(/^exercise:/, "");
    if (!exerciseId) continue;
    // Exercise progress_sec is stored as today's accumulated watched seconds,
    // so repeated watches / sets continue adding toward the daily minute goal.
    const progressSec = Math.max(0, Number(row.progress_sec) || 0);
    const durationSec = Math.max(0, Number(row.duration_sec) || 0);
    secondsByExercise.set(exerciseId, Math.max(secondsByExercise.get(exerciseId) ?? 0, progressSec));
    if (durationSec > 0) durationByExercise.set(exerciseId, durationSec);
  }

  // Fallback for sessions saved before accumulated seconds were added: a logged
  // set means the user reached the end of that exercise video once.
  for (const row of (logRows as any[]) ?? []) {
    const exerciseId = String(row.exercise_id ?? "");
    const durationSec = durationByExercise.get(exerciseId) ?? 0;
    if (!exerciseId || durationSec <= 0) continue;
    const setsDone = Math.max(1, Number(row.sets_done) || 1);
    const loggedSec = durationSec * setsDone;
    secondsByExercise.set(exerciseId, Math.max(secondsByExercise.get(exerciseId) ?? 0, loggedSec));
  }

  return secondsToMinutes([...secondsByExercise.values()].reduce((sum, sec) => sum + sec, 0));
}

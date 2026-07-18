// Local-first store for video watch state + cached YouTube durations.
// Lives in localStorage so it works without any backend round-trips.

const WATCHED_KEY = "bbdo:video-progress:v1";
const DURATIONS_KEY = "bbdo:yt-durations:v1";

export type WatchRecord = {
  watchedAt: number;         // ms epoch — last time the video was opened
  progressSec: number;       // last known playback position (for resume)
  durationSec: number;       // duration at time of recording (0 if unknown)
  completed: boolean;        // reached ≥90% on any single pass
  totalWatchedSec?: number;  // lifetime accumulated real playback time (replays add up)
  sessionDate?: string;      // YYYY-MM-DD of the current watching day (for daily accrual reset)
  todayWatchedSec?: number;  // accumulated real playback time today (resets each day)
};

type WatchMap = Record<string, WatchRecord>;
type DurationMap = Record<string, number>;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function loadWatched(): WatchMap {
  if (typeof window === "undefined") return {};
  return safeParse<WatchMap>(localStorage.getItem(WATCHED_KEY), {});
}

export function saveWatched(map: WatchMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(WATCHED_KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent("bbdo:video-progress-changed"));
}

function emitChange(videoId: string, record: WatchRecord | null, youtubeId?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("bbdo:video-progress-updated", {
      detail: { videoId, record, youtubeId },
    }),
  );
}

/** Update the resume position only. Does NOT change lifetime/today accumulators. */
export function recordProgress(videoId: string, progressSec: number, durationSec: number, youtubeId?: string) {
  const map = loadWatched();
  const prev = map[videoId];
  const completed = durationSec > 0 && progressSec / durationSec >= 0.9;
  const next: WatchRecord = {
    ...prev,
    watchedAt: Date.now(),
    progressSec: Math.max(prev?.progressSec ?? 0, progressSec),
    durationSec: durationSec || prev?.durationSec || 0,
    completed: completed || !!prev?.completed,
  };
  map[videoId] = next;
  saveWatched(map);
  emitChange(videoId, next, youtubeId);
}

/** Add a small increment of real playback time. Replays keep adding up. */
export function accumulateWatched(videoId: string, deltaSec: number, durationSec: number, youtubeId?: string) {
  if (!deltaSec || deltaSec <= 0) return;
  const map = loadWatched();
  const prev = map[videoId];
  const day = todayKey();
  const sameDay = prev?.sessionDate === day;
  const next: WatchRecord = {
    watchedAt: Date.now(),
    progressSec: prev?.progressSec ?? 0,
    durationSec: durationSec || prev?.durationSec || 0,
    completed: !!prev?.completed,
    totalWatchedSec: (prev?.totalWatchedSec ?? 0) + deltaSec,
    sessionDate: day,
    todayWatchedSec: (sameDay ? (prev?.todayWatchedSec ?? 0) : 0) + deltaSec,
  };
  map[videoId] = next;
  saveWatched(map);
  emitChange(videoId, next, youtubeId);
}

export function markCompleted(videoId: string, durationSec: number, youtubeId?: string) {
  const map = loadWatched();
  const prev = map[videoId];
  const next: WatchRecord = {
    ...prev,
    watchedAt: Date.now(),
    progressSec: durationSec,
    durationSec,
    completed: true,
  };
  map[videoId] = next;
  saveWatched(map);
  emitChange(videoId, next, youtubeId);
}

export function resetProgress(videoId: string) {
  const map = loadWatched();
  if (map[videoId]) {
    delete map[videoId];
    saveWatched(map);
    emitChange(videoId, null);
  }
}

// --- YouTube duration cache (shared across videos with same youtubeId) ---

export function loadDurations(): DurationMap {
  if (typeof window === "undefined") return {};
  return safeParse<DurationMap>(localStorage.getItem(DURATIONS_KEY), {});
}

export function saveDuration(youtubeId: string, seconds: number) {
  if (!youtubeId || !seconds || seconds <= 0) return;
  const map = loadDurations();
  if (map[youtubeId] === seconds) return;
  map[youtubeId] = seconds;
  localStorage.setItem(DURATIONS_KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent("bbdo:yt-durations-changed"));
}

export function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0 || !isFinite(seconds)) return "";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

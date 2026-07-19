import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  pullVideoProgress,
  upsertVideoProgress,
  deleteVideoProgress,
} from "@/lib/videoProgressService";
import { saveWatched, type WatchRecord } from "@/lib/videoProgressStore";

/**
 * On login: pull backend video progress and merge into localStorage.
 * On any local change: push that record to the backend (debounced per video).
 */
export function useVideoProgressSync() {
  const { user } = useAuth();
  const pulledFor = useRef<string | null>(null);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Pull once per signed-in user. On user change (incl. sign-out), wipe local
  // store first so one user never inherits another user's watched videos.
  useEffect(() => {
    if (!user) {
      pulledFor.current = null;
      saveWatched({}); // clear on sign out
      return;
    }
    if (pulledFor.current === user.id) return;
    // New / different user: clear stale local progress before pulling theirs.
    saveWatched({});
    pulledFor.current = user.id;
    pullVideoProgress(user.id).catch(console.error);
  }, [user]);

  // Push local updates
  useEffect(() => {
    if (!user) return;
    const uid = user.id;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        videoId: string;
        record: WatchRecord | null;
        youtubeId?: string;
        flush?: boolean;
      } | undefined;
      if (!detail?.videoId) return;
      const { videoId, record, youtubeId, flush } = detail;

      // Debounce per video to avoid flooding during playback polling
      const existing = timers.current.get(videoId);
      if (existing) clearTimeout(existing);
      const persist = () => {
        timers.current.delete(videoId);
        if (record) {
          upsertVideoProgress(uid, videoId, record, youtubeId).catch(console.error);
        } else {
          deleteVideoProgress(uid, videoId).catch(console.error);
        }
      };
      if (flush) {
        persist();
        return;
      }
      const t = setTimeout(() => {
        persist();
      }, 1200);
      timers.current.set(videoId, t);
    };

    window.addEventListener("bbdo:video-progress-updated", handler);
    return () => {
      window.removeEventListener("bbdo:video-progress-updated", handler);
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
    };
  }, [user]);
}

import { useEffect } from "react";
import { loadDurations, saveDuration } from "@/lib/videoProgressStore";
import { isNativeMobileApp } from "@/lib/youtubeEmbed";

// Loads the YouTube IFrame API once.
let ytReadyPromise: Promise<any> | null = null;
function loadYTAPI(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const w = window as any;
  if (w.YT && w.YT.Player) return Promise.resolve(w.YT);
  if (ytReadyPromise) return ytReadyPromise;
  ytReadyPromise = new Promise((resolve) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      try { prev?.(); } catch {}
      resolve((window as any).YT);
    };
    if (!document.querySelector('script[data-yt-api]')) {
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      s.dataset.ytApi = "1";
      document.head.appendChild(s);
    }
  });
  return ytReadyPromise;
}

/**
 * Prefetches durations for a list of YouTube IDs using a single hidden player.
 * Cached values in localStorage are skipped. Runs sequentially with a small
 * delay to keep the page responsive.
 */
export function useYouTubeDurationPrefetch(youtubeIds: string[], enabled = true) {
  useEffect(() => {
    if (!enabled || !youtubeIds.length || typeof window === "undefined") return;
    if (isNativeMobileApp()) return;
    let cancelled = false;
    let host: HTMLDivElement | null = null;
    let player: any = null;

    (async () => {
      const cached = loadDurations();
      const queue = Array.from(new Set(youtubeIds.filter((id) => id && !cached[id])));
      if (!queue.length) return;

      try {
        const YT = await loadYTAPI();
        if (cancelled) return;

        host = document.createElement("div");
        host.style.cssText =
          "position:fixed;right:0;bottom:0;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;transform:scale(0);transform-origin:bottom right;";
        const inner = document.createElement("div");
        host.appendChild(inner);
        document.body.appendChild(host);

        await new Promise<void>((resolveReady) => {
          player = new YT.Player(inner, {
            width: 1,
            height: 1,
            host: "https://www.youtube-nocookie.com",
            playerVars: {
              autoplay: 0,
              controls: 0,
              mute: 1,
              playsinline: 1,
              enablejsapi: 1,
              origin: window.location.origin,
              widget_referrer: window.location.origin,
            },
            events: { onReady: () => resolveReady() },
          });
        });
        if (cancelled) return;

        for (const id of queue) {
          if (cancelled) break;
          // eslint-disable-next-line no-await-in-loop
          await new Promise<void>((resolveOne) => {
            const timeout = setTimeout(() => resolveOne(), 3500);
            const handler = () => {
              const dur = Number(player?.getDuration?.() || 0);
              if (dur > 0) {
                saveDuration(id, dur);
                clearTimeout(timeout);
                resolveOne();
              }
            };
            // Poll briefly: cueing fires state change but duration sometimes
            // becomes available only after a moment.
            try { player.cueVideoById(id); } catch { resolveOne(); return; }
            const start = Date.now();
            const poll = setInterval(() => {
              const dur = Number(player?.getDuration?.() || 0);
              if (dur > 0) {
                saveDuration(id, dur);
                clearInterval(poll);
                clearTimeout(timeout);
                resolveOne();
              } else if (Date.now() - start > 3000) {
                clearInterval(poll);
              }
            }, 250);
            void handler;
          });
        }
      } catch {
        // Silent fail — durations just won't show.
      }
    })();

    return () => {
      cancelled = true;
      try { player?.destroy?.(); } catch {}
      if (host && host.parentNode) host.parentNode.removeChild(host);
    };
  }, [enabled, youtubeIds.join("|")]);
}

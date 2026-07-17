import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  X, Check, Ban, Sparkles, ShieldAlert, ExternalLink, RotateCcw,
  Activity, Brain, CircleDot, Dumbbell, Flower2, Lock, Moon, Move3D, Sun, Target, Triangle, Wind,
  type LucideIcon,
} from "lucide-react";
import { VideoEntry } from "@/lib/exerciseData";
import {
  recordProgress,
  markCompleted,
  saveDuration,
  loadWatched,
  formatDuration,
  resetProgress,
  accumulateWatched,
} from "@/lib/videoProgressStore";

const VIDEO_ICON_MAP: Record<string, LucideIcon> = {
  Activity,
  Brain,
  CircleDot,
  Dumbbell,
  Flower2,
  Lock,
  Moon,
  Move3D,
  Sparkles,
  Sun,
  Target,
  Triangle,
  Wind,
};

function VideoFlatIcon({ name, className = "w-5 h-5" }: { name?: string | null; className?: string }) {
  const Icon = VIDEO_ICON_MAP[name || ""] ?? Sparkles;
  return <Icon className={className} strokeWidth={1.75} />;
}

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

export default function VideoPlayer({ video, onClose }: { video: VideoEntry; onClose: () => void }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const pollRef = useRef<number | null>(null);
  const watchedSecRef = useRef<number>(0);
  const lastTickRef = useRef<number | null>(null);
  const lastPosRef = useRef<number>(0);
  const [resumeFrom, setResumeFrom] = useState<number>(0);
  const [restarted, setRestarted] = useState(false);

  // Read prior progress once on open — seed accumulator so resumes don't lose credit
  useEffect(() => {
    const prior = loadWatched()[video.id];
    if (prior && !prior.completed && prior.progressSec > 10 && prior.durationSec > 0
        && prior.progressSec < prior.durationSec - 15) {
      setResumeFrom(prior.progressSec);
      watchedSecRef.current = prior.progressSec;
    } else {
      watchedSecRef.current = 0;
    }
  }, [video.id]);

  // Boot YT player
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const YT = await loadYTAPI();
      if (cancelled || !hostRef.current) return;
      // Capacitor apps run under `capacitor://localhost` (iOS) / `https://localhost` (Android).
      // YouTube's IFrame API rejects those origins and throws Error 153 unless we point at the
      // privacy-enhanced host and pass an https origin it accepts.
      const isNative =
        typeof window !== "undefined" &&
        /^(capacitor|ionic):/i.test(window.location.protocol);
      const embedOrigin = isNative ? "https://localhost" : window.location.origin;
      playerRef.current = new YT.Player(hostRef.current, {
        videoId: video.youtubeId,
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          autoplay: 1,
          enablejsapi: 1,
          origin: embedOrigin,
          widget_referrer: embedOrigin,
          start: restarted ? 0 : Math.floor(resumeFrom || 0),
        },
        events: {
          onReady: (e: any) => {
            const d = Number(e.target.getDuration?.() || 0);
            if (d > 0) saveDuration(video.youtubeId, d);
            lastPosRef.current = Number(e.target.getCurrentTime?.() || 0);
          },
          onStateChange: (e: any) => {
            // 1 = playing, everything else stops the tick clock so seeking / pausing don't accrue time
            if (e.data === 1) {
              lastTickRef.current = Date.now();
              lastPosRef.current = Number(playerRef.current?.getCurrentTime?.() || 0);
              if (pollRef.current == null) {
                pollRef.current = window.setInterval(() => {
                  const p = playerRef.current;
                  if (!p?.getCurrentTime) return;
                  const now = Date.now();
                  const t = Number(p.getCurrentTime() || 0);
                  const d = Number(p.getDuration?.() || 0);
                  if (d > 0) saveDuration(video.youtubeId, d);

                  // Only credit if playback advanced roughly in real time (no seek-ahead)
                  const wall = lastTickRef.current ? (now - lastTickRef.current) / 1000 : 0;
                  const posDelta = t - lastPosRef.current;
                  let creditedDelta = 0;
                  if (wall > 0 && posDelta > 0 && posDelta <= wall + 1.5) {
                    creditedDelta = posDelta;
                    watchedSecRef.current = watchedSecRef.current + posDelta;
                  }
                  lastTickRef.current = now;
                  lastPosRef.current = t;

                  // Persist resume position + accumulate lifetime/today real watch time
                  if (t > 1) recordProgress(video.id, t, d, video.youtubeId);
                  if (creditedDelta > 0) accumulateWatched(video.id, creditedDelta, d, video.youtubeId);
                  if (d > 0 && watchedSecRef.current / d >= 0.9) {
                    markCompleted(video.id, d, video.youtubeId);
                  }
                }, 2000);
              }
            } else {
              lastTickRef.current = null;
              if (e.data === 0) {
                // Ended: only credit completion if the user actually watched ≥90%
                const d = Number(playerRef.current?.getDuration?.() || 0);
                if (d > 0 && watchedSecRef.current / d >= 0.9) {
                  markCompleted(video.id, d, video.youtubeId);
                }
              }
            }
          },
        },
      });
    })();
    return () => {
      cancelled = true;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      try {
        const p = playerRef.current;
        const d = Number(p?.getDuration?.() || 0);
        const t = Number(p?.getCurrentTime?.() || 0);
        if (t > 1) recordProgress(video.id, t, d, video.youtubeId);
        p?.destroy?.();
      } catch {}
      playerRef.current = null;
      lastTickRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id, video.youtubeId, restarted]);

  const handleRestart = () => {
    resetProgress(video.id);
    setResumeFrom(0);
    setRestarted((v) => !v);
  };

  return (
    <motion.div
      className="fixed inset-0 z-[60] bg-background/95 overflow-y-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <div className="min-h-full flex items-start justify-center p-4 md:p-8">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          className="w-full max-w-3xl rounded-3xl overflow-hidden bg-card shadow-lift ring-1 ring-border"
        >
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-2xl shrink-0 text-white"
                style={{ background: "var(--bbdo-gradient)" }}>
                <VideoFlatIcon name={video.icon} className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h2 className="font-black text-foreground truncate">{video.name}</h2>
                <p className="text-xs text-muted-foreground truncate">{video.category}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleRestart}
                className="h-10 px-3 rounded-full bg-muted hover:bg-accent text-xs font-bold inline-flex items-center gap-1.5"
                title="Restart from beginning"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Restart
              </button>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-muted hover:bg-accent flex items-center justify-center shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {resumeFrom > 0 && !restarted && (
            <div className="mx-4 mb-3 px-3 py-2 rounded-xl bg-primary/5 text-xs text-primary font-semibold flex items-center justify-between">
              <span>Resuming from {formatDuration(resumeFrom)}</span>
              <button onClick={handleRestart} className="underline hover:no-underline">Start over</button>
            </div>
          )}

          <div className="relative w-full bg-black" style={{ aspectRatio: "16 / 9" }}>
            <div ref={hostRef} className="absolute inset-0 w-full h-full" />
          </div>

          <div className="p-5 space-y-4">
            <Section icon={<Sparkles className="w-4 h-4" />} title="Main Benefits" body={video.benefits} tone="primary" />
            <div className="grid md:grid-cols-2 gap-3">
              <Section icon={<Check className="w-4 h-4" />} title="Suitable For" body={video.suitableFor} tone="primary" />
              <Section icon={<ShieldAlert className="w-4 h-4" />} title="Not Suitable For" body={video.notSuitableFor} tone="destructive" />
              <Section icon={<Check className="w-4 h-4" />} title="Do’s" body={video.dos} tone="primary" />
              <Section icon={<Ban className="w-4 h-4" />} title="Don’ts" body={video.donts} tone="destructive" />
            </div>

            <a
              href={video.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs font-semibold text-primary hover:underline"
            >
              Open on YouTube <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function Section({
  icon, title, body, tone,
}: {
  icon: React.ReactNode; title: string; body: string; tone: "primary" | "destructive";
}) {
  const tones = {
    primary: "bg-primary/5 text-primary",
    destructive: "bg-destructive/5 text-destructive",
  } as const;
  return (
    <div className="rounded-2xl p-3 bg-muted/40">
      <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${tones[tone]}`}>
        {icon} {title}
      </div>
      <p className="mt-2 text-sm text-foreground leading-relaxed">{body}</p>
    </div>
  );
}

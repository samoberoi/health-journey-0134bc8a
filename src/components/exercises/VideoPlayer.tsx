import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  X, Check, Ban, Sparkles, ShieldAlert, RotateCcw,
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
import { isNativeIOSApp, isYoutubePlayerMessage, youtubePlayerProxyUrl } from "@/lib/youtubeEmbed";

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

export default function VideoPlayer({ video, onClose }: { video: VideoEntry; onClose: () => void }) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const watchedSecRef = useRef<number>(0);
  const lastTickRef = useRef<number | null>(null);
  const lastPosRef = useRef<number>(0);
  const currentTimeRef = useRef<number>(0);
  const durationRef = useRef<number>(0);
  const [resumeFrom, setResumeFrom] = useState<number>(0);
  const [restarted, setRestarted] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [useSimpleEmbed] = useState(() => isNativeIOSApp());

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

  const playerSrc = youtubePlayerProxyUrl(video.youtubeId, {
    autoplay: true,
    start: restarted ? 0 : resumeFrom,
    simple: useSimpleEmbed,
  });

  const handleProgressSnapshot = (currentTime?: number, duration?: number) => {
    const t = Number(currentTime || 0);
    const d = Number(duration || 0);
    const now = Date.now();

    currentTimeRef.current = t;
    durationRef.current = d;
    if (d > 0) saveDuration(video.youtubeId, d);

    const wall = lastTickRef.current ? (now - lastTickRef.current) / 1000 : 0;
    const posDelta = t - lastPosRef.current;
    let creditedDelta = 0;
    if (lastTickRef.current && wall > 0 && posDelta > 0 && posDelta <= wall + 1.5) {
      creditedDelta = posDelta;
      watchedSecRef.current = watchedSecRef.current + posDelta;
    }
    lastTickRef.current = now;
    lastPosRef.current = t;

    if (t > 1) recordProgress(video.id, t, d, video.youtubeId);
    if (creditedDelta > 0) accumulateWatched(video.id, creditedDelta, d, video.youtubeId);
    if (d > 0 && watchedSecRef.current / d >= 0.9) {
      markCompleted(video.id, d, video.youtubeId);
    }
  };

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (!isYoutubePlayerMessage(event.data, video.youtubeId)) return;

      if (event.data.type === "error") {
        setPlayerError(true);
        return;
      }

      if (event.data.type === "ready") {
        const d = Number(event.data.duration || 0);
        const t = Number(event.data.currentTime || 0);
        durationRef.current = d;
        currentTimeRef.current = t;
        if (d > 0) saveDuration(video.youtubeId, d);
        lastPosRef.current = t;
        return;
      }

      if (event.data.type === "state") {
        if (event.data.state === 1) {
          lastTickRef.current = Date.now();
          lastPosRef.current = Number(event.data.currentTime || 0);
        } else {
          lastTickRef.current = null;
          if (event.data.state === 0) {
            const d = Number(event.data.duration || durationRef.current || 0);
            if (d > 0 && watchedSecRef.current / d >= 0.9) markCompleted(video.id, d, video.youtubeId);
          }
        }
        return;
      }

      if (event.data.type === "progress") {
        handleProgressSnapshot(event.data.currentTime, event.data.duration);
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      const d = Number(durationRef.current || 0);
      const t = Number(currentTimeRef.current || 0);
      if (t > 1) recordProgress(video.id, t, d, video.youtubeId);
      lastTickRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [video.id, video.youtubeId, restarted]);

  const handleRestart = () => {
    resetProgress(video.id);
    setResumeFrom(0);
    setPlayerError(false);
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
            <iframe
              key={`${video.id}-${restarted}-${Math.floor(resumeFrom || 0)}-${useSimpleEmbed ? "simple" : "tracked"}`}
              ref={iframeRef}
              src={playerSrc}
              title={video.name}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="absolute inset-0 w-full h-full border-0"
            />
            {playerError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black p-5 text-center">
                <p className="text-sm font-bold text-white">This device blocked the in-app YouTube player. Please close and try again.</p>
                <button
                  onClick={handleRestart}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-black"
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          <div className="p-5 space-y-4">
            <Section icon={<Sparkles className="w-4 h-4" />} title="Main Benefits" body={video.benefits} tone="primary" />
            <div className="grid md:grid-cols-2 gap-3">
              <Section icon={<Check className="w-4 h-4" />} title="Suitable For" body={video.suitableFor} tone="primary" />
              <Section icon={<ShieldAlert className="w-4 h-4" />} title="Not Suitable For" body={video.notSuitableFor} tone="destructive" />
              <Section icon={<Check className="w-4 h-4" />} title="Do’s" body={video.dos} tone="primary" />
              <Section icon={<Ban className="w-4 h-4" />} title="Don’ts" body={video.donts} tone="destructive" />
            </div>
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

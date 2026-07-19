import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Play, Check, Lock, Sparkles, Flame, Target, Dumbbell, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  listExercises,
  listCategories,
  listBadges,
  extractYoutubeId,
  parseTargetSets,
  summarizeExerciseProgress,
  getCompletedExerciseIdsFromLogs,
  DAILY_EXERCISE_GOAL,
  tierForPackageKey,
  type Exercise,
  type ExerciseCategory,
  type ExerciseBadge,
  type ExerciseTier,
  PLAN_LABEL,
  TIER_COLOR,
  PLAN_FOR_TIER,
} from "@/lib/exerciseService";
import { useDailyExerciseGoal } from "@/hooks/useAppSettings";
import { EmptyState } from "@/components/shared";

import { getTodayExerciseMinutes } from "@/lib/yogaProgressService";
import NativeYouTubePlayer from "@/components/exercises/NativeYouTubePlayer";
import { isNativeAndroidApp, isNativeIOSApp, isYoutubePlayerMessage, youtubePlayerProxyUrl } from "@/lib/youtubeEmbed";
import { accumulateWatched, loadWatched, markCompleted, recordProgress, saveDuration } from "@/lib/videoProgressStore";

const FALLBACK_SHORT_VIDEO_SEC = 120;

interface Props {
  packageKey: string | null;
}

type LogRow = { exercise_id: string; logged_at: string; sets_done?: number | null };

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Modal player that auto-logs a set when the video ends AND reports watched seconds. */
function WatchModal({
  exercise,
  onClose,
  onCompleted,
  onProgress,
}: {
  exercise: Exercise;
  onClose: () => void;
  onCompleted: () => void;
  /** Fired with newly watched seconds so repeats keep counting toward minutes. */
  onProgress: (deltaSec: number, durationSec: number, completed: boolean, flush?: boolean) => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const firedRef = useRef(false);
  const lastWatchedRef = useRef({ watched: 0, duration: 0, completed: false });
  const lastReportedSecRef = useRef(0);
  const onProgressRef = useRef(onProgress);
  const videoId = extractYoutubeId(exercise.youtube_url);
  const [playerError, setPlayerError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const [useNativePlayer] = useState(() => isNativeIOSApp());
  const [useAndroidSimpleEmbed] = useState(() => isNativeAndroidApp());
  const playerSrc = videoId
    ? youtubePlayerProxyUrl(videoId, { autoplay: !useAndroidSimpleEmbed, simple: useAndroidSimpleEmbed })
    : "";

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  const reportDelta = useCallback(
    (watchedSec: number, durationSec: number, completed: boolean, flush = false) => {
      const safeWatched = Math.max(0, Math.floor(watchedSec || 0));
      const deltaSec = Math.max(0, safeWatched - lastReportedSecRef.current);
      if (deltaSec > 0) onProgressRef.current(deltaSec, durationSec, completed, flush);
      else if (flush) onProgressRef.current(0, durationSec, completed, true);
      lastReportedSecRef.current = Math.max(lastReportedSecRef.current, safeWatched);
    },
    [],
  );

  // Wall-clock fallback: iOS native player and Android simple embed do not
  // post progress events, so we track elapsed time while the modal is open
  // and credit it on close (capped to avoid runaway values).
  const wallClockStartedAtRef = useRef<number>(Date.now());
  const noPostMessagePath = useNativePlayer || useAndroidSimpleEmbed;

  const wallClockElapsedSec = useCallback(
    (overrideSec?: number) => Math.min(4 * 60 * 60, Math.max(0, Math.floor(overrideSec ?? ((Date.now() - wallClockStartedAtRef.current) / 1000)))),
    [],
  );

  const handleClose = useCallback(
    (nativeResult?: { elapsedSec?: number }) => {
      if (noPostMessagePath) {
        reportDelta(wallClockElapsedSec(nativeResult?.elapsedSec), FALLBACK_SHORT_VIDEO_SEC, false, true);
      } else {
        const { watched, duration, completed } = lastWatchedRef.current;
        reportDelta(watched, duration, completed, true);
      }
      onClose();
    },
    [noPostMessagePath, onClose, reportDelta, wallClockElapsedSec],
  );

  useEffect(() => {
    if (!noPostMessagePath) return;
    wallClockStartedAtRef.current = Date.now();
    lastReportedSecRef.current = 0;
    // Periodically credit seconds while the video is open.
    const interval = window.setInterval(() => {
      reportDelta(wallClockElapsedSec(), FALLBACK_SHORT_VIDEO_SEC, false);
    }, 1000);
    return () => {
      window.clearInterval(interval);
      reportDelta(wallClockElapsedSec(), FALLBACK_SHORT_VIDEO_SEC, false, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noPostMessagePath, reportDelta, wallClockElapsedSec]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (useAndroidSimpleEmbed || event.source !== iframeRef.current?.contentWindow) return;
      if (!isYoutubePlayerMessage(event.data, videoId || undefined)) return;

      if (event.data.type === "error") {
        setPlayerError(true);
        return;
      }

      if (event.data.type === "progress" || event.data.type === "ready") {
        const watched = Math.max(lastWatchedRef.current.watched, Math.floor(event.data.currentTime || 0));
        const duration = Math.floor(event.data.duration || 0);
        lastWatchedRef.current = { watched, duration, completed: lastWatchedRef.current.completed };
        if (watched - lastReportedSecRef.current >= 15) reportDelta(watched, duration, false);
      }

      if (event.data.type === "state" && event.data.state === 0 && !firedRef.current) {
        firedRef.current = true;
        const duration = Math.floor(event.data.duration || lastWatchedRef.current.duration || 0);
        lastWatchedRef.current = { watched: duration, duration, completed: true };
        reportDelta(duration, duration, true, true);
        onCompleted();
      }
    };

    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      const { watched, duration, completed } = lastWatchedRef.current;
      if (watched > 0) reportDelta(watched, duration, completed, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useAndroidSimpleEmbed, videoId]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => handleClose()}
    >
      <div
        className="w-full max-w-2xl rounded-2xl overflow-hidden bg-black ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative aspect-video">
          {videoId ? (
            useNativePlayer ? (
              <NativeYouTubePlayer key={`${videoId}-${retryKey}`} videoId={videoId} title={exercise.name} onNativeClose={handleClose} />
            ) : (
              <iframe
                key={`${videoId}-${retryKey}`}
                ref={iframeRef}
                src={playerSrc}
                title={exercise.name}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
                className="w-full h-full border-0"
              />
            )
          ) : null}
          {playerError && !useNativePlayer && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black p-5 text-center">
              <p className="text-sm font-bold text-white">Video is still loading. Please try once more.</p>
              <button
                onClick={() => {
                  setPlayerError(false);
                  setRetryKey((value) => value + 1);
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-black"
              >
                Retry
              </button>
            </div>
          )}
        </div>
        <div className="px-4 py-3 bg-black/80 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-white text-sm font-black truncate">{exercise.name}</p>
            <p className="text-white/60 text-[11px]">
              Every second you watch counts toward today's minutes.
            </p>
          </div>
          <button
            onClick={() => handleClose()}
            className="text-white/80 text-xs font-bold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


export default function ExerciseTab({ packageKey }: Props) {
  const { user } = useAuth();
  const userTier = tierForPackageKey(packageKey);

  const [categories, setCategories] = useState<ExerciseCategory[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [badges, setBadges] = useState<ExerciseBadge[]>([]);
  const [earnedKeys, setEarnedKeys] = useState<Set<string>>(new Set());
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [loading, setLoading] = useState(true);

  /** Sum today's watched seconds from video_progress (exercise-namespaced). */
  const loadTodayMinutes = useCallback(async () => {
    if (!user) return;
    setTodayMinutes(await getTodayExerciseMinutes(user.id));
  }, [user]);

  /** Save watched seconds locally first, then let the shared video sync push it to the backend. */
  const saveWatchProgress = useCallback(
    async (ex: Exercise, deltaSec: number, durationSec: number, completed: boolean, flush = false) => {
      if (!user) return;
      const videoKey = `exercise:${ex.id}`;
      const youtube = extractYoutubeId(ex.youtube_url) || undefined;
      const previous = loadWatched()[videoKey];
      const safeDuration = Math.max(durationSec || 0, previous?.durationSec || 0, FALLBACK_SHORT_VIDEO_SEC);
      const roundedDelta = Math.max(0, Math.round(deltaSec));
      if (youtube && safeDuration > 0) saveDuration(youtube, safeDuration);
      if (roundedDelta < 1) {
        if (flush && previous) {
          recordProgress(videoKey, previous.progressSec || previous.todayWatchedSec || 0, safeDuration, youtube, { flush: true });
        }
        return;
      }
      accumulateWatched(videoKey, roundedDelta, safeDuration, youtube, { flush });
      recordProgress(videoKey, Math.min(safeDuration, (previous?.progressSec ?? 0) + roundedDelta), safeDuration, youtube, { flush });
      if (completed) markCompleted(videoKey, safeDuration, youtube, { flush });
      setTodayMinutes((prev) => prev + roundedDelta / 60);
      window.setTimeout(() => void loadTodayMinutes(), flush ? 250 : 1800);
    },
    [user, loadTodayMinutes],
  );

  useEffect(() => {
    const refresh = () => void loadTodayMinutes();
    window.addEventListener("bbdo:video-progress-synced", refresh);
    return () => window.removeEventListener("bbdo:video-progress-synced", refresh);
  }, [loadTodayMinutes]);

  const [activeTier, setActiveTier] = useState<ExerciseTier | "all">("all");
  const [activeCat, setActiveCat] = useState<string | "all">("all");
  const [watching, setWatching] = useState<Exercise | null>(null);
  const [todayLogs, setTodayLogs] = useState<LogRow[]>([]);
  const [allLogs, setAllLogs] = useState<LogRow[]>([]);


  const loadLogs = useCallback(async () => {
    if (!user) return;
    const [{ data: todayData }, { data: allData }] = await Promise.all([
      (supabase as any)
        .from("user_exercise_logs")
        .select("exercise_id, logged_at, sets_done")
        .eq("user_id", user.id)
        .gte("logged_at", startOfTodayISO()),
      (supabase as any)
        .from("user_exercise_logs")
        .select("exercise_id, logged_at, sets_done")
        .eq("user_id", user.id),
    ]);
    setTodayLogs((todayData as LogRow[]) ?? []);
    setAllLogs((allData as LogRow[]) ?? []);
    const { data: earned } = await (supabase as any)
      .from("user_exercise_badges")
      .select("badge_key")
      .eq("user_id", user.id);
    setEarnedKeys(new Set(((earned as any[]) ?? []).map((e) => e.badge_key)));
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [cats, exs, bds] = await Promise.all([listCategories(), listExercises(), listBadges()]);
        if (cancelled) return;
        setCategories(cats);
        setExercises(exs.filter((e) => e.enabled));
        setBadges(bds.filter((b) => b.enabled));
        await Promise.all([loadLogs(), loadTodayMinutes()]);
      } catch (e: any) {
        toast.error(e?.message || "Couldn't load exercises");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadLogs, loadTodayMinutes]);

  const setsByExercise = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of todayLogs) m.set(l.exercise_id, (m.get(l.exercise_id) ?? 0) + Math.max(1, Number(l.sets_done) || 1));
    return m;
  }, [todayLogs]);

  const visibleTiers = useMemo<ExerciseTier[]>(() => {
    const out: ExerciseTier[] = [];
    for (let t = 1; t <= userTier; t++) out.push(t as ExerciseTier);
    return out;
  }, [userTier]);

  const accessibleExercises = useMemo(
    () => exercises.filter((e) => visibleTiers.includes(e.tier as ExerciseTier)),
    [exercises, visibleTiers],
  );

  const completedExerciseIds = useMemo(() => {
    return getCompletedExerciseIdsFromLogs(accessibleExercises, allLogs);
  }, [accessibleExercises, allLogs]);

  useEffect(() => {
    if (activeTier !== "all" && !visibleTiers.includes(activeTier)) setActiveTier("all");
  }, [visibleTiers, activeTier]);

  const filtered = useMemo(() => {
    return exercises
      .filter((e) => visibleTiers.includes(e.tier as ExerciseTier))
      .filter((e) => (activeTier === "all" ? true : e.tier === activeTier))
      .filter((e) => (activeCat === "all" ? true : e.category_id === activeCat))
      .sort((a, b) => (a.tier - b.tier) || (a.sort_order - b.sort_order));
  }, [exercises, activeTier, activeCat, visibleTiers]);

  // Daily goal is admin-configured MINUTES of exercise watch time (default 30).
  const dailyGoalMinutes = useDailyExerciseGoal(DAILY_EXERCISE_GOAL);
  const todayProgress = useMemo(
    () => summarizeExerciseProgress(accessibleExercises, todayLogs, 5),
    [accessibleExercises, todayLogs],
  );
  const goalPct = Math.min(100, Math.round((todayMinutes / Math.max(1, dailyGoalMinutes)) * 100));
  const goalMet = todayMinutes >= dailyGoalMinutes;
  const remainingMinutes = Math.max(0, dailyGoalMinutes - todayMinutes);

  // Badge awarding runs server-side (public.award_exercise_badges) so the rules
  // — distinct-days-of-practice, tier gating, one badge per calendar day —
  // can't be bypassed by rapid client logs. We just call it and refresh.
  const evaluateBadges = useCallback(
    async (_nextCompleted: Set<string>) => {
      if (!user) return;
      const { error } = await (supabase as any).rpc("award_exercise_badges", { _user_id: user.id });
      if (error) return;
      const { data: earned } = await (supabase as any)
        .from("user_exercise_badges")
        .select("badge_key")
        .eq("user_id", user.id);
      const nextKeys = new Set<string>(((earned as any[]) ?? []).map((e) => e.badge_key));
      const added = [...nextKeys].filter((k) => !earnedKeys.has(k));
      if (added.length) {
        setEarnedKeys(nextKeys);
        added.forEach((key) => {
          const b = badges.find((x) => x.key === key);
          if (b) toast.success(`Badge unlocked: ${b.name}`);
        });
      }
    },
    [user, badges, earnedKeys],
  );

  const logSetFromWatch = async (ex: Exercise) => {
    if (!user) return;
    const target = parseTargetSets(ex.sets);
    const done = setsByExercise.get(ex.id) ?? 0;
    if (done >= target) {
      toast(`✅ ${ex.name} already has all ${target} sets today`);
      return;
    }
    const wasCompleted = completedExerciseIds.has(ex.id);
    const { error } = await (supabase as any)
      .from("user_exercise_logs")
      .insert({ user_id: user.id, exercise_id: ex.id, sets_done: 1 });
    if (error) {
      toast.error(error.message || "Couldn't log set");
      return;
    }
    const nowDone = done + 1;
    const remain = Math.max(0, target - nowDone);
    if (nowDone >= target) toast.success(`✅ ${ex.name} complete`);
    else toast.success(`Set ${nowDone}/${target} logged — watch ${remain} more to finish`);

    const loggedAt = new Date().toISOString();
    setTodayLogs((prev) => [...prev, { exercise_id: ex.id, logged_at: loggedAt, sets_done: 1 }]);
    setAllLogs((prev) => [...prev, { exercise_id: ex.id, logged_at: loggedAt, sets_done: 1 }]);
    window.dispatchEvent(new CustomEvent("exercise-log-saved"));

    if (!wasCompleted && nowDone >= target) {
      const next = new Set(completedExerciseIds);
      next.add(ex.id);
      await evaluateBadges(next);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading exercises…</div>;
  }

  return (
    <div className="theme-exercise px-4 md:px-6 pt-3 md:pt-8 pb-10 space-y-6">
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl p-6 text-white shadow-card relative overflow-hidden"
        style={{ background: "var(--pillar-exercise)" }}
      >
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-16 w-44 h-44 rounded-full bg-white/5 blur-3xl" />
        <div className="relative">
          <p className="text-[11px] font-bold tracking-[0.2em] uppercase text-white/80">Exercise</p>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-1">
            {PLAN_LABEL[PLAN_FOR_TIER[userTier]]}
          </h1>
          <p className="text-sm text-white/85 mt-1">
            Every second of watch time counts. Aim for {dailyGoalMinutes} minutes today.
          </p>

          {/* Daily goal ring */}
          <div className="mt-4 rounded-2xl bg-white/12 backdrop-blur-sm p-4 ring-1 ring-white/15">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4" />
                <span className="text-xs font-black uppercase tracking-[0.14em]">Daily goal</span>
              </div>
              <span className="text-xs font-bold">
                {todayMinutes.toLocaleString("en-IN", { maximumFractionDigits: 1 })}/{dailyGoalMinutes} min{goalMet ? " · Goal met" : ""}
              </span>
            </div>
            <div className="mt-2 h-2.5 rounded-full bg-white/15 overflow-hidden">
              <motion.div
                initial={false}
                animate={{ width: `${goalPct}%` }}
                transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="h-full rounded-full"
                style={{ background: goalMet ? "#10B981" : "#FFFFFF" }}
              />
            </div>
            <p className="text-[11px] text-white/75 mt-2">
              {goalMet
                ? "You've smashed today's minimum — keep going, no ceiling."
                : `${remainingMinutes.toLocaleString("en-IN", { maximumFractionDigits: 1 })} more minute${remainingMinutes === 1 ? "" : "s"} to hit today's goal.`}
            </p>
            <p className="text-[10px] text-white/60 mt-1">
              {todayProgress.completedExercises} exercise{todayProgress.completedExercises === 1 ? "" : "s"} fully completed today.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px]">
            <span className="inline-flex items-center gap-1.5 bg-white/15 px-2.5 py-1 rounded-full font-semibold">
              <Flame className="w-3.5 h-3.5" /> Tier {userTier}
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white/15 px-2.5 py-1 rounded-full font-semibold">
              <Trophy className="w-3.5 h-3.5" /> {earnedKeys.size}/{badges.length} badges
            </span>
            <span className="inline-flex items-center gap-1.5 bg-white/15 px-2.5 py-1 rounded-full font-semibold">
              <Check className="w-3.5 h-3.5" /> {todayMinutes.toLocaleString("en-IN", { maximumFractionDigits: 1 })} min watched
            </span>
          </div>

        </div>
      </motion.div>

      {/* Fasting-window session breakdown removed for end users —
          the live daily-goal ring already reflects the active fasting protocol. */}

      {/* Tier tabs */}
      {visibleTiers.length >= 1 && (
        <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
          <button
            onClick={() => setActiveTier("all")}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              activeTier === "all"
                ? "bg-[var(--bbdo-blue)] text-white shadow-card"
                : "bg-[var(--bbdo-surface)] text-muted-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          {visibleTiers.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTier(t)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                activeTier === t
                  ? "text-white shadow-card"
                  : "bg-[var(--bbdo-surface)] text-muted-foreground hover:text-foreground"
              }`}
              style={activeTier === t ? { background: TIER_COLOR[t] } : undefined}
            >
              Tier {t} · {PLAN_LABEL[PLAN_FOR_TIER[t]]}
            </button>
          ))}
        </div>
      )}

      {/* Category filter */}
      <div className="flex gap-2 overflow-x-auto -mx-1 px-1">
        <button
          onClick={() => setActiveCat("all")}
          className={`px-3 py-1.5 rounded-full text-xs font-bold ${
            activeCat === "all"
              ? "bg-[var(--bbdo-blue)] text-white"
              : "bg-[var(--bbdo-surface)] text-muted-foreground"
          }`}
        >
          All
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCat(c.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${
              activeCat === c.id
                ? "bg-[var(--bbdo-blue)] text-white"
                : "bg-[var(--bbdo-surface)] text-muted-foreground"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Exercise list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filtered.length === 0 && (
          <div className="col-span-full">
            <EmptyState icon={Dumbbell} title="No exercises here yet" description="Try a different section or check back soon." />
          </div>
        )}
        {filtered.map((ex) => {
          const target = parseTargetSets(ex.sets);
          const done = setsByExercise.get(ex.id) ?? 0;
          const pct = Math.min(100, Math.round((done / target) * 100));
          const complete = done >= target;
          const hasVideo = !!ex.youtube_url && !!extractYoutubeId(ex.youtube_url);
          const ytId = extractYoutubeId(ex.youtube_url);
          const thumbSrc = ex.image_url || (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : null);
          const canWatch = hasVideo && !complete;
          return (
            <motion.div
              key={ex.id}
              layout
              className="rounded-2xl overflow-hidden liquid-glass hover:-translate-y-px transition-transform"
            >
              {/* Thumbnail */}
              <button
                type="button"
                onClick={() => canWatch && setWatching(ex)}
                disabled={!canWatch}
                className="relative block w-full aspect-video bg-muted overflow-hidden group"
                aria-label={canWatch ? `Play ${ex.name}` : ex.name}
              >
                {thumbSrc ? (
                  <img
                    src={thumbSrc}
                    alt={ex.name}
                    loading="lazy"
                    className="w-full h-full object-cover transition-transform group-hover:scale-[1.02]"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ background: "var(--pillar-exercise-soft)", color: "var(--pillar-exercise)" }}
                  >
                    <Dumbbell className="w-10 h-10" strokeWidth={1.5} />
                  </div>
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/10 pointer-events-none" />
                {/* Play badge */}
                {canWatch && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-12 h-12 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                      <Play className="w-5 h-5 text-black ml-0.5" fill="currentColor" />
                    </span>
                  </span>
                )}
                {/* Tier / done pill */}
                <span className="absolute top-2 left-2">
                  {complete ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-black text-white bg-emerald-500/90 px-2 py-0.5 rounded-full">
                      <Check className="w-3 h-3" /> Done
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full text-white"
                      style={{ background: `${TIER_COLOR[ex.tier as ExerciseTier]}E6` }}
                    >
                      Tier {ex.tier}
                    </span>
                  )}
                </span>
                {!hasVideo && (
                  <span className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] font-bold text-white bg-black/60 px-2 py-0.5 rounded-full">
                    <Lock className="w-3 h-3" /> No video
                  </span>
                )}
                {/* Title over gradient */}
                <div className="absolute bottom-0 left-0 right-0 p-3 text-left">
                  <h3 className="text-sm font-black text-white leading-tight line-clamp-2 drop-shadow">
                    {ex.name}
                  </h3>
                  <p className="text-[11px] text-white/85 mt-0.5">
                    {ex.reps_duration} · {ex.sets} sets
                  </p>
                </div>
              </button>

              {/* Body */}
              <div className="p-4 space-y-3">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                    <span className={complete ? "text-success" : "text-foreground/70"}>
                      {done}/{target} sets today
                    </span>
                    {!complete && (
                      <span className="text-muted-foreground">
                        {done === 0 ? "Watch to log set 1" : `Watch again for set ${done + 1}`}
                      </span>
                    )}
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={false}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full"
                      style={{
                        background: complete ? "#10B981" : TIER_COLOR[ex.tier as ExerciseTier],
                      }}
                    />
                  </div>
                </div>

                <button
                  onClick={() => canWatch && setWatching(ex)}
                  disabled={!hasVideo || complete}
                  className="w-full h-9 px-3 rounded-xl text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
                  style={{
                    background: complete
                      ? "#10B981"
                      : hasVideo
                      ? TIER_COLOR[ex.tier as ExerciseTier]
                      : "var(--bbdo-surface-3)",
                  }}
                  title={
                    !hasVideo
                      ? "No video available yet"
                      : complete
                      ? "Already complete"
                      : "Watch the full video to log this set"
                  }
                >
                  {complete ? (
                    <>
                      <Check className="w-3.5 h-3.5" /> Completed
                    </>
                  ) : !hasVideo ? (
                    <>
                      <Lock className="w-3.5 h-3.5" /> No video
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5" /> Watch &amp; log set {done + 1}
                    </>
                  )}
                </button>

                {ex.knee_pain_substitute && (
                  <p className="text-[10px] text-muted-foreground italic">
                    Knee-pain swap: {ex.knee_pain_substitute}
                  </p>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="rounded-3xl p-5 liquid-glass">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-black uppercase tracking-[0.12em] text-foreground/80 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" /> Badges
            </h3>
            <span className="text-[11px] text-muted-foreground">
              {earnedKeys.size}/{badges.length}
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
            {badges.map((b) => {
              const earned = earnedKeys.has(b.key);
              const locked = b.tier_required > userTier;
              return (
                <div
                  key={b.id}
                  className={`rounded-2xl p-3 text-center transition-opacity ${
                    earned
                      ? "bg-primary/5 ring-1 ring-primary/20"
                      : locked
                      ? "bg-muted/40 opacity-40"
                      : "bg-muted/40 opacity-70"
                  }`}
                  title={locked ? `Unlocks at Tier ${b.tier_required}` : b.description}
                >
                  <span
                    className="w-10 h-10 rounded-xl mx-auto flex items-center justify-center"
                    style={{
                      background: earned ? "var(--pillar-exercise-soft)" : "hsl(var(--muted))",
                      color: earned ? "var(--pillar-exercise)" : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {locked ? <Lock className="w-5 h-5" strokeWidth={1.75} /> : earned ? <Dumbbell className="w-5 h-5" strokeWidth={1.75} /> : <CheckCircle2 className="w-5 h-5" strokeWidth={1.75} />}
                  </span>
                  <p className="text-[11px] font-bold mt-1 text-foreground leading-tight">{b.name}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5 line-clamp-2">
                    {locked ? `Tier ${b.tier_required}+` : b.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {watching && (
        <WatchModal
          exercise={watching}
          onClose={() => setWatching(null)}
          onCompleted={() => {
            const ex = watching;
            setWatching(null);
            void logSetFromWatch(ex);
          }}
          onProgress={(watchedSec, durationSec, completed, flush) => {
            void saveWatchProgress(watching, watchedSec, durationSec, completed, flush);
          }}
        />
      )}
    </div>
  );
}

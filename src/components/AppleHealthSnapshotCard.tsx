import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { motion } from "framer-motion";
import {
  Activity, Flame, HeartPulse, Moon, Route, Timer, Droplet, Scale, RefreshCw, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  canUseNativeHealth, fetchHealthSnapshot, type HealthSnapshot,
  enableHealthBackgroundSync, onHealthDataChanged,
  getNativeHealthPermissionState, requestNativeHealthAuthorization,
} from "@/lib/healthProvider";
import { useAuth } from "@/contexts/AuthContext";
import {
  saveHealthSnapshot, fetchLatestHealthSnapshot, type StoredHealthSnapshot,
} from "@/lib/healthSnapshotService";
import { healthSourceLabel, isAndroidPlatform, phoneLabel, wearableLabel } from "@/lib/platformLabels";

type TileDef = {
  icon: any;
  label: string;
  value: string | null;
  accent: string; // hsl color
};

function formatSyncedAt(iso?: string) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const diffMin = Math.round((Date.now() - d.getTime()) / 60_000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return null;
  }
}

function Pill({ icon: Icon, label, value, accent }: TileDef) {
  return (
    <div
      className="snap-start shrink-0 w-[128px] rounded-2xl border border-border/60 bg-background/70 px-3 py-3 backdrop-blur-sm transition-transform hover:-translate-y-0.5"
      style={{ boxShadow: "0 1px 0 hsl(var(--border) / 0.4)" }}
    >
      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3 w-3" style={{ color: accent }} strokeWidth={2} />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-1.5 text-[18px] font-black leading-none text-foreground tabular-nums">
        {value ?? "—"}
      </div>
    </div>
  );
}

export default function AppleHealthSnapshotCard() {
  const { user } = useAuth();
  const isNative = canUseNativeHealth();
  const [snap, setSnap] = useState<HealthSnapshot | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [healthMessage, setHealthMessage] = useState<string | null>(null);
  const [canRequestHealth, setCanRequestHealth] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (isNative) {
        const state = await getNativeHealthPermissionState();
        setCanRequestHealth(state.canRequest);
        setHealthMessage(state.authorized ? null : state.message);
        try {
          const live = await fetchHealthSnapshot();
          if (live) {
            setSnap(live);
            setSyncedAt(new Date().toISOString());
            setHealthMessage(null);
            setCanRequestHealth(false);
            void saveHealthSnapshot(user.id, live);
            return;
          }
        } catch (error: any) {
          setHealthMessage(error?.message || `Couldn't sync ${healthSourceLabel()} data.`);
          setCanRequestHealth(true);
        }
      }
      const stored: StoredHealthSnapshot | null = await fetchLatestHealthSnapshot(user.id);
      if (stored) {
        setSnap(stored);
        setSyncedAt(stored.synced_at);
      }
    } finally {
      setLoading(false);
    }
  }, [isNative, user]);

  const connectHealth = useCallback(async () => {
    if (!user || !isNative) return;
    setLoading(true);
    try {
      const state = await requestNativeHealthAuthorization();
      setHealthMessage(state.authorized ? null : state.message);
      setCanRequestHealth(state.canRequest);
      if (state.authorized) await load();
    } finally {
      setLoading(false);
    }
  }, [isNative, load, user]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    void enableHealthBackgroundSync();
    let unsub: () => void = () => {};
    void onHealthDataChanged(() => { void load(); }).then((fn) => { unsub = fn; });
    const sub = CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) void load();
    });
    const onVis = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      unsub();
      void sub.then((s) => s.remove());
    };
  }, [load, user]);

  const tiles: TileDef[] = useMemo(() => {
    if (!snap) return [];
    const km = snap.distanceMeters ? (snap.distanceMeters / 1000).toFixed(2) : null;
    const all: TileDef[] = [
      { icon: Flame,       label: "Active kcal", accent: "#F97316", value: snap.activeCalories != null ? snap.activeCalories.toLocaleString("en-IN") : null },
      { icon: Route,       label: "Distance",    accent: "#0EA5E9", value: km ? `${km} km` : null },
      { icon: Timer,       label: "Exercise",    accent: "#22C55E", value: snap.exerciseMinutes != null ? `${snap.exerciseMinutes}m` : null },
      { icon: Moon,        label: "Sleep",       accent: "#8B5CF6", value: snap.sleepHours ? `${snap.sleepHours.toFixed(1)}h` : null },
      { icon: HeartPulse,  label: "Resting HR",  accent: "#EF4444", value: snap.restingHeartRate ? `${snap.restingHeartRate} bpm` : null },
      { icon: Activity,    label: "HRV",         accent: "#14B8A6", value: snap.hrvMs ? `${snap.hrvMs} ms` : null },
      { icon: Scale,       label: "Weight",      accent: "#64748B", value: snap.weightKg ? `${snap.weightKg.toFixed(1)} kg` : null },
      { icon: Droplet,     label: "Glucose",     accent: "#F59E0B", value: snap.glucoseMgDl ? `${snap.glucoseMgDl} mg/dL` : null },
    ];
    // Prefer populated tiles first; keep empty ones after so layout stays consistent when a metric returns.
    return all.filter((t) => t.value != null).concat(all.filter((t) => t.value == null));
  }, [snap]);

  if (!user) return null;

  const syncedLabel = formatSyncedAt(syncedAt);
  const hasAnyData = tiles.some((t) => t.value != null);
  const nonNativeMessage = isAndroidPlatform()
    ? "Health Connect sync works in the installed Android app."
    : `Open the app on your ${phoneLabel()} to sync ${healthSourceLabel()}.`;

  const scrollBy = (dx: number) => scrollerRef.current?.scrollBy({ left: dx, behavior: "smooth" });

  return (
    <motion.div
      className="rounded-3xl border border-border/60 bg-card/60 p-4 backdrop-blur-xl"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      {/* Header — compact single row */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-primary/10 shrink-0">
            <HeartPulse className="h-4 w-4 text-primary" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-muted-foreground truncate">
              {healthSourceLabel()}
            </p>
            <p className="text-sm font-black text-foreground leading-tight truncate">
              Today · {syncedLabel ? `synced ${syncedLabel}` : "live"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {hasAnyData && (
            <>
              <button
                type="button"
                onClick={() => scrollBy(-160)}
                aria-label="Scroll left"
                className="hidden md:inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollBy(160)}
                aria-label="Scroll right"
                className="hidden md:inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-label={`Refresh ${healthSourceLabel()}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-primary disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {!hasAnyData && !loading ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/60 px-3 py-4 text-center">
          <p className="text-[12px] font-medium text-muted-foreground">
            {isNative
              ? healthMessage ?? `No ${healthSourceLabel()} data yet. Allow permissions to sync.`
              : nonNativeMessage}
          </p>
          {isNative && canRequestHealth && (
            <button
              type="button"
              onClick={() => void connectHealth()}
              className="mt-3 h-9 rounded-xl bg-primary px-4 text-xs font-bold text-primary-foreground disabled:opacity-60"
              disabled={loading}
            >
              Allow {healthSourceLabel()}
            </button>
          )}
        </div>
      ) : (
        <div
          ref={scrollerRef}
          className="flex gap-2 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1 no-scrollbar"
          style={{ scrollbarWidth: "none" }}
        >
          {tiles.map((t) => (
            <Pill key={t.label} {...t} />
          ))}
        </div>
      )}

      {hasAnyData && (
        <p className="mt-2.5 text-[10px] leading-snug text-muted-foreground">
          Auto-syncs from your {phoneLabel()} & {wearableLabel()}. Swipe for more.
        </p>
      )}
    </motion.div>
  );
}

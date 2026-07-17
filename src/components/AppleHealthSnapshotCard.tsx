import { useCallback, useEffect, useState } from "react";
import { App as CapApp } from "@capacitor/app";
import { motion } from "framer-motion";
import {
  Activity, Flame, HeartPulse, Moon, Route, Timer, Droplet, Scale, RefreshCw,
} from "lucide-react";
import {
  canUseNativeHealth, fetchHealthSnapshot, type HealthSnapshot,
  enableHealthBackgroundSync, onHealthDataChanged,
} from "@/lib/healthProvider";
import { useAuth } from "@/contexts/AuthContext";
import {
  saveHealthSnapshot, fetchLatestHealthSnapshot, type StoredHealthSnapshot,
} from "@/lib/healthSnapshotService";
import { healthSourceLabel, phoneLabel, wearableLabel } from "@/lib/platformLabels";

function Tile({
  icon: Icon, label, value, sub,
}: {
  icon: any; label: string; value: string; sub?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <div className="mt-1 text-lg font-black leading-tight text-foreground">{value}</div>
      {sub && <div className="text-[10px] font-medium text-muted-foreground">{sub}</div>}
    </div>
  );
}

function formatSyncedAt(iso?: string) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const now = Date.now();
    const diffMin = Math.round((now - d.getTime()) / 60_000);
    if (diffMin < 1) return "Synced just now";
    if (diffMin < 60) return `Synced ${diffMin} min ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `Synced ${diffHr}h ago`;
    return `Synced ${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`;
  } catch {
    return null;
  }
}

export default function AppleHealthSnapshotCard() {
  const { user } = useAuth();
  const isNative = canUseAppleHealthSteps();
  const [snap, setSnap] = useState<HealthSnapshot | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (isNative) {
        // Read live from HealthKit, persist to DB, and update UI.
        const live = await fetchAppleHealthSnapshot();
        if (live) {
          setSnap(live);
          setSyncedAt(new Date().toISOString());
          void saveHealthSnapshot(user.id, live);
          return;
        }
      }
      // Web (or native failed): fall back to the last synced snapshot from DB.
      const stored: StoredHealthSnapshot | null = await fetchLatestHealthSnapshot(user.id);
      if (stored) {
        setSnap(stored);
        setSyncedAt(stored.synced_at);
      }
    } finally {
      setLoading(false);
    }
  }, [isNative, user]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    // Enable background delivery once so iOS wakes the app on new samples.
    void enableAppleHealthBackgroundSync();
    let unsub: () => void = () => {};
    void onAppleHealthDataChanged(() => { void load(); }).then((fn) => { unsub = fn; });
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

  if (!user) return null;

  const km = snap?.distanceMeters ? (snap.distanceMeters / 1000).toFixed(2) : null;
  const syncedLabel = formatSyncedAt(syncedAt);
  const hasAnyData = snap && Object.values(snap).some((v) => v != null && v !== "");

  return (
    <motion.div
      className="liquid-glass rounded-3xl p-5"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground">
            {healthSourceLabel()} {!isNative && `· from your ${phoneLabel()}`}
          </p>
          <p className="text-sm font-black text-foreground">Today's snapshot</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          aria-label={`Refresh ${healthSourceLabel()}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card text-primary disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {!hasAnyData && !loading ? (
        <p className="rounded-2xl border border-dashed border-border bg-background/60 px-3 py-4 text-center text-[12px] font-medium text-muted-foreground">
          {isNative
            ? `No ${healthSourceLabel()} data yet. Allow permissions in the Health app.`
            : `Open the app on your ${phoneLabel()} once to sync your ${healthSourceLabel()} vitals here.`}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Tile
            icon={Flame}
            label="Active kcal"
            value={snap?.activeCalories != null ? snap.activeCalories.toLocaleString("en-IN") : "—"}
          />
          <Tile
            icon={Route}
            label="Distance"
            value={km ? `${km} km` : "—"}
          />
          <Tile
            icon={Timer}
            label="Exercise"
            value={snap?.exerciseMinutes != null ? `${snap.exerciseMinutes} min` : "—"}
          />
          <Tile
            icon={Moon}
            label="Sleep"
            value={snap?.sleepHours ? `${snap.sleepHours.toFixed(1)} h` : "—"}
          />
          <Tile
            icon={HeartPulse}
            label="Resting HR"
            value={snap?.restingHeartRate ? `${snap.restingHeartRate} bpm` : "—"}
          />
          <Tile
            icon={Activity}
            label="HRV"
            value={snap?.hrvMs ? `${snap.hrvMs} ms` : "—"}
          />
          <Tile
            icon={Scale}
            label="Weight"
            value={snap?.weightKg ? `${snap.weightKg.toFixed(1)} kg` : "—"}
          />
          <Tile
            icon={Droplet}
            label="Glucose"
            value={snap?.glucoseMgDl ? `${snap.glucoseMgDl} mg/dL` : "—"}
          />
        </div>
      )}

      <p className="mt-3 text-[10px] leading-snug text-muted-foreground">
        {syncedLabel ?? `Data syncs automatically from your ${phoneLabel()}, ${wearableLabel()} and connected apps.`}
      </p>
    </motion.div>
  );
}

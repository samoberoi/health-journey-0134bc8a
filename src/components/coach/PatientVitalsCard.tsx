import { useEffect, useState } from "react";
import { Activity, Droplet, Flame, Footprints, HeartPulse, Moon, Scale, Timer } from "lucide-react";
import { fetchLatestHealthSnapshot, type StoredHealthSnapshot } from "@/lib/healthSnapshotService";
import HealthTrendsCard from "@/components/HealthTrendsCard";

function Tile({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-background/60 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" />
        {label}
      </div>
      <div className="mt-1 text-lg font-black leading-tight text-foreground">{value}</div>
    </div>
  );
}

export default function PatientVitalsCard({ patientId }: { patientId: string }) {
  const [snap, setSnap] = useState<StoredHealthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLatestHealthSnapshot(patientId)
      .then((s) => { if (!cancelled) setSnap(s); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [patientId]);

  const km = snap?.distanceMeters ? (snap.distanceMeters / 1000).toFixed(2) : null;

  return (
    <div className="space-y-3">
      <div className="liquid-glass rounded-3xl p-5">
        <div className="mb-3">
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-muted-foreground">Health</p>
          <p className="text-sm font-black text-foreground">
            Latest vitals{snap?.date ? ` · ${snap.date}` : ""}
          </p>
        </div>
        {loading ? (
          <p className="text-[12px] text-muted-foreground">Loading…</p>
        ) : !snap ? (
          <p className="rounded-2xl border border-dashed border-border bg-background/60 px-3 py-4 text-center text-[12px] font-medium text-muted-foreground">
            Patient hasn't synced health data from their phone yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Tile icon={Footprints} label="Steps" value={snap.steps != null ? snap.steps.toLocaleString("en-IN") : "—"} />
            <Tile icon={Flame} label="Active kcal" value={snap.activeCalories != null ? snap.activeCalories.toLocaleString("en-IN") : "—"} />
            <Tile icon={Timer} label="Exercise" value={snap.exerciseMinutes != null ? `${snap.exerciseMinutes} min` : "—"} />
            <Tile icon={Moon} label="Sleep" value={snap.sleepHours ? `${snap.sleepHours.toFixed(1)} h` : "—"} />
            <Tile icon={HeartPulse} label="Resting HR" value={snap.restingHeartRate ? `${snap.restingHeartRate} bpm` : "—"} />
            <Tile icon={Activity} label="HRV" value={snap.hrvMs ? `${snap.hrvMs} ms` : "—"} />
            <Tile icon={Scale} label="Weight" value={snap.weightKg ? `${snap.weightKg.toFixed(1)} kg` : (km ? `${km} km` : "—")} />
            <Tile icon={Droplet} label="Glucose" value={snap.glucoseMgDl ? `${snap.glucoseMgDl} mg/dL` : "—"} />
          </div>
        )}
      </div>

      <HealthTrendsCard userId={patientId} days={30} />
    </div>
  );
}

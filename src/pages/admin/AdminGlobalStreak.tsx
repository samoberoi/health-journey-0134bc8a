import { useEffect, useState } from "react";
import { Save, Flame } from "lucide-react";
import { toast } from "sonner";
import { getStreakConfig, updateStreakConfig } from "@/lib/globalStreak";

import CsvToolbar from "@/components/admin/CsvToolbar";
type Pillar = { key: string; label: string; required: boolean; threshold?: number };

export default function AdminGlobalStreak() {
  const [pillars, setPillars] = useState<Pillar[]>([]);
  const [weekly, setWeekly] = useState("");
  const [monthly, setMonthly] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getStreakConfig().then((cfg) => {
      if (!cfg) return;
      setPillars(cfg.pillars ?? []);
      setWeekly(cfg.weekly_badge_copy ?? "");
      setMonthly(cfg.monthly_badge_copy ?? "");
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await updateStreakConfig({ pillars, weekly_badge_copy: weekly, monthly_badge_copy: monthly });
      toast.success("Global streak config saved");
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex justify-end mb-3"><CsvToolbar table="global_streak_config" onImported={() => window.location.reload()} /></div>
      <div className="flex items-center gap-2">
        <Flame className="w-5 h-5 text-[#E00101]" />
        <h2 className="text-xl font-black text-foreground">Global Streak Manager</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Configure which pillars must be completed each day to lock a BBDO streak brick. Weekly badge fires every 7 consecutive complete days; monthly journey every 28.
      </p>

      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="grid grid-cols-12 bg-muted/40 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          <div className="col-span-4">Pillar</div>
          <div className="col-span-3">Key</div>
          <div className="col-span-3">Threshold</div>
          <div className="col-span-2 text-right">Required</div>
        </div>
        {pillars.map((p, i) => (
          <div key={p.key} className="grid grid-cols-12 items-center px-4 py-3 border-t border-border">
            <input
              className="col-span-4 bg-transparent text-sm font-medium text-foreground focus:outline-none"
              value={p.label}
              onChange={(e) => setPillars((arr) => arr.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
            />
            <div className="col-span-3 text-xs font-mono text-muted-foreground">{p.key}</div>
            <input
              className="col-span-3 bg-transparent text-sm text-foreground focus:outline-none w-24 border-b border-border/40"
              placeholder="—"
              type="number"
              value={p.threshold ?? ""}
              onChange={(e) =>
                setPillars((arr) => arr.map((x, j) => (j === i ? { ...x, threshold: e.target.value ? Number(e.target.value) : undefined } : x)))
              }
            />
            <div className="col-span-2 text-right">
              <input
                type="checkbox"
                checked={p.required}
                onChange={(e) => setPillars((arr) => arr.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))}
                className="w-5 h-5 accent-[#E00101]"
              />
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Weekly badge copy</span>
          <textarea className="mt-1 w-full h-20 rounded-xl border border-border bg-transparent p-3 text-sm" value={weekly} onChange={(e) => setWeekly(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Monthly journey copy</span>
          <textarea className="mt-1 w-full h-20 rounded-xl border border-border bg-transparent p-3 text-sm" value={monthly} onChange={(e) => setMonthly(e.target.value)} />
        </label>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="inline-flex items-center gap-2 h-11 px-5 rounded-full font-bold text-sm text-white disabled:opacity-60"
        style={{ background: "linear-gradient(135deg,#248CCB,#E00101)" }}
      >
        <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save changes"}
      </button>
    </div>
  );
}

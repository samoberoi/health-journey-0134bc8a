import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Gift, Save, CheckCircle2, Clock, Users } from "lucide-react";

import CsvToolbar from "@/components/admin/CsvToolbar";
interface ReferralRow {
  id: string;
  created_at: string;
  status: string;
  reward_granted: boolean;
  referral_code: string;
  referrer_id: string;
  referrer_name: string | null;
  referrer_phone: string | null;
  referred_user_id: string;
  referred_name: string | null;
  referred_phone: string | null;
  referred_subscribed: boolean;
}

export default function AdminReferrals() {
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rewardDays, setRewardDays] = useState<number>(30);
  const [savingDays, setSavingDays] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: refs }, { data: setting }] = await Promise.all([
      supabase.from("admin_referrals_overview" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("app_settings" as any).select("value").eq("key", "referral_reward_days").maybeSingle(),
    ]);
    setRows((refs as any) ?? []);
    const v = (setting as any)?.value;
    setRewardDays(typeof v === "number" ? v : parseInt(String(v ?? 30)) || 30);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const saveRewardDays = async () => {
    setSavingDays(true);
    const { error } = await supabase
      .from("app_settings" as any)
      .upsert({ key: "referral_reward_days", value: rewardDays } as any, { onConflict: "key" });
    setSavingDays(false);
    if (error) {
      toast.error("Could not save: " + error.message);
    } else {
      toast.success(`Reward set to ${rewardDays} days`);
    }
  };

  const totals = {
    total: rows.length,
    joined: rows.filter((r) => r.status === "joined").length,
    pending: rows.filter((r) => r.status !== "joined").length,
    rewardsGiven: rows.filter((r) => r.reward_granted).length,
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex justify-end mb-3"><CsvToolbar table="referrals" onImported={() => window.location.reload()} /></div>
      <header className="space-y-1">
        <h1 className="text-2xl md:text-3xl font-black text-foreground">Referrals</h1>
        <p className="text-sm text-muted-foreground">Track who referred whom and configure the reward.</p>
      </header>

      {/* Config card */}
      <div className="bg-white rounded-2xl border border-border p-5 shadow-card">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[var(--bbdo-red-soft)] flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5 text-[var(--bbdo-red)]" />
          </div>
          <div>
            <h2 className="font-bold text-foreground">Referral Reward</h2>
            <p className="text-xs text-muted-foreground">Days added to the referrer's active plan when a referred user subscribes.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Reward (days)</label>
            <input
              type="number"
              min={1}
              max={365}
              value={rewardDays}
              onChange={(e) => setRewardDays(parseInt(e.target.value) || 0)}
              className="block mt-1 w-32 px-3 py-2 rounded-xl border border-border bg-white text-foreground font-bold text-lg"
            />
          </div>
          <button
            onClick={saveRewardDays}
            disabled={savingDays || rewardDays < 1}
            className="px-4 py-2.5 rounded-xl bg-[var(--bbdo-red)] text-white font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {savingDays ? "Saving…" : "Save"}
          </button>
          <p className="text-xs text-muted-foreground ml-auto">Applies to all future qualifying referrals.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Users} label="Total Referrals" value={totals.total} />
        <StatCard icon={CheckCircle2} label="Joined" value={totals.joined} accent="text-emerald-600" />
        <StatCard icon={Clock} label="Pending" value={totals.pending} accent="text-amber-600" />
        <StatCard icon={Gift} label="Rewards Given" value={totals.rewardsGiven} accent="text-[var(--bbdo-red)]" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold text-foreground">All Referrals</h2>
          <button onClick={load} className="text-xs text-[var(--bbdo-blue)] font-semibold">Refresh</button>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No referrals yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Referrer</th>
                  <th className="text-left px-4 py-3 font-semibold">Referred</th>
                  <th className="text-left px-4 py-3 font-semibold">Code</th>
                  <th className="text-left px-4 py-3 font-semibold">Joined?</th>
                  <th className="text-left px-4 py-3 font-semibold">Subscribed?</th>
                  <th className="text-left px-4 py-3 font-semibold">Reward</th>
                  <th className="text-left px-4 py-3 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{r.referrer_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.referrer_phone || ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground">{r.referred_name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.referred_phone || ""}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{r.referral_code}</td>
                    <td className="px-4 py-3">
                      <Pill ok={r.status === "joined"} okLabel="Joined" noLabel="Pending" />
                    </td>
                    <td className="px-4 py-3">
                      <Pill ok={r.referred_subscribed} okLabel="Active" noLabel="—" />
                    </td>
                    <td className="px-4 py-3">
                      <Pill ok={r.reward_granted} okLabel="Granted" noLabel="Not yet" />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-border p-4">
      <Icon className={`w-5 h-5 ${accent ?? "text-muted-foreground"} mb-2`} />
      <div className="text-xl sm:text-2xl font-black text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function Pill({ ok, okLabel, noLabel }: { ok: boolean; okLabel: string; noLabel: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-[11px] font-bold ${
        ok ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
      }`}
    >
      {ok ? okLabel : noLabel}
    </span>
  );
}

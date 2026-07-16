import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Save, Download, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";
import { fetchPnl, fetchPnlConfig, sumPnl, updatePnlConfig, inr, type PnlConfig, type PnlRow, type PnlTotals } from "@/lib/pnl";

import CsvToolbar from "@/components/admin/CsvToolbar";
type Scope = "month" | "all";

const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
const startOfNextMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 1);
const startOfPrevMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() - 1, 1);

export default function AdminPnl() {
  const [scope, setScope] = useState<Scope>("month");
  const [rows, setRows] = useState<PnlRow[]>([]);
  const [prevRows, setPrevRows] = useState<PnlRow[]>([]);
  const [cfg, setCfg] = useState<PnlConfig | null>(null);
  const [draft, setDraft] = useState<PnlConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "subscription" | "yoga" | "event">("all");

  const load = async () => {
    setLoading(true);
    try {
      const c = await fetchPnlConfig();
      setCfg(c);
      setDraft(c);

      const now = new Date();
      const from = scope === "month" ? startOfMonth(now) : new Date("2020-01-01");
      const to = scope === "month" ? startOfNextMonth(now) : new Date("2100-01-01");
      const [current, previous] = await Promise.all([
        fetchPnl(from, to),
        scope === "month"
          ? fetchPnl(startOfPrevMonth(now), startOfMonth(now))
          : Promise.resolve([] as PnlRow[]),
      ]);
      setRows(current);
      setPrevRows(previous);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load P&L");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [scope]);

  const totals = useMemo(() => sumPnl(rows), [rows]);
  const prevTotals = useMemo(() => sumPnl(prevRows), [prevRows]);
  const filtered = useMemo(() => filter === "all" ? rows : rows.filter(r => r.source === filter), [rows, filter]);

  const save = async () => {
    if (!draft || !cfg) return;
    setSaving(true);
    try {
      await updatePnlConfig(cfg.id, {
        gst_pct: Number(draft.gst_pct),
        hyperrevamp_pct: Number(draft.hyperrevamp_pct),
        default_coach_commission_pct: Number(draft.default_coach_commission_pct),
        default_partner_split_pct: Number(draft.default_partner_split_pct),
      });
      toast.success("Rates saved — P&L recomputed");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    const header = ["Date", "Source", "Label", "Gross", "GST", "Net", "Coach", "Partner", "HyperRevamp", "Margin"];
    const lines = [header.join(",")];
    filtered.forEach(r => {
      lines.push([
        new Date(r.occurred_at).toISOString().slice(0, 10),
        r.source,
        `"${(r.label || "").replace(/"/g, '""')}"`,
        r.gross, r.gst, r.net, r.coach_cost, r.partner_cost, r.hyperrevamp_cost, r.margin
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `pnl-${scope}-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex justify-end mb-3"><CsvToolbar table="pnl_rate_config" onImported={() => window.location.reload()} /></div>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#E00101]" />
          <h2 className="text-xl font-black text-foreground">P&amp;L Manager</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-full border border-border p-1 bg-muted/40">
            {(["month", "all"] as Scope[]).map(s => (
              <button
                key={s}
                onClick={() => setScope(s)}
                className={`px-4 h-8 rounded-full text-xs font-bold transition-colors ${scope === s ? "bg-foreground text-background" : "text-muted-foreground"}`}
              >
                {s === "month" ? "This month" : "All time"}
              </button>
            ))}
          </div>
          <button onClick={exportCsv} className="inline-flex items-center gap-1 h-8 px-3 rounded-full border border-border text-xs font-semibold">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Tile label="Gross revenue" value={totals.gross} prev={scope === "month" ? prevTotals.gross : undefined} tone="foreground" />
        <Tile label="Less: GST" value={-totals.gst} prev={scope === "month" ? -prevTotals.gst : undefined} tone="danger" />
        <Tile label="Less: HyperRevamp" value={-totals.hyperrevamp_cost} prev={scope === "month" ? -prevTotals.hyperrevamp_cost : undefined} tone="muted" />
        <Tile label="Less: Coaches" value={-totals.coach_cost} prev={scope === "month" ? -prevTotals.coach_cost : undefined} tone="muted" />
        <Tile label="Less: Partners" value={-totals.partner_cost} prev={scope === "month" ? -prevTotals.partner_cost : undefined} tone="muted" />
        <Tile label="Platform margin" value={totals.margin} prev={scope === "month" ? prevTotals.margin : undefined} tone="primary" />
      </div>

      {/* Rate config */}
      {draft && (
        <div className="rounded-2xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-black text-foreground">Rate configuration</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Editable anytime — the P&amp;L recomputes on save.</p>
            </div>
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1 h-9 px-4 rounded-full text-white font-bold text-xs disabled:opacity-60" style={{ background: "linear-gradient(135deg,#248CCB,#E00101)" }}>
              <Save className="w-3.5 h-3.5" /> {saving ? "Saving..." : "Save"}
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <PctField label="GST %" value={draft.gst_pct} onChange={v => setDraft({ ...draft, gst_pct: v })} />
            <PctField label="HyperRevamp %" value={draft.hyperrevamp_pct} onChange={v => setDraft({ ...draft, hyperrevamp_pct: v })} />
            <PctField label="Default coach commission %" value={draft.default_coach_commission_pct} onChange={v => setDraft({ ...draft, default_coach_commission_pct: v })} />
            <PctField label="Default partner split %" value={draft.default_partner_split_pct} onChange={v => setDraft({ ...draft, default_partner_split_pct: v })} />
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Per-coach commissions live in Admin → Coaches. Per-package yoga splits live in Admin → Channel Partners → Packages (<code>partner_split_pct</code>). Blank values fall back to the defaults above.
          </p>
        </div>
      )}

      {/* Line items */}
      <div className="rounded-2xl border border-border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
          <h3 className="text-sm font-black text-foreground">Line entries · {filtered.length}</h3>
          <div className="inline-flex rounded-full border border-border p-1 bg-background">
            {(["all", "subscription", "yoga", "event"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`px-3 h-7 rounded-full text-[11px] font-bold ${filter === f ? "bg-foreground text-background" : "text-muted-foreground"}`}>
                {f === "all" ? "All" : f === "subscription" ? "Subscriptions" : f === "yoga" ? "Yoga" : "Events"}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto max-h-[520px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-background border-b border-border">
              <tr className="text-muted-foreground">
                <Th>Date</Th><Th>Source</Th><Th>Label</Th>
                <Th right>Gross</Th><Th right>GST</Th><Th right>Net</Th>
                <Th right>Coach</Th><Th right>Partner</Th><Th right>HR</Th>
                <Th right>Margin</Th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">No transactions in range.</td></tr>
              ) : filtered.map(r => (
                <tr key={r.source + r.ref_id} className="border-b border-border/40 hover:bg-muted/20">
                  <Td>{new Date(r.occurred_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</Td>
                  <Td>
                    <span className={`inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold ${r.source === "yoga" ? "bg-emerald-500/10 text-emerald-600" : r.source === "event" ? "bg-amber-500/10 text-amber-600" : "bg-blue-500/10 text-blue-600"}`}>
                      {r.source}
                    </span>
                  </Td>
                  <Td className="max-w-[220px] truncate">{r.label}</Td>
                  <Td right>{inr(r.gross)}</Td>
                  <Td right className="text-destructive">-{inr(r.gst)}</Td>
                  <Td right>{inr(r.net)}</Td>
                  <Td right>{r.coach_cost ? `-${inr(r.coach_cost)}` : "—"}</Td>
                  <Td right>{r.partner_cost ? `-${inr(r.partner_cost)}` : "—"}</Td>
                  <Td right>-{inr(r.hyperrevamp_cost)}</Td>
                  <Td right className="font-bold text-foreground">{inr(r.margin)}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, prev, tone }: { label: string; value: number; prev?: number; tone: "foreground" | "danger" | "primary" | "muted" }) {
  const delta = prev !== undefined ? value - prev : undefined;
  const up = (delta ?? 0) >= 0;
  const bg =
    tone === "primary" ? "text-white" :
    tone === "danger" ? "bg-destructive/5 border-destructive/20" :
    tone === "foreground" ? "bg-foreground/5" :
    "bg-muted/40";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={`rounded-2xl border border-border p-4 ${bg}`}
      style={tone === "primary" ? { background: "linear-gradient(135deg,#248CCB,#E00101)" } : undefined}
    >
      <div className={`text-[10px] font-bold uppercase tracking-widest ${tone === "primary" ? "opacity-80" : "text-muted-foreground"}`}>{label}</div>
      <div className={`mt-1 text-xl font-black ${tone === "primary" ? "" : tone === "danger" ? "text-destructive" : "text-foreground"}`}>
        {inr(value)}
      </div>
      {delta !== undefined && (
        <div className={`mt-1 inline-flex items-center gap-0.5 text-[10px] font-semibold ${tone === "primary" ? "opacity-80" : up ? "text-emerald-500" : "text-destructive"}`}>
          {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {inr(Math.abs(delta))} vs last mo.
        </div>
      )}
    </motion.div>
  );
}

function PctField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center gap-1 rounded-xl border border-border px-3 h-10">
        <input
          type="number"
          step="0.01"
          value={value ?? 0}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-full bg-transparent text-sm font-bold text-foreground focus:outline-none"
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
    </label>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2 font-bold text-[10px] uppercase tracking-wider ${right ? "text-right" : "text-left"}`}>{children}</th>;
}
function Td({ children, right, className = "" }: { children: React.ReactNode; right?: boolean; className?: string }) {
  return <td className={`px-3 py-2 ${right ? "text-right tabular-nums" : ""} ${className}`}>{children}</td>;
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Download, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import DateRangeFilter, { defaultRange, DateRange } from "@/components/admin/DateRangeFilter";


import CsvToolbar from "@/components/admin/CsvToolbar";
interface LogRow {
  id: string;
  created_at: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  module: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
}

const MODULES = [
  "All", "Overview", "Users", "Coaches", "Super Admins", "Access Control",
  "Packages", "Subscriptions", "Assignments", "Languages", "Diet", "Supplements",
  "Conditions", "Fasting", "Movement", "Lab Tests", "Videos", "Control Center", "Auth",
];
const ACTIONS = [
  "All", "create", "update", "delete", "enable", "disable", "assign", "unassign",
  "login", "logout", "import", "export", "regenerate", "upload", "rebalance",
];

const toneFor = (action: string) => {
  if (["delete", "disable", "unassign"].includes(action)) return "bg-destructive/10 text-destructive";
  if (["create", "enable", "assign", "import", "upload"].includes(action)) return "bg-emerald-500/10 text-emerald-600";
  if (["update", "regenerate", "rebalance"].includes(action)) return "bg-amber-500/10 text-amber-600";
  return "bg-primary/10 text-primary";
};

const fmtDt = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });

export default function AdminLogs() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("All");
  const [actionFilter, setActionFilter] = useState("All");
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    let q = supabase
      .from("audit_logs")
      .select("*")
      .gte("created_at", range.from.toISOString())
      .lte("created_at", range.to.toISOString())
      .order("created_at", { ascending: false })
      .limit(2000);
    if (moduleFilter !== "All") q = q.eq("module", moduleFilter);
    if (actionFilter !== "All") q = q.eq("action", actionFilter);
    const { data } = await q;
    setRows((data ?? []) as LogRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [moduleFilter, actionFilter, range]);


  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.actor_name, r.target_label, r.target_id, r.ip_address, r.module, r.action]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [rows, search]);

  const exportCsv = () => {
    const head = ["timestamp", "actor", "role", "module", "action", "target_type", "target", "ip", "metadata"];
    const lines = [head.join(",")];
    for (const r of filtered) {
      const cells = [
        r.created_at,
        r.actor_name ?? "",
        r.actor_role ?? "",
        r.module,
        r.action,
        r.target_type ?? "",
        r.target_label ?? r.target_id ?? "",
        r.ip_address ?? "",
        JSON.stringify(r.metadata ?? {}),
      ].map((c) => `"${String(c).replace(/"/g, '""')}"`);
      lines.push(cells.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex justify-end mb-3"><CsvToolbar table="audit_logs" onImported={() => window.location.reload()} /></div>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-foreground">Audit Logs</h1>
          <p className="text-muted-foreground text-sm">
            Every action across the platform — who, what, when, and from where.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
          <DateRangeFilter value={range} onChange={setRange} />
          <Button variant="outline" size="sm" onClick={load} className="gap-2 w-full sm:w-auto">
            <RefreshCw className="w-4 h-4" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-2 w-full sm:w-auto">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
        </div>

      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by user, target, IP…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {MODULES.map((m) => <option key={m} value={m}>{m === "All" ? "All modules" : m}</option>)}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          {ACTIONS.map((a) => <option key={a} value={a}>{a === "All" ? "All actions" : a}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{filtered.length} entries · {range.label}</span>
      </div>


      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-sm">No log entries match these filters.</div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((r) => {
            const isOpen = expanded === r.id;
            return (
              <motion.div key={r.id} layout className="liquid-glass rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm"
                >
                  <span className="text-[11px] text-muted-foreground tabular-nums w-44 shrink-0">{fmtDt(r.created_at)}</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${toneFor(r.action)}`}>
                    {r.action}
                  </span>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                    {r.module}
                  </span>
                  <span className="text-foreground truncate flex-1">
                    <span className="font-semibold">{r.actor_name || "—"}</span>
                    <span className="text-muted-foreground"> · {r.target_label || r.target_type || r.target_id || ""}</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground hidden md:inline shrink-0">{r.ip_address || "—"}</span>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 py-3 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <Cell label="Actor" value={r.actor_name || "—"} />
                        <Cell label="Role" value={r.actor_role || "—"} />
                        <Cell label="IP Address" value={r.ip_address || "—"} />
                        <Cell label="User Agent" value={r.user_agent || "—"} truncate />
                        <Cell label="Target Type" value={r.target_type || "—"} />
                        <Cell label="Target ID" value={r.target_id || "—"} truncate />
                        <Cell label="Target Label" value={r.target_label || "—"} />
                        <Cell label="Actor User ID" value={r.actor_user_id || "—"} truncate />
                        {r.metadata && Object.keys(r.metadata).length > 0 && (
                          <div className="col-span-2 md:col-span-4">
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">Metadata</p>
                            <pre className="text-[11px] bg-muted rounded-lg p-2 overflow-x-auto">{JSON.stringify(r.metadata, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Cell({ label, value, truncate }: { label: string; value: string; truncate?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-sm text-foreground font-medium ${truncate ? "truncate" : "break-words"}`}>{value}</p>
    </div>
  );
}

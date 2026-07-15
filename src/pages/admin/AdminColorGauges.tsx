import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Palette, Plus, Trash2, Save } from "lucide-react";
import { useColorGauges, refreshColorGauges, type GaugeModule, type GaugeBand } from "@/hooks/useColorGauges";

import CsvToolbar from "@/components/admin/CsvToolbar";
export default function AdminColorGauges() {
  const { modules } = useColorGauges();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, GaugeBand[]>>({});

  useEffect(() => {
    // seed draft on first load
    const next: Record<string, GaugeBand[]> = {};
    modules.forEach((m) => { next[m.id] = m.bands.map((b) => ({ ...b })); });
    setDraft(next);
    if (!expanded && modules.length) setExpanded(modules[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modules.length]);

  const updateBand = (moduleId: string, bandId: string, patch: Partial<GaugeBand>) => {
    setDraft((d) => ({
      ...d,
      [moduleId]: (d[moduleId] || []).map((b) => (b.id === bandId ? { ...b, ...patch } : b)),
    }));
  };

  const addBand = async (m: GaugeModule) => {
    const nextSort = (draft[m.id]?.length || 0) + 1;
    const { data, error } = await (supabase as any)
      .from("color_gauge_bands")
      .insert({ module_id: m.id, label: "New band", min_value: 0, max_value: 100, color_hex: "#10B981", sort_order: nextSort })
      .select()
      .single();
    if (error) { toast.error(error.message); return; }
    setDraft((d) => ({ ...d, [m.id]: [...(d[m.id] || []), data as GaugeBand] }));
    refreshColorGauges();
  };

  const removeBand = async (moduleId: string, bandId: string) => {
    const { error } = await (supabase as any).from("color_gauge_bands").delete().eq("id", bandId);
    if (error) { toast.error(error.message); return; }
    setDraft((d) => ({ ...d, [moduleId]: (d[moduleId] || []).filter((b) => b.id !== bandId) }));
    refreshColorGauges();
    toast.success("Band removed");
  };

  const saveModule = async (m: GaugeModule) => {
    const rows = draft[m.id] || [];
    // bulk update
    for (const b of rows) {
      const { error } = await (supabase as any)
        .from("color_gauge_bands")
        .update({
          label: b.label,
          min_value: b.min_value,
          max_value: b.max_value,
          color_hex: b.color_hex,
          sort_order: b.sort_order,
        })
        .eq("id", b.id);
      if (error) { toast.error(`${b.label}: ${error.message}`); return; }
    }
    toast.success(`${m.module_name} saved`);
    refreshColorGauges();
  };

  return (
    <div className="p-4 sm:p-6 space-y-4">
      <div className="flex justify-end mb-3"><CsvToolbar table="color_gauge_bands" onImported={() => window.location.reload()} /></div>
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Palette className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-black text-foreground">Color Gauge Manager</h2>
          <p className="text-muted-foreground text-xs">Control the color of every metric across the app. Edit ranges and pick any color.</p>
        </div>
      </div>

      <div className="grid gap-3">
        {modules.map((m) => {
          const open = expanded === m.id;
          const bands = draft[m.id] || m.bands;
          return (
            <div key={m.id} className="rounded-2xl border border-border bg-card">
              <button
                onClick={() => setExpanded(open ? null : m.id)}
                className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 text-left"
              >
                <div className="min-w-0 w-full sm:w-auto">
                  <div className="text-sm font-bold text-foreground">{m.module_name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    key: <code className="text-foreground">{m.module_key}</code>{m.unit ? ` • ${m.unit}` : ""} • {bands.length} bands
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-wrap w-full sm:w-auto">
                  {bands.map((b) => (
                    <span key={b.id} className="w-4 h-4 rounded-full border border-border" style={{ background: b.color_hex }} />
                  ))}
                </div>
              </button>

              {open && (
                <div className="px-4 pb-4 space-y-2 border-t border-border">
                  <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_90px_90px_120px_40px] gap-2 text-[10px] uppercase tracking-wide text-muted-foreground pt-3">
                    <span>Label</span><span>Min</span><span>Max</span><span>Color</span><span></span>
                  </div>
                  {bands.map((b) => (
                    <div key={b.id} className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_90px_90px_120px_40px] gap-2 items-center rounded-xl border border-border/70 p-2 sm:border-0 sm:p-0">
                      <input
                        value={b.label}
                        onChange={(e) => updateBand(m.id, b.id, { label: e.target.value })}
                        aria-label="Band label"
                        className="h-9 px-2 rounded-lg border border-border bg-background text-sm min-w-0"
                      />
                      <div className="grid grid-cols-2 gap-2 sm:contents">
                        <input
                          type="number" step="0.1"
                          value={b.min_value ?? ""}
                          onChange={(e) => updateBand(m.id, b.id, { min_value: e.target.value === "" ? null : Number(e.target.value) })}
                          aria-label="Minimum value"
                          className="h-9 px-2 rounded-lg border border-border bg-background text-sm min-w-0"
                        />
                        <input
                          type="number" step="0.1"
                          value={b.max_value ?? ""}
                          onChange={(e) => updateBand(m.id, b.id, { max_value: e.target.value === "" ? null : Number(e.target.value) })}
                          aria-label="Maximum value"
                          className="h-9 px-2 rounded-lg border border-border bg-background text-sm min-w-0"
                        />
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="color"
                          value={b.color_hex}
                          onChange={(e) => updateBand(m.id, b.id, { color_hex: e.target.value })}
                          className="w-9 h-9 rounded-lg border border-border bg-background cursor-pointer shrink-0"
                        />
                        <input
                          value={b.color_hex}
                          onChange={(e) => updateBand(m.id, b.id, { color_hex: e.target.value })}
                          aria-label="Color hex"
                          className="h-9 w-full min-w-0 px-2 rounded-lg border border-border bg-background text-xs font-mono"
                        />
                      </div>
                      <button
                        onClick={() => removeBand(m.id, b.id)}
                        className="h-9 w-full sm:w-9 rounded-lg border border-border text-destructive hover:bg-destructive/10 flex items-center justify-center"
                        aria-label="Remove band"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2">
                    <button
                      onClick={() => addBand(m)}
                      className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-lg border border-border text-sm font-semibold text-foreground hover:bg-muted"
                    >
                      <Plus className="w-4 h-4" /> Add band
                    </button>
                    <button
                      onClick={() => saveModule(m)}
                      className="inline-flex items-center justify-center gap-1.5 h-9 px-4 rounded-lg bg-[var(--bbdo-red)] text-white text-sm font-bold"
                    >
                      <Save className="w-4 h-4" /> Save {m.module_name}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {modules.length === 0 && (
          <div className="text-sm text-muted-foreground p-6 text-center border border-dashed rounded-2xl">
            No gauges configured yet.
          </div>
        )}
      </div>
    </div>
  );
}

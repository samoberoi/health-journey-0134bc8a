import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

interface Row {
  id?: string;
  slug: string;
  label: string;
  description: string | null;
  dot_color: string | null;
  display_order: number;
  is_active: boolean;
}

const BLANK: Row = { slug: "", label: "", description: "", dot_color: "bg-emerald-500", display_order: 100, is_active: true };

export default function AdminDietTypes() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("diet_types" as any)
      .select("*")
      .order("display_order", { ascending: true });
    if (error) toast({ title: "Failed to load", description: error.message, variant: "destructive" });
    setRows(((data as any) || []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = (idx: number, patch: Partial<Row>) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  const addRow = () => setRows(prev => [...prev, { ...BLANK, display_order: (prev.at(-1)?.display_order ?? 0) + 10 }]);

  const removeRow = async (idx: number) => {
    const r = rows[idx];
    if (r.id) {
      const { error } = await supabase.from("diet_types" as any).delete().eq("id", r.id);
      if (error) return toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    }
    setRows(prev => prev.filter((_, i) => i !== idx));
  };

  const saveAll = async () => {
    setSaving(true);
    const errors: string[] = [];
    for (const r of rows) {
      if (!r.slug.trim() || !r.label.trim()) continue;
      const payload: any = {
        label: r.label.trim(),
        description: r.description || null,
        dot_color: r.dot_color || null,
        display_order: r.display_order,
        is_active: r.is_active,
      };
      if (r.id) {
        // Do NOT update slug on existing rows — it's the stable identifier used
        // by food_items.diet_type and user_diet_profiles.diet_preference.
        const { error } = await supabase.from("diet_types" as any).update(payload).eq("id", r.id);
        if (error) errors.push(`${r.label}: ${error.message}`);
      } else {
        payload.slug = r.slug.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
        const { error } = await supabase.from("diet_types" as any).insert(payload);
        if (error) errors.push(`${r.label}: ${error.message}`);
      }
    }
    setSaving(false);
    if (errors.length) {
      toast({ title: "Some rows didn't save", description: errors.join(" · "), variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Diet types updated." });
    }
    load();
  };

  if (loading) return <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>;

  return (
    <div className="px-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-black">Diet Types</h2>
          <p className="text-xs text-muted-foreground mt-1">These options power the user profile dropdown and the food library diet filter.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={addRow}><Plus className="w-4 h-4 mr-1.5" /> Add</Button>
          <Button size="sm" onClick={saveAll} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
            Save all
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-3 font-semibold w-32">Slug</th>
              <th className="px-3 py-3 font-semibold">Label</th>
              <th className="px-3 py-3 font-semibold">Description</th>
              <th className="px-3 py-3 font-semibold w-36">Dot color class</th>
              <th className="px-3 py-3 font-semibold w-20">Order</th>
              <th className="px-3 py-3 font-semibold w-20">Active</th>
              <th className="px-3 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id ?? `new-${i}`} className="border-t border-border">
                <td className="px-3 py-2"><Input value={r.slug} onChange={e => update(i, { slug: e.target.value })} placeholder="veg" disabled={!!r.id} /></td>
                <td className="px-3 py-2"><Input value={r.label} onChange={e => update(i, { label: e.target.value })} placeholder="Vegetarian" /></td>
                <td className="px-3 py-2"><Input value={r.description || ""} onChange={e => update(i, { description: e.target.value })} placeholder="Short description" /></td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${r.dot_color || "bg-muted"}`} />
                    <Input value={r.dot_color || ""} onChange={e => update(i, { dot_color: e.target.value })} placeholder="bg-emerald-500" />
                  </div>
                </td>
                <td className="px-3 py-2"><Input type="number" value={r.display_order} onChange={e => update(i, { display_order: Number(e.target.value) })} /></td>
                <td className="px-3 py-2"><Switch checked={r.is_active} onCheckedChange={v => update(i, { is_active: v })} /></td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => removeRow(i)} className="text-muted-foreground hover:text-rose-600"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">No diet types yet — click Add.</td></tr>}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        <strong>Slug</strong> is the identifier written to <code>food_items.diet_type</code> and <code>user_diet_profiles.diet_preference</code>. Existing slugs (<code>veg</code>, <code>vegan</code>, <code>jain</code>, <code>non_veg</code>) power built-in filter logic and cannot be renamed safely; new slugs (like <code>eggitarian</code>) show up in the dropdowns automatically.
      </p>
    </div>
  );
}

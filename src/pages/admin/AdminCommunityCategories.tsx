import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, GripVertical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { PostCategory } from "@/lib/communityService";
import { useConfirm } from "@/components/ConfirmProvider";

import CsvToolbar from "@/components/admin/CsvToolbar";
const EASE = [0.22, 1, 0.36, 1] as const;

const BLANK = {
  id: "",
  slug: "",
  label: "",
  emoji: "",
  accent_color: "#248CCB",
  sort_order: 0,
  is_active: true,
};

export default function AdminCommunityCategories() {
  const confirm = useConfirm();
  const [rows, setRows] = useState<PostCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<typeof BLANK | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("community_post_categories")
      .select("*")
      .order("sort_order", { ascending: true });
    setRows((data ?? []) as PostCategory[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!editing) return;
    if (!editing.slug.trim() || !editing.label.trim()) {
      toast.error("Slug and label are required");
      return;
    }
    setSaving(true);
    try {
      if (editing.id) {
        const { error } = await (supabase as any)
          .from("community_post_categories")
          .update({
            slug: editing.slug.trim(),
            label: editing.label.trim(),
            emoji: editing.emoji.trim() || null,
            accent_color: editing.accent_color,
            sort_order: editing.sort_order,
            is_active: editing.is_active,
          })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Category updated");
      } else {
        const { error } = await (supabase as any)
          .from("community_post_categories")
          .insert({
            slug: editing.slug.trim(),
            label: editing.label.trim(),
            emoji: editing.emoji.trim() || null,
            accent_color: editing.accent_color,
            sort_order: editing.sort_order || rows.length + 1,
            is_active: editing.is_active,
          });
        if (error) throw error;
        toast.success("Category added");
      }
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!(await confirm({ title: "Delete category?", description: "Posts already tagged will keep their text but lose the category.", destructive: true, confirmText: "Delete" }))) return;
    const { error } = await (supabase as any).from("community_post_categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const toggleActive = async (row: PostCategory) => {
    const { error } = await (supabase as any)
      .from("community_post_categories")
      .update({ is_active: !row.is_active })
      .eq("id", row.id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex justify-end mb-3"><CsvToolbar table="community_post_categories" onImported={() => window.location.reload()} /></div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: EASE }}
        className="flex items-center justify-between mb-6"
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--bbdo-blue)]">Community</p>
          <h1 className="text-2xl font-black text-foreground mt-1">Post Categories</h1>
          <p className="text-sm text-muted-foreground mt-1">Curate the filter chips members see on the Community feed.</p>
        </div>
        <Button onClick={() => setEditing({ ...BLANK })}>
          <Plus className="w-4 h-4 mr-2" /> Add Category
        </Button>
      </motion.div>

      {loading ? (
        <div className="py-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--bbdo-blue)]" /></div>
      ) : (
        <div className="grid gap-3">
          {rows.length === 0 && (
            <p className="text-sm text-muted-foreground py-8 text-center">No categories yet. Add one to get started.</p>
          )}
          {rows.map((r) => (
            <div
              key={r.id}
              className="bg-card border border-border/60 rounded-2xl p-4 flex items-center gap-4"
            >
              <GripVertical className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 text-xl"
                style={{ background: `${r.accent_color}15`, color: r.accent_color }}>
                {r.emoji || "•"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-foreground">{r.label}</p>
                <p className="text-[11px] text-muted-foreground">/{r.slug} · order {r.sort_order}</p>
              </div>
              <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
              <Button variant="ghost" size="sm" onClick={() => setEditing({ ...r, emoji: r.emoji ?? "" })}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit Category" : "New Category"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid gap-3">
              <div>
                <Label>Label</Label>
                <Input value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} />
              </div>
              <div>
                <Label>Slug (unique, lowercase)</Label>
                <Input
                  value={editing.slug}
                  onChange={(e) => setEditing({ ...editing, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Emoji</Label>
                  <Input value={editing.emoji} onChange={(e) => setEditing({ ...editing, emoji: e.target.value })} placeholder="🏆" />
                </div>
                <div>
                  <Label>Accent color</Label>
                  <Input type="color" value={editing.accent_color} onChange={(e) => setEditing({ ...editing, accent_color: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Sort order</Label>
                <Input type="number" value={editing.sort_order} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Bell, Plus, Play, Pencil, Trash2, Clock, Users, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  listCategories, listTemplates, upsertTemplate, deleteTemplate,
  toggleTemplate, runDispatcherNow,
  AUDIENCE_KEYS, type NotificationCategory, type NotificationTemplate,
} from "@/lib/notificationManagerService";
import SoundManagerCard from "@/components/admin/SoundManagerCard";
import { useConfirm } from "@/components/ConfirmProvider";

import CsvToolbar from "@/components/admin/CsvToolbar";
const TRIGGER_TYPES = ["reminder", "missed_action", "goal_met", "share_prompt", "profile", "delivery"];
const DAYS = [
  { n: 1, l: "M" }, { n: 2, l: "T" }, { n: 3, l: "W" }, { n: 4, l: "T" },
  { n: 5, l: "F" }, { n: 6, l: "S" }, { n: 7, l: "S" },
];

export default function AdminNotificationManager() {
  const confirm = useConfirm();
  const [cats, setCats] = useState<NotificationCategory[]>([]);
  const [tpls, setTpls] = useState<NotificationTemplate[]>([]);
  const [activeCat, setActiveCat] = useState<string>("all");
  const [editing, setEditing] = useState<Partial<NotificationTemplate> | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [c, t] = await Promise.all([listCategories(), listTemplates()]);
      setCats(c);
      setTpls(t);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const catMap = useMemo(() => {
    const m = new Map<string, NotificationCategory>();
    cats.forEach((c) => m.set(c.id, c));
    return m;
  }, [cats]);

  const filtered = activeCat === "all"
    ? tpls
    : tpls.filter((t) => t.category_id === activeCat);

  async function onSave() {
    if (!editing) return;
    try {
      if (!editing.title || !editing.category_id || !editing.key) {
        toast.error("Title, category, and key are required");
        return;
      }
      const variants = Array.isArray(editing.message_variants) ? editing.message_variants : [];
      if (variants.filter((v) => v && v.trim()).length === 0) {
        toast.error("Add at least one message variant");
        return;
      }
      await upsertTemplate({
        ...editing,
        message_variants: variants.filter((v) => v && v.trim()),
      });
      toast.success("Saved");
      setEditing(null);
      refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function onDelete(id: string) {
    if (!(await confirm({ title: "Delete template?", description: "This cannot be undone.", destructive: true, confirmText: "Delete" }))) return;
    await deleteTemplate(id);
    toast.success("Deleted");
    refresh();
  }

  async function onDispatchNow() {
    setRunning(true);
    try {
      const r = await runDispatcherNow();
      toast.success(`Dispatched ${r?.dispatched ?? 0} notifications`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex justify-end mb-3"><CsvToolbar table="notification_templates" onImported={() => window.location.reload()} /></div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-black flex items-center gap-2">
            <Bell className="w-5 h-5" /> Notification Manager
          </h2>
          <p className="text-sm text-muted-foreground">
            Audience-aware reminders per module. Rotating message variants. Time-of-day scheduled.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:flex gap-2 w-full sm:w-auto">
          <Button variant="outline" onClick={onDispatchNow} disabled={running} className="w-full sm:w-auto">
            <Play className="w-4 h-4 mr-1" /> {running ? "Running..." : "Run dispatcher now"}
          </Button>
          <Button onClick={() => setEditing({
            trigger_type: "reminder",
            send_time_local: "09:00",
            send_days: [1,2,3,4,5,6,7],
            timezone: "Asia/Kolkata",
            cooldown_hours: 20,
            is_active: true,
            message_variants: [""],
            audience_filter: {},
            icon: "🔔",
          })} className="w-full sm:w-auto">
            <Plus className="w-4 h-4 mr-1" /> New template
          </Button>
        </div>
      </div>

      <SoundManagerCard />

      {/* Category tabs */}
      <div className="flex gap-2 flex-wrap">

        <button
          onClick={() => setActiveCat("all")}
          className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${activeCat === "all" ? "bg-primary text-primary-foreground" : "bg-background"}`}
        >
          All ({tpls.length})
        </button>
        {cats.map((c) => {
          const count = tpls.filter((t) => t.category_id === c.id).length;
          return (
            <button
              key={c.id}
              onClick={() => setActiveCat(c.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold border ${activeCat === c.id ? "bg-primary text-primary-foreground" : "bg-background"}`}
            >
              {c.icon} {c.label} ({count})
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">No templates in this category yet.</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((t) => {
            const cat = catMap.get(t.category_id);
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="border rounded-xl p-4 bg-card flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 min-w-0"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg">{t.icon}</span>
                    <span className="font-bold">{t.title}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{cat?.label}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted">{t.trigger_type}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {t.send_time_local.slice(0,5)} ({t.timezone})</span>
                    <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />
                      {Object.keys(t.audience_filter ?? {}).length === 0 ? "no filter" : Object.keys(t.audience_filter).join(", ")}
                    </span>
                    <span className="inline-flex items-center gap-1"><Sparkles className="w-3 h-3" /> {t.message_variants.length} variants</span>
                    <span>cooldown {t.cooldown_hours}h</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                    {t.message_variants[0]}
                  </p>
                </div>
                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                  <Switch
                    checked={t.is_active}
                    onCheckedChange={async (v) => { await toggleTemplate(t.id, v); refresh(); }}
                  />
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setEditing(t)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => onDelete(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit template" : "New template"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category</Label>
                  <Select value={editing.category_id} onValueChange={(v) => setEditing({ ...editing, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Trigger type</Label>
                  <Select value={editing.trigger_type} onValueChange={(v) => setEditing({ ...editing, trigger_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRIGGER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Key (unique)</Label>
                  <Input value={editing.key ?? ""} onChange={(e) => setEditing({ ...editing, key: e.target.value })} placeholder="e.g. supp_morning_reminder" />
                </div>
                <div>
                  <Label>Title</Label>
                  <Input value={editing.title ?? ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Icon (emoji)</Label>
                  <Input value={editing.icon ?? ""} onChange={(e) => setEditing({ ...editing, icon: e.target.value })} />
                </div>
                <div>
                  <Label>Send time (local)</Label>
                  <Input type="time" value={(editing.send_time_local ?? "09:00").slice(0,5)} onChange={(e) => setEditing({ ...editing, send_time_local: e.target.value + ":00" })} />
                </div>
                <div>
                  <Label>Cooldown (hrs)</Label>
                  <Input type="number" min={1} value={editing.cooldown_hours ?? 20} onChange={(e) => setEditing({ ...editing, cooldown_hours: parseInt(e.target.value || "20") })} />
                </div>
              </div>

              <div>
                <Label>Action URL (optional)</Label>
                <Input value={editing.action_url ?? ""} onChange={(e) => setEditing({ ...editing, action_url: e.target.value })} placeholder="/home?tab=supplements" />
              </div>

              <div>
                <Label>Send on days</Label>
                <div className="flex gap-1 mt-1">
                  {DAYS.map((d) => {
                    const active = (editing.send_days ?? []).includes(d.n);
                    return (
                      <button
                        key={d.n}
                        type="button"
                        onClick={() => {
                          const cur = new Set(editing.send_days ?? []);
                          if (cur.has(d.n)) cur.delete(d.n); else cur.add(d.n);
                          setEditing({ ...editing, send_days: [...cur].sort() });
                        }}
                        className={`w-9 h-9 rounded-full text-xs font-bold border ${active ? "bg-primary text-primary-foreground" : "bg-background"}`}
                      >
                        {d.l}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Audience filter (all must match)</Label>
                <div className="grid grid-cols-2 gap-2 mt-1 p-3 border rounded-lg max-h-56 overflow-y-auto">
                  {AUDIENCE_KEYS.map((a) => {
                    const checked = !!(editing.audience_filter ?? {})[a.key];
                    return (
                      <label key={a.key} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => {
                            const cur = { ...(editing.audience_filter ?? {}) };
                            if (v) cur[a.key] = true; else delete cur[a.key];
                            setEditing({ ...editing, audience_filter: cur });
                          }}
                        />
                        <span>{a.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Message variants (rotates across users/days)</Label>
                <div className="space-y-2 mt-1">
                  {(editing.message_variants ?? []).map((m, i) => (
                    <div key={i} className="flex gap-2">
                      <Textarea
                        value={m}
                        onChange={(e) => {
                          const arr = [...(editing.message_variants ?? [])];
                          arr[i] = e.target.value;
                          setEditing({ ...editing, message_variants: arr });
                        }}
                        rows={2}
                      />
                      <Button variant="ghost" size="icon" onClick={() => {
                        const arr = [...(editing.message_variants ?? [])];
                        arr.splice(i, 1);
                        setEditing({ ...editing, message_variants: arr.length ? arr : [""] });
                      }}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setEditing({ ...editing, message_variants: [...(editing.message_variants ?? []), ""] })}>
                    <Plus className="w-4 h-4 mr-1" /> Add variant
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                <span className="text-sm">Active</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={onSave}>Save template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

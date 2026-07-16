import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatEventWhen, type EventRow } from "@/lib/eventsService";
import { Plus, Trash2, Pencil, Users } from "lucide-react";

const db = supabase as any;

const empty = () => ({
  id: "" as string,
  title: "",
  description: "",
  cover_image_url: "",
  mode: "offline" as "offline" | "online",
  online_url: "",
  venue_name: "",
  venue_address: "",
  venue_city: "",
  starts_at: "",
  ends_at: "",
  timezone: "Asia/Kolkata",
  organizer_type: "bbdo" as "bbdo" | "coach" | "channel_partner" | "admin",
  organizer_name: "BBDO Team",
  organizer_avatar_url: "",
  is_paid: false,
  fee_inr: 0,
  capacity: "" as string | number,
  status: "published" as "draft" | "published" | "cancelled" | "completed",
});

export default function AdminEvents() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(empty());
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await db
      .from("events")
      .select("*")
      .order("starts_at", { ascending: true });
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    setRows((data ?? []) as EventRow[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setForm(empty());
    setEditing(null);
    setShowForm(true);
  };

  const openEdit = (e: EventRow) => {
    setEditing(e.id);
    setForm({
      id: e.id,
      title: e.title,
      description: e.description ?? "",
      cover_image_url: e.cover_image_url ?? "",
      mode: e.mode,
      online_url: e.online_url ?? "",
      venue_name: e.venue_name ?? "",
      venue_address: e.venue_address ?? "",
      venue_city: e.venue_city ?? "",
      starts_at: e.starts_at ? new Date(e.starts_at).toISOString().slice(0, 16) : "",
      ends_at: e.ends_at ? new Date(e.ends_at).toISOString().slice(0, 16) : "",
      timezone: e.timezone,
      organizer_type: e.organizer_type,
      organizer_name: e.organizer_name,
      organizer_avatar_url: e.organizer_avatar_url ?? "",
      is_paid: e.is_paid,
      fee_inr: e.fee_inr,
      capacity: e.capacity ?? "",
      status: e.status,
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!user) return;
    if (!form.title.trim() || !form.starts_at) {
      toast({ title: "Title and start time required", variant: "destructive" });
      return;
    }
    const payload: any = {
      title: form.title.trim(),
      description: form.description || null,
      cover_image_url: form.cover_image_url || null,
      mode: form.mode,
      online_url: form.mode === "online" ? form.online_url || null : null,
      venue_name: form.mode === "offline" ? form.venue_name || null : null,
      venue_address: form.mode === "offline" ? form.venue_address || null : null,
      venue_city: form.mode === "offline" ? form.venue_city || null : null,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      timezone: form.timezone,
      organizer_type: form.organizer_type,
      organizer_name: form.organizer_name || "BBDO Team",
      organizer_avatar_url: form.organizer_avatar_url || null,
      is_paid: form.is_paid,
      fee_inr: form.is_paid ? Number(form.fee_inr) || 0 : 0,
      capacity: form.capacity === "" ? null : Number(form.capacity),
      status: form.status,
    };
    let error;
    if (editing) {
      ({ error } = await db.from("events").update(payload).eq("id", editing));
    } else {
      ({ error } = await db.from("events").insert({ ...payload, created_by: user.id }));
    }
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: editing ? "Event updated" : "Event created" });
    setShowForm(false);
    await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this event? Registrations will be removed too.")) return;
    const { error } = await db.from("events").delete().eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Event deleted" });
    await load();
  };

  const input = "w-full h-10 rounded-lg border border-border bg-background px-3 text-sm";
  const label = "block text-xs font-semibold text-muted-foreground mb-1";

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-foreground">Events</h1>
          <p className="text-sm text-muted-foreground">Create and manage community events, workshops, and meetups.</p>
        </div>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full font-bold text-sm text-white"
          style={{ background: "var(--bbdo-red)" }}
        >
          <Plus className="w-4 h-4" /> New event
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No events yet. Create your first one.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Title</th>
                <th className="text-left p-3">When</th>
                <th className="text-left p-3">Mode</th>
                <th className="text-left p-3">Fee</th>
                <th className="text-left p-3">Registered</th>
                <th className="text-left p-3">Status</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-t border-border">
                  <td className="p-3 font-semibold">{e.title}</td>
                  <td className="p-3 text-muted-foreground">{formatEventWhen(e.starts_at, e.timezone)}</td>
                  <td className="p-3 capitalize">{e.mode}</td>
                  <td className="p-3">{e.is_paid && e.fee_inr > 0 ? `₹${e.fee_inr}` : "Free"}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Users className="w-3.5 h-3.5" />
                      {e.registered_count}
                      {e.capacity != null ? ` / ${e.capacity}` : ""}
                    </span>
                  </td>
                  <td className="p-3">
                    <span
                      className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                        e.status === "published"
                          ? "bg-emerald-100 text-emerald-700"
                          : e.status === "draft"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {e.status}
                    </span>
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(e)} className="p-2 text-muted-foreground hover:text-foreground" aria-label="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => remove(e.id)} className="p-2 text-muted-foreground hover:text-destructive" aria-label="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-background w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">{editing ? "Edit event" : "New event"}</h2>
              <button onClick={() => setShowForm(false)} className="text-sm text-muted-foreground">Cancel</button>
            </div>

            <div>
              <label className={label}>Title</label>
              <input className={input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className={label}>Description</label>
              <textarea
                className={input + " h-24 py-2"}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label className={label}>Cover image URL</label>
              <input className={input} value={form.cover_image_url} onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Mode</label>
                <select className={input} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value as any })}>
                  <option value="offline">Offline</option>
                  <option value="online">Online</option>
                </select>
              </div>
              <div>
                <label className={label}>Status</label>
                <select className={input} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="completed">Completed</option>
                </select>
              </div>
            </div>

            {form.mode === "online" ? (
              <div>
                <label className={label}>Online link (Zoom / Meet / etc.)</label>
                <input className={input} value={form.online_url} onChange={(e) => setForm({ ...form, online_url: e.target.value })} />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className={label}>Venue name</label>
                  <input className={input} value={form.venue_name} onChange={(e) => setForm({ ...form, venue_name: e.target.value })} />
                </div>
                <div>
                  <label className={label}>Address</label>
                  <input className={input} value={form.venue_address} onChange={(e) => setForm({ ...form, venue_address: e.target.value })} />
                </div>
                <div>
                  <label className={label}>City</label>
                  <input className={input} value={form.venue_city} onChange={(e) => setForm({ ...form, venue_city: e.target.value })} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Starts at</label>
                <input type="datetime-local" className={input} value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
              </div>
              <div>
                <label className={label}>Ends at</label>
                <input type="datetime-local" className={input} value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Organizer type</label>
                <select className={input} value={form.organizer_type} onChange={(e) => setForm({ ...form, organizer_type: e.target.value as any })}>
                  <option value="bbdo">BBDO</option>
                  <option value="coach">Coach</option>
                  <option value="channel_partner">Channel Partner</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className={label}>Organizer name</label>
                <input className={input} value={form.organizer_name} onChange={(e) => setForm({ ...form, organizer_name: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Paid event?</label>
                <select className={input} value={form.is_paid ? "yes" : "no"} onChange={(e) => setForm({ ...form, is_paid: e.target.value === "yes" })}>
                  <option value="no">Free</option>
                  <option value="yes">Paid</option>
                </select>
              </div>
              <div>
                <label className={label}>Fee (₹) — 0 if free</label>
                <input type="number" min={0} className={input} value={form.fee_inr} disabled={!form.is_paid} onChange={(e) => setForm({ ...form, fee_inr: Number(e.target.value) })} />
              </div>
            </div>

            <div>
              <label className={label}>Capacity (leave blank for unlimited)</label>
              <input type="number" min={1} className={input} value={form.capacity as any} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setShowForm(false)} className="h-10 px-4 rounded-full text-sm font-semibold text-muted-foreground">Cancel</button>
              <button onClick={save} className="h-10 px-5 rounded-full text-sm font-bold text-white" style={{ background: "var(--bbdo-blue)" }}>
                {editing ? "Save changes" : "Create event"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

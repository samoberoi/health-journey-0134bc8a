import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dumbbell,
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  Loader2,
  Award,
  ExternalLink,
  Play,
  Filter,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import { uploadExerciseThumbnail, fileToDataUrl } from "@/lib/exerciseThumbnailService";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import ExportCsvButton from "@/components/admin/ExportCsvButton";
import ImportCsvButton from "@/components/admin/ImportCsvButton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/ConfirmProvider";
import {
  listCategories,
  listExercises,
  listBadges,
  createExercise,
  updateExercise,
  deleteExercise,
  toggleExerciseEnabled,
  updateBadge,
  normalizeYoutubeUrl,
  extractYoutubeId,
  PLAN_LABEL,
  PLAN_FOR_TIER,
  TIER_FOR_PLAN,
  TIER_COLOR,
  type Exercise,
  type ExerciseBadge,
  type ExerciseCategory,
  type ExerciseTier,
  type ExercisePlanKey,
} from "@/lib/exerciseService";
import strengthImg from "@/assets/exercise-strength.jpg";
import resistanceImg from "@/assets/exercise-resistance.jpg";
import SessionsGoalConfigCard from "@/components/admin/SessionsGoalConfigCard";

type ViewTab = "catalog" | "badges";
type TierFilter = "all" | ExerciseTier;

interface EditForm {
  name: string;
  category_id: string;
  tier: ExerciseTier;
  reps_duration: string;
  sets: string;
  youtube_url: string;
  image_url: string;
  icon: string;
  instructions: string;
  benefits: string;
  cautions: string;
  knee_pain_substitute: string;
}

function toForm(e: Exercise): EditForm {
  return {
    name: e.name,
    category_id: e.category_id,
    tier: e.tier,
    reps_duration: e.reps_duration,
    sets: e.sets,
    youtube_url: e.youtube_url,
    image_url: e.image_url ?? "",
    icon: e.icon ?? "🏋️",
    instructions: e.instructions ?? "",
    benefits: e.benefits ?? "",
    cautions: e.cautions ?? "",
    knee_pain_substitute: e.knee_pain_substitute ?? "",
  };
}

function fallbackImage(categorySlug: string): string {
  return categorySlug === "resistance_training" ? resistanceImg : strengthImg;
}

export default function AdminExercises() {
  const confirm = useConfirm();
  const [view, setView] = useState<ViewTab>("catalog");
  const [tier, setTier] = useState<TierFilter>("all");
  const [categoryId, setCategoryId] = useState<string>("all");

  const [categories, setCategories] = useState<ExerciseCategory[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [badges, setBadges] = useState<ExerciseBadge[]>([]);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<Exercise | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [thumbPreview, setThumbPreview] = useState<string | null>(null);
  const [thumbUploading, setThumbUploading] = useState(false);
  const thumbInputRef = useRef<HTMLInputElement | null>(null);

  const [editingBadge, setEditingBadge] = useState<ExerciseBadge | null>(null);
  const [badgeForm, setBadgeForm] = useState<Partial<ExerciseBadge> | null>(null);

  const categoryMap = useMemo(() => {
    const m = new Map<string, ExerciseCategory>();
    categories.forEach((c) => m.set(c.id, c));
    return m;
  }, [categories]);

  async function reload() {
    setLoading(true);
    try {
      const [cats, exs, bds] = await Promise.all([listCategories(), listExercises(), listBadges()]);
      setCategories(cats);
      setExercises(exs);
      setBadges(bds);
    } catch (e: any) {
      toast({ title: "Failed to load", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  const filtered = useMemo(() => {
    return exercises.filter((e) => {
      if (tier !== "all" && e.tier !== tier) return false;
      if (categoryId !== "all" && e.category_id !== categoryId) return false;
      return true;
    });
  }, [exercises, tier, categoryId]);

  const counts = useMemo(
    () => ({
      total: exercises.length,
      foundation: exercises.filter((e) => e.tier === 1).length,
      active: exercises.filter((e) => e.tier === 2).length,
      intensive: exercises.filter((e) => e.tier === 3).length,
    }),
    [exercises],
  );

  function openNew() {
    setIsNew(true);
    setEditing({
      id: "__new__",
      name: "",
      category_id: categories[0]?.id ?? "",
      tier: 1,
      plan_key: "foundation",
      reps_duration: "",
      sets: "",
      youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      image_url: null,
      icon: "🏋️",
      instructions: "",
      benefits: "",
      cautions: "",
      knee_pain_substitute: "",
      sort_order: 999,
      enabled: true,
    });
    setForm({
      name: "",
      category_id: categories[0]?.id ?? "",
      tier: 1,
      reps_duration: "",
      sets: "2–3",
      youtube_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      image_url: "",
      icon: "🏋️",
      instructions: "",
      benefits: "",
      cautions: "",
      knee_pain_substitute: "",
    });
  }

  function openEdit(e: Exercise) {
    setIsNew(false);
    setEditing(e);
    setForm(toForm(e));
    setThumbFile(null);
    setThumbPreview(null);
  }

  function closeEdit() {
    setEditing(null);
    setForm(null);
    setIsNew(false);
    setThumbFile(null);
    setThumbPreview(null);
  }

  function onSelectThumbFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image.", variant: "destructive" });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: "Too large", description: "Max 3MB.", variant: "destructive" });
      return;
    }
    setThumbFile(file);
    fileToDataUrl(file).then((url) => setThumbPreview(url));
  }

  async function save() {
    if (!editing || !form) return;
    if (!form.name.trim() || !form.category_id) {
      toast({ title: "Missing details", description: "Name and category are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Upload thumbnail (if user picked one) before saving row
      let nextImageUrl: string | null = form.image_url?.trim() ? form.image_url.trim() : editing.image_url ?? null;
      if (thumbFile) {
        setThumbUploading(true);
        try {
          nextImageUrl = await uploadExerciseThumbnail(editing.id === "__new__" ? "new" : editing.id, thumbFile);
        } finally {
          setThumbUploading(false);
        }
      }

      const payload = {
        name: form.name.trim(),
        category_id: form.category_id,
        tier: form.tier,
        plan_key: PLAN_FOR_TIER[form.tier],
        reps_duration: form.reps_duration.trim(),
        sets: form.sets.trim(),
        youtube_url: normalizeYoutubeUrl(form.youtube_url),
        image_url: nextImageUrl,
        icon: form.icon || "🏋️",
        instructions: form.instructions,
        benefits: form.benefits,
        cautions: form.cautions,
        knee_pain_substitute: form.knee_pain_substitute,
      };

      if (isNew) {
        const created = await createExercise(payload);
        logAudit({ module: "Exercises", action: "create", target_id: created.id, target_label: created.name });
        toast({ title: "Exercise added", description: created.name });
      } else {
        await updateExercise(editing.id, payload);
        logAudit({ module: "Exercises", action: "update", target_id: editing.id, target_label: form.name });
        toast({ title: "Exercise updated", description: form.name });
      }
      await reload();
      closeEdit();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function remove(e: Exercise) {
    if (!(await confirm({ title: "Delete exercise?", description: `Delete "${e.name}"? This cannot be undone.`, destructive: true, confirmText: "Delete" }))) return;
    try {
      await deleteExercise(e.id);
      logAudit({ module: "Exercises", action: "delete", target_id: e.id, target_label: e.name });
      toast({ title: "Deleted", description: e.name });
      await reload();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message ?? String(err), variant: "destructive" });
    }
  }

  async function toggleEnabled(e: Exercise, next: boolean) {
    try {
      await toggleExerciseEnabled(e.id, next);
      setExercises((prev) => prev.map((x) => (x.id === e.id ? { ...x, enabled: next } : x)));
      logAudit({
        module: "Exercises",
        action: "update",
        target_id: e.id,
        target_label: `${e.name} ${next ? "enabled" : "disabled"}`,
      });
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message ?? String(err), variant: "destructive" });
    }
  }

  async function saveBadge() {
    if (!editingBadge || !badgeForm) return;
    try {
      await updateBadge(editingBadge.id, {
        name: badgeForm.name ?? editingBadge.name,
        description: badgeForm.description ?? editingBadge.description,
        icon: badgeForm.icon ?? editingBadge.icon,
        color: badgeForm.color ?? editingBadge.color,
        tier_required: (badgeForm.tier_required as ExerciseTier) ?? editingBadge.tier_required,
      });
      toast({ title: "Badge updated", description: badgeForm.name ?? editingBadge.name });
      setEditingBadge(null);
      setBadgeForm(null);
      await reload();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message ?? String(err), variant: "destructive" });
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary uppercase tracking-wider">
            <Dumbbell className="w-3.5 h-3.5" /> Exercise
          </div>
          <h2 className="mt-2 text-2xl font-black text-foreground">Exercise Library</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Strength & resistance training programs across Foundation, Active, and Intensive care. Visible to users based on
            their package tier.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={openNew} className="bg-[var(--bbdo-red)] hover:bg-[var(--bbdo-red)]/90 text-white">
            <Plus className="w-4 h-4 mr-1" /> New exercise
          </Button>
          <ExportCsvButton filename="exercises" rows={filtered as any} />
<ImportCsvButton table="exercises" onImported={() => window.location.reload()} />
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total", value: counts.total, color: "#0F1A3D" },
          { label: PLAN_LABEL.foundation, value: counts.foundation, color: TIER_COLOR[1] },
          { label: PLAN_LABEL.active, value: counts.active, color: TIER_COLOR[2] },
          { label: PLAN_LABEL.intensive, value: counts.intensive, color: TIER_COLOR[3] },
        ].map((item) => (
          <div key={item.label} className="liquid-glass rounded-2xl px-4 py-3">
            <div
              className="inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white"
              style={{ backgroundColor: item.color }}
            >
              {item.label}
            </div>
            <p className="mt-3 text-2xl font-black text-foreground">{item.value}</p>
          </div>
        ))}
      </div>

      <SessionsGoalConfigCard
        title="Daily Exercise Goal"
        description="Total minutes users should exercise per day, broken into sessions used for nudges and completion tracking."
        totalSettingKey="exercise_daily_minutes"
        sessionsSettingKey="exercise_sessions"
        defaultTotal={30}
        defaultSessions={[
          { label: "Morning", minutes: 10 },
          { label: "Afternoon", minutes: 10 },
          { label: "Evening", minutes: 10 },
        ]}
      />


      {/* View tabs */}
      <div className="flex gap-2 border-b">
        {[
          { id: "catalog" as const, label: "Catalog", icon: Dumbbell },
          { id: "badges" as const, label: "Badges", icon: Award },
        ].map((t) => {
          const Icon = t.icon;
          const active = view === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className={cn(
                "inline-flex items-center gap-2 h-10 px-4 -mb-px border-b-2 text-sm font-semibold transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* Catalog view */}
      {view === "catalog" && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mr-1">
              <Filter className="w-3.5 h-3.5" /> Filters
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "all", label: "All tiers", color: "#64748B" },
                  { id: 1, label: PLAN_LABEL.foundation, color: TIER_COLOR[1] },
                  { id: 2, label: PLAN_LABEL.active, color: TIER_COLOR[2] },
                  { id: 3, label: PLAN_LABEL.intensive, color: TIER_COLOR[3] },
                ] as { id: TierFilter; label: string; color: string }[]
              ).map((t) => {
                const active = tier === t.id;
                return (
                  <button
                    key={String(t.id)}
                    onClick={() => setTier(t.id)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors",
                      active ? "text-white" : "text-muted-foreground hover:text-foreground bg-background",
                    )}
                    style={active ? { backgroundColor: t.color, borderColor: t.color } : { borderColor: "hsl(var(--border))" }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            <div className="h-4 w-px bg-border mx-1" />
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setCategoryId("all")}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors",
                  categoryId === "all"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                All categories
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoryId(c.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors",
                    categoryId === c.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground hover:text-foreground",
                  )}
                >
                  {c.icon} {c.name}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="liquid-glass rounded-3xl p-10 text-center text-sm text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> Loading exercises…
            </div>
          ) : filtered.length === 0 ? (
            <div className="liquid-glass rounded-3xl p-10 text-center text-sm text-muted-foreground">
              No exercises match this filter.
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {filtered.map((e, index) => {
                const cat = categoryMap.get(e.category_id);
                const img = e.image_url || (cat ? fallbackImage(cat.slug) : strengthImg);
                const yid = extractYoutubeId(e.youtube_url);
                const tierColor = TIER_COLOR[e.tier];
                return (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.02, 0.24), duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                      "liquid-glass rounded-3xl p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4 border-l-4 min-w-0 mobile-card-stack",
                      !e.enabled && "opacity-60",
                    )}
                    style={{ borderLeftColor: tierColor }}
                  >
                    <div
                      className="relative w-full sm:w-40 shrink-0 rounded-2xl overflow-hidden bg-muted mobile-media"
                      style={{ aspectRatio: "16 / 9" }}
                    >
                      <img src={img} alt={e.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      
                      {yid && (
                        <a
                          href={e.youtube_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute inset-0 flex items-center justify-center"
                          aria-label={`Watch ${e.name}`}
                        >
                          <Play className="w-6 h-6 text-white" fill="currentColor" />
                        </a>
                      )}
                    </div>
                    <div className="min-w-0 flex-1 w-full">
                      <div className="flex items-start sm:items-center flex-wrap gap-2 mobile-wrap-between">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white"
                          style={{ backgroundColor: tierColor }}
                        >
                          {PLAN_LABEL[e.plan_key]}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                          {cat?.name}
                        </span>
                        <div className="sm:ml-auto flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-muted-foreground">{e.enabled ? "On" : "Off"}</span>
                          <Switch
                            checked={e.enabled}
                            onCheckedChange={(v) => toggleEnabled(e, v)}
                            aria-label="Enable exercise"
                          />
                        </div>
                      </div>
                      <h3 className="mt-1 text-base font-bold text-foreground leading-snug">{e.name}</h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>
                          <span className="font-semibold text-foreground">{e.reps_duration || "—"}</span>{" "}
                          <span className="mx-1">·</span>{" "}
                          <span className="font-semibold text-foreground">{e.sets || "—"}</span> sets
                        </span>
                      </div>
                      {e.knee_pain_substitute && (
                        <p className="mt-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                          Knee pain sub: {e.knee_pain_substitute}
                        </p>
                      )}
                      <div className="mt-2.5 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 mobile-action-stack">
                        <button
                          onClick={() => openEdit(e)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground px-3 py-2 sm:py-1.5 text-[11px] font-semibold text-background transition-opacity hover:opacity-90"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                        {yid && (
                          <a
                            href={e.youtube_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-muted px-3 py-2 sm:py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3 w-3" /> YouTube
                          </a>
                        )}
                        <button
                          onClick={() => remove(e)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-destructive/10 px-3 py-2 sm:py-1.5 text-[11px] font-semibold text-destructive hover:opacity-80"
                        >
                          <Trash2 className="h-3 w-3" /> Delete
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Badges view */}
      {view === "badges" && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {badges.map((b) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="liquid-glass rounded-3xl p-5"
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0"
                  style={{ backgroundColor: `${b.color}20`, color: b.color }}
                >
                  <Dumbbell className="w-6 h-6" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-foreground">{b.name}</h3>
                    <span
                      className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
                      style={{ backgroundColor: TIER_COLOR[b.tier_required] }}
                    >
                      Tier {b.tier_required}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{b.description}</p>
                  <pre className="mt-2 text-[10px] font-mono text-muted-foreground/70 bg-muted rounded-lg p-2 overflow-x-auto">
                    {JSON.stringify(b.criteria_json, null, 0)}
                  </pre>
                  <button
                    onClick={() => {
                      setEditingBadge(b);
                      setBadgeForm(b);
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-foreground px-3 py-1.5 text-[11px] font-semibold text-background hover:opacity-90"
                  >
                    <Pencil className="h-3 w-3" /> Edit badge
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Exercise editor */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && closeEdit()}>
        <DialogContent className="max-w-2xl max-h-[calc(100dvh-1rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{form?.icon}</span>
              {isNew ? "Add new exercise" : "Edit exercise"}
            </DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4 py-2 min-w-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tier / Package</Label>
                  <Select
                    value={String(form.tier)}
                    onValueChange={(v) => setForm({ ...form, tier: Number(v) as ExerciseTier })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 · {PLAN_LABEL.foundation}</SelectItem>
                      <SelectItem value="2">2 · {PLAN_LABEL.active}</SelectItem>
                      <SelectItem value="3">3 · {PLAN_LABEL.intensive}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Reps / Duration</Label>
                  <Input
                    value={form.reps_duration}
                    placeholder="e.g. 10–15 reps"
                    onChange={(e) => setForm({ ...form, reps_duration: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Sets</Label>
                  <Input
                    value={form.sets}
                    placeholder="e.g. 2–3"
                    onChange={(e) => setForm({ ...form, sets: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Thumbnail</Label>
                  <div className="mt-1 flex items-start gap-3">
                    <div
                      className="relative w-40 shrink-0 rounded-2xl overflow-hidden bg-muted border border-border"
                      style={{ aspectRatio: "16 / 9" }}
                    >
                      {(thumbPreview || form.image_url) ? (
                        <img
                          src={thumbPreview || form.image_url}
                          alt="Thumbnail preview"
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                          <ImageIcon className="w-6 h-6" />
                        </div>
                      )}
                      {thumbUploading && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <input
                        ref={thumbInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onSelectThumbFile(f);
                          e.currentTarget.value = "";
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => thumbInputRef.current?.click()}
                      >
                        <Upload className="w-4 h-4 mr-1" />
                        {(thumbPreview || form.image_url) ? "Replace thumbnail" : "Upload thumbnail"}
                      </Button>
                      {(thumbPreview || form.image_url) && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setThumbFile(null);
                            setThumbPreview(null);
                            setForm({ ...form, image_url: "" });
                          }}
                        >
                          <X className="w-4 h-4 mr-1" /> Remove
                        </Button>
                      )}
                      <p className="text-[11px] text-muted-foreground">JPG, PNG or WEBP · up to 3MB · 16:9 recommended</p>
                    </div>
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label>YouTube Link</Label>
                  <Input
                    value={form.youtube_url}
                    placeholder="https://www.youtube.com/watch?v=…"
                    onChange={(e) => setForm({ ...form, youtube_url: e.target.value })}
                  />
                  {form.youtube_url && extractYoutubeId(form.youtube_url) && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Video ID: <span className="font-mono">{extractYoutubeId(form.youtube_url)}</span>
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <Label>Knee pain substitute (optional)</Label>
                  <Input
                    value={form.knee_pain_substitute}
                    onChange={(e) => setForm({ ...form, knee_pain_substitute: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>Benefits</Label>
                  <Textarea
                    rows={2}
                    value={form.benefits}
                    onChange={(e) => setForm({ ...form, benefits: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Instructions</Label>
                  <Textarea
                    rows={3}
                    value={form.instructions}
                    onChange={(e) => setForm({ ...form, instructions: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Cautions</Label>
                  <Textarea
                    rows={3}
                    value={form.cautions}
                    onChange={(e) => setForm({ ...form, cautions: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={closeEdit} disabled={saving}>
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Badge editor */}
      <Dialog
        open={!!editingBadge}
        onOpenChange={(o) => {
          if (!o) {
            setEditingBadge(null);
            setBadgeForm(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{badgeForm?.icon}</span>
              Edit badge
            </DialogTitle>
          </DialogHeader>
          {badgeForm && (
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={badgeForm.name ?? ""}
                  onChange={(e) => setBadgeForm({ ...badgeForm, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  rows={2}
                  value={badgeForm.description ?? ""}
                  onChange={(e) => setBadgeForm({ ...badgeForm, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Icon</Label>
                  <Input
                    value={badgeForm.icon ?? ""}
                    onChange={(e) => setBadgeForm({ ...badgeForm, icon: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Color</Label>
                  <Input
                    type="color"
                    value={badgeForm.color ?? "#248CCB"}
                    onChange={(e) => setBadgeForm({ ...badgeForm, color: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Tier</Label>
                  <Select
                    value={String(badgeForm.tier_required ?? 1)}
                    onValueChange={(v) => setBadgeForm({ ...badgeForm, tier_required: Number(v) as ExerciseTier })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Tier 1</SelectItem>
                      <SelectItem value="2">Tier 2</SelectItem>
                      <SelectItem value="3">Tier 3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditingBadge(null);
                setBadgeForm(null);
              }}
            >
              <X className="w-4 h-4 mr-1" /> Cancel
            </Button>
            <Button onClick={saveBadge}>
              <Save className="w-4 h-4 mr-1" /> Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

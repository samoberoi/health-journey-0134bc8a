import { useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, Play, Upload, RotateCcw, Loader2, Pencil, Save, X, Plus, Trash2, Target, Wind, Flower2, Lock, Dumbbell, type LucideIcon } from "lucide-react";

function extractYoutubeId(input: string): string {
  const s = input.trim();
  if (!s) return "";
  const patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = s.match(p);
    if (m) return m[1];
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
  return s;
}
import { videos, videoGroups, type VideoEntry, type VideoGroup, type VideoTag } from "@/lib/exerciseData";
import VideoPlayer from "@/components/exercises/VideoPlayer";
import { notifyVideoThumbnailsChanged, useVideoThumbnails } from "@/hooks/useVideoThumbnails";
import { useVideoMetadata } from "@/hooks/useVideoMetadata";
import {
  setVideoThumbnail,
  clearVideoThumbnail,
  fileToDataUrl,
} from "@/lib/videoThumbnailService";
import {
  setVideoMetadata,
  clearVideoMetadata,
  setVideoEnabled,
  createCustomVideo,
  deleteCustomVideo,
  type VideoMetadataOverride,
} from "@/lib/videoMetadataService";
import { toast } from "@/hooks/use-toast";
import { logAudit } from "@/lib/auditLog";
import ExportCsvButton from "@/components/admin/ExportCsvButton";
import ImportCsvButton from "@/components/admin/ImportCsvButton";
import SessionsGoalConfigCard from "@/components/admin/SessionsGoalConfigCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useConfirm } from "@/components/ConfirmProvider";

const GROUP_OPTIONS: VideoGroup[] = ["Pranayama", "Yoga Asana", "Bandha"];
const GROUP_ICONS: Record<string, LucideIcon> = {
  all: Target,
  Pranayama: Wind,
  "Yoga Asana": Flower2,
  Bandha: Lock,
};
const TAG_OPTIONS: VideoTag[] = [
  "Stress", "Diabetes", "Thyroid", "Digestion", "Flexibility",
  "Energy", "Sleep & Calm", "Focus", "Weight Loss", "Posture",
];

interface EditForm {
  name: string;
  category: string;
  icon: string;
  youtube_id: string;
  group_name: VideoGroup;
  tags: VideoTag[];
  benefits: string;
  suitable_for: string;
  not_suitable_for: string;
  dos: string;
  donts: string;
}

function videoToForm(v: VideoEntry): EditForm {
  return {
    name: v.name,
    category: v.category,
    icon: v.icon,
    youtube_id: v.youtubeUrl || (v.youtubeId ? `https://www.youtube.com/watch?v=${v.youtubeId}` : ""),
    group_name: v.group,
    tags: [...v.tags],
    benefits: v.benefits,
    suitable_for: v.suitableFor,
    not_suitable_for: v.notSuitableFor,
    dos: v.dos,
    donts: v.donts,
  };
}

export default function AdminVideos() {
  const confirm = useConfirm();
  const [group, setGroup] = useState<(typeof videoGroups)[number]["id"]>("all");
  const [active, setActive] = useState<VideoEntry | null>(null);
  const { overrides, loading: thumbnailsLoading, reload, resolve } = useVideoThumbnails();
  const { overrides: metaOverrides, loading: metadataLoading, reload: reloadMeta, resolveVideo, customVideos, disabledIds } = useVideoMetadata();
  const thumbFileInputRef = useRef<HTMLInputElement | null>(null);

  const [editing, setEditing] = useState<VideoEntry | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingThumbFile, setEditingThumbFile] = useState<File | null>(null);
  const [editingThumbPreview, setEditingThumbPreview] = useState<string | null>(null);
  const [editingThumbReset, setEditingThumbReset] = useState(false);

  const allVideos = useMemo(
    () => [...videos.map(resolveVideo), ...customVideos],
    [resolveVideo, customVideos],
  );

  const filtered = useMemo(
    () => allVideos.filter((v) => group === "all" || v.group === group),
    [group, allVideos],
  );

  const counts = useMemo(
    () => ({
      total: allVideos.length,
      pranayama: allVideos.filter((v) => v.group === "Pranayama").length,
      yoga: allVideos.filter((v) => v.group === "Yoga Asana").length,
    }),
    [allVideos],
  );

  function onSelectThumbFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please upload an image.", variant: "destructive" });
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: "Too large", description: "Max 3MB.", variant: "destructive" });
      return;
    }
    setEditingThumbFile(file);
    fileToDataUrl(file).then((url) => setEditingThumbPreview(url));
  }

  function openEditor(v: VideoEntry) {
    setEditing(v);
    setIsNew(false);
    setForm(videoToForm(v));
    setEditingThumbFile(null);
    setEditingThumbPreview(null);
    setEditingThumbReset(false);
  }

  function openNewVideo() {
    setEditing({
      id: "__new__",
      name: "",
      category: "",
      group: "Yoga Asana",
      tags: [],
      suitableFor: "",
      notSuitableFor: "",
      dos: "",
      donts: "",
      benefits: "",
      icon: "🎬",
      thumbnail: "",
      youtubeId: "",
      youtubeUrl: "",
    });
    setIsNew(true);
    setForm({
      name: "",
      category: "",
      icon: "🎬",
      youtube_id: "",
      group_name: "Yoga Asana",
      tags: [],
      benefits: "",
      suitable_for: "",
      not_suitable_for: "",
      dos: "",
      donts: "",
    });
    setEditingThumbFile(null);
    setEditingThumbPreview(null);
    setEditingThumbReset(false);
  }

  function closeEditor() {
    setEditing(null);
    setIsNew(false);
    setForm(null);
    setEditingThumbFile(null);
    setEditingThumbPreview(null);
    setEditingThumbReset(false);
  }

  async function saveMeta() {
    if (!editing || !form) return;
    if (isNew && (!form.name.trim() || !form.youtube_id.trim())) {
      toast({ title: "Missing details", description: "Name and YouTube ID are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const normalizedYoutubeId = extractYoutubeId(form.youtube_id);
      const patch: VideoMetadataOverride = {
        name: form.name,
        category: form.category,
        icon: form.icon,
        youtube_id: normalizedYoutubeId,
        group_name: form.group_name,
        tags: form.tags,
        benefits: form.benefits,
        suitable_for: form.suitable_for,
        not_suitable_for: form.not_suitable_for,
        dos: form.dos,
        donts: form.donts,
      };

      let targetId = editing.id;
      if (isNew) {
        targetId = await createCustomVideo({ ...patch, name: form.name, youtube_id: normalizedYoutubeId });
        if (editingThumbFile) {
          await setVideoThumbnail(targetId, editingThumbFile);
        }
      } else {
        await setVideoMetadata(editing.id, patch);
        if (editingThumbReset) {
          await clearVideoThumbnail(editing.id);
        } else if (editingThumbFile) {
          await setVideoThumbnail(editing.id, editingThumbFile);
        }
      }

      await reload();
      await reloadMeta();
      notifyVideoThumbnailsChanged();
      logAudit({
        module: "Videos",
        action: isNew ? "create" : "update",
        target_id: targetId,
        target_label: `${form.name} ${isNew ? "created" : "details"}`,
        metadata: patch as unknown as Record<string, unknown>,
      });
      toast({ title: isNew ? "Video added" : "Video updated", description: form.name });
      closeEditor();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function resetMeta() {
    if (!editing) return;
    setSaving(true);
    try {
      await clearVideoMetadata(editing.id);
      await reloadMeta();
      logAudit({
        module: "Videos",
        action: "delete",
        target_id: editing.id,
        target_label: `${editing.name} details reset`,
      });
      toast({ title: "Details reset", description: editing.name });
      closeEditor();
    } catch (e: any) {
      toast({ title: "Reset failed", description: e.message ?? String(e), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleEnabled(v: VideoEntry, next: boolean) {
    try {
      await setVideoEnabled(v.id, next);
      await reloadMeta();
      logAudit({
        module: "Videos",
        action: "update",
        target_id: v.id,
        target_label: `${v.name} ${next ? "enabled" : "disabled"}`,
      });
      toast({ title: next ? "Enabled" : "Disabled", description: v.name });
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message ?? String(e), variant: "destructive" });
    }
  }

  async function deleteVideo(v: VideoEntry) {
    if (!(await confirm({ title: "Delete video?", description: `Delete "${v.name}"? This cannot be undone.`, destructive: true, confirmText: "Delete" }))) return;
    try {
      await deleteCustomVideo(v.id);
      await reloadMeta();
      toast({ title: "Video deleted", description: v.name });
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message ?? String(e), variant: "destructive" });
    }
  }


  function toggleTag(t: VideoTag) {
    if (!form) return;
    setForm({
      ...form,
      tags: form.tags.includes(t) ? form.tags.filter((x) => x !== t) : [...form.tags, t],
    });
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 min-w-0 overflow-x-hidden">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 w-full lg:w-auto min-w-0">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-black text-foreground">Stress & Yoga</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Curated BBDO stress relief, pranayama & yoga sessions surfaced inside the app.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 mobile-action-stack">
            <Button onClick={openNewVideo} className="bg-[var(--bbdo-red)] hover:bg-[var(--bbdo-red)]/90 text-white w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-1" /> New video
            </Button>
            <ExportCsvButton filename="videos" rows={filtered as any} />
<ImportCsvButton table="videos" onImported={() => window.location.reload()} />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full lg:w-auto mobile-grid-2">
          {[
            { label: "Total", value: counts.total, accent: "text-primary bg-primary/10" },
            { label: "Pranayama", value: counts.pranayama, accent: "text-primary bg-primary/10" },
            { label: "Yoga", value: counts.yoga, accent: "text-accent-foreground bg-accent" },
          ].map((item) => (
            <div key={item.label} className="liquid-glass rounded-2xl px-3 sm:px-4 py-3 min-w-0">
              <div className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${item.accent}`}>
                {item.label}
              </div>
              <p className="mt-3 text-xl sm:text-2xl font-black text-foreground">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <SessionsGoalConfigCard
        title="Daily Stress & Yoga Goal"
        description="Total minutes users should spend on stress-relief & yoga per day, split into sessions used for nudges and completion tracking."
        totalSettingKey="yoga_stress_daily_minutes"
        sessionsSettingKey="yoga_stress_sessions"
        defaultTotal={20}
        defaultSessions={[
          { label: "Morning", minutes: 10 },
          { label: "Evening", minutes: 10 },
        ]}
      />



      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {videoGroups.map((g) => (
          <button
            key={g.id}
            onClick={() => setGroup(g.id)}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              group === g.id
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {(() => {
              const Icon = GROUP_ICONS[g.id] ?? Target;
              return <Icon className="w-4 h-4 mr-2 inline-block align-[-2px]" strokeWidth={1.75} />;
            })()}
            {g.label}
          </button>
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        {(thumbnailsLoading || metadataLoading) && Array.from({ length: 6 }).map((_, index) => (
          <div key={`video-skeleton-${index}`} className="liquid-glass rounded-3xl p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4 min-w-0 mobile-card-stack">
            <div className="w-full sm:w-40 shrink-0 rounded-2xl bg-muted animate-pulse mobile-media" style={{ aspectRatio: "16 / 9" }} />
            <div className="min-w-0 flex-1 space-y-3 py-1">
              <div className="h-3 w-24 rounded-full bg-muted animate-pulse" />
              <div className="h-4 w-44 rounded-full bg-muted animate-pulse" />
              <div className="h-3 w-full max-w-xs rounded-full bg-muted animate-pulse" />
              <div className="h-7 w-24 rounded-full bg-muted animate-pulse" />
            </div>
          </div>
        ))}
        {!(thumbnailsLoading || metadataLoading) && filtered.map((v, index) => {
          const thumb = resolve(v.id, v.thumbnail);
          const isThumbOverridden = !!overrides[v.id];
          const isMetaOverridden = !!metaOverrides[v.id];
          const isCustom = !!metaOverrides[v.id]?.is_custom;
          const isDisabled = disabledIds.has(v.id);
          return (
            <motion.div
              key={v.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`liquid-glass rounded-3xl p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4 min-w-0 mobile-card-stack ${isDisabled ? "opacity-60" : ""}`}
            >
              <button
                onClick={() => setActive({ ...v, thumbnail: thumb })}
                className="relative w-full sm:w-40 shrink-0 rounded-2xl overflow-hidden transition-opacity hover:opacity-90 mobile-media"
                style={{ aspectRatio: "16 / 9" }}
                aria-label={`Preview ${v.name}`}
              >
                <img src={thumb} alt={v.name} loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 flex items-center justify-center bg-background/30">
                  <Play className="w-6 h-6 text-primary-foreground" fill="currentColor" />
                </div>
                {isThumbOverridden && (
                  <span className="absolute top-1 left-1 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold text-primary-foreground">
                    Custom
                  </span>
                )}
              </button>
              <div className="min-w-0 flex-1 w-full">
                <div className="flex items-start sm:items-center justify-between gap-2 flex-wrap mobile-wrap-between">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {v.group}
                    </span>
                    {isCustom && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary uppercase tracking-wider">
                        New
                      </span>
                    )}
                    {isMetaOverridden && !isCustom && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-600 uppercase tracking-wider">
                        Edited
                      </span>
                    )}
                    {isDisabled && (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[9px] font-bold text-destructive uppercase tracking-wider">
                        Disabled
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{isDisabled ? "Off" : "On"}</span>
                    <Switch
                      checked={!isDisabled}
                      onCheckedChange={(next) => toggleEnabled(v, next)}
                      aria-label="Enable video"
                    />
                  </div>
                </div>
                <h3 className="mt-1 text-base font-bold text-foreground leading-snug">{v.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{v.benefits}</p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {v.tags.slice(0, 3).map((t) => (
                    <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[10px]">
                      {t}
                    </span>
                  ))}
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    <Eye className="h-3 w-3" /> Preview
                  </span>
                </div>
                <div className="mt-3 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2 mobile-action-stack">
                  <button
                    onClick={() => openEditor(v)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-full bg-foreground px-3 py-2 sm:py-1.5 text-[11px] font-semibold text-background transition-opacity hover:opacity-90"
                  >
                    <Pencil className="h-3 w-3" /> Edit details
                  </button>
                  {isCustom && (
                    <button
                      onClick={() => deleteVideo(v)}
                        className="inline-flex items-center justify-center gap-1.5 rounded-full bg-destructive/10 px-3 py-2 sm:py-1.5 text-[11px] font-semibold text-destructive transition-opacity hover:opacity-80"
                    >
                      <Trash2 className="h-3 w-3" /> Delete
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {!(thumbnailsLoading || metadataLoading) && filtered.length === 0 && (
        <div className="liquid-glass rounded-3xl p-10 text-center text-sm text-muted-foreground">
          No videos match this filter.
        </div>
      )}

      <AnimatePresence>
        {active && <VideoPlayer video={active} onClose={() => setActive(null)} />}
      </AnimatePresence>

      <Dialog open={!!editing} onOpenChange={(o) => !o && closeEditor()}>
        <DialogContent className="max-w-2xl max-h-[calc(100dvh-1rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="text-2xl">{form?.icon}</span> {isNew ? "Add new video" : "Edit video details"}
            </DialogTitle>
          </DialogHeader>
          {form && editing && (
            <div className="space-y-4 py-2 min-w-0">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-3 sm:gap-4">
                <div className="relative w-full sm:w-48 shrink-0 rounded-2xl overflow-hidden bg-muted" style={{ aspectRatio: "16 / 9" }}>
                  {(() => {
                    const previewSrc = editingThumbReset ? editing.thumbnail : editingThumbPreview ?? resolve(editing.id, editing.thumbnail);
                    return previewSrc ? (
                      <img
                        src={previewSrc}
                        alt={form.name || "Video thumbnail preview"}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                        <Play className="w-7 h-7" />
                        <span className="text-xs font-semibold">Thumbnail preview</span>
                      </div>
                    );
                  })()}
                  {!!overrides[editing.id] && !editingThumbReset && (
                    <span className="absolute top-1 left-1 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold text-primary-foreground">
                      Custom
                    </span>
                  )}
                  {editingThumbFile && !editingThumbReset && (
                    <span className="absolute top-1 right-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold text-white">
                      Pending
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2 min-w-0">
                  <input
                    ref={thumbFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onSelectThumbFile(f);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => thumbFileInputRef.current?.click()}
                    disabled={saving}
                  >
                    <Upload className="w-4 h-4 mr-1" />
                    {!!overrides[editing.id] ? "Replace thumbnail" : "Upload thumbnail"}
                  </Button>
                  {!!overrides[editing.id] && !editingThumbReset ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setEditingThumbReset(true)}
                      disabled={saving}
                    >
                      <RotateCcw className="w-4 h-4 mr-1" /> Reset thumbnail
                    </Button>
                  ) : editingThumbReset ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setEditingThumbReset(false)}
                      disabled={saving}
                    >
                      Undo thumbnail reset
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div>
                  <Label>Category</Label>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                </div>
                <div>
                  <Label>Group</Label>
                  <Select
                    value={form.group_name}
                    onValueChange={(v) => setForm({ ...form, group_name: v as VideoGroup })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GROUP_OPTIONS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Icon (emoji)</Label>
                  <Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <Label>YouTube Link</Label>
                  <Input
                    value={form.youtube_id}
                    placeholder="https://www.youtube.com/watch?v=..."
                    onChange={(e) => setForm({ ...form, youtube_id: e.target.value })}
                  />
                  {form.youtube_id && extractYoutubeId(form.youtube_id) !== form.youtube_id && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Video ID: <span className="font-mono">{extractYoutubeId(form.youtube_id)}</span>
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {TAG_OPTIONS.map((t) => {
                    const on = form.tags.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleTag(t)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                          on ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Main benefits</Label>
                <Textarea rows={2} value={form.benefits} onChange={(e) => setForm({ ...form, benefits: e.target.value })} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Suitable for</Label>
                  <Textarea rows={3} value={form.suitable_for} onChange={(e) => setForm({ ...form, suitable_for: e.target.value })} />
                </div>
                <div>
                  <Label>Not suitable for</Label>
                  <Textarea rows={3} value={form.not_suitable_for} onChange={(e) => setForm({ ...form, not_suitable_for: e.target.value })} />
                </div>
                <div>
                  <Label>Do's</Label>
                  <Textarea rows={3} value={form.dos} onChange={(e) => setForm({ ...form, dos: e.target.value })} />
                </div>
                <div>
                  <Label>Don'ts</Label>
                  <Textarea rows={3} value={form.donts} onChange={(e) => setForm({ ...form, donts: e.target.value })} />
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
            {!isNew ? (
              <Button
                type="button"
                variant="ghost"
                onClick={resetMeta}
                disabled={saving || !editing || !metaOverrides[editing.id]}
              >
                <RotateCcw className="w-4 h-4 mr-1" /> Reset to default
              </Button>
            ) : <span className="hidden sm:block" />}
            <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
              <Button type="button" variant="outline" onClick={closeEditor} disabled={saving}>
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
              <Button type="button" onClick={saveMeta} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

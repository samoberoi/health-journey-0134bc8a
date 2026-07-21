import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useConfirm } from "@/components/ConfirmProvider";
import { logAudit } from "@/lib/auditLog";
import ExportCsvButton from "@/components/admin/ExportCsvButton";
import ImportCsvButton from "@/components/admin/ImportCsvButton";
import { Plus, Pencil, Trash2, Search, HeartPulse, Check, ChevronsUpDown, Settings2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

type Action = "avoid" | "limit" | "encourage";

interface Condition {
  id: string;
  key: string;
  label: string;
  emoji: string | null;
  icon_url: string | null;
  sort_order: number;
  is_active: boolean;
}


interface Rule {
  id: string;
  condition_key: string;
  action: Action;
  name_pattern: string;
  filter_id: string | null;
  reason: string;
  priority: number;
  is_active: boolean;
  updated_at?: string;
}

interface FilterRow { id: string; name: string; slug: string; }
interface FoodOption { id: string; name: string; filter_id: string | null; }

const ACTIONS: { value: Action; label: string; cls: string }[] = [
  { value: "avoid",     label: "Avoid",     cls: "bg-destructive/10 text-destructive border-destructive/30" },
  { value: "limit",     label: "Limit",     cls: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  { value: "encourage", label: "Encourage", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
];

const emptyRuleForm = (defaultKey: string): Omit<Rule, "id" | "updated_at"> => ({
  condition_key: defaultKey,
  action: "avoid",
  name_pattern: "",
  filter_id: null,
  reason: "",
  priority: 100,
  is_active: true,
});

const emptyConditionForm = (): Omit<Condition, "id"> => ({
  key: "",
  label: "",
  emoji: "",
  icon_url: null,
  sort_order: 100,
  is_active: true,
});


export default function AdminFoodConditionRules() {
  const confirm = useConfirm();
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [filters, setFilters] = useState<FilterRow[]>([]);
  const [foods, setFoods] = useState<FoodOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<"all" | Action>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [form, setForm] = useState(emptyRuleForm("hypothyroid"));
  const [selectedFoods, setSelectedFoods] = useState<string[]>([]); // names, used only when creating
  const [foodPickerOpen, setFoodPickerOpen] = useState(false);

  // Condition manager state
  const [condMgrOpen, setCondMgrOpen] = useState(false);
  const [condEditing, setCondEditing] = useState<Condition | null>(null);
  const [condForm, setCondForm] = useState(emptyConditionForm());
  const [condDialogOpen, setCondDialogOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    const [cRes, rRes, fRes, foodRes] = await Promise.all([
      (supabase as any).from("food_conditions").select("*").order("sort_order").order("label"),
      supabase.from("food_condition_rules").select("*").order("condition_key").order("priority", { ascending: false }),
      supabase.from("food_filters").select("id,name,slug").order("name"),
      supabase.from("food_items").select("id,name,filter_id").order("name"),
    ]);
    const conds = ((cRes.data as any[]) || []) as Condition[];
    setConditions(conds);
    setRules(((rRes.data as any[]) || []) as Rule[]);
    setFilters(((fRes.data as any[]) || []) as FilterRow[]);
    setFoods(((foodRes.data as any[]) || []) as FoodOption[]);
    setLoading(false);
    // Ensure form default key is valid
    if (conds.length && !conds.some((c) => c.key === form.condition_key)) {
      setForm((f) => ({ ...f, condition_key: conds[0].key }));
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const filterById = useMemo(() => new Map(filters.map((f) => [f.id, f])), [filters]);
  const conditionByKey = useMemo(() => new Map(conditions.map((c) => [c.key, c])), [conditions]);
  const activeConditions = useMemo(() => conditions.filter((c) => c.is_active), [conditions]);

  const foodsGrouped = useMemo(() => {
    const groups = new Map<string, { name: string; items: FoodOption[] }>();
    foods.forEach((fd) => {
      const key = fd.filter_id || "__uncategorized__";
      const name = fd.filter_id ? (filterById.get(fd.filter_id)?.name || "Uncategorized") : "Uncategorized";
      if (!groups.has(key)) groups.set(key, { name, items: [] });
      groups.get(key)!.items.push(fd);
    });
    return Array.from(groups.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [foods, filterById]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rules.filter((r) => {
      if (conditionFilter !== "all" && r.condition_key !== conditionFilter) return false;
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (!q) return true;
      return (
        r.name_pattern.toLowerCase().includes(q) ||
        r.reason.toLowerCase().includes(q)
      );
    });
  }, [rules, search, conditionFilter, actionFilter]);

  const countsByCondition = useMemo(() => {
    const map: Record<string, number> = {};
    rules.forEach((r) => { map[r.condition_key] = (map[r.condition_key] || 0) + 1; });
    return map;
  }, [rules]);

  const openNew = () => {
    setEditing(null);
    setForm(emptyRuleForm(activeConditions[0]?.key || "hypothyroid"));
    setSelectedFoods([]);
    setDialogOpen(true);
  };
  const openEdit = (r: Rule) => {
    setEditing(r);
    setForm({
      condition_key: r.condition_key, action: r.action,
      name_pattern: r.name_pattern, filter_id: r.filter_id,
      reason: r.reason, priority: r.priority, is_active: r.is_active,
    });
    setSelectedFoods([]);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.reason.trim()) { toast.error("Reason is required"); return; }
    const basePayload = {
      condition_key: form.condition_key,
      action: form.action,
      filter_id: form.filter_id || null,
      reason: form.reason.trim(),
      priority: Number(form.priority) || 100,
      is_active: form.is_active,
    };
    if (editing) {
      if (!form.name_pattern.trim()) { toast.error("Food is required"); return; }
      const payload = { ...basePayload, name_pattern: form.name_pattern.trim().toLowerCase() };
      const { error } = await supabase.from("food_condition_rules").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      logAudit({ module: "Diet", action: "update", target_type: "rule", target_id: editing.id, target_label: `${payload.condition_key}: ${payload.name_pattern}` });
      toast.success("Rule updated");
    } else {
      if (selectedFoods.length === 0) { toast.error("Pick at least one food"); return; }
      const rows = selectedFoods.map((n) => ({ ...basePayload, name_pattern: n.trim().toLowerCase() }));
      const { error } = await supabase.from("food_condition_rules").insert(rows);
      if (error) { toast.error(error.message); return; }
      logAudit({ module: "Diet", action: "create", target_type: "rule", target_label: `${basePayload.condition_key}: ${rows.length} foods` });
      toast.success(`Created ${rows.length} rule${rows.length === 1 ? "" : "s"}`);
    }
    setDialogOpen(false);
    load();
  };

  const handleDelete = async (r: Rule) => {
    const ok = await confirm({
      title: "Delete rule?",
      description: `Remove "${r.name_pattern}" for ${conditionByKey.get(r.condition_key)?.label}?`,
      confirmText: "Delete",
    });
    if (!ok) return;
    const { error } = await supabase.from("food_condition_rules").delete().eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    logAudit({ module: "Diet", action: "delete", target_type: "rule", target_id: r.id, target_label: `${r.condition_key}: ${r.name_pattern}` });
    toast.success("Deleted");
    load();
  };

  const toggleActive = async (r: Rule) => {
    const { error } = await supabase.from("food_condition_rules").update({ is_active: !r.is_active }).eq("id", r.id);
    if (error) { toast.error(error.message); return; }
    load();
  };

  // ---------- Condition CRUD ----------
  const openNewCondition = () => {
    setCondEditing(null);
    setCondForm(emptyConditionForm());
    setCondDialogOpen(true);
  };
  const openEditCondition = (c: Condition) => {
    setCondEditing(c);
    setCondForm({ key: c.key, label: c.label, emoji: c.emoji || "", icon_url: c.icon_url || null, sort_order: c.sort_order, is_active: c.is_active });
    setCondDialogOpen(true);
  };
  const slugify = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const handleSaveCondition = async () => {
    const key = slugify(condForm.key || condForm.label);
    if (!key) { toast.error("Key is required"); return; }
    if (!condForm.label.trim()) { toast.error("Label is required"); return; }
    const payload = {
      key,
      label: condForm.label.trim(),
      emoji: (condForm.emoji || "").trim() || null,
      icon_url: condForm.icon_url || null,
      sort_order: Number(condForm.sort_order) || 100,
      is_active: condForm.is_active,
    };

    if (condEditing) {
      // If key changed, cascade-update existing rules to new key
      const keyChanged = condEditing.key !== key;
      const { error } = await (supabase as any).from("food_conditions").update(payload).eq("id", condEditing.id);
      if (error) { toast.error(error.message); return; }
      if (keyChanged) {
        const { error: rErr } = await supabase.from("food_condition_rules")
          .update({ condition_key: key }).eq("condition_key", condEditing.key);
        if (rErr) { toast.error(`Rules re-key failed: ${rErr.message}`); return; }
      }
      logAudit({ module: "Diet", action: "update", target_type: "condition", target_id: condEditing.id, target_label: payload.label });
      toast.success("Condition updated");
    } else {
      const { error } = await (supabase as any).from("food_conditions").insert(payload);
      if (error) { toast.error(error.message); return; }
      logAudit({ module: "Diet", action: "create", target_type: "condition", target_label: payload.label });
      toast.success("Condition created");
    }
    setCondDialogOpen(false);
    load();
  };
  const handleDeleteCondition = async (c: Condition) => {
    const usageCount = countsByCondition[c.key] || 0;
    if (usageCount > 0) {
      toast.error(`Cannot delete — ${usageCount} rule${usageCount > 1 ? "s" : ""} still reference this condition. Reassign or delete those rules first.`);
      return;
    }
    const ok = await confirm({
      title: "Delete condition?",
      description: `Remove "${c.label}" from the list? This cannot be undone.`,
      confirmText: "Delete",
    });
    if (!ok) return;
    const { error } = await (supabase as any).from("food_conditions").delete().eq("id", c.id);
    if (error) { toast.error(error.message); return; }
    logAudit({ module: "Diet", action: "delete", target_type: "condition", target_id: c.id, target_label: c.label });
    toast.success("Condition deleted");
    load();
  };

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <HeartPulse className="w-6 h-6 text-primary" />
            Food ↔ Condition Rules
          </h2>
          <p className="text-muted-foreground text-sm">
            Tag foods to auto-flag <b>avoid</b>, <b>limit</b>, or <b>encourage</b> for users with specific
            clinical conditions. {rules.length} total rules · {conditions.length} conditions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCondMgrOpen(true)}>
            <Settings2 className="w-4 h-4 mr-2" />Manage Conditions
          </Button>
          <ExportCsvButton filename="food_condition_rules" rows={rules as any} />
          <ImportCsvButton table="food_condition_rules" onImported={() => window.location.reload()} />
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Add Rule</Button>
        </div>
      </div>

      {/* Condition summary chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setConditionFilter("all")}
          className={`px-3 py-1.5 rounded-full text-sm border transition ${
            conditionFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"
          }`}
        >
          All · {rules.length}
        </button>
        {conditions.map((c) => (
          <button
            key={c.key}
            onClick={() => setConditionFilter(c.key)}
            className={`px-3 py-1.5 rounded-full text-sm border transition ${
              conditionFilter === c.key ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-muted"
            } ${c.is_active ? "" : "opacity-60"}`}
          >
            {c.icon_url && <img src={c.icon_url} alt="" className="inline w-4 h-4 mr-1 align-text-bottom" />} {c.label} · {countsByCondition[c.key] || 0}
          </button>
        ))}
      </div>

      {/* Search + action filter */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search food pattern or reason..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={actionFilter} onValueChange={(v) => setActionFilter(v as any)}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Condition</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Food pattern</TableHead>
              <TableHead>Scope (filter)</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="text-center">Priority</TableHead>
              <TableHead className="text-center">Active</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : visible.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No rules match</TableCell></TableRow>
            ) : visible.map((r) => {
              const cond = conditionByKey.get(r.condition_key);
              const act = ACTIONS.find((a) => a.value === r.action)!;
              return (
                <TableRow key={r.id} className={r.is_active ? "" : "opacity-50"}>
                  <TableCell><Badge variant="outline" className="gap-1">{cond?.icon_url && <img src={cond.icon_url} alt="" className="w-4 h-4" />} {cond?.label || r.condition_key}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={act.cls}>{act.label}</Badge></TableCell>
                  <TableCell className="font-mono text-sm">{r.name_pattern}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.filter_id ? filterById.get(r.filter_id)?.name || "—" : <span className="italic">All foods</span>}
                  </TableCell>
                  <TableCell className="text-sm max-w-[360px]"><span className="line-clamp-2">{r.reason}</span></TableCell>
                  <TableCell className="text-center">{r.priority}</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(r)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Edit rule dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Rule" : "Add Food ↔ Condition Rule"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Condition *</Label>
                <Select value={form.condition_key} onValueChange={(v) => setForm((f) => ({ ...f, condition_key: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {activeConditions.map((c) => (
                      <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Action *</Label>
                <Select value={form.action} onValueChange={(v) => setForm((f) => ({ ...f, action: v as Action }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTIONS.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Food{editing ? "" : "s"} *</Label>
              <Popover open={foodPickerOpen} onOpenChange={setFoodPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={foodPickerOpen}
                    className={cn(
                      "w-full justify-between font-normal h-auto min-h-10 py-2",
                      !editing && selectedFoods.length === 0 && !form.name_pattern && "text-muted-foreground",
                    )}
                  >
                    <span className="flex flex-wrap gap-1 text-left">
                      {editing ? (
                        foods.find((fd) => fd.name.toLowerCase() === form.name_pattern.toLowerCase())?.name ?? form.name_pattern ?? "Pick a food…"
                      ) : selectedFoods.length === 0 ? (
                        "Pick one or more foods…"
                      ) : (
                        selectedFoods.map((n) => (
                          <Badge key={n} variant="secondary" className="font-normal">{n}</Badge>
                        ))
                      )}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
                  <Command>
                    <CommandInput placeholder="Search foods…" />
                    <CommandList className="max-h-72">
                      <CommandEmpty>No food found. Add it in Foods first.</CommandEmpty>
                      <CommandGroup>
                        {foods.map((fd) => {
                          const selected = editing
                            ? form.name_pattern.toLowerCase() === fd.name.toLowerCase()
                            : selectedFoods.includes(fd.name);
                          return (
                            <CommandItem
                              key={fd.id}
                              value={fd.name}
                              onSelect={() => {
                                if (editing) {
                                  setForm((f) => ({ ...f, name_pattern: fd.name }));
                                  setFoodPickerOpen(false);
                                } else {
                                  setSelectedFoods((prev) =>
                                    prev.includes(fd.name) ? prev.filter((n) => n !== fd.name) : [...prev, fd.name],
                                  );
                                }
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", selected ? "opacity-100" : "opacity-0")} />
                              {fd.name}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground mt-1">
                {editing
                  ? `Only foods from the master Foods list can be mapped. ${foods.length} available.`
                  : `Select multiple foods to create one rule per food with the same action & reason. ${selectedFoods.length} selected of ${foods.length}.`}
              </p>
            </div>


            <div>
              <Label>Scope to filter (optional)</Label>
              <Select
                value={form.filter_id || "__all__"}
                onValueChange={(v) => setForm((f) => ({ ...f, filter_id: v === "__all__" ? null : v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All food filters</SelectItem>
                  {filters.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reason (shown to user) *</Label>
              <Textarea
                rows={2}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. High iodine — avoid with hypothyroidism"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
              <div>
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))}
                />
                <p className="text-xs text-muted-foreground mt-1">Higher wins when multiple rules of the same action match.</p>
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
                <Label>Active</Label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? "Update" : "Create"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Conditions dialog */}
      <Dialog open={condMgrOpen} onOpenChange={setCondMgrOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Manage Conditions</DialogTitle>
          </DialogHeader>
          <div className="flex justify-between items-center mb-2">
            <p className="text-sm text-muted-foreground">
              Add, edit, or remove clinical conditions. A condition in use by any rule cannot be deleted.
            </p>
            <Button size="sm" onClick={openNewCondition}><Plus className="w-4 h-4 mr-1" />Add Condition</Button>
          </div>
          <div className="rounded-xl border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Condition</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead className="text-center">Order</TableHead>
                  <TableHead className="text-center">Rules</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conditions.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-muted-foreground">No conditions yet</TableCell></TableRow>
                ) : conditions.map((c) => {
                  const uses = countsByCondition[c.key] || 0;
                  return (
                    <TableRow key={c.id} className={c.is_active ? "" : "opacity-60"}>
                      <TableCell><Badge variant="outline" className="gap-1">{c.icon_url && <img src={c.icon_url} alt="" className="w-4 h-4" />} {c.label}</Badge></TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{c.key}</TableCell>
                      <TableCell className="text-center">{c.sort_order}</TableCell>
                      <TableCell className="text-center">{uses}</TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={c.is_active}
                          onCheckedChange={async () => {
                            const { error } = await (supabase as any).from("food_conditions").update({ is_active: !c.is_active }).eq("id", c.id);
                            if (error) { toast.error(error.message); return; }
                            load();
                          }}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEditCondition(c)}><Pencil className="w-4 h-4" /></Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteCondition(c)}
                          disabled={uses > 0}
                          title={uses > 0 ? `In use by ${uses} rule(s)` : "Delete"}
                        >
                          <Trash2 className={cn("w-4 h-4", uses > 0 ? "text-muted-foreground" : "text-destructive")} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Condition create/edit dialog */}
      <Dialog open={condDialogOpen} onOpenChange={setCondDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{condEditing ? "Edit Condition" : "Add Condition"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Label *</Label>
              <Input
                value={condForm.label}
                onChange={(e) => setCondForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Insulin Resistance"
              />
            </div>
            <div>
              <Label>Key {condEditing ? "" : "(auto from label if empty)"}</Label>
              <Input
                value={condForm.key}
                onChange={(e) => setCondForm((f) => ({ ...f, key: e.target.value }))}
                placeholder="insulin_resistance"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Lowercase, snake_case identifier used internally. Renaming will re-key all existing rules.
              </p>
            </div>
            <div>
              <Label>Icon image</Label>
              <div className="flex items-center gap-3 mt-1">
                <div className="w-14 h-14 rounded-lg border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                  {condForm.icon_url ? (
                    <img src={condForm.icon_url} alt="" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">No icon</span>
                  )}

                </div>
                <div className="flex-1 space-y-2">
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const ext = (file.name.split(".").pop() || "png").toLowerCase();
                      const key = slugify(condForm.key || condForm.label) || `cond-${Date.now()}`;
                      const path = `${key}-${Date.now()}.${ext}`;
                      const { error } = await supabase.storage.from("condition-icons").upload(path, file, { upsert: true, contentType: file.type });
                      if (error) { toast.error(error.message); return; }
                      // Bucket is private (workspace blocks public buckets), so mint a long-lived signed URL.
                      const tenYears = 60 * 60 * 24 * 365 * 10;
                      const { data: signed, error: signErr } = await supabase.storage
                        .from("condition-icons")
                        .createSignedUrl(path, tenYears);
                      if (signErr || !signed?.signedUrl) { toast.error(signErr?.message || "Could not sign URL"); return; }
                      setCondForm((f) => ({ ...f, icon_url: signed.signedUrl }));
                      toast.success("Icon uploaded");
                    }}

                  />
                  {condForm.icon_url && (
                    <Button variant="ghost" size="sm" onClick={() => setCondForm((f) => ({ ...f, icon_url: null }))}>
                      Remove icon
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Recommended: square PNG on transparent background, at least 256×256.
              </p>
            </div>
            <div>
              <Label>Sort order</Label>
              <Input
                type="number"
                value={condForm.sort_order}
                onChange={(e) => setCondForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
              />
            </div>


            <div className="flex items-center gap-2">
              <Switch
                checked={condForm.is_active}
                onCheckedChange={(v) => setCondForm((f) => ({ ...f, is_active: v }))}
              />
              <Label>Active</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setCondDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCondition}>{condEditing ? "Update" : "Create"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

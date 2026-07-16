/**
 * Clinical condition ↔ food filter engine.
 *
 * Reads the user's deep-profiling data + saved conditions, fetches rule rows from
 * public.food_condition_rules, and returns a Map keyed by food_items.id with the
 * strongest applicable action ("avoid" > "limit" > "encourage") plus a human
 * reason. Used by Quick Food Reference (and anywhere else meals are listed) to
 * dim, skip, or emphasise foods automatically based on the person's health.
 */
import { supabase } from "@/integrations/supabase/client";
import type { FoodItem } from "@/components/diet/dietTypes";

export type ConditionAction = "avoid" | "limit" | "encourage";

/**
 * Condition keys are strings sourced from the `food_conditions` table in the DB.
 * Historically we hardcoded a union of keys here; that led to UI/DB drift (e.g.
 * "PMOS" vs "pcos"). The UI now fetches labels/emojis from the DB and passes a
 * meta map into deriveActiveConditions.
 */
export type ConditionKey = string;

export interface ActiveCondition {
  key: ConditionKey;
  label: string;
  emoji: string;
}

export interface FoodRuleHit {
  action: ConditionAction;
  reason: string;
  condition: ActiveCondition;
}

export interface ConditionRuleRow {
  id: string;
  condition_key: string;
  action: ConditionAction;
  name_pattern: string;
  filter_id: string | null;
  reason: string;
  priority: number;
}

// Fallback labels used only if the DB fetch fails. UI should prefer the meta
// map fetched from food_conditions.
const FALLBACK_META: Record<string, { label: string; emoji: string }> = {
  hypothyroid:     { label: "Hypothyroidism",   emoji: "🦋" },
  hyperthyroid:    { label: "Hyperthyroidism",  emoji: "🦋" },
  pcos:            { label: "PCOS",             emoji: "🌸" },
  ckd:             { label: "Kidney Disease",   emoji: "🫘" },
  kidney_stone:    { label: "Kidney Stones",    emoji: "🪨" },
  uric_acid:       { label: "High Uric Acid",   emoji: "🧪" },
  fatty_liver:     { label: "Fatty Liver",      emoji: "🫀" },
  iron_deficiency: { label: "Iron Deficiency",  emoji: "🩸" },
};

const RANK: Record<ConditionAction, number> = { avoid: 3, limit: 2, encourage: 1 };

/**
 * Derive which condition keys apply to a user's deep-profiling record.
 * The `metaMap` is typically fetched from `public.food_conditions` so labels
 * and emojis stay in sync with the admin console.
 */
export function deriveActiveConditions(
  deep: Record<string, any> | null | undefined,
  metaMap: Record<string, { label: string; emoji: string }> = FALLBACK_META,
  uricAcidThreshold = 7.0,
): ActiveCondition[] {
  if (!deep) return [];
  const out: ActiveCondition[] = [];
  const seen = new Set<string>();
  const push = (key: ConditionKey) => {
    if (seen.has(key)) return;
    seen.add(key);
    const meta = metaMap[key] ?? FALLBACK_META[key] ?? { label: key, emoji: "" };
    out.push({ key, label: meta.label, emoji: meta.emoji });
  };

  // Thyroid → hypo vs hyper
  const tt = String(deep.thyroidType || "").toLowerCase();
  const t  = String(deep.thyroid || "").toLowerCase();
  if (tt === "hypothyroid" || t === "hypothyroid") push("hypothyroid");
  else if (tt === "hyperthyroid" || t === "hyperthyroid") push("hyperthyroid");
  else if (t === "yes") push("hypothyroid"); // safest default when type unknown

  if (String(deep.pcos || "").toLowerCase() === "yes") push("pcos");
  if (String(deep.kidneyDisease || "").toLowerCase() === "yes") push("ckd");
  if (String(deep.kidneyStones || "").toLowerCase() === "yes") push("kidney_stone");
  if (String(deep.fattyLiver || "").toLowerCase() === "yes") push("fatty_liver");
  if (String(deep.ironDeficiency || "").toLowerCase() === "yes") push("iron_deficiency");

  const ua = Number(deep.uricAcid);
  if (Number.isFinite(ua) && ua >= uricAcidThreshold) push("uric_acid");

  return out;
}

export async function fetchConditionRules(keys: ConditionKey[]): Promise<ConditionRuleRow[]> {
  if (!keys.length) return [];
  const { data } = await supabase
    .from("food_condition_rules")
    .select("id,condition_key,action,name_pattern,filter_id,reason,priority")
    .in("condition_key", keys as string[])
    .eq("is_active", true);
  return ((data as ConditionRuleRow[]) || []);
}

/**
 * Build a Map from food_item.id -> the strongest rule hit for that food.
 * "avoid" beats "limit" beats "encourage". Ties broken by rule priority.
 */
export function buildFoodRuleMap(
  items: FoodItem[],
  rules: ConditionRuleRow[],
  active: ActiveCondition[],
): Map<string, FoodRuleHit> {
  const map = new Map<string, FoodRuleHit>();
  if (!rules.length || !active.length) return map;

  const conditionByKey = new Map(active.map((c) => [c.key, c] as const));

  for (const item of items) {
    const haystack = `${item.name} ${item.alt_name || ""}`.toLowerCase();
    let best: (FoodRuleHit & { priority: number }) | null = null;

    for (const rule of rules) {
      if (rule.filter_id && rule.filter_id !== item.filter_id) continue;
      if (!haystack.includes(rule.name_pattern.toLowerCase())) continue;

      const condition = conditionByKey.get(rule.condition_key as ConditionKey);
      if (!condition) continue;

      const rank = RANK[rule.action];
      const bestRank = best ? RANK[best.action] : -1;
      if (
        rank > bestRank ||
        (rank === bestRank && rule.priority > (best?.priority ?? -1))
      ) {
        best = { action: rule.action, reason: rule.reason, condition, priority: rule.priority };
      }
    }

    if (best) {
      const { priority: _p, ...hit } = best;
      map.set(item.id, hit);
    }
  }

  return map;
}

/**
 * Fetch the master list of health conditions the admin has configured.
 * Consumers use this to build the "Health filter" chip row and label map,
 * so UI stays in sync with backend edits (no hardcoded "PMOS" mismatches).
 */
export async function fetchFoodConditions(): Promise<
  { key: string; label: string; emoji: string; sort_order: number }[]
> {
  const { data } = await supabase
    .from("food_conditions")
    .select("key,label,emoji,sort_order,is_active")
    .eq("is_active", true)
    .order("sort_order");
  return ((data as any[]) || []).map((r) => ({
    key: r.key,
    label: r.label,
    emoji: r.emoji || "",
    sort_order: r.sort_order ?? 100,
  }));
}

export async function loadUserActiveConditions(userId: string): Promise<ActiveCondition[]> {
  const [profRes, conds] = await Promise.all([
    supabase.from("profiles").select("deep_profiling").eq("user_id", userId).maybeSingle(),
    fetchFoodConditions(),
  ]);
  const metaMap = Object.fromEntries(conds.map((c) => [c.key, { label: c.label, emoji: c.emoji }]));
  return deriveActiveConditions((profRes.data as any)?.deep_profiling, metaMap);
}


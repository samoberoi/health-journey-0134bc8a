import { supabase } from "@/integrations/supabase/client";

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  plan_name: string;
  plan_price: number;
  duration_months: number;
  started_at: string;
  expires_at: string;
  status: "active" | "expired" | "cancelled";
  created_at: string;
}

/**
 * Legacy plan_id values that were used before packages were seeded in the DB.
 * All new code should use plan_keys from `packages` directly.
 */
export const PLAN_KEY_ALIAS: Record<string, string> = {
  starter: "foundation",
  pro: "intensive",
};

export function normalizePlanKey(planId: string | null | undefined): string | null {
  if (!planId) return null;
  return PLAN_KEY_ALIAS[planId] ?? planId;
}

export async function fetchActiveSubscription(userId?: string): Promise<Subscription | null> {
  let query = supabase
    .from("subscriptions" as any)
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1);

  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.error("Failed to fetch subscription:", error);
    return null;
  }
  const sub = data as unknown as Subscription | null;
  // Treat time-expired subscriptions as inactive even if status not yet reconciled.
  if (sub && new Date(sub.expires_at).getTime() <= Date.now()) return null;
  return sub;
}

/** Latest subscription row regardless of status — used to detect expired users. */
export async function fetchLatestSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from("subscriptions" as any)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("Failed to fetch latest subscription:", error);
    return null;
  }
  return data as unknown as Subscription | null;
}

export function isSubscriptionExpired(sub: Subscription | null): boolean {
  if (!sub) return false;
  if (sub.status !== "active") return true;
  return new Date(sub.expires_at).getTime() <= Date.now();
}

export async function createSubscription(sub: {
  user_id: string;
  plan_id: string;
  plan_name: string;
  plan_price: number;
  duration_months: number;
  started_at: string;
  expires_at: string;
}): Promise<Subscription> {
  const { data, error } = await (supabase as any).rpc("complete_demo_payment", {
    _plan_id: sub.plan_id,
    _plan_name: sub.plan_name,
    _plan_price: sub.plan_price,
    _duration_months: sub.duration_months,
  });

  if (error) {
    console.error("Failed to create subscription:", error);
    throw new Error(error.message || "Failed to create subscription");
  }
  return data as unknown as Subscription;
}

/** Get upgrade options for the current plan using DB packages by sort_order */
export async function fetchUpgradeOptions(currentPlanKey: string) {
  const normalizedPlanKey = normalizePlanKey(currentPlanKey) ?? currentPlanKey;
  const { data: pkgs } = await (supabase as any)
    .from("packages")
    .select("*")
    .eq("enabled", true)
    .order("sort_order", { ascending: true });
  if (!pkgs) return [];
  const idx = pkgs.findIndex((p: any) => p.plan_key === normalizedPlanKey);
  if (idx === -1) return [];
  return pkgs.slice(idx + 1).map((p: any) => ({
    id: p.plan_key,
    name: p.name as string,
    tagline: (p.tagline ?? "") as string,
    monthlyPrice: p.base_monthly_price as number,
  }));
}

/** Fetch a single package by plan_key for display */
export async function fetchPackageByPlanKey(planKey: string) {
  const normalizedPlanKey = normalizePlanKey(planKey) ?? planKey;
  const { data } = await (supabase as any)
    .from("packages")
    .select("*")
    .eq("plan_key", normalizedPlanKey)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.plan_key as string,
    name: data.name as string,
    tagline: (data.tagline ?? "") as string,
    features: (Array.isArray(data.features) ? data.features : []) as string[],
  };
}


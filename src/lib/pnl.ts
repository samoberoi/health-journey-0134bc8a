import { supabase } from "@/integrations/supabase/client";

export type PnlRow = {
  source: "subscription" | "yoga" | "event";
  ref_id: string;
  occurred_at: string;
  user_id: string;
  label: string;
  gross: number;
  gst: number;
  net: number;
  coach_cost: number;
  partner_cost: number;
  hyperrevamp_cost: number;
  margin: number;
  meta: Record<string, any>;
};

export type PnlConfig = {
  id: string;
  gst_pct: number;
  hyperrevamp_pct: number;
  default_coach_commission_pct: number;
  default_partner_split_pct: number;
};

export async function fetchPnl(from: Date, to: Date): Promise<PnlRow[]> {
  const { data, error } = await (supabase as any).rpc("pnl_compute", {
    _from: from.toISOString(),
    _to: to.toISOString(),
  });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    ...r,
    gross: Number(r.gross),
    gst: Number(r.gst),
    net: Number(r.net),
    coach_cost: Number(r.coach_cost),
    partner_cost: Number(r.partner_cost),
    hyperrevamp_cost: Number(r.hyperrevamp_cost),
    margin: Number(r.margin),
  }));
}

export async function fetchPnlConfig(): Promise<PnlConfig | null> {
  const { data } = await (supabase as any)
    .from("pnl_rate_config")
    .select("*")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return data as PnlConfig | null;
}

export async function updatePnlConfig(id: string, patch: Partial<PnlConfig>): Promise<void> {
  const { error } = await (supabase as any).from("pnl_rate_config").update(patch).eq("id", id);
  if (error) throw error;
}

export type PnlTotals = {
  gross: number;
  gst: number;
  net: number;
  coach_cost: number;
  partner_cost: number;
  hyperrevamp_cost: number;
  margin: number;
  count: number;
};

export function sumPnl(rows: PnlRow[]): PnlTotals {
  return rows.reduce(
    (acc, r) => ({
      gross: acc.gross + r.gross,
      gst: acc.gst + r.gst,
      net: acc.net + r.net,
      coach_cost: acc.coach_cost + r.coach_cost,
      partner_cost: acc.partner_cost + r.partner_cost,
      hyperrevamp_cost: acc.hyperrevamp_cost + r.hyperrevamp_cost,
      margin: acc.margin + r.margin,
      count: acc.count + 1,
    }),
    { gross: 0, gst: 0, net: 0, coach_cost: 0, partner_cost: 0, hyperrevamp_cost: 0, margin: 0, count: 0 }
  );
}

export function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

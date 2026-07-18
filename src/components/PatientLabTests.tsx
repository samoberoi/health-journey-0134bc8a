import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FlaskConical, MapPin, Check, Home, Clock, Eye } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { patientPriceFor, useLabTestMarkup } from "@/lib/labTestMarkup";
import LabOrderDetails from "@/components/lab/LabOrderDetails";


type Rec = {
  id: string;
  product_codes: string[];
  notes: string | null;
  status: string;
  recommended_at: string;
};

type Order = {
  id: string;
  recommendation_id: string | null;
  product_codes?: string[] | null;
  thyrocare_order_id: string | null;
  thyrocare_lead_id: string | null;
  status: string | null;
  status_detail: string | null;
  beneficiary_name: string | null;
  beneficiary_age: number | null;
  beneficiary_gender: string | null;
  mobile: string | null;
  email: string | null;
  pincode: string | null;
  address: string | null;
  collection_date: string | null;
  collection_slot: string | null;
  amount: number | null;
  raw_response: any;
  created_at: string;
};


type IncludedTest = { code?: string; name?: string; groupName?: string };
type Test = { product_code: string; product_name: string; offer_rate: number | null; rate: number | null; markup_pct: number | null; fasting_required?: boolean | null; parameters_count?: number | null; description?: string | null; raw_data?: any };

function titleCaseStatus(value?: string | null) {
  if (!value) return "Not yet booked";
  const normalized = value.replace(/_/g, " ").trim().toLowerCase();
  if (["pending", "viewed", "recommended"].includes(normalized)) return "Not yet booked";
  if (normalized === "booked" || normalized === "created") return "Booked";
  if (["done", "completed", "report ready", "reports ready"].includes(normalized)) return "Results ready";
  return normalized.replace(/\b\w/g, (m) => m.toUpperCase());
}

function orderDisplayStatus(order?: Order, recStatus?: string) {
  if (!order) return titleCaseStatus(recStatus);
  const raw = order.raw_response?.data || order.raw_response || {};
  return titleCaseStatus(raw.statusText || raw.statusDescription || raw.status || order.status || recStatus);
}

export default function PatientLabTests({ alwaysShow = false, foundationMode = false }: { alwaysShow?: boolean; foundationMode?: boolean } = {}) {
  const { user } = useAuth();
  const markupPct = useLabTestMarkup();
  const [recs, setRecs] = useState<Rec[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersByRec, setOrdersByRec] = useState<Record<string, Order>>({});
  const [testsByCode, setTestsByCode] = useState<Record<string, Test>>({});
  const [reports, setReports] = useState<any[]>([]);
  const [foundationTests, setFoundationTests] = useState<Test[]>([]);
  const [detailsTest, setDetailsTest] = useState<Test | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bookingRec, setBookingRec] = useState<Rec | null>(null);
  const [form, setForm] = useState({
    name: "", age: "", gender: "Male", mobile: "", email: "",
    pincode: "", address: "", collection_date: "", collection_slot: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [pinChecking, setPinChecking] = useState(false);
  const [pinOk, setPinOk] = useState<boolean | null>(null);
  const [slots, setSlots] = useState<{ start: string; end: string | null; available: boolean }[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsSource, setSlotsSource] = useState<string | null>(null);


  useEffect(() => {
    if (!user) {
      setLoadError(null);
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoadError(null);
        const [r, rep, ord, prof] = await Promise.all([
          supabase.from("thyrocare_recommendations" as any)
            .select("id, product_codes, notes, status, recommended_at")
            .eq("user_id", user.id).order("recommended_at", { ascending: false }),
          supabase.from("thyrocare_reports" as any)
            .select("id, report_url, report_type, delivered_at, order_id, parameters")
            .eq("user_id", user.id).order("delivered_at", { ascending: false }),
          supabase.from("thyrocare_orders" as any)
            .select("id, recommendation_id, product_codes, thyrocare_order_id, thyrocare_lead_id, status, status_detail, beneficiary_name, beneficiary_age, beneficiary_gender, mobile, email, pincode, address, collection_date, collection_slot, amount, raw_response, created_at")
            .eq("user_id", user.id).order("created_at", { ascending: false }),

          supabase.from("profiles")
            .select("name, phone, age, gender, birth_date, pincode, address_line1, address_line2, city, state")
            .eq("user_id", user.id).maybeSingle(),
        ]);
        const firstError = r.error || rep.error || ord.error || prof.error;
        if (firstError) throw firstError;
        const list = ((r.data as any) || []) as Rec[];
        const rawOrders = (((ord.data as any) || []) as Order[]);
        // Only show real, active orders (hide failed/cancelled and orders that never got a Thyrocare ID)
        const orderList = rawOrders.filter(
          (o) => !!o.thyrocare_order_id && !["failed", "cancelled"].includes((o.status || "").toLowerCase()),
        );
        setRecs(list);
        setOrders(orderList);
        setReports((rep.data as any) || []);
        const orderMap: Record<string, Order> = {};
        for (const o of orderList) {
          if (o.recommendation_id && !orderMap[o.recommendation_id]) orderMap[o.recommendation_id] = o;
        }
        setOrdersByRec(orderMap);

        // Refresh live status, then auto-fetch reports for any "done" orders
        const liveOrders = orderList.filter((o) => o.thyrocare_order_id);
        if (liveOrders.length) {
          Promise.all(
            liveOrders.map((o) =>
              supabase.functions.invoke("thyrocare-api", {
                body: { action: "order_status", thyrocare_order_id: o.thyrocare_order_id },
              }).catch(() => null),
            ),
          ).then(async () => {
            const { data: o2 } = await supabase.from("thyrocare_orders" as any)
              .select("id, recommendation_id, product_codes, thyrocare_order_id, thyrocare_lead_id, status, status_detail, beneficiary_name, beneficiary_age, beneficiary_gender, mobile, email, pincode, address, collection_date, collection_slot, amount, raw_response, created_at")
              .eq("user_id", user.id).order("created_at", { ascending: false });
            const refreshedRaw = (((o2 as any) || []) as Order[]);
            const refreshedOrders = refreshedRaw.filter(
              (o) => !!o.thyrocare_order_id && !["failed", "cancelled"].includes((o.status || "").toLowerCase()),
            );
            const map2: Record<string, Order> = {};
            for (const o of refreshedOrders) {
              if (o.recommendation_id && !map2[o.recommendation_id]) map2[o.recommendation_id] = o;
            }
            setOrders(refreshedOrders);
            setOrdersByRec(map2);

            const doneOrders = refreshedOrders.filter((o) => {
              const raw = o.raw_response || {};
              const rawStatus = String(raw.orderStatus || raw.status || "").toLowerCase();
              const reportReady = raw?.orderOptions?.isReportReady === true || raw?.patients?.some?.((p: any) => p?.isReportAvailable === true);
              return reportReady || ["done", "completed", "report_ready", "reports_ready"].includes((o.status || rawStatus).toLowerCase());
            });
            if (doneOrders.length) {
              await Promise.all(
                doneOrders.map((o) =>
                  supabase.functions.invoke("thyrocare-api", {
                    body: {
                      action: "fetch_report",
                      thyrocare_order_id: o.thyrocare_order_id,
                      thyrocare_lead_id: o.thyrocare_lead_id,
                    },
                  }).catch(() => null),
                ),
              );
              const { data: rep2 } = await supabase.from("thyrocare_reports" as any)
                .select("id, report_url, report_type, delivered_at, order_id, parameters")
                .eq("user_id", user.id).order("delivered_at", { ascending: false });
              setReports((rep2 as any) || []);
            }
          }).catch(() => {});
        }


        const codes = Array.from(new Set([
          ...list.flatMap((x) => x.product_codes || []),
          ...orderList.flatMap((x) => x.product_codes || []),
        ]));
        if (codes.length) {
          const { data: tt } = await supabase
            .from("thyrocare_tests" as any)
            .select("product_code, product_name, offer_rate, rate, markup_pct, fasting_required, parameters_count, description, raw_data")
            .in("product_code", codes);
          const map: Record<string, Test> = {};
          for (const t of ((tt as any) || []) as Test[]) map[t.product_code] = t;
          setTestsByCode(map);
        }
        if (prof.data) {
          const p: any = prof.data;
          let age = p.age ? String(p.age) : "";
          if (!age && p.birth_date) {
            const b = new Date(p.birth_date);
            if (!isNaN(b.getTime())) {
              const now = new Date();
              let a = now.getFullYear() - b.getFullYear();
              const m = now.getMonth() - b.getMonth();
              if (m < 0 || (m === 0 && now.getDate() < b.getDate())) a--;
              if (a > 0 && a < 130) age = String(a);
            }
          }
          const g = (p.gender || "").toString().toLowerCase();
          const gender = g.startsWith("f") ? "Female" : g.startsWith("m") ? "Male" : g ? "Other" : "Male";
          const addressParts = [p.address_line1, p.address_line2, p.city, p.state].filter(Boolean);
          const phone = (p.phone || "").replace(/^\+?91/, "").trim();
          setForm((f) => ({
            ...f,
            name: p.name || "",
            mobile: phone || p.phone || "",
            email: user.email || "",
            age,
            gender,
            pincode: p.pincode || "",
            address: addressParts.join(", "),
          }));
          if (p.pincode && /^\d{6}$/.test(p.pincode)) {
            void checkPin(p.pincode);
          }
        } else {
          setForm((f) => ({ ...f, email: user.email || "" }));
        }
      } catch (e) {
        console.error("[PatientLabTests] load failed", e);
        setLoadError(e instanceof Error ? e.message : "Couldn't load lab tests.");
        toast.error("Couldn't load lab tests. Please refresh.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  // Load Foundation Essentials (3 default tests) when in foundationMode
  useEffect(() => {
    if (!foundationMode) return;
    (async () => {
      const { data } = await supabase
        .from("thyrocare_tests" as any)
        .select("product_code, product_name, offer_rate, rate, markup_pct, fasting_required, parameters_count, description, raw_data")
        .eq("is_active", true);
      const raw = ((data as any) || []) as Test[];
      // Order: BASIC → PLUS → ADVANCED
      const rank = (n: string) => {
        const s = (n || "").toUpperCase();
        if (s.includes("BASIC")) return 0;
        if (s.includes("PLUS")) return 1;
        if (s.includes("ADVANCED")) return 2;
        return 99;
      };
      const list = [...raw].sort((a, b) => rank(a.product_name) - rank(b.product_name));
      setFoundationTests(list);
      setTestsByCode((prev) => {
        const next = { ...prev };
        for (const t of list) next[t.product_code] = t;
        return next;
      });
    })();
  }, [foundationMode]);


  const checkPin = async (pincode: string) => {
    if (!/^\d{6}$/.test(pincode)) { setPinOk(null); setPinChecking(false); return; }
    setPinChecking(true);
    setPinOk(null);
    try {
      const { data } = await supabase.functions.invoke("thyrocare-api", {
        body: { action: "serviceability", pincode },
      });
      setPinOk(!!data?.ok);
    } catch {
      setPinOk(false);
    } finally {
      setPinChecking(false);
    }
  };

  const loadSlots = async (pincode: string, date: string) => {
    if (!/^\d{6}$/.test(pincode) || !date) {
      setSlots([]);
      setSlotsSource(null);
      return;
    }
    setSlotsLoading(true);
    try {
      const { data } = await supabase.functions.invoke("thyrocare-api", {
        body: {
          action: "available_slots",
          pincode,
          date,
          name: form.name || "Patient",
          age: Number(form.age) || 30,
          gender: form.gender || "Male",
          productCodes: bookingRec?.product_codes || [],
        },
      });

      const list = (data?.slots || []) as { start: string; end: string | null; available: boolean }[];
      setSlots(list);
      setSlotsSource(data?.source || null);
      // If currently chosen slot is no longer in the list, clear it
      setForm((f) => {
        if (!f.collection_slot) return f;
        return list.some((s) => s.start === f.collection_slot && s.available)
          ? f
          : { ...f, collection_slot: "" };
      });
    } catch {
      setSlots([]);
      setSlotsSource(null);
    } finally {
      setSlotsLoading(false);
    }
  };

  useEffect(() => {
    if (!bookingRec) return;
    void loadSlots(form.pincode, form.collection_date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pincode, form.collection_date, bookingRec]);

  const submitOrder = async () => {
    if (!bookingRec) return;
    if (!form.name || !form.mobile || !form.pincode) {
      return toast.error("Name, mobile and pincode are required");
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("thyrocare-api", {
        body: {
          action: "create_order",
          recommendation_id: bookingRec.id || null,
          beneficiary: { name: form.name, age: Number(form.age) || null, gender: form.gender },
          mobile: form.mobile,
          email: form.email,
          pincode: form.pincode,
          address: form.address,
          collection_date: form.collection_date || null,
          collection_slot: form.collection_slot || null,
          productCodes: bookingRec.product_codes,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || data?.thyrocare?.message || "Booking failed");
      const orderId = data?.order?.thyrocare_order_id || data?.thyrocare?.orderId || data?.thyrocare?.data?.orderId;
      toast.success(orderId ? `Booked! Order ID: ${orderId}` : "Order placed! You'll get updates here.");
      setBookingRec(null);
      const [{ data: r }, { data: o }] = await Promise.all([
        supabase.from("thyrocare_recommendations" as any)
          .select("id, product_codes, notes, status, recommended_at")
          .eq("user_id", user!.id).order("recommended_at", { ascending: false }),
        supabase.from("thyrocare_orders" as any)
          .select("id, recommendation_id, product_codes, thyrocare_order_id, thyrocare_lead_id, status, status_detail, beneficiary_name, beneficiary_age, beneficiary_gender, mobile, email, pincode, address, collection_date, collection_slot, amount, raw_response, created_at")

          .eq("user_id", user!.id).order("created_at", { ascending: false }),
      ]);
      setRecs(((r as any) || []) as Rec[]);
      setOrders(((o as any) || []) as Order[]);
      const orderMap: Record<string, Order> = {};
      for (const ox of (((o as any) || []) as Order[])) {
        if (ox.recommendation_id && !orderMap[ox.recommendation_id]) orderMap[ox.recommendation_id] = ox;
      }
      setOrdersByRec(orderMap);

    } catch (e: any) {
      toast.error(e.message || "Booking failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-4 text-muted-foreground text-sm">Loading…</div>;

  if (!user) {
    return alwaysShow ? (
      <div className="liquid-glass rounded-2xl p-6 text-center space-y-2">
        <FlaskConical className="w-8 h-8 text-primary mx-auto" />
        <h3 className="text-base font-black">Sign in to view lab tests</h3>
        <p className="text-sm text-muted-foreground">Your bookings, OTP, technician details and reports will appear here.</p>
      </div>
    ) : null;
  }

  if (loadError) {
    return (
      <div className="liquid-glass rounded-2xl p-6 text-center space-y-2">
        <FlaskConical className="w-8 h-8 text-primary mx-auto" />
        <h3 className="text-base font-black">Lab tests could not load</h3>
        <p className="text-sm text-muted-foreground">{loadError}</p>
      </div>
    );
  }

  const orphanOrders = orders.filter((order) => !order.recommendation_id || !recs.some((rec) => rec.id === order.recommendation_id));

  const startFoundationBooking = (test: Test) => {
    setBookingRec({
      id: "",
      product_codes: [test.product_code],
      notes: null,
      status: "pending",
      recommended_at: new Date().toISOString(),
    } as Rec);
  };

  const tierBadge = (name: string) => {
    const s = (name || "").toUpperCase();
    if (s.includes("BASIC")) return { label: "Starter", tone: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" };
    if (s.includes("PLUS")) return { label: "Most Popular", tone: "bg-amber-50 text-amber-700 ring-1 ring-amber-200" };
    if (s.includes("ADVANCED")) return { label: "Comprehensive", tone: "bg-primary/10 text-primary ring-1 ring-primary/20" };
    return { label: "Panel", tone: "bg-muted text-muted-foreground ring-1 ring-border" };
  };

  const FoundationStrip = foundationMode && foundationTests.length > 0 ? (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <FlaskConical className="w-4 h-4 text-[var(--bbdo-red)]" />
        <h3 className="text-sm font-black uppercase tracking-[0.12em]">Foundation Essentials</h3>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {foundationTests.map((t, idx) => {
          const price = patientPriceFor(t.offer_rate ?? t.rate, t.markup_pct, markupPct) ?? 0;
          const original = Number(t.rate || 0);
          const showStrike = original > price && price > 0;
          const tier = tierBadge(t.product_name);
          const count = t.parameters_count || (Array.isArray(t?.raw_data?.testsIncluded) ? t.raw_data.testsIncluded.length : 0);
          const isPlus = (t.product_name || "").toUpperCase().includes("PLUS");
          return (
            <motion.div
              key={t.product_code}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: idx * 0.04, ease: [0.22, 1, 0.36, 1] }}
              className={`relative rounded-2xl p-5 bg-card shadow-card flex flex-col gap-4 transition-all hover:-translate-y-px ${
                isPlus ? "ring-2 ring-primary/30 shadow-lift" : "ring-1 ring-border"
              }`}
            >
              {isPlus && (
                <div className="absolute -top-2.5 left-5 px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide text-white"
                  style={{ background: "var(--bbdo-gradient)" }}>
                  RECOMMENDED
                </div>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                    style={{ background: "var(--bbdo-gradient)" }}>
                    <FlaskConical className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black tracking-tight leading-tight break-words">{t.product_name}</p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${tier.tone}`}>{tier.label}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-black text-foreground">{price > 0 ? `₹${price.toLocaleString("en-IN")}` : "—"}</p>
                {showStrike && (
                  <p className="text-xs text-muted-foreground line-through">₹{original.toLocaleString("en-IN")}</p>
                )}
              </div>

              <ul className="space-y-1.5 text-xs text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-emerald-600" /> {count > 0 ? `${count} parameters` : "Curated panel"}</li>
                <li className="flex items-center gap-2"><Home className="w-3.5 h-3.5 text-primary" /> Free home sample collection</li>
                <li className="flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-amber-600" /> {t.fasting_required ? "8–10 hr fasting required" : "No fasting required"}</li>
              </ul>

              <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
                <Button variant="outline" size="sm" className="h-9" onClick={() => setDetailsTest(t)}>
                  <Eye className="w-3.5 h-3.5 mr-1" /> Details
                </Button>
                <Button size="sm" className="h-9 font-bold" onClick={() => startFoundationBooking(t)}>
                  Buy now
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  ) : null;

  if (recs.length === 0 && reports.length === 0 && orphanOrders.length === 0 && !foundationMode) {
    if (!alwaysShow) return null;
    return (
      <div className="liquid-glass rounded-2xl p-6 text-center space-y-2">
        <FlaskConical className="w-8 h-8 text-primary mx-auto" />
        <h3 className="text-base font-black">Awaiting your coach</h3>
        <p className="text-sm text-muted-foreground">
          Your coach will review your health assessment and recommend the right lab panels for your plan. You'll see them here as soon as they're assigned.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {FoundationStrip}
      {recs.length > 0 && !foundationMode && (
        <div className="flex items-center gap-2 px-1">
          <FlaskConical className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-black uppercase tracking-wide">Recommended Lab Tests</h3>
        </div>
      )}

      {recs.map((r) => {
        const items = (r.product_codes || []).map((c) => testsByCode[c]).filter(Boolean);
        const priceOf = (t: Test) => patientPriceFor(t.offer_rate ?? t.rate, t.markup_pct, markupPct) ?? 0;
        const total = items.reduce((s, t) => s + priceOf(t), 0);
        const order = ordersByRec[r.id];
        const displayStatus = orderDisplayStatus(order, r.status);
        return (

          <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="liquid-glass rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs text-muted-foreground">
                {new Date(r.recommended_at).toLocaleDateString()}
              </div>
              <Badge variant={order || r.status === "booked" ? "default" : "secondary"} className="text-[10px]">
                {displayStatus}
              </Badge>
            </div>
            <ul className="space-y-1">
              {items.map((t, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span>{t.product_name}</span>
                  <span className="text-muted-foreground">{priceOf(t) > 0 ? `₹${priceOf(t).toLocaleString("en-IN")}` : "-"}</span>
                </li>
              ))}
              {(r.product_codes || []).filter((c) => !testsByCode[c]).map((c) => (
                <li key={c} className="text-sm text-muted-foreground">{c}</li>
              ))}
            </ul>
            {r.notes && (
              <div className="text-xs text-muted-foreground italic border-l-2 border-primary pl-2">
                {r.notes}
              </div>
            )}
            {order && (
              <LabOrderDetails
                order={order}
                fastingRequired={items.some((t) => t.fasting_required)}
                reports={reports.filter((rep: any) => rep.order_id === order.id)}
                userId={user?.id}
              />
            )}


            <div className="flex items-center justify-between pt-1">
              <div className="text-sm font-black">Total ₹{total.toFixed(0)}</div>
              {r.status !== "booked" && (
                <Button size="sm" onClick={() => setBookingRec(r)}>Book this test</Button>
              )}
            </div>
          </motion.div>
        );
      })}

      {orphanOrders.map((order) => {
        const codes = order.product_codes || [];
        const items = codes.map((c) => testsByCode[c]).filter(Boolean);
        const priceOf = (t: Test) => patientPriceFor(t.offer_rate ?? t.rate, t.markup_pct, markupPct) ?? 0;
        const total = order.amount ?? items.reduce((s, t) => s + priceOf(t), 0);
        return (
          <motion.div key={order.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="liquid-glass rounded-2xl p-4 space-y-3">
            <ul className="space-y-1">
              {items.map((t, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span>{t.product_name}</span>
                  <span className="text-muted-foreground">{priceOf(t) > 0 ? `₹${priceOf(t).toLocaleString("en-IN")}` : "-"}</span>
                </li>
              ))}
              {codes.filter((c) => !testsByCode[c]).map((c) => (
                <li key={c} className="text-sm text-muted-foreground">{c}</li>
              ))}
            </ul>
            <LabOrderDetails
              order={order}
              fastingRequired={items.some((t) => t.fasting_required)}
              reports={reports.filter((rep: any) => rep.order_id === order.id)}
              userId={user?.id}
            />
            <div className="text-sm font-black">Total ₹{Number(total || 0).toFixed(0)}</div>
          </motion.div>
        );
      })}


      <Dialog open={!!bookingRec} onOpenChange={(o) => !o && setBookingRec(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Book Lab Test</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Patient Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Age</Label>
                <Input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} />
              </div>
              <div>
                <Label>Gender</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option>Male</option><option>Female</option><option>Other</option>
                </select>
              </div>
            </div>
            <div>
              <Label>Mobile</Label>
              <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </div>
            <div>
              <Label>Email (optional)</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label className="flex items-center gap-1"><MapPin className="w-3 h-3" /> Pincode</Label>
              <Input value={form.pincode} inputMode="numeric" maxLength={6} onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setForm({ ...form, pincode: v });
                if (v.length === 6) checkPin(v); else setPinOk(null);
              }} />
              {pinChecking && <p className="text-xs text-muted-foreground mt-1">Checking serviceability…</p>}
              {pinOk === true && <p className="text-xs text-primary mt-1">✓ Sample collection available</p>}
              {pinOk === false && <p className="text-xs text-destructive mt-1">Not serviceable in this pincode</p>}
            </div>
            <div>
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label>Collection Date</Label>
              <Input
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={form.collection_date}
                onChange={(e) => setForm({ ...form, collection_date: e.target.value })}
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Available slots</Label>
                {slotsSource === "fallback" && (
                  <span className="text-[10px] text-muted-foreground">Standard times</span>
                )}
              </div>
              {!form.pincode || !form.collection_date ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Enter pincode and pick a date to see available slots.
                </p>
              ) : slotsLoading ? (
                <p className="text-xs text-muted-foreground mt-1">Loading slots…</p>
              ) : slots.length === 0 ? (
                <p className="text-xs text-destructive mt-1">No slots available for this date.</p>
              ) : (
                <div className="mt-2 flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {slots.map((s) => {
                    const selected = form.collection_slot === s.start;
                    const disabled = !s.available;
                    return (
                      <button
                        key={s.start}
                        type="button"
                        disabled={disabled}
                        onClick={() => setForm({ ...form, collection_slot: s.start })}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                          selected
                            ? "bg-primary text-primary-foreground border-primary"
                            : disabled
                              ? "bg-muted text-muted-foreground/50 border-border line-through cursor-not-allowed"
                              : "bg-background text-foreground border-border hover:bg-accent"
                        }`}
                      >
                        {s.start}
                        {s.end ? `–${s.end}` : ""}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingRec(null)}>Cancel</Button>
            <Button onClick={submitOrder} disabled={submitting || pinOk === false || !form.collection_slot}>
              {submitting ? "Booking…" : "Confirm Booking"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!detailsTest} onOpenChange={(o) => !o && setDetailsTest(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-primary" />
              {detailsTest?.product_name}
            </DialogTitle>
            <DialogDescription>
              {detailsTest?.fasting_required ? "Fasting required (8–10 hours). " : "No fasting required. "}
              Home sample collection included.
            </DialogDescription>
          </DialogHeader>
          {detailsTest && (() => {
            const price = patientPriceFor(detailsTest.offer_rate ?? detailsTest.rate, detailsTest.markup_pct, markupPct) ?? 0;
            const original = Number(detailsTest.rate || 0);
            const included: IncludedTest[] = Array.isArray(detailsTest?.raw_data?.testsIncluded) ? detailsTest.raw_data.testsIncluded : [];
            const groups: Record<string, IncludedTest[]> = {};
            for (const it of included) {
              const g = it.groupName || "Others";
              (groups[g] ||= []).push(it);
            }
            return (
              <div className="space-y-4">
                <div className="rounded-2xl p-4 text-white" style={{ background: "var(--bbdo-gradient)" }}>
                  <p className="text-[10px] tracking-[0.18em] uppercase font-bold text-white/80">Your price</p>
                  <div className="flex items-baseline gap-2">
                    <p className="text-3xl font-black">₹{price.toLocaleString("en-IN")}</p>
                    {original > price && (
                      <p className="text-sm line-through text-white/70">₹{original.toLocaleString("en-IN")}</p>
                    )}
                  </div>
                  <p className="text-xs text-white/85 mt-1">
                    {(detailsTest.parameters_count || included.length) > 0
                      ? `${detailsTest.parameters_count || included.length} parameters included`
                      : "Curated panel"}
                  </p>
                </div>

                {included.length > 0 ? (
                  <div className="space-y-3">
                    {Object.entries(groups).map(([g, items]) => (
                      <div key={g}>
                        <p className="text-[11px] font-black uppercase tracking-wide text-muted-foreground mb-1.5">{g}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {items.map((it, i) => (
                            <Badge key={i} variant="secondary" className="text-[11px] font-medium">
                              {it.name || it.code}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Detailed parameter list will appear here after the next sync.</p>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsTest(null)}>Close</Button>
            <Button onClick={() => { if (detailsTest) { startFoundationBooking(detailsTest); setDetailsTest(null); } }}>
              Buy now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

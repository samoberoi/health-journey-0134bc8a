import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FlaskConical, ChevronRight, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import LabHistorySection from "@/components/lab/LabHistorySection";
import ThyrocarePoweredBy from "@/components/lab/ThyrocarePoweredBy";
import LabBookingDialog from "@/components/lab/LabBookingDialog";

interface Props {
  userId: string;
}

/**
 * Foundation-tier "Day-1 lab" card shown on Home.
 *
 * • Before any results exist  → urges the user to book BBDO Basic (their baseline).
 * • Once at least one result exists → shows a tap-through to the full Body
 *   Investigation Map + marker deltas so month-over-month improvements are visible.
 */
export default function FoundationLabCard({ userId }: Props) {
  const [hasResults, setHasResults] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [basicCode, setBasicCode] = useState<string | null>(null);
  const [booking, setBooking] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("lab_results" as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId);
      if (!cancelled) setHasResults((count ?? 0) > 0);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Resolve the BBDO Basic product_code so we can open the booking dialog on Home.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("thyrocare_tests" as any)
        .select("product_code, product_name")
        .eq("is_active", true);
      const list = ((data as any) || []) as { product_code: string; product_name: string }[];
      const basic = list.find((t) => (t.product_name || "").toUpperCase().includes("BASIC"));
      if (!cancelled && basic) setBasicCode(basic.product_code);
    })();
    return () => { cancelled = true; };
  }, []);

  const openBooking = () => {
    if (!basicCode) return;
    setBooking(true);
  };

  if (hasResults === null) return null;


  return (
    <>
      {hasResults ? (
        <motion.button
          type="button"
          onClick={() => setOpen(true)}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="w-full text-left rounded-3xl p-5 text-white shadow-card relative overflow-hidden active:scale-[0.99] transition-transform"
          style={{ background: "var(--bbdo-gradient)" }}
        >
          <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="relative flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-white" strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                Your reports are available
              </p>
              <h3 className="text-lg font-black mt-1 leading-tight">
                View your Health Profile
              </h3>
              <p className="text-xs text-white/85 mt-1.5 leading-relaxed">
                Tap to open your body map — track every marker and compare against your baseline as you retest.
              </p>
            </div>
            <ChevronRight className="w-5 h-5 text-white/90 shrink-0 mt-1" />
          </div>
        </motion.button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="liquid-glass rounded-3xl p-5 ring-1 ring-[var(--bbdo-red)]/30"
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: "var(--bbdo-red)" }}>
              <FlaskConical className="w-5 h-5 text-white" strokeWidth={1.8} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--bbdo-red)" }}>
                    Day-1 essential
                  </p>
                  <h3 className="text-base font-black text-foreground mt-1 leading-tight">
                    Book your BBDO Basic lab test
                  </h3>
                </div>
                <ThyrocarePoweredBy variant="dark" className="ml-auto" />
              </div>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                This first test helps personalise your plan. Once your report is ready, your Health Profile and body map will unlock on Home.
              </p>
              <button
                type="button"
                onClick={openBooking}
                disabled={!basicCode}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white active:scale-[0.98] transition-transform disabled:opacity-60"
                style={{ background: "var(--bbdo-red)" }}
              >
                Book lab test <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-50 bg-background overflow-y-auto"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="max-w-3xl mx-auto px-4 md:px-6 pt-[max(env(safe-area-inset-top),0.75rem)] pb-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Health Profile</p>
                  <h2 className="text-xl font-black">Your body map</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <LabHistorySection userId={userId} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <LabBookingDialog
        open={booking}
        onClose={() => setBooking(false)}
        productCodes={basicCode ? [basicCode] : []}
        onBooked={() => setHasResults((v) => v)}
      />
    </>
  );
}


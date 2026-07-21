import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, ArrowRight } from "lucide-react";
import SoundToggle from "@/components/SoundToggle";
import { setPhase } from "@/lib/musicEngine";

const benefits = [
  "Blood sugar becomes stable",
  "Belly fat starts reducing",
  "Energy & sleep improve",
  "Cravings come down",
  "Mental clarity improves",
];

export default function BreakPattern() {
  const navigate = useNavigate();
  useEffect(() => { setPhase("hope"); }, []);

  return (
    <div className="phone-container ob-lock bg-background overflow-x-hidden overflow-y-auto" style={{ minHeight: "100dvh", WebkitOverflowScrolling: "touch" }}>
      <SoundToggle />
      <div className="flex-1 flex flex-col px-6 pt-[calc(env(safe-area-inset-top)+2rem)] mobile-bottom-safe">
        {/* Header */}
        <motion.p
          className="text-[11px] font-bold uppercase tracking-[0.22em] text-primary mb-2"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          Break the pattern
        </motion.p>
        <motion.h1
          className="text-[1.6rem] sm:text-3xl font-black text-foreground tracking-tight leading-[1.1]"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          When the root cause is
          <br />
          <span className="text-primary">addressed, everything shifts.</span>
        </motion.h1>
        <motion.p
          className="text-muted-foreground text-[0.8rem] mt-2 mb-5 leading-snug"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35 }}
        >
          Here's what starts changing within the first few weeks — not from willpower, but from restoring how your body is meant to work.
        </motion.p>

        {/* Benefits list */}
        <div className="flex flex-col gap-2">
          {benefits.map((b, i) => (
            <motion.div
              key={i}
              className="flex items-center gap-3 px-4 py-2.5 rounded-2xl liquid-glass"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 + i * 0.08 }}
            >
              <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <Check className="w-3.5 h-3.5 text-primary" strokeWidth={2.5} />
              </div>
              <p className="text-[0.85rem] font-semibold text-foreground">{b}</p>
            </motion.div>
          ))}
        </div>

        <motion.p
          className="text-muted-foreground/70 text-[11px] text-center mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
        >
          The key is understanding what's really driving these symptoms.
        </motion.p>

        {/* CTA */}
        <motion.div
          className="mt-auto pt-3 shrink-0"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.1 }}
        >
          <motion.button
            onClick={() => navigate("/transformation")}
            className="w-full gradient-blue text-primary-foreground font-bold py-3.5 rounded-full flex items-center justify-center gap-2 glow-blue"
            whileTap={{ scale: 0.98 }}
          >
            See real results <ArrowRight className="w-5 h-5" />
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}

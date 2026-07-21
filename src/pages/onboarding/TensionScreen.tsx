import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Heart, Droplets, Activity, ShieldAlert } from "lucide-react";
import SoundToggle from "@/components/SoundToggle";
import { setPhase } from "@/lib/musicEngine";

const organs = [
  { icon: Activity, title: "Pancreas under pressure", desc: "Insulin struggling to keep up", color: "text-destructive" },
  { icon: Droplets, title: "Fat building in liver", desc: "Sugar converting to fat", color: "text-destructive" },
  { icon: Heart, title: "Heart under strain", desc: "Rising blood pressure", color: "text-destructive" },
  { icon: ShieldAlert, title: "Kidneys under stress", desc: "Filtering overload", color: "text-destructive" },
];

export default function TensionScreen() {
  const navigate = useNavigate();
  useEffect(() => { setPhase("reality"); }, []);

  return (
    <div className="phone-container ob-lock min-h-dvh flex flex-col bg-background overflow-x-hidden">
      <SoundToggle />
      <div className="flex-1 flex flex-col px-5 pt-[calc(env(safe-area-inset-top)+2rem)] mobile-bottom-safe">


        <motion.p
          className="text-muted-foreground text-[11px] font-semibold uppercase tracking-[0.22em] mb-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          While you feel 'normal'
        </motion.p>

        <motion.h1
          className="ob-title mb-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          Damage is building <span className="text-destructive">silently.</span>
        </motion.h1>

        <motion.p
          className="text-muted-foreground text-[13.5px] mb-7 leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.14, duration: 0.22 }}
        >
          Blood sugar spikes · Inflammation rises · Organs take the hit
        </motion.p>

        <div className="flex flex-col gap-2.5 flex-1">
          {organs.map((o, i) => {
            const Icon = o.icon;
            return (
              <motion.div
                key={i}
                className="liquid-glass rounded-xl px-4 py-3.5 flex items-start gap-3.5"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18 + Math.min(i, 5) * 0.04, duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: "hsl(var(--critical) / 0.10)" }}>
                  <Icon className="w-5 h-5 text-destructive" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-bold text-foreground leading-snug">{o.title}</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">{o.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          className="mt-auto pt-6 flex flex-col items-center shrink-0"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <motion.button
            onClick={() => navigate("/break-pattern")}
            className="ob-cta"
            whileTap={{ scale: 0.98 }}
          >
            What can I do? <ArrowRight className="w-4 h-4" />
          </motion.button>
          <p className="text-muted-foreground/70 text-[11.5px] mt-2.5">It's reversible. Let's show you how.</p>
        </motion.div>
      </div>
    </div>
  );
}


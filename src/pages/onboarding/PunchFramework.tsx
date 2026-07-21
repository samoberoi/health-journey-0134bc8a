import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Timer, Footprints, Pill, Brain, ArrowRight } from "lucide-react";
import Avocado from "@/components/icons/Avocado";
import SoundToggle from "@/components/SoundToggle";
import { setPhase } from "@/lib/musicEngine";

const pillars = [
  { icon: Avocado, label: "Food", desc: "Metabolic nutrition tailored to your body" },
  { icon: Timer, label: "Fasting", desc: "Strategic windows for your body to rest and reset" },
  { icon: Footprints, label: "Movement", desc: "Daily activity calibrated to your level" },
  { icon: Pill, label: "Supplements", desc: "Evidence-based micronutrient support" },
  { icon: Brain, label: "Stress", desc: "Cortisol management & sleep hygiene" },
];

export default function PunchFramework() {
  const navigate = useNavigate();
  const [activeIdx, setActiveIdx] = useState(-1);
  useEffect(() => { setPhase("hope"); const timers = pillars.map((_, i) => setTimeout(() => setActiveIdx(i), 600 + i * 400)); return () => timers.forEach(clearTimeout); }, []);

  return (
    <div className="ob-screen phone-container ob-lock min-h-dvh overflow-x-hidden">
      <SoundToggle />
      <div className="ob-content">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
          <span className="ob-kicker !text-primary">The 5-Pillar System</span>
          <h1 className="ob-title mt-2 mb-2">The <span className="text-primary">PUNCH</span> Framework</h1>
          <p className="ob-sub">A simple, structured way to help your body recover</p>
        </motion.div>
        <div className="ob-stack flex-1">
          {pillars.map((p, i) => {
            const Icon = p.icon;
            const isActive = i <= activeIdx;
            return (
              <motion.div key={p.label} className="liquid-glass flex items-center gap-4 px-4 py-3.5 transition-colors duration-300" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.1 }}>
                <div className={`ob-icon liquid-glass-icon ic-${i % 5} transition-colors duration-300`}>
                  <Icon className={`h-5 w-5`} strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{p.label}</p>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <motion.p
          className="text-muted-foreground/60 text-xs text-center mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          Alone they help. Together, they transform.
        </motion.p>

        <motion.div className="ob-bottom" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
          <motion.button onClick={() => navigate("/start-assessment")} className="ob-cta gradient-blue glow-blue" whileTap={{ scale: 0.98 }}>
            Let's personalise this <ArrowRight className="h-5 w-5" />
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}

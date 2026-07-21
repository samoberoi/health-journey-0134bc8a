import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Shield, TrendingUp } from "lucide-react";
import { getUser } from "@/lib/userStore";
import SoundToggle from "@/components/SoundToggle";
import { setPhase } from "@/lib/musicEngine";

function getInterpretation(score: number) {
  if (score >= 85) return { title: "You're in great shape!", message: "Your metabolic health is strong.", tone: "text-primary", bg: "bg-primary/10", hope: "With small optimizations, you can stay ahead of any future risks." };
  if (score >= 70) return { title: "Good, but there's room", message: "Your health is decent, but some lifestyle tweaks can make a significant difference.", tone: "text-primary", bg: "bg-primary/10", hope: "A few targeted changes can push your score well above 85." };
  if (score >= 50) return { title: "Moderate risk detected", message: "Your body is showing signs of metabolic stress. Early intervention is key.", tone: "text-warning", bg: "bg-warning/10", hope: "The good news? Most people in this range see dramatic improvement within 90 days." };
  if (score >= 30) return { title: "High risk — but not too late", message: "Your markers indicate significant metabolic dysfunction.", tone: "text-destructive", bg: "bg-destructive/10", hope: "With our intensive program, people in your range have reversed their condition in 4-6 months." };
  return { title: "Critical — immediate action needed", message: "Your health metrics require urgent attention.", tone: "text-destructive", bg: "bg-destructive/10", hope: "Even at this stage, guided metabolic correction has shown remarkable results." };
}

export default function ScoreInterpretation() {
  const navigate = useNavigate();
  const user = getUser();
  const score = user.assessment?.healthScore ?? 72;
  const interp = getInterpretation(score);
  useEffect(() => { setPhase("power"); }, []);

  const ambientGlow = score < 50 ? "rgba(239,68,68,0.06)" : score < 70 ? "rgba(245,158,11,0.06)" : "rgba(59,130,246,0.06)";

  return (
    <div className="phone-container ob-lock min-h-dvh flex flex-col px-6 pt-14 mobile-bottom-safe bg-background relative">
      <SoundToggle />
      <div className="absolute inset-0 z-0" style={{ background: `radial-gradient(ellipse at top, ${ambientGlow}, transparent 60%)` }} />
      <div className="relative z-10 flex flex-col flex-1">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-primary" strokeWidth={1.5} />
            <span className="text-xs font-semibold text-primary uppercase tracking-[0.2em]">Score Analysis</span>
          </div>
          <h1 className="text-3xl font-black text-foreground mb-2">Your score is <span className={interp.tone}>{score}</span></h1>
        </motion.div>

        <div className="flex flex-col gap-5 flex-1 mt-8">
          <motion.div className={`liquid-glass rounded-2xl p-5 ${interp.bg}`} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h2 className={`font-bold text-lg mb-2 ${interp.tone}`}>{interp.title}</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">{interp.message}</p>
          </motion.div>

          <motion.div className="liquid-glass bg-primary/5 rounded-2xl p-5" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" strokeWidth={1.5} />
              <span className="text-primary text-xs font-semibold uppercase tracking-widest">The Good News</span>
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">{interp.hope}</p>
          </motion.div>

          <motion.div className="liquid-glass rounded-2xl p-5" initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
            <p className="text-muted-foreground text-xs uppercase tracking-widest mb-2 font-semibold">What happens next</p>
            <p className="text-muted-foreground text-sm leading-relaxed">We'll show you exactly how your health trajectory could change — and recommend the perfect plan for your profile.</p>
          </motion.div>
        </div>

        <motion.button onClick={() => navigate("/trajectory")} className="gradient-blue text-primary-foreground font-bold py-4 rounded-full glow-blue mt-auto flex items-center justify-center gap-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} whileTap={{ scale: 0.98 }}>
          See my trajectory <ChevronRight className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );
}
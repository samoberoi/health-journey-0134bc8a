import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Dna } from "lucide-react";
import SoundToggle from "@/components/SoundToggle";
import { setPhase, setIntensity } from "@/lib/musicEngine";

const messages = ["Building your metabolic profile...", "Analyzing clinical markers...", "Calculating risk trajectory...", "Generating personalized insights...", "Preparing your health score..."];

export default function ProcessingScreen() {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => { setPhase("power"); setIntensity("high"); }, []);
  useEffect(() => { const interval = setInterval(() => setProgress((p) => { if (p >= 100) { clearInterval(interval); return 100; } return p + 2; }), 18); return () => clearInterval(interval); }, []);
  useEffect(() => { const interval = setInterval(() => setMsgIdx((i) => (i + 1) % messages.length), 500); return () => clearInterval(interval); }, []);
  useEffect(() => { if (progress >= 100) { const timer = setTimeout(() => navigate("/setup/score"), 200); return () => clearTimeout(timer); } }, [progress, navigate]);


  return (
    <div className="phone-container ob-lock min-h-dvh flex flex-col items-center justify-center relative overflow-x-hidden bg-background px-6">
      <SoundToggle />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(500px,92vw)] h-[min(500px,92vw)] rounded-full"
        style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.1), transparent 60%)" }}
      />
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="relative w-28 h-28 mb-10">
          <div className="absolute inset-0 rounded-full border border-primary/20" />
          <div className="absolute inset-2 rounded-full border border-primary/15" />
          <div className="absolute inset-0 rounded-full gradient-blue flex items-center justify-center glow-blue">
            <Dna className="w-8 h-8 text-primary-foreground" strokeWidth={1.5} />
          </div>
        </div>
        <h1 className="text-2xl font-black text-foreground mb-3">Building your metabolic profile</h1>
        <motion.p key={msgIdx} className="text-primary text-sm font-medium mb-8 h-5" initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>{messages[msgIdx]}</motion.p>
        <div className="w-64 h-2 rounded-full overflow-x-hidden bg-surface-2">
          <motion.div className="h-full gradient-blue rounded-full" style={{ width: `${progress}%` }} />
        </div>
        <p className="text-muted-foreground text-xs mt-2">{Math.round(progress)}%</p>
      </div>
    </div>
  );
}

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Clock, ShieldCheck, ClipboardCheck } from "lucide-react";
import SoundToggle from "@/components/SoundToggle";
import { setPhase, setIntensity } from "@/lib/musicEngine";

const features = [
  { icon: Clock, text: "Takes less than\n5 minutes" },
  { icon: ShieldCheck, text: "100% private\nand secure" },
  { icon: ClipboardCheck, text: "Personalised\nplan" },
];

export default function StartAssessment() {
  const navigate = useNavigate();
  useEffect(() => { setPhase("hope"); setIntensity("low"); }, []);

  const goToLogin = () => {
    // Keep this tap path instant on Android. Native session recovery can be slow
    // or stuck on some WebView/keychain combinations, so do not block the first
    // onboarding action on any async auth check.
    try {
      sessionStorage.setItem("bb_skip_auth_prepare_once", "1");
    } catch {
      /* sessionStorage may be unavailable in rare WebView states */
    }
    navigate("/auth", { replace: true });
  };

  return (
    <div
      className="phone-container flex flex-col items-center px-5 text-center bg-background overflow-y-auto"
      style={{
        minHeight: "100dvh",
        paddingTop: "calc(env(safe-area-inset-top) + 1rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + var(--bbdo-native-bottom-guard, 0px) + 1.5rem)",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <SoundToggle />
      <motion.h1 className="ob-title mb-8 mt-8" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        Let's understand what<br />your <span className="text-primary">body needs</span>
      </motion.h1>
      <div className="flex items-start gap-3 mb-10 w-full max-w-sm">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <motion.div key={i} className="flex flex-col items-center gap-2 flex-1" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.1 }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "var(--bbdo-blue-soft)" }}>
                <Icon className="h-6 w-6" strokeWidth={1.75} style={{ color: "var(--bbdo-blue)" }} />
              </div>
              <p className="text-[11.5px] font-medium text-muted-foreground leading-tight whitespace-pre-line">{f.text}</p>
            </motion.div>
          );
        })}
      </div>
      <motion.div className="w-full max-w-sm mt-auto pt-4" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
        <motion.button type="button" onClick={goToLogin} className="ob-cta" whileTap={{ scale: 0.98 }}>Get Started <ArrowRight className="h-4 w-4" /></motion.button>
      </motion.div>
    </div>
  );
}


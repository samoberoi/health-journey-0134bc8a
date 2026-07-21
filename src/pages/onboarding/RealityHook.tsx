import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AppIcon, AppIconName } from "@/components/ui/AppIcon";
import { HeroCard } from "@/components/ui/HeroCard";
import SoundToggle from "@/components/SoundToggle";
import { setPhase } from "@/lib/musicEngine";

type SymptomItem = { text: string; icon: AppIconName };

const symptoms: SymptomItem[] = [
  { text: "Belly fat gain", icon: "scale" },
  { text: "Sugar cravings", icon: "apple" },
  { text: "Constant fatigue", icon: "bolt" },
  { text: "Energy crashes", icon: "chartDown" },
  { text: "Brain fog", icon: "brain" },
  { text: "Poor sleep", icon: "moon" },
  { text: "Bloating", icon: "drop" },
  { text: "Joint aches", icon: "activity" },
];

export default function RealityHook() {
  const navigate = useNavigate();
  useEffect(() => { setPhase("reality"); }, []);

  const goToLogin = () => {
    try {
      sessionStorage.setItem("bb_skip_auth_prepare_once", "1");
    } catch {
      /* sessionStorage may be unavailable in rare WebView states */
    }
    navigate("/auth", { replace: true });
  };

  return (
    <div className="phone-container ob-lock overflow-x-hidden overflow-y-auto" style={{ minHeight: "100dvh", WebkitOverflowScrolling: "touch" }}>
      <SoundToggle />
      <div className="flex-1 flex flex-col px-5 pt-[calc(env(safe-area-inset-top)+2rem)] pb-[env(safe-area-inset-bottom)]">

        <HeroCard variant="navy" className="pb-8">
          <p className="bbdo-eyebrow text-white mb-3">Reality check</p>
          <h1 className="text-[30px] leading-[1.05] font-extrabold tracking-tight text-white">
            Does this <br /> feel familiar?
          </h1>
          <p className="text-[13px] mt-3 text-white/70 leading-relaxed">
            Most people ignore these signals until they become a bigger problem.
          </p>
        </HeroCard>

        <div className="grid grid-cols-2 gap-2.5 mt-5 content-start">
          {symptoms.map((s, i) => (
            <motion.div
              key={i}
              className="sub-card sub-card-tight flex items-center gap-3"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 5) * 0.04, duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className={`tile-icon shrink-0 ic-${i % 5}`}>
                <AppIcon name={s.icon} size={20} />
              </div>
              <p className="text-[13px] font-semibold text-bbdo-ink leading-tight">{s.text}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="mt-auto pt-5 pb-6 flex items-center justify-between gap-3"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <button
            onClick={goToLogin}
            className="text-bbdo-inksoft text-[13px] font-medium min-h-11 px-2 hover:text-bbdo-ink transition-colors"
          >
            Skip to Login
          </button>
          <button onClick={() => navigate("/tension")} className="ob-cta ios-tap max-w-[240px] px-6">
            This is me <AppIcon name="arrowRight" size={18} />
          </button>
        </motion.div>
      </div>
    </div>
  );
}

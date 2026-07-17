import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Trophy, Target, Flame } from "lucide-react";
import { getUser } from "@/lib/userStore";
import SoundToggle from "@/components/SoundToggle";
import { setPhase, fadeOutAndStop } from "@/lib/musicEngine";
import { useAuth } from "@/contexts/AuthContext";
import { updateProfile, syncLocalToBackend } from "@/lib/profileService";
import { sendWelcomeNotification } from "@/lib/notificationService";
import { fetchActiveSubscription } from "@/lib/subscriptionService";

const badges = [
  { icon: Trophy, label: "First Step Taken" },
  { icon: Target, label: "Assessment Complete" },
  { icon: Flame, label: "Transformation Begins" },
];

export default function DayOneScreen() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const user = getUser();
  const name = user.profile.name ?? "Friend";
  useEffect(() => { setPhase("power"); const t = setTimeout(() => fadeOutAndStop(2.5), 2000); return () => clearTimeout(t); }, []);
  const nextRoute = (() => {
    try {
      const uid = authUser?.id ?? "anon";
      return localStorage.getItem(`bbdo:tourCompleted:${uid}`) === "1" ? "/home" : "/tour";
    } catch { return "/tour"; }
  })();
  useEffect(() => { const t = setTimeout(() => navigate(nextRoute), 5000); return () => clearTimeout(t); }, [navigate, nextRoute]);

  // Mark onboarding as completed in backend
  useEffect(() => {
    if (authUser) {
      syncLocalToBackend(authUser.id).then(() => {
        fetchActiveSubscription(authUser.id).then((activeSubscription) => {
          if (!activeSubscription) {
            navigate("/plans", { replace: true });
            return;
          }
          updateProfile(authUser.id, { onboarding_completed: true }).then(() => {
            void sendWelcomeNotification(authUser.id).catch((error) => {
              console.error("sendWelcomeNotification failed", error);
            });
          });
        });
      });
    }
  }, [authUser, navigate]);

  return (
    <div className="phone-container ob-lock min-h-dvh cursor-pointer overflow-x-hidden bg-background flex flex-col items-center justify-center px-6 text-center" onClick={() => navigate(nextRoute)}>
      <SoundToggle />
      <motion.div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full gradient-blue glow-blue" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1]}}>
        <Sparkles className="h-8 w-8 text-primary-foreground" strokeWidth={1.5} />
      </motion.div>
      <motion.h1 className="ob-title mb-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>Day 1 <span className="text-primary">Unlocked</span></motion.h1>
      <motion.p className="ob-sub mb-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>{name}, your transformation starts now.</motion.p>
      <div className="ob-stack mb-10 w-full max-w-sm">
        {badges.map((b, i) => {
          const Icon = b.icon;
          return (
            <motion.div key={i} className="liquid-glass flex items-center gap-3 px-4 py-3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.15 }}>
              <div className="ob-icon liquid-glass-icon tile-icon-mint"><Icon className="h-5 w-5 text-[color:var(--bbdo-mint)]" strokeWidth={1.5} /></div>
              <p className="text-sm font-bold text-foreground">{b.label}</p>
              <span className="ml-auto text-xs font-semibold text-primary">✓ Earned</span>
            </motion.div>
          );
        })}
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ delay: 0.4, duration: 0.22 }} className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />Entering your dashboard...
      </motion.div>
    </div>
  );
}
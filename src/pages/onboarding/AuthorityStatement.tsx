import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import SoundToggle from "@/components/SoundToggle";
import { setPhase } from "@/lib/musicEngine";

export default function AuthorityStatement() {
  const navigate = useNavigate();
  useEffect(() => { setPhase("hope"); }, []);

  return (
    <div className="phone-container ob-lock min-h-dvh overflow-x-hidden bg-background flex flex-col px-6 pt-[calc(env(safe-area-inset-top)+2rem)] mobile-bottom-safe">
      <SoundToggle />
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <motion.p
          className="text-muted-foreground text-xs font-semibold uppercase tracking-[0.2em] mb-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          This is not another diet.
        </motion.p>

        <motion.h1
          className="ob-title mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          This is how your body{" "}
          <span className="text-primary">resets</span>
        </motion.h1>

        <motion.p
          className="text-muted-foreground text-sm mb-2 max-w-[280px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          Simple steps · Done consistently · Backed by science
        </motion.p>

        <motion.p
          className="text-muted-foreground/50 text-xs max-w-[260px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.75 }}
        >
          We focus on what actually moves your health.
        </motion.p>
      </div>

      <motion.div
        className="shrink-0"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        <motion.button
          onClick={() => navigate("/punch")}
          className="w-full gradient-blue text-primary-foreground font-bold py-4 rounded-full flex items-center justify-center gap-2 glow-blue"
          whileTap={{ scale: 0.98 }}
        >
          How it works <ArrowRight className="w-5 h-5" />
        </motion.button>
      </motion.div>
    </div>
  );
}

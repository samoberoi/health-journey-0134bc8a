import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { getExistingSessionUnlessLoggedOut } from "@/contexts/AuthContext";
import { resolvePostAuthRoute } from "@/lib/accessControl";

const slides = [
  {
    image: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=1200&fit=crop&crop=top",
    title: "Reset Your\nMetabolism",
    subtitle: "Science-backed lifestyle changes that actually reverse diabetes and restore your energy.",
    tag: "Science-backed",
  },
  {
    image: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&h=1200&fit=crop&crop=top",
    title: "Small Habits.\nBig Transformation.",
    subtitle: "Daily micro-habits designed by doctors and coaches — that fit into your real life.",
    tag: "Coach-designed",
  },
  {
    image: "https://images.unsplash.com/photo-1547592180-85f173990554?w=800&h=1200&fit=crop&crop=top",
    title: "Take Control of\nYour Health",
    subtitle: "Personalized plans, AI coaching, and a community cheering you on every step.",
    tag: "AI-powered",
  },
];

export default function Onboarding() {
  const [current, setCurrent] = useState(0);
  const navigate = useNavigate();

  const goToLogin = async () => {
    const existingSession = await getExistingSessionUnlessLoggedOut();
    if (existingSession) {
      const route = await resolvePostAuthRoute(existingSession.user.id, { missingProfileRoute: null });
      navigate(route ?? "/auth", { replace: true });
      return;
    }
    navigate("/auth", { replace: true });
  };

  const next = () => {
    if (current < slides.length - 1) {
      setCurrent(current + 1);
    } else {
      void goToLogin();
    }
  };

  const slide = slides[current];

  return (
    <div className="min-h-dvh flex flex-col relative overflow-x-hidden">
      {/* Full screen image */}
      <AnimatePresence initial={false}>
        <motion.div
          key={current}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <img
            src={slide.image}
            alt={slide.title}
            className="w-full h-full object-cover"
          />
          {/* Gradient overlay - heavier at bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
        </motion.div>
      </AnimatePresence>

      {/* Skip button */}
      <div className="relative z-10 flex justify-end px-6 pt-14 pb-2">
        <button
          onClick={() => void goToLogin()}
          className="text-white/70 text-sm font-medium bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10"
        >
          Skip
        </button>
      </div>

      {/* Bottom content */}
      <div className="relative z-10 flex-1 flex flex-col justify-end px-6 pb-12">
        <AnimatePresence initial={false}>
          <motion.div
            key={current}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-4"
          >
            {/* Tag pill */}
            <span className="w-fit px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-white text-xs font-medium border border-white/20">
              {slide.tag}
            </span>

            {/* Title */}
            <h1 className="text-4xl font-black text-white leading-tight whitespace-pre-line" style={{ textShadow: "0 2px 20px rgba(0,0,0,0.5)" }}>
              {slide.title}
            </h1>

            {/* Subtitle */}
            <p className="text-white/70 text-base leading-relaxed">
              {slide.subtitle}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Bottom row: dots + button */}
        <div className="flex items-center justify-between mt-8">
          <div className="flex gap-2">
            {slides.map((_, i) => (
              <motion.button
                key={i}
                onClick={() => setCurrent(i)}
                className="rounded-full bg-white transition-colors"
                animate={{
                  width: i === current ? 24 : 8,
                  opacity: i === current ? 1 : 0.4,
                }}
                style={{ height: 8 }}
              />
            ))}
          </div>

          <motion.button
            onClick={next}
            className="flex items-center gap-2 gradient-blue text-primary-foreground font-bold px-6 py-3.5 rounded-2xl glow-blue"
            whileTap={{ scale: 0.98 }}
            whileHover={{ y: -1 }}
          >
            {current === slides.length - 1 ? "Let's Begin" : "Next"}
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
    </div>
  );
}

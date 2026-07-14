import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import supplements from "@/assets/auth-carousel/supplements.png.asset.json";
import meditation from "@/assets/auth-carousel/meditation.png.asset.json";
import fasting from "@/assets/auth-carousel/fasting.png.asset.json";
import activity from "@/assets/auth-carousel/activity.png.asset.json";

const SLIDES = [
  { url: fasting.url, alt: "Fasting window — lemon water and morning light" },
  { url: activity.url, alt: "Active walking outdoors" },
  { url: meditation.url, alt: "Morning meditation and calm" },
  { url: supplements.url, alt: "Daily supplement support" },
];

interface Props {
  alt?: string;
  intervalMs?: number;
}

export default function AuthHeroCarousel({ intervalMs = 4200 }: Props) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % SLIDES.length), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);

  return (
    <>
      <AnimatePresence mode="sync">
        <motion.img
          key={i}
          src={SLIDES[i].url}
          alt={SLIDES[i].alt}
          initial={{ opacity: 0, scale: 1.05 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 0.9, ease: "easeInOut" }, scale: { duration: 6, ease: "linear" } }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </AnimatePresence>
      <div className="absolute left-1/2 -translate-x-1/2 bottom-3 flex gap-1.5 z-10">
        {SLIDES.map((_, idx) => (
          <span
            key={idx}
            className={`h-1.5 rounded-full transition-all duration-500 ${idx === i ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
          />
        ))}
      </div>
    </>
  );
}

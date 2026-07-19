import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDailyExerciseGoal } from "@/hooks/useAppSettings";
import { getTodayExerciseMinutes } from "@/lib/yogaProgressService";

export function useTodayExerciseProgress(fallbackGoal = 30) {
  const { user } = useAuth();
  const goal = useDailyExerciseGoal(fallbackGoal);
  const [minutes, setMinutes] = useState(0);

  const refresh = useCallback(async () => {
    if (!user?.id) {
      setMinutes(0);
      return;
    }
    setMinutes(await getTodayExerciseMinutes(user.id));
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!user?.id) {
        if (!cancelled) setMinutes(0);
        return;
      }
      const next = await getTodayExerciseMinutes(user.id);
      if (!cancelled) setMinutes(next);
    };

    void load();
    const onProgress = () => void load();
    window.addEventListener("exercise-log-saved", onProgress);
    window.addEventListener("bbdo:video-progress-changed", onProgress);
    window.addEventListener("bbdo:video-progress-synced", onProgress);
    window.addEventListener("storage", onProgress);
    const interval = window.setInterval(load, 60_000);

    return () => {
      cancelled = true;
      window.removeEventListener("exercise-log-saved", onProgress);
      window.removeEventListener("bbdo:video-progress-changed", onProgress);
      window.removeEventListener("bbdo:video-progress-synced", onProgress);
      window.removeEventListener("storage", onProgress);
      window.clearInterval(interval);
    };
  }, [user?.id]);

  return {
    minutes,
    goal,
    done: goal > 0 && minutes >= goal,
    refresh,
    setMinutes,
  };
}
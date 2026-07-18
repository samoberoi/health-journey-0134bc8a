import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchBreathSessionsToday, BREATH_DAILY_GOAL } from "@/lib/breathProtocol";

export function useBreathSessionsToday() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setCount(0); setLoading(false); return; }
    const c = await fetchBreathSessionsToday(user.id);
    setCount(c);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      if (!user) { if (!cancelled) { setCount(0); setLoading(false); } return; }
      const c = await fetchBreathSessionsToday(user.id);
      if (!cancelled) { setCount(c); setLoading(false); }
    })();
    const onSaved = () => refresh();
    window.addEventListener("breath-session-saved", onSaved);
    return () => { cancelled = true; window.removeEventListener("breath-session-saved", onSaved); };
  }, [user, refresh]);

  return { count, goal: BREATH_DAILY_GOAL, completed: count >= BREATH_DAILY_GOAL, refresh, loading };
}

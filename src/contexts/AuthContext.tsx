import { createContext, useContext, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { logAudit } from "@/lib/auditLog";
import { clearUser } from "@/lib/userStore";
import { sendWelcomeNotification } from "@/lib/notificationService";
import {
  clearNativePersistedAuthState,
  hasNativePersistedAuthSession,
  hydrateNativePersistence,
  persistAuthSessionToNative,
  syncNativePersistenceFromLocalStorage,
} from "@/lib/nativePersistence";
import { isNative } from "@/lib/biometric";

export const EXPLICIT_LOGOUT_KEY = "bb_explicit_logout";

export function clearPersistedAuthState(markLoggedOut = true) {
  try {
    clearUser();
    if (markLoggedOut) localStorage.setItem(EXPLICIT_LOGOUT_KEY, "1");
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("sb-") || key.toLowerCase().includes("supabase")) {
        localStorage.removeItem(key);
      }
    });
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith("sb-") || key.toLowerCase().includes("supabase")) {
        sessionStorage.removeItem(key);
      }
    });
    document.cookie.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0]?.trim();
      if (name && (name.startsWith("sb-") || name.toLowerCase().includes("supabase"))) {
        document.cookie = `${name}=; Max-Age=0; path=/`;
      }
    });
    window.dispatchEvent(new CustomEvent("bb_user_updated"));
  } catch {
    /* ignore storage cleanup errors */
  }
}

async function clearAllPersistedAuthState(markLoggedOut = true) {
  clearPersistedAuthState(markLoggedOut);
  await clearNativePersistedAuthState();
}

export async function prepareFreshLoginState() {
  await clearAllPersistedAuthState(true);
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    /* local session may already be gone */
  } finally {
    await clearAllPersistedAuthState(true);
  }
}

export async function getExistingSessionUnlessLoggedOut() {
  try {
    if (isNative()) await hydrateNativePersistence();
    let { data } = await supabase.auth.getSession();
    if (!data.session && isNative() && await hasNativePersistedAuthSession()) {
      await hydrateNativePersistence();
      const retry = await supabase.auth.getSession();
      data = retry.data;
    }
    if (data.session) {
      localStorage.removeItem(EXPLICIT_LOGOUT_KEY);
      return data.session;
    }
    if (localStorage.getItem(EXPLICIT_LOGOUT_KEY) === "1") return null;
    return data.session ?? null;
  } catch {
    return null;
  }
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  ready: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  ready: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const prevUserId = useRef<string | null>(null);

  const applySession = useCallback((nextSession: Session | null) => {
    setSession(nextSession);
    prevUserId.current = nextSession?.user?.id ?? null;
    if (nextSession) void persistAuthSessionToNative();
    else void syncNativePersistenceFromLocalStorage();
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (localStorage.getItem(EXPLICIT_LOGOUT_KEY) === "1") {
          if (session) {
            localStorage.removeItem(EXPLICIT_LOGOUT_KEY);
          } else {
            localStorage.removeItem(EXPLICIT_LOGOUT_KEY);
            applySession(null);
            setLoading(false);
            setReady(true);
            prevUserId.current = null;
            void syncNativePersistenceFromLocalStorage();
            return;
          }
        }

        const previousUid = prevUserId.current;
        applySession(session);
        setLoading(false);
        setReady(true);
        const newUid = session?.user?.id ?? null;
        if (event === "SIGNED_IN" && newUid && previousUid !== newUid) {
          logAudit({ module: "Auth", action: "login", target_type: "user", target_id: newUid });
          // Idempotent: server-side checks welcome_sent_at and no-ops if already sent.
          setTimeout(() => {
            void sendWelcomeNotification(newUid).catch((error) => {
              console.error("sendWelcomeNotification failed", error);
            });
          }, 0);
        }
        prevUserId.current = newUid;
      }
    );

    (async () => {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session && isNative() && await hasNativePersistedAuthSession()) {
        await hydrateNativePersistence();
        const retry = await supabase.auth.getSession();
        session = retry.data.session;
      }
      if (localStorage.getItem(EXPLICIT_LOGOUT_KEY) === "1") {
        if (session) {
          localStorage.removeItem(EXPLICIT_LOGOUT_KEY);
        } else {
          localStorage.removeItem(EXPLICIT_LOGOUT_KEY);
          applySession(null);
          setLoading(false);
          setReady(true);
          prevUserId.current = null;
          void syncNativePersistenceFromLocalStorage();
          return;
        }
      }

      applySession(session);
      setLoading(false);
      setReady(true);
      const uid = session?.user?.id;
      if (uid) {
        setTimeout(() => {
          void sendWelcomeNotification(uid).catch((error) => {
            console.error("sendWelcomeNotification failed", error);
          });
        }, 0);
      }
    })().catch((error) => {
      console.error("Initial auth restore failed", error);
      applySession(null);
      setLoading(false);
      setReady(true);
    });

    return () => subscription.unsubscribe();
  }, [applySession]);

  const signOut = async () => {
    const uid = session?.user?.id;
    if (uid) logAudit({ module: "Auth", action: "logout", target_type: "user", target_id: uid });
    setLoading(true);
    try {
      await supabase.auth.signOut({ scope: "global" });
    } finally {
      await clearAllPersistedAuthState();
      prevUserId.current = null;
      setSession(null);
      setLoading(false);
      setReady(true);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, ready, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

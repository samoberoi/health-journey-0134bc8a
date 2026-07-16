import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { logAudit } from "@/lib/auditLog";
import { clearUser } from "@/lib/userStore";
import { sendWelcomeNotification } from "@/lib/notificationService";
import {
  clearNativePersistedAuthState,
  persistAuthSessionToNative,
  syncNativePersistenceFromLocalStorage,
} from "@/lib/nativePersistence";

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
    const { data } = await supabase.auth.getSession();
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
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const prevUserId = useRef<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (localStorage.getItem(EXPLICIT_LOGOUT_KEY) === "1") {
          if (session) {
            localStorage.removeItem(EXPLICIT_LOGOUT_KEY);
          } else {
            localStorage.removeItem(EXPLICIT_LOGOUT_KEY);
            setSession(null);
            setLoading(false);
            prevUserId.current = null;
            void syncNativePersistenceFromLocalStorage();
            return;
          }
        }

        setSession(session);
        setLoading(false);
        if (session) void persistAuthSessionToNative();
        else void syncNativePersistenceFromLocalStorage();
        const newUid = session?.user?.id ?? null;
        if (event === "SIGNED_IN" && newUid && prevUserId.current !== newUid) {
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

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (localStorage.getItem(EXPLICIT_LOGOUT_KEY) === "1") {
        if (session) {
          localStorage.removeItem(EXPLICIT_LOGOUT_KEY);
        } else {
          localStorage.removeItem(EXPLICIT_LOGOUT_KEY);
          setSession(null);
          setLoading(false);
          prevUserId.current = null;
          void syncNativePersistenceFromLocalStorage();
          return;
        }
      }

      setSession(session);
      prevUserId.current = session?.user?.id ?? null;
      setLoading(false);
      if (session) void persistAuthSessionToNative();
      else void syncNativePersistenceFromLocalStorage();
      const uid = session?.user?.id;
      if (uid) {
        setTimeout(() => {
          void sendWelcomeNotification(uid).catch((error) => {
            console.error("sendWelcomeNotification failed", error);
          });
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
    }
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

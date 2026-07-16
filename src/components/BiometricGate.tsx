import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { App as CapApp } from "@capacitor/app";
import { useAuth } from "@/contexts/AuthContext";
import {
  BIOMETRIC_PREFERENCE_CHANGED_EVENT,
  authenticateWithBiometrics,
  isBiometricAvailable,
  isBiometricEnabled,
  isNative,
  getBiometryLabel,
} from "@/lib/biometric";

/**
 * Native-only Face ID / biometric gate.
 * - Runs on iOS/Android when the user has enabled biometric unlock in-app.
 * - Prompts on first mount (after login) and again when the app returns
 *   from background.
 * - On failure the app stays locked behind a full-screen overlay with a
 *   "Try again" button.
 */
export default function BiometricGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const [locked, setLocked] = useState<boolean>(false);
  const [authenticating, setAuthenticating] = useState<boolean>(false);
  const [biometryChecked, setBiometryChecked] = useState<boolean>(false);
  const [biometryAvailable, setBiometryAvailable] = useState<boolean>(false);
  const [label, setLabel] = useState<string>("Face ID");
  const [preferenceVersion, setPreferenceVersion] = useState(0);
  const lastAuthAt = useRef<number>(0);
  const authenticatingRef = useRef(false);

  const native = isNative();
  const biometricEnabled = isBiometricEnabled();
  const startupShield = native && loading && biometricEnabled;
  const shouldPrepareGate = native && !loading && !!session && biometricEnabled;
  const shouldGate = shouldPrepareGate;
  const gateVisible =
    startupShield ||
    (shouldPrepareGate && !biometryChecked) ||
    (shouldGate && (locked || authenticating || lastAuthAt.current === 0));

  const runAuth = useCallback(async () => {
    if (authenticatingRef.current) return;
    authenticatingRef.current = true;
    setLocked(true);
    setAuthenticating(true);
    const ok = await authenticateWithBiometrics("Unlock bye bye diabetes");
    authenticatingRef.current = false;
    setAuthenticating(false);
    if (ok) {
      lastAuthAt.current = Date.now();
      setLocked(false);
    } else {
      setLocked(true);
    }
  }, []);

  useEffect(() => {
    const syncPreference = () => setPreferenceVersion((value) => value + 1);
    window.addEventListener(BIOMETRIC_PREFERENCE_CHANGED_EVENT, syncPreference);
    window.addEventListener("storage", syncPreference);
    return () => {
      window.removeEventListener(BIOMETRIC_PREFERENCE_CHANGED_EVENT, syncPreference);
      window.removeEventListener("storage", syncPreference);
    };
  }, []);

  // Initial gate when a session appears
  useEffect(() => {
    if (!shouldPrepareGate) {
      setLocked(false);
      setAuthenticating(false);
      authenticatingRef.current = false;
      setBiometryChecked(false);
      setBiometryAvailable(false);
      lastAuthAt.current = 0;
      return;
    }
    let cancelled = false;
    void (async () => {
      const available = await isBiometricAvailable();
      if (cancelled) return;
      setBiometryAvailable(available);
      setBiometryChecked(true);
      setLabel(await getBiometryLabel());
      if (cancelled) return;
      setLocked(true);
      await runAuth();
    })();
    return () => {
      cancelled = true;
    };
  }, [runAuth, shouldPrepareGate, session?.user?.id, preferenceVersion]);

  // Re-lock whenever the native app leaves the foreground, then prompt on resume.
  useEffect(() => {
    if (!shouldGate) return;
    const sub = CapApp.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) {
        lastAuthAt.current = 0;
        setLocked(true);
        return;
      }
      if (lastAuthAt.current === 0) {
        void runAuth();
      }
    });
    return () => {
      void sub.then((s) => s.remove());
    };
  }, [runAuth, shouldGate]);

  return (
    <>
      <div className={gateVisible ? "pointer-events-none opacity-0" : undefined}>
        {children}
      </div>
      {gateVisible && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 bg-background px-8 text-center text-foreground"
        >
          <div className="text-5xl">🔒</div>
          <div>
            <h2 className="text-xl font-semibold mb-2">App locked</h2>
            <p className="text-muted-foreground text-sm">
              {startupShield || !biometryChecked
                ? "Checking your secure session…"
                : `Use ${label} to unlock bye bye diabetes.`}
            </p>
          </div>
          {biometryChecked && (
            <button
              onClick={() => void runAuth()}
              className="px-6 py-3 rounded-full bg-primary text-primary-foreground font-semibold"
            >
              Unlock with {label}
            </button>
          )}
          {biometryChecked && !biometryAvailable && (
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              Face ID is not responding. Make sure Face ID is enabled for this app in iPhone Settings, then try again.
            </p>
          )}
        </div>
      )}
    </>
  );
}

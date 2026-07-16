import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { App as CapApp } from "@capacitor/app";
import { useAuth } from "@/contexts/AuthContext";
import {
  authenticateWithBiometrics,
  isBiometricAvailable,
  isNative,
  getBiometryLabel,
  setBiometricEnabled,
} from "@/lib/biometric";
import { Button } from "@/components/ui/button";

/**
 * Native-only Face ID / biometric gate.
 * - Runs on iOS/Android automatically whenever an authenticated session exists.
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
  const lastAuthAt = useRef<number>(0);
  const authenticatingRef = useRef(false);

  const native = isNative();
  const startupShield = native && loading;
  const shouldGate = native && !loading && !!session;
  const gateVisible =
    startupShield ||
    (shouldGate && (locked || authenticating || lastAuthAt.current === 0));

  const runAuth = useCallback(async () => {
    if (authenticatingRef.current) return;
    authenticatingRef.current = true;
    setLocked(true);
    setAuthenticating(true);
    setLabel(await getBiometryLabel());
    let available = await isBiometricAvailable();
    if (!available) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      available = await isBiometricAvailable();
    }
    setBiometryAvailable(available);
    setBiometryChecked(true);
    const ok = await authenticateWithBiometrics("Unlock bye bye diabetes");
    authenticatingRef.current = false;
    setAuthenticating(false);
    if (ok) {
      setBiometricEnabled(true);
      lastAuthAt.current = Date.now();
      setLocked(false);
    } else {
      setLocked(true);
    }
  }, []);

  // Initial gate when a session appears
  useEffect(() => {
    if (!shouldGate) {
      setLocked(false);
      setAuthenticating(false);
      authenticatingRef.current = false;
      setBiometryChecked(false);
      setBiometryAvailable(false);
      lastAuthAt.current = 0;
      return;
    }
    let cancelled = false;
    setLocked(true);
    setBiometryChecked(false);
    void (async () => {
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (cancelled) return;
      await runAuth();
    })();
    return () => {
      cancelled = true;
    };
  }, [runAuth, shouldGate, session?.user?.id]);

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
            <Button
              onClick={() => void runAuth()}
              className="rounded-full px-6 font-semibold"
            >
              Unlock with {label}
            </Button>
          )}
          {biometryChecked && !biometryAvailable && (
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              If Face ID is unavailable, your device passcode can unlock this app.
            </p>
          )}
        </div>
      )}
    </>
  );
}

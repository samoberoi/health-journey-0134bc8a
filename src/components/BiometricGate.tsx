import { useEffect, useRef, useState, type ReactNode } from "react";
import { App as CapApp } from "@capacitor/app";
import { useAuth } from "@/contexts/AuthContext";
import {
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
  const { session } = useAuth();
  const [locked, setLocked] = useState<boolean>(false);
  const [label, setLabel] = useState<string>("Face ID");
  const lastAuthAt = useRef<number>(0);

  const shouldGate = isNative() && !!session && isBiometricEnabled();

  const runAuth = async () => {
    const ok = await authenticateWithBiometrics("Unlock bye bye diabetes");
    if (ok) {
      lastAuthAt.current = Date.now();
      setLocked(false);
    } else {
      setLocked(true);
    }
  };

  // Initial gate when a session appears
  useEffect(() => {
    if (!shouldGate) {
      setLocked(false);
      return;
    }
    void (async () => {
      const available = await isBiometricAvailable();
      if (!available) {
        setLocked(false);
        return;
      }
      setLabel(await getBiometryLabel());
      setLocked(true);
      await runAuth();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldGate]);

  // Re-lock when the app resumes from background (>30s since last unlock)
  useEffect(() => {
    if (!shouldGate) return;
    const sub = CapApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        const stale = Date.now() - lastAuthAt.current > 30_000;
        if (stale) {
          setLocked(true);
          void runAuth();
        }
      }
    });
    return () => {
      void sub.then((s) => s.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldGate]);

  return (
    <>
      {children}
      {locked && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-6 px-8 text-center"
          style={{ background: "#0B1220", color: "white" }}
        >
          <div className="text-5xl">🔒</div>
          <div>
            <h2 className="text-xl font-semibold mb-2">App locked</h2>
            <p className="text-white/70 text-sm">
              Use {label} to unlock bye bye diabetes.
            </p>
          </div>
          <button
            onClick={() => void runAuth()}
            className="px-6 py-3 rounded-full bg-white text-[#0B1220] font-semibold"
          >
            Unlock with {label}
          </button>
        </div>
      )}
    </>
  );
}

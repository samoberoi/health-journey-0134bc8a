import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
  BIOMETRIC_PREFERENCE_CHANGED_EVENT,
  authenticateWithBiometrics,
  getBiometryLabel,
  isBiometricAvailable,
  isBiometricEnabled,
  isNative,
  setBiometricEnabled,
} from "@/lib/biometric";

/**
 * Face ID / Touch ID unlock toggle.
 *
 * Visible on any native (iOS/Android) build. If the device doesn't support
 * biometrics (e.g. iOS simulator, no Face ID enrolled), the switch is disabled
 * and a helper line explains why — we never silently hide it, so the user
 * always knows the feature exists.
 */
export default function BiometricToggle() {
  const native = isNative();
  const [supported, setSupported] = useState(false);
  const [checking, setChecking] = useState(native);
  const [enabled, setEnabled] = useState(false);
  const [label, setLabel] = useState("Face ID");

  useEffect(() => {
    if (!native) {
      setChecking(false);
      setEnabled(false);
      return;
    }
    void (async () => {
      let ok = false;
      try {
        ok = await isBiometricAvailable();
        setSupported(ok);
        setLabel(await getBiometryLabel());
      } catch {
        setSupported(false);
      } finally {
        setEnabled(ok && isBiometricEnabled());
        setChecking(false);
      }
    })();
  }, [native]);

  useEffect(() => {
    const sync = () => setEnabled(supported && isBiometricEnabled());
    window.addEventListener(BIOMETRIC_PREFERENCE_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(BIOMETRIC_PREFERENCE_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [supported]);

  const handleToggle = async (next: boolean) => {
    if (!native) {
      toast({
        title: "Face ID is native only",
        description: "Open the installed iPhone app to use Face ID unlock.",
      });
      return;
    }
    if (next) {
      const ok = await authenticateWithBiometrics(`Enable ${label} for this app`);
      if (!ok) {
        toast({
          title: `${label} not verified`,
          description: supported
            ? "Please try again."
            : "Enroll Face ID and allow it for this app in iPhone Settings, then try again.",
        });
        return;
      }
      setSupported(true);
      setBiometricEnabled(true);
      setEnabled(true);
      toast({ title: `${label} enabled`, description: "You'll be asked to unlock on launch." });
    } else {
      setBiometricEnabled(false);
      setEnabled(false);
      toast({ title: `${label} disabled` });
    }
  };

  return (
    <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border">
      <div className="pr-3">
        <div className="text-sm font-semibold">Unlock with {label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {!native
            ? "Available in the installed iPhone app."
            : checking
            ? "Checking device support…"
            : supported
              ? `${label} is on by default and required each time you open the app.`
              : "Not available on this device. Enroll Face ID in Settings or use a real iPhone (simulator not supported)."}
        </div>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={handleToggle}
        disabled={!native || checking}
      />
    </div>
  );
}

import { useEffect, useState } from "react";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import {
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
  const [checked, setChecked] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [label, setLabel] = useState("Face ID");

  useEffect(() => {
    if (!native) {
      setChecked(false);
      return;
    }
    void (async () => {
      try {
        const ok = await isBiometricAvailable();
        setSupported(ok);
        setLabel(await getBiometryLabel());
      } catch {
        setSupported(false);
      } finally {
        setEnabled(isBiometricEnabled());
        setChecked(false);
      }
    })();
  }, [native]);

  // On the web preview, don't render — biometrics are a native feature.
  if (!native) return null;

  const handleToggle = async (next: boolean) => {
    if (!supported) {
      toast({
        title: "Face ID not available",
        description:
          "Enroll Face ID in iOS Settings, or run on a real device. Face ID doesn't work in the iOS simulator.",
      });
      return;
    }
    if (next) {
      const ok = await authenticateWithBiometrics(`Enable ${label} for this app`);
      if (!ok) {
        toast({ title: `${label} not verified`, description: "Please try again." });
        return;
      }
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
    <div className="flex items-center justify-between p-4 rounded-2xl bg-card border">
      <div className="pr-3">
        <div className="text-sm font-semibold">Unlock with {label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {checked
            ? "Checking device support…"
            : supported
              ? `Require ${label} each time you open the app.`
              : "Not available on this device. Enroll Face ID in Settings or use a real iPhone (simulator not supported)."}
        </div>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={handleToggle}
        disabled={checked || !supported}
      />
    </div>
  );
}

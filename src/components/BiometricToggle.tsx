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

export default function BiometricToggle() {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [label, setLabel] = useState("Face ID");

  useEffect(() => {
    if (!isNative()) return;
    void (async () => {
      const ok = await isBiometricAvailable();
      setSupported(ok);
      if (ok) setLabel(await getBiometryLabel());
      setEnabled(isBiometricEnabled());
    })();
  }, []);

  if (!isNative() || !supported) return null;

  const handleToggle = async (next: boolean) => {
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
      <div>
        <div className="text-sm font-semibold">Unlock with {label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          Require {label} each time you open the app.
        </div>
      </div>
      <Switch checked={enabled} onCheckedChange={handleToggle} />
    </div>
  );
}

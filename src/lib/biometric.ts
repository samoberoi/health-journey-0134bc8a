import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  BiometricAuth,
  BiometryType,
  BiometryError,
  BiometryErrorType,
  AndroidBiometryStrength,
  type CheckBiometryResult,
} from "@aparajita/capacitor-biometric-auth";
import { syncNativePersistenceFromLocalStorage } from "@/lib/nativePersistence";

const ENABLED_KEY = "bb_biometric_enabled";
const DISABLED_KEY = "bb_biometric_disabled";
export const BIOMETRIC_PREFERENCE_CHANGED_EVENT = "bb_biometric_preference_changed";

type NativeBiometricCheck = {
  available: boolean;
  biometryAvailable?: boolean;
  deviceSecure: boolean;
  biometryType: string;
  label: string;
  code: string;
  reason: string;
};

type BBDOBiometricsPlugin = {
  check(): Promise<NativeBiometricCheck>;
  authenticate(options: { reason: string }): Promise<{ success: boolean }>;
};

const BBDOBiometrics = registerPlugin<BBDOBiometricsPlugin>("BBDOBiometrics");

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export type BiometricDiagnostics = {
  native: boolean;
  platform: string;
  available: boolean;
  deviceSecure: boolean;
  label: string;
  code: string;
  reason: string;
  raw?: CheckBiometryResult;
};

function labelForBiometryType(type: BiometryType): string {
  switch (type) {
    case BiometryType.faceId:
      return "Face ID";
    case BiometryType.touchId:
      return "Touch ID";
    case BiometryType.fingerprintAuthentication:
      return "Fingerprint";
    case BiometryType.faceAuthentication:
      return "Face Unlock";
    case BiometryType.irisAuthentication:
      return "Iris";
    default:
      return Capacitor.getPlatform() === "ios" ? "Face ID / Touch ID" : "Biometrics";
  }
}

export async function getBiometricDiagnostics(): Promise<BiometricDiagnostics> {
  const platform = Capacitor.getPlatform();
  if (!isNative()) {
    return {
      native: false,
      platform,
      available: false,
      deviceSecure: false,
      label: "Face ID / Touch ID",
      code: "web-preview",
      reason: "Biometric unlock only runs in the installed iPhone app.",
    };
  }

  try {
    const info = await BBDOBiometrics.check();
    return {
      native: true,
      platform,
      available: Boolean(info.available),
      deviceSecure: Boolean(info.deviceSecure),
      label: info.label || (platform === "ios" ? "Face ID / Touch ID" : "Biometrics"),
      code: info.code || (info.available ? "available" : "unavailable"),
      reason: info.reason || "Device biometric status checked.",
    };
  } catch {
    /* Fall through to the package plugin for older installed builds. */
  }

  try {
    const info = await BiometricAuth.checkBiometry();
    return {
      native: true,
      platform,
      available: info.isAvailable && info.biometryType !== BiometryType.none,
      deviceSecure: info.deviceIsSecure,
      label: labelForBiometryType(info.biometryType),
      code: info.code || BiometryErrorType.none,
      reason: info.reason || "Device biometric status checked.",
      raw: info,
    };
  } catch (error) {
    const err = error as BiometryError;
    return {
      native: true,
      platform,
      available: false,
      deviceSecure: false,
      label: platform === "ios" ? "Face ID / Touch ID" : "Biometrics",
      code: err?.code || "plugin-error",
      reason: err?.message || "Native biometric plugin did not respond.",
    };
  }
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const info = await BBDOBiometrics.check();
    if (info.available) return true;
  } catch {
    /* Fall through to the package plugin. */
  }
  try {
    const info = await BiometricAuth.checkBiometry();
    return info.isAvailable && info.biometryType !== BiometryType.none;
  } catch {
    return false;
  }
}

export async function getBiometryLabel(): Promise<string> {
  try {
    const info = await BBDOBiometrics.check();
    if (info.label) return info.label;
  } catch {
    /* Fall through to the package plugin. */
  }
  try {
    const info = await BiometricAuth.checkBiometry();
    return labelForBiometryType(info.biometryType);
  } catch {
    return Capacitor.getPlatform() === "ios" ? "Face ID / Touch ID" : "Biometrics";
  }
}

export function isBiometricEnabled(): boolean {
  return isNative();
}

export function isBiometricSetupPending(): boolean {
  return false;
}

export function shouldRequireBiometricUnlock(): boolean {
  return isNative();
}

export function setBiometricEnabled(_on = true) {
  localStorage.setItem(ENABLED_KEY, "1");
  localStorage.removeItem(DISABLED_KEY);
  void syncNativePersistenceFromLocalStorage();
  window.dispatchEvent(new CustomEvent(BIOMETRIC_PREFERENCE_CHANGED_EVENT));
}

export async function authenticateWithBiometrics(
  reason = "Unlock bye bye diabetes"
): Promise<boolean> {
  if (isNative()) {
    try {
      const result = await BBDOBiometrics.authenticate({ reason });
      return result.success !== false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error ?? "");
      if (!/not implemented|unimplemented|plugin/i.test(message)) {
        console.warn("Native biometric auth failed:", message);
        return false;
      }
    }
  }

  try {
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: "Cancel",
      allowDeviceCredential: true,
      iosFallbackTitle: "Use passcode",
      androidTitle: "Unlock",
      androidSubtitle: reason,
      androidConfirmationRequired: false,
      androidBiometryStrength: AndroidBiometryStrength.weak,
    });
    return true;
  } catch (err) {
    const e = err as BiometryError;
    console.warn("Biometric auth failed:", e?.message ?? err);
    return false;
  }
}

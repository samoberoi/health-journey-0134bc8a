import { Capacitor } from "@capacitor/core";
import {
  BiometricAuth,
  BiometryType,
  BiometryError,
} from "@aparajita/capacitor-biometric-auth";

const ENABLED_KEY = "bb_biometric_enabled";

export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

export async function isBiometricAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try {
    const info = await BiometricAuth.checkBiometry();
    return info.isAvailable && info.biometryType !== BiometryType.none;
  } catch {
    return false;
  }
}

export async function getBiometryLabel(): Promise<string> {
  try {
    const info = await BiometricAuth.checkBiometry();
    switch (info.biometryType) {
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
        return "Biometrics";
    }
  } catch {
    return "Biometrics";
  }
}

export function isBiometricEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === "1";
}

export function setBiometricEnabled(on: boolean) {
  if (on) localStorage.setItem(ENABLED_KEY, "1");
  else localStorage.removeItem(ENABLED_KEY);
}

export async function authenticateWithBiometrics(
  reason = "Unlock bye bye diabetes"
): Promise<boolean> {
  try {
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: "Cancel",
      allowDeviceCredential: true,
      iosFallbackTitle: "Use passcode",
      androidTitle: "Unlock",
      androidSubtitle: reason,
      androidConfirmationRequired: false,
    });
    return true;
  } catch (err) {
    const e = err as BiometryError;
    console.warn("Biometric auth failed:", e?.message ?? err);
    return false;
  }
}

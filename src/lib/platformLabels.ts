import { Capacitor } from "@capacitor/core";

export function isAndroidPlatform(): boolean {
  try {
    if (Capacitor.getPlatform() === "android") return true;
  } catch {}
  if (typeof navigator !== "undefined" && /android/i.test(navigator.userAgent || "")) {
    return true;
  }
  return false;
}

export function isIOSPlatform(): boolean {
  try {
    if (Capacitor.getPlatform() === "ios") return true;
  } catch {}
  if (typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent || "")) {
    return true;
  }
  return false;
}

/** User-facing name for the OS-integrated health source. */
export function healthSourceLabel(): string {
  if (isAndroidPlatform()) return "Health Connect";
  if (isIOSPlatform()) return "Apple Health";
  return "Apple Health";
}

/** User-facing name for the phone in copy ("from your <phone>"). */
export function phoneLabel(): string {
  if (isAndroidPlatform()) return "phone";
  if (isIOSPlatform()) return "iPhone";
  return "phone";
}

/** User-facing name for the wearable ecosystem. */
export function wearableLabel(): string {
  if (isAndroidPlatform()) return "Wear OS";
  return "Apple Watch";
}

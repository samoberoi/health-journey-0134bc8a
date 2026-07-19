const VIDEO_BIOMETRIC_SUPPRESS_KEY = "bbdo_video_biometric_suppress_until";
const NATIVE_PLAYER_ACTIVE_KEY = "bbdo_native_player_active";
const VIDEO_SUPPRESSION_MS = 45 * 60 * 1000;

function storage() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage;
}

export function readNativeVideoSuppressUntil() {
  if (typeof window === "undefined") return 0;
  const memoryValue = Number((window as any).__bbdoBiometricSuppressUntil || 0);
  const storedValue = Number(storage()?.getItem(VIDEO_BIOMETRIC_SUPPRESS_KEY) || 0);
  return Math.max(memoryValue, storedValue);
}

export function extendNativeVideoSuppression() {
  if (typeof window === "undefined") return;
  const until = Date.now() + VIDEO_SUPPRESSION_MS;
  (window as any).__bbdoBiometricSuppressUntil = until;
  storage()?.setItem(VIDEO_BIOMETRIC_SUPPRESS_KEY, String(until));
}

export function isNativeVideoContextActive() {
  if (typeof window === "undefined") return false;
  return Boolean((window as any).__bbdoNativePlayerActive) || storage()?.getItem(NATIVE_PLAYER_ACTIVE_KEY) === "1";
}

export function isNativeVideoSuppressionActive() {
  return Date.now() < readNativeVideoSuppressUntil() || isNativeVideoContextActive();
}

export function markNativeVideoOpen() {
  if (typeof window === "undefined") return;
  (window as any).__bbdoNativePlayerActive = true;
  storage()?.setItem(NATIVE_PLAYER_ACTIVE_KEY, "1");
  extendNativeVideoSuppression();
}

export function markNativeVideoClosed() {
  if (typeof window === "undefined") return;
  (window as any).__bbdoNativePlayerActive = false;
  storage()?.removeItem(NATIVE_PLAYER_ACTIVE_KEY);
  extendNativeVideoSuppression();
}

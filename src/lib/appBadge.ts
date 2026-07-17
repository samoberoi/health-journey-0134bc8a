/**
 * iOS/Android app icon badge management.
 *
 * Keeps the OS-level badge (the little red dot with a number on the app icon)
 * in sync with the real unread notification count. Web/preview is a no-op.
 */
import { Capacitor } from "@capacitor/core";
import { Badge } from "@capawesome/capacitor-badge";

function isNativeBadgeSupported(): boolean {
  return Capacitor.isNativePlatform();
}

export async function setAppBadgeCount(count: number): Promise<void> {
  if (!isNativeBadgeSupported()) return;
  try {
    const safe = Math.max(0, Math.floor(count || 0));
    if (safe === 0) {
      await Badge.clear();
    } else {
      await Badge.set({ count: safe });
    }
  } catch (error) {
    console.warn("[badge] set failed", error);
  }
}

export async function clearAppBadge(): Promise<void> {
  await setAppBadgeCount(0);
}

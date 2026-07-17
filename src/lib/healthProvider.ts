/**
 * Unified health provider — routes to Apple Health on iOS and Health Connect on Android.
 * Same API surface as the original appleHealth.ts, so UI components can call one thing.
 */
import { Capacitor } from "@capacitor/core";
import type { HealthSnapshot } from "@/lib/appleHealth";
import {
  canUseAppleHealthSteps,
  syncTodayStepsFromAppleHealth,
  fetchAppleHealthSnapshot,
  writeWeightToAppleHealth,
  enableAppleHealthBackgroundSync,
  onAppleHealthDataChanged,
} from "@/lib/appleHealth";
import {
  canUseHealthConnect,
  syncTodayStepsFromHealthConnect,
  fetchHealthConnectSnapshot,
  writeWeightToHealthConnect,
  getHealthConnectPermissionState,
  requestHealthConnectAuthorization,
  openHealthConnectSettings,
} from "@/lib/healthConnect";

export type { HealthSnapshot };

export type NativeHealthPermissionState = {
  authorized: boolean;
  canRequest: boolean;
  message: string;
};

const isIOS = () => Capacitor.getPlatform() === "ios";
const isAndroid = () => Capacitor.getPlatform() === "android";

export function canUseNativeHealth(): boolean {
  return canUseAppleHealthSteps() || canUseHealthConnect();
}

/** Alias kept for legacy callers that still check "Apple Health steps". */
export const canUseHealthSteps = canUseNativeHealth;

export async function syncTodaySteps(): Promise<number | null> {
  if (isIOS()) return syncTodayStepsFromAppleHealth();
  if (isAndroid()) return syncTodayStepsFromHealthConnect();
  return null;
}

export async function fetchHealthSnapshot(): Promise<HealthSnapshot | null> {
  if (isIOS()) return fetchAppleHealthSnapshot();
  if (isAndroid()) return fetchHealthConnectSnapshot();
  return null;
}

export async function writeWeight(kg: number, at?: Date): Promise<boolean> {
  if (isIOS()) return writeWeightToAppleHealth(kg, at);
  if (isAndroid()) return writeWeightToHealthConnect(kg, at);
  return false;
}

export async function getNativeHealthPermissionState(): Promise<NativeHealthPermissionState> {
  if (isAndroid()) return getHealthConnectPermissionState();
  if (isIOS()) {
    return {
      authorized: false,
      canRequest: true,
      message: "Allow Apple Health permissions to sync your vitals.",
    };
  }
  return {
    authorized: false,
    canRequest: false,
    message: "Open the installed mobile app to sync health data.",
  };
}

export async function requestNativeHealthAuthorization(): Promise<NativeHealthPermissionState> {
  if (isAndroid()) return requestHealthConnectAuthorization();
  if (isIOS()) {
    const available = await syncTodayStepsFromAppleHealth();
    return {
      authorized: available != null,
      canRequest: available == null,
      message: available != null
        ? "Apple Health is connected."
        : "Apple Health permission was not granted.",
    };
  }
  return getNativeHealthPermissionState();
}

export async function openNativeHealthSettings(): Promise<void> {
  if (isAndroid()) await openHealthConnectSettings();
}

export async function enableHealthBackgroundSync(): Promise<boolean> {
  if (isIOS()) return enableAppleHealthBackgroundSync();
  // Health Connect doesn't expose background delivery to third-party apps.
  return false;
}

export async function onHealthDataChanged(cb: () => void): Promise<() => void> {
  if (isIOS()) return onAppleHealthDataChanged(cb);
  return () => {};
}

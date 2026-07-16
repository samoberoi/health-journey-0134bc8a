import { Capacitor, registerPlugin } from "@capacitor/core";
import { logStartupEvent, reportStartupError } from "@/lib/startupDiagnostics";

type HealthAvailability = { available: boolean };
type HealthAuthorization = { granted: boolean };
type TodaySteps = { steps: number; startDate: string; endDate: string };

export type HealthSnapshot = {
  steps?: number;
  activeCalories?: number;
  distanceMeters?: number;
  exerciseMinutes?: number;
  weightKg?: number;
  weightAt?: string;
  restingHeartRate?: number;
  restingHeartRateAt?: string;
  hrvMs?: number;
  hrvAt?: string;
  glucoseMgDl?: number;
  glucoseAt?: string;
  sleepHours?: number;
};

type BBDOHealthKitPlugin = {
  isAvailable(): Promise<HealthAvailability>;
  requestAuthorization(): Promise<HealthAuthorization>;
  getTodayStepCount(): Promise<TodaySteps>;
  getHealthSnapshot?(): Promise<HealthSnapshot>;
};

const BBDOHealthKit = registerPlugin<BBDOHealthKitPlugin>("BBDOHealthKit");

export function canUseAppleHealthSteps() {
  return Capacitor.getPlatform() === "ios" && Capacitor.isNativePlatform();
}

export async function syncTodayStepsFromAppleHealth(): Promise<number | null> {
  if (!canUseAppleHealthSteps()) return null;

  try {
    logStartupEvent("healthkit availability check");
    const availability = await BBDOHealthKit.isAvailable();
    logStartupEvent("healthkit availability result", availability.available ? "available" : "unavailable");
    if (!availability.available) return null;

    logStartupEvent("healthkit authorization requested");
    await BBDOHealthKit.requestAuthorization();
    const result = await BBDOHealthKit.getTodayStepCount();
    logStartupEvent("healthkit steps result", String(result.steps || 0));
    return Math.max(0, Math.round(Number(result.steps || 0)));
  } catch (error) {
    reportStartupError("healthkit sync failed", error);
    throw error;
  }
}

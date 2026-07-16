import { Capacitor, registerPlugin } from "@capacitor/core";

type HealthAvailability = { available: boolean };
type HealthAuthorization = { granted: boolean };
type TodaySteps = { steps: number; startDate: string; endDate: string };

type BBDOHealthKitPlugin = {
  isAvailable(): Promise<HealthAvailability>;
  requestAuthorization(): Promise<HealthAuthorization>;
  getTodayStepCount(): Promise<TodaySteps>;
};

const BBDOHealthKit = registerPlugin<BBDOHealthKitPlugin>("BBDOHealthKit");

export function canUseAppleHealthSteps() {
  return Capacitor.getPlatform() === "ios" && Capacitor.isNativePlatform();
}

export async function syncTodayStepsFromAppleHealth(): Promise<number | null> {
  if (!canUseAppleHealthSteps()) return null;

  const availability = await BBDOHealthKit.isAvailable();
  if (!availability.available) return null;

  await BBDOHealthKit.requestAuthorization();
  const result = await BBDOHealthKit.getTodayStepCount();
  return Math.max(0, Math.round(Number(result.steps || 0)));
}

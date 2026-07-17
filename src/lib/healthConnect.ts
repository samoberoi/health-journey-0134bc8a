import { Capacitor } from "@capacitor/core";
import { HealthConnect } from "capacitor-health-connect";
import type { HealthSnapshot } from "@/lib/appleHealth";
import { logStartupEvent, reportStartupError } from "@/lib/startupDiagnostics";

/** True on native Android where Health Connect can (potentially) run. */
export function canUseHealthConnect() {
  return Capacitor.getPlatform() === "android" && Capacitor.isNativePlatform();
}

const READ_TYPES = [
  "Steps",
  "Distance",
  "ActiveCaloriesBurned",
  "ExerciseSession",
  "HeartRate",
  "HeartRateVariabilityRmssd",
  "SleepSession",
  "Weight",
  "BloodGlucose",
] as const;

type ReadType = (typeof READ_TYPES)[number];

async function ensureAvailableAndAuthorized(): Promise<boolean> {
  if (!canUseHealthConnect()) return false;
  try {
    const status = await HealthConnect.checkAvailability();
    // status.availability: "Available" | "NotInstalled" | "NotSupported"
    if (status.availability !== "Available") {
      logStartupEvent("health-connect availability", status.availability);
      return false;
    }
    const perms = await HealthConnect.checkHealthPermissions({
      read: READ_TYPES as unknown as ReadType[],
      write: ["Weight"],
    } as any);
    const missing = ((perms as any)?.readPermissions ?? []).length !==
      READ_TYPES.length;
    if (missing) {
      await HealthConnect.requestHealthPermissions({
        read: READ_TYPES as unknown as ReadType[],
        write: ["Weight"],
      } as any);
    }
    return true;
  } catch (e) {
    reportStartupError("health-connect init failed", e);
    return false;
  }
}

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function endOfToday()   { const d = new Date(); d.setHours(23, 59, 59, 999); return d; }
function daysAgo(n: number) { const d = new Date(); d.setDate(d.getDate() - n); return d; }

async function aggregate(type: ReadType, start: Date, end: Date): Promise<any | null> {
  try {
    const res: any = await (HealthConnect as any).readRecords({
      type,
      timeRangeFilter: {
        type: "between",
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      },
    });
    return res?.records ?? [];
  } catch (e) {
    console.warn(`health-connect readRecords ${type} failed`, e);
    return null;
  }
}

function sum(records: any[] | null, key: string): number | undefined {
  if (!records || records.length === 0) return undefined;
  return records.reduce((acc, r) => acc + Number(r?.[key] ?? 0), 0);
}

function last<T = any>(records: any[] | null): T | undefined {
  if (!records || records.length === 0) return undefined;
  return records[records.length - 1] as T;
}

export async function syncTodayStepsFromHealthConnect(): Promise<number | null> {
  const ok = await ensureAvailableAndAuthorized();
  if (!ok) return null;
  const recs = await aggregate("Steps", startOfToday(), endOfToday());
  const total = sum(recs, "count");
  return total != null ? Math.max(0, Math.round(total)) : 0;
}

export async function fetchHealthConnectSnapshot(): Promise<HealthSnapshot | null> {
  const ok = await ensureAvailableAndAuthorized();
  if (!ok) return null;

  const [steps, distance, active, exercise, hr, hrv, sleep, weight, glucose] =
    await Promise.all([
      aggregate("Steps", startOfToday(), endOfToday()),
      aggregate("Distance", startOfToday(), endOfToday()),
      aggregate("ActiveCaloriesBurned", startOfToday(), endOfToday()),
      aggregate("ExerciseSession", startOfToday(), endOfToday()),
      aggregate("HeartRate", daysAgo(1), endOfToday()),
      aggregate("HeartRateVariabilityRmssd", daysAgo(1), endOfToday()),
      aggregate("SleepSession", daysAgo(1), endOfToday()),
      aggregate("Weight", daysAgo(30), endOfToday()),
      aggregate("BloodGlucose", daysAgo(7), endOfToday()),
    ]);

  const stepsTotal = sum(steps, "count");
  const distMeters = sum(distance, "distance") ??
    (distance ? distance.reduce((a: number, r: any) => a + Number(r?.distance?.value ?? 0), 0) : undefined);
  const activeKcal = active ? active.reduce(
    (a: number, r: any) => a + Number(r?.energy?.value ?? r?.energy ?? 0),
    0,
  ) : undefined;

  const exerciseMinutes = exercise ? Math.round(
    exercise.reduce((a: number, r: any) => {
      const s = new Date(r?.startTime).getTime();
      const e = new Date(r?.endTime).getTime();
      return a + Math.max(0, (e - s) / 60000);
    }, 0),
  ) : undefined;

  const restingHr = (() => {
    if (!hr || hr.length === 0) return undefined;
    const samples: number[] = [];
    for (const r of hr) {
      const arr = r?.samples ?? [];
      for (const s of arr) samples.push(Number(s?.beatsPerMinute ?? 0));
    }
    if (!samples.length) return undefined;
    samples.sort((a, b) => a - b);
    return Math.round(samples[Math.floor(samples.length * 0.1)]);
  })();

  const hrvMs = (() => {
    if (!hrv || hrv.length === 0) return undefined;
    const vals = hrv.map((r: any) => Number(r?.heartRateVariabilityMillis ?? 0)).filter(Boolean);
    if (!vals.length) return undefined;
    return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  })();

  const sleepHours = (() => {
    if (!sleep || sleep.length === 0) return undefined;
    const ms = sleep.reduce((a: number, r: any) => {
      const s = new Date(r?.startTime).getTime();
      const e = new Date(r?.endTime).getTime();
      return a + Math.max(0, e - s);
    }, 0);
    return ms > 0 ? +(ms / 3600000).toFixed(2) : undefined;
  })();

  const lastWeight = last<any>(weight);
  const weightKg = lastWeight
    ? Number(lastWeight?.weight?.value ?? lastWeight?.weight ?? 0) || undefined
    : undefined;
  const weightAt = lastWeight?.time ?? lastWeight?.endTime;

  const lastGlucose = last<any>(glucose);
  const glucoseMgDl = lastGlucose
    ? Math.round(Number(lastGlucose?.level?.value ?? 0) * 18.0182) || undefined
    : undefined;
  const glucoseAt = lastGlucose?.time;

  return {
    steps: stepsTotal != null ? Math.round(stepsTotal) : undefined,
    distanceMeters: distMeters ? Math.round(distMeters) : undefined,
    activeCalories: activeKcal ? Math.round(activeKcal) : undefined,
    exerciseMinutes,
    restingHeartRate: restingHr,
    hrvMs,
    sleepHours,
    weightKg,
    weightAt,
    glucoseMgDl,
    glucoseAt,
  };
}

export async function writeWeightToHealthConnect(kg: number, at?: Date): Promise<boolean> {
  if (!canUseHealthConnect() || !kg || kg <= 0) return false;
  try {
    const ok = await ensureAvailableAndAuthorized();
    if (!ok) return false;
    await (HealthConnect as any).insertRecords({
      records: [{
        type: "Weight",
        time: (at ?? new Date()).toISOString(),
        weight: { value: kg, unit: "kilograms" },
      }],
    });
    return true;
  } catch (e) {
    console.warn("writeWeightToHealthConnect failed", e);
    return false;
  }
}

export async function openHealthConnectSettings(): Promise<void> {
  try { await (HealthConnect as any).openHealthConnectSetting?.(); } catch {}
}

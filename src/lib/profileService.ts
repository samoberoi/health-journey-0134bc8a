import { supabase } from "@/integrations/supabase/client";
import { getUser, saveUser } from "./userStore";
import { fireHealthMetricFeedback } from "@/lib/healthAlerts";

export interface ProfileRow {
  user_id: string;
  phone?: string;
  country?: string;
  country_code?: string;
  email?: string;
  name?: string;
  age?: number;
  gender?: string;
  goals?: any;
  height?: number;
  weight?: number;
  bmi?: number;
  bmi_category?: string;
  waist?: number;
  clinical?: any;
  lifestyle?: any;
  deep_profiling?: any;
  assessment?: any;
  avatar_url?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  onboarding_completed?: boolean;
  birth_date?: string;
  marital_status?: string;
  anniversary_date?: string;
  spouse_name?: string;
  coach_name?: string;
  created_at?: string;
  initial_health_score?: number;
  initial_assessment_date?: string;
}

/** Fetch profile from backend and sync to localStorage */
export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles" as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch profile:", error);
    return null;
  }
  return data as unknown as ProfileRow | null;
}

/** Create a new profile row */
export async function createProfile(profile: ProfileRow) {
  const { data, error } = await supabase
    .from("profiles" as any)
    .insert(profile as any)
    .select()
    .single();

  if (error) {
    console.error("Failed to create profile:", error);
    return null;
  }
  return data as unknown as ProfileRow;
}

/** Update an existing profile (upserts if missing) */
export async function updateProfile(userId: string, updates: Partial<ProfileRow>) {
  const shouldCheckHealthAlert =
    Object.prototype.hasOwnProperty.call(updates, "weight") ||
    !!(updates.clinical as any)?.systolicBP ||
    !!(updates.clinical as any)?.diastolicBP;
  const previousProfile = shouldCheckHealthAlert ? await fetchProfile(userId) : null;

  const { error } = await supabase
    .from("profiles" as any)
    .upsert({ user_id: userId, ...updates } as any, { onConflict: "user_id" });

  if (error) {
    console.error("Failed to update profile:", error);
    return false;
  }

  const nextWeight = Number((updates as any).weight);
  if (Number.isFinite(nextWeight) && previousProfile?.weight !== nextWeight) {
    void fireHealthMetricFeedback(
      { user_id: userId, log_type: "weight", weight_kg: nextWeight },
      previousProfile?.weight ?? null,
    );
  }

  const clinical = (updates.clinical ?? {}) as any;
  const previousClinical = (previousProfile?.clinical ?? {}) as any;
  const systolic = Number(clinical.systolicBP ?? clinical.bp_systolic ?? clinical.systolic ?? clinical.bloodPressureSystolic);
  const diastolic = Number(clinical.diastolicBP ?? clinical.bp_diastolic ?? clinical.diastolic ?? clinical.bloodPressureDiastolic);
  const previousSystolic = Number(previousClinical.systolicBP ?? previousClinical.bp_systolic ?? previousClinical.systolic ?? previousClinical.bloodPressureSystolic);
  const previousDiastolic = Number(previousClinical.diastolicBP ?? previousClinical.bp_diastolic ?? previousClinical.diastolic ?? previousClinical.bloodPressureDiastolic);
  const bpChanged = systolic !== previousSystolic || diastolic !== previousDiastolic;
  if (Number.isFinite(systolic) && Number.isFinite(diastolic) && bpChanged) {
    void fireHealthMetricFeedback({
      user_id: userId,
      log_type: "bp",
      bp_systolic: systolic,
      bp_diastolic: diastolic,
    });
  }

  return true;
}

/** Sync current localStorage data to backend */
export async function syncLocalToBackend(userId: string) {
  const local = getUser();

  const updates: Partial<ProfileRow> = {
    name: local.profile.name,
    age: local.profile.age,
    gender: local.profile.gender,
    goals: (local.profile as any).goals ?? [],
    height: local.bodyMetrics.height,
    weight: local.bodyMetrics.weight,
    bmi: local.bodyMetrics.bmi,
    bmi_category: local.bodyMetrics.bmiCategory,
    waist: (local.bodyMetrics as any).waist,
    clinical: local.clinical,
    lifestyle: local.lifestyle,
    deep_profiling: local.deepProfiling,
    assessment: local.assessment,
  };

  // Remove undefined values
  Object.keys(updates).forEach((key) => {
    if ((updates as any)[key] === undefined) delete (updates as any)[key];
  });

  return updateProfile(userId, updates);
}

/** Load backend profile into localStorage */
export function loadProfileToLocal(profile: ProfileRow) {
  const compact = (obj: Record<string, any>) =>
    Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined && value !== null));

  const payload: any = {
    profile: compact({
      phone: profile.phone,
      country: profile.country,
      country_code: profile.country_code,
      name: profile.name,
      age: profile.age,
      gender: profile.gender,
      email: profile.email,
      goals: profile.goals,
    }),
    bodyMetrics: compact({
      height: profile.height,
      weight: profile.weight,
      bmi: profile.bmi,
      bmiCategory: profile.bmi_category,
      waist: profile.waist,
    }),
  };

  if (profile.clinical != null) payload.clinical = profile.clinical;
  if (profile.lifestyle != null) payload.lifestyle = profile.lifestyle;
  if (profile.deep_profiling != null) payload.deepProfiling = profile.deep_profiling;
  if (profile.assessment != null) payload.assessment = profile.assessment;
  if (profile.avatar_url != null) payload.avatarUrl = profile.avatar_url;

  saveUser(payload);
}

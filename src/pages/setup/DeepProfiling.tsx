import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, FlaskConical, Pill, Stethoscope, Utensils, Circle } from "lucide-react";
import { saveUser, getUser } from "@/lib/userStore";
import { calculateHealthScore, calculateBMI, inferClinicalValues } from "@/lib/healthEngine";
import type { BodyMetrics, ClinicalData, LifestyleData, DeepProfilingData } from "@/lib/healthEngine";
import { insertOnboardingLogs } from "@/lib/healthLogsService";
import { useAuth } from "@/contexts/AuthContext";

interface StepConfig {
  id: string; question: string; type: "slider" | "select"; icon: React.ReactNode;
  options?: { id: string; label: string }[];
  min?: number; max?: number; step?: number; unit?: string;
  defaultValue?: number; skippable?: boolean;
}

const steps: StepConfig[] = [
  { id: "hba1cInput", question: "Do you know your HbA1c reading?", type: "slider", icon: <FlaskConical className="w-6 h-6 text-destructive" strokeWidth={1.5} />, min: 4, max: 14, step: 0.1, unit: "%", defaultValue: 5.7, skippable: true },
  { id: "fastingGlucose", question: "What's your fasting glucose level?", type: "slider", icon: <FlaskConical className="w-6 h-6 text-primary" strokeWidth={1.5} />, min: 60, max: 300, step: 1, unit: "mg/dL", defaultValue: 100, skippable: true },
  { id: "bellyFat", question: "Do you have visible belly fat?", type: "select", icon: <Circle className="w-6 h-6 text-warning" strokeWidth={1.5} />, options: [{ id: "yes", label: "Yes, noticeably" }, { id: "no", label: "No, not really" }] },
  { id: "medicationCount", question: "How many medications do you take daily?", type: "select", icon: <Pill className="w-6 h-6 text-primary" strokeWidth={1.5} />, options: [{ id: "none", label: "None" }, { id: "0_1", label: "0-1 medications" }, { id: "2_3", label: "2-3 medications" }, { id: "4_plus", label: "4 or more" }] },
  { id: "medications", question: "Are you on insulin?", type: "select", icon: <Pill className="w-6 h-6 text-destructive" strokeWidth={1.5} />, options: [{ id: "none", label: "No insulin" }, { id: "insulin", label: "Yes, insulin only" }, { id: "insulin_plus", label: "Yes, insulin + oral meds" }] },
  { id: "bpMedication", question: "Are you on BP medication?", type: "select", icon: <Pill className="w-6 h-6 text-primary" strokeWidth={1.5} />, options: [{ id: "no", label: "No" }, { id: "yes", label: "Yes" }, { id: "unsure", label: "Not sure" }] },
  { id: "lipidMedication", question: "Are you on cholesterol/lipid medication?", type: "select", icon: <Pill className="w-6 h-6 text-warning" strokeWidth={1.5} />, options: [{ id: "no", label: "No" }, { id: "yes", label: "Yes" }, { id: "unsure", label: "Not sure" }] },
  { id: "thyroidMedication", question: "Are you on thyroid medication?", type: "select", icon: <Pill className="w-6 h-6 text-primary" strokeWidth={1.5} />, options: [{ id: "no", label: "No" }, { id: "yes", label: "Yes" }, { id: "unsure", label: "Not sure" }] },
  { id: "thyroid", question: "Do you have thyroid issues?", type: "select", icon: <Stethoscope className="w-6 h-6 text-primary" strokeWidth={1.5} />, options: [{ id: "no", label: "No" }, { id: "yes", label: "Yes" }, { id: "unsure", label: "Not sure" }] },
  { id: "vitaminD", question: "Are you Vitamin D deficient?", type: "select", icon: <Stethoscope className="w-6 h-6 text-warning" strokeWidth={1.5} />, options: [{ id: "no", label: "No" }, { id: "yes", label: "Yes" }, { id: "unsure", label: "Not sure" }] },
  { id: "fattyLiver", question: "Have you been diagnosed with fatty liver?", type: "select", icon: <Stethoscope className="w-6 h-6 text-primary" strokeWidth={1.5} />, options: [{ id: "no", label: "No" }, { id: "yes", label: "Yes" }, { id: "unsure", label: "Not sure" }] },
  { id: "pcos", question: "Do you have PMOS?", type: "select", icon: <Stethoscope className="w-6 h-6 text-primary" strokeWidth={1.5} />, options: [{ id: "no", label: "No" }, { id: "yes", label: "Yes" }, { id: "unsure", label: "Not sure" }] },
  { id: "dietQuality", question: "How would you rate your overall diet?", type: "select", icon: <Utensils className="w-6 h-6 text-primary" strokeWidth={1.5} />, options: [{ id: "poor", label: "Poor — lots of junk food, sugar" }, { id: "average", label: "Average — mix of good and bad" }, { id: "good", label: "Good — mostly healthy, home-cooked" }] },
  { id: "stressLevel", question: "How would you rate your stress level?", type: "select", icon: <Stethoscope className="w-6 h-6 text-destructive" strokeWidth={1.5} />, options: [{ id: "low", label: "Low — I manage well" }, { id: "moderate", label: "Moderate — sometimes overwhelmed" }, { id: "high", label: "High — constantly stressed" }] },
];

export default function DeepProfiling() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [sliderValues, setSliderValues] = useState<Record<string, number>>({});

  const localUser = getUser();
  const gender = localUser.profile?.gender ?? "male";
  const filteredSteps = steps.filter(s => !(s.id === "pcos" && gender === "male"));
  const step = filteredSteps[current];
  const progress = ((current + 1) / filteredSteps.length) * 100;
  const getSliderVal = (s: StepConfig) => sliderValues[s.id] ?? s.defaultValue ?? s.min ?? 0;
  const canProceed = step.type === "slider" ? true : !!answers[step.id];

  const finishAndCalculate = async (finalAnswers: Record<string, any>) => {
    const tempAnswers = { ...finalAnswers };
    steps.filter(s => s.type === "slider").forEach(s => { if (sliderValues[s.id] !== undefined && !(s.id in tempAnswers)) tempAnswers[s.id] = sliderValues[s.id]; });
    const has = (k: string) => tempAnswers[k] !== undefined && tempAnswers[k] !== null;
    const dp: DeepProfilingData = {
      hba1cInput: has("hba1cInput") ? tempAnswers.hba1cInput : null,
      fastingGlucose: has("fastingGlucose") ? tempAnswers.fastingGlucose : null,
      bellyFat: has("bellyFat") ? tempAnswers.bellyFat === "yes" : null,
      medicationCount: has("medicationCount") ? tempAnswers.medicationCount : null,
      medications: has("medications") ? tempAnswers.medications : null,
      bpMedication: has("bpMedication") ? tempAnswers.bpMedication === "yes" : null,
      lipidMedication: has("lipidMedication") ? tempAnswers.lipidMedication === "yes" : null,
      thyroidMedication: has("thyroidMedication") ? tempAnswers.thyroidMedication === "yes" : null,
      thyroid: has("thyroid") ? tempAnswers.thyroid : null,
      vitaminD: has("vitaminD") ? tempAnswers.vitaminD : null,
      fattyLiver: has("fattyLiver") ? tempAnswers.fattyLiver : null,
      pcos: has("pcos") ? tempAnswers.pcos : null,
      dietQuality: has("dietQuality") ? tempAnswers.dietQuality : null,
      stressLevel: has("stressLevel") ? tempAnswers.stressLevel : null,
    } as any;
    saveUser({ deepProfiling: dp as any });
    const u = getUser();
    const h = u.bodyMetrics.height ?? 170; const w = u.bodyMetrics.weight ?? 70;
    const { bmi, bmiCategory } = calculateBMI(h, w);
    const body: BodyMetrics = { height: h, weight: w, bmi, bmiCategory, waist: (u.bodyMetrics as any).waist ?? 80 };
    const clinical = inferClinicalValues(u.clinical as ClinicalData);
    const lifestyle = u.lifestyle as LifestyleData;
    const assessment = calculateHealthScore(body, clinical, lifestyle, dp, gender);
    saveUser({ bodyMetrics: body, assessment });

    // Seed initial health logs from onboarding data
    if (authUser) {
      insertOnboardingLogs(authUser.id, {
        weight: w,
        fastingGlucose: tempAnswers.fastingGlucose,
      });
      // Save initial health score baseline
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        await supabase.from("profiles").update({
          initial_health_score: assessment.healthScore,
          initial_assessment_date: new Date().toISOString(),
        }).eq("user_id", authUser.id);
      } catch (e) { console.error("Failed to save initial_health_score", e); }
    }

    navigate("/processing");
  };

  const goNext = () => {
    const updated = { ...answers };
    if (step.type === "slider") { updated[step.id] = getSliderVal(step); setAnswers(updated); }
    if (current < filteredSteps.length - 1) setCurrent(current + 1);
    else finishAndCalculate(updated);
  };

  const skip = () => {
    const updated = { ...answers, [step.id]: null };
    setAnswers(updated);
    if (current < filteredSteps.length - 1) setCurrent(current + 1);
    else finishAndCalculate(updated);
  };

  const sliderBg = (val: number, min: number, max: number) => {
    const pct = ((val - min) / (max - min)) * 100;
    return `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${pct}%, hsl(var(--border)) ${pct}%, hsl(var(--border)) 100%)`;
  };

  return (
    <div className="phone-container min-h-dvh flex flex-col px-5 pt-14 mobile-bottom-safe bg-background">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted-foreground text-xs font-medium">Detailed Assessment</span>
          <span className="text-primary text-xs font-medium">{current + 1}/{filteredSteps.length}</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <div className="flex flex-col flex-1">
        <div className="mb-8">
          <div className="w-12 h-12 rounded-2xl liquid-glass flex items-center justify-center mb-4">{step.icon}</div>
          <h1 className="text-2xl font-black text-foreground mb-2">{step.question}</h1>
          <p className="text-muted-foreground text-xs">Skip if you don't know or prefer not to answer.</p>
        </div>

        {step.type === "select" && step.options && (
          <div className="flex flex-col gap-2 flex-1">
            {step.options.map((opt) => (
              <motion.button key={opt.id} onClick={() => setAnswers({ ...answers, [step.id]: opt.id })} whileTap={{ scale: 0.98 }}
                className={`text-left p-4 rounded-xl border-2 transition-colors ${answers[step.id] === opt.id ? "border-primary bg-primary/5 shadow-sm" : "bg-card border-border"}`}>
                <span className={`text-sm font-medium ${answers[step.id] === opt.id ? "text-primary" : "text-foreground"}`}>{opt.label}</span>
              </motion.button>
            ))}
          </div>
        )}

        {step.type === "slider" && (
          <div className="flex-1 flex flex-col justify-center">
            <div className="text-center mb-8">
              <span className="text-5xl font-black text-primary">{getSliderVal(step)}</span>
              <span className="text-muted-foreground text-lg ml-2">{step.unit}</span>
            </div>
            <input type="range" min={step.min} max={step.max} step={step.step} value={getSliderVal(step)}
              onChange={(e) => setSliderValues({ ...sliderValues, [step.id]: parseFloat(e.target.value) })}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ background: sliderBg(getSliderVal(step), step.min ?? 0, step.max ?? 100) }} />
            <div className="flex justify-between text-muted-foreground text-xs mt-2">
              <span>{step.min} {step.unit}</span><span>{step.max} {step.unit}</span>
            </div>
          </div>
        )}
      </div>


      <div className="flex gap-3 mt-6 shrink-0">
        <button onClick={() => current > 0 ? setCurrent(current - 1) : navigate("/projection-preview")} className="w-14 h-14 rounded-xl flex items-center justify-center text-muted-foreground bg-card">
          <ArrowLeft className="w-5 h-5" />
        </button>
        {step.type === "slider" && step.skippable && (
          <button onClick={skip} className="h-14 px-5 rounded-2xl flex items-center justify-center text-sm font-semibold text-muted-foreground bg-card">
            Skip
          </button>
        )}
        <motion.button onClick={goNext} disabled={!canProceed} className="flex-1 gradient-blue text-primary-foreground font-bold py-4 rounded-xl glow-blue disabled:opacity-40 flex items-center justify-center gap-2" whileTap={{ scale: 0.98 }}>
          {current === filteredSteps.length - 1 ? "Calculate My Score" : "Next"} <ArrowRight className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );
}

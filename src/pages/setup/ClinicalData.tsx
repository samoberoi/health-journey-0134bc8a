import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, Heart, HelpCircle } from "lucide-react";
import { saveUser, getUser } from "@/lib/userStore";

type Answer = "yes" | "no" | "not_sure";
type DiabetesType = "type1" | "type2" | "prediabetes" | "not_sure";
interface Question { id: string; text: string; subtitle: string; followUp?: boolean; }

const questions: Question[] = [
  { id: "hasDiabetes", text: "Have you been diagnosed with Diabetes?", subtitle: "Type 1, Type 2, or Prediabetes diagnosed by a doctor.", followUp: true },
  { id: "hasHypertension", text: "Do you have high blood pressure?", subtitle: "Also known as Hypertension, diagnosed or told by a doctor." },
  { id: "hasCardiovascular", text: "Any heart or cardiovascular condition?", subtitle: "Heart disease, stroke, chest pain, or related conditions." },
];

const answerOptions: { id: Answer; label: string; description: string }[] = [
  { id: "yes", label: "Yes", description: "Diagnosed / confirmed" },
  { id: "no", label: "No", description: "Not applicable to me" },
  { id: "not_sure", label: "Not Sure", description: "I'm uncertain" },
];

const diabetesTypeOptions: { id: DiabetesType; label: string; description: string }[] = [
  { id: "type1", label: "Type 1", description: "Autoimmune, insulin dependent" },
  { id: "type2", label: "Type 2", description: "Lifestyle-related insulin resistance" },
  { id: "prediabetes", label: "Prediabetes", description: "Borderline high blood sugar" },
  { id: "not_sure", label: "Not Sure", description: "I don't know the type" },
];

export default function ClinicalData() {
  const navigate = useNavigate();
  const stored = getUser().clinical;
  const [currentQ, setCurrentQ] = useState(0);
  const [showDiabetesType, setShowDiabetesType] = useState(false);
  const [diabetesType, setDiabetesType] = useState<DiabetesType | null>(null);
  const [answers, setAnswers] = useState<Record<string, Answer | undefined>>({ hasDiabetes: undefined, hasHypertension: undefined, hasCardiovascular: undefined });

  const q = questions[currentQ];
  const currentAnswer = answers[q.id];
  const isLast = currentQ === questions.length - 1;
  const progress = 75 + ((currentQ + 1) / questions.length) * 10;

  const selectAnswer = (answer: Answer) => {
    setAnswers((prev) => ({ ...prev, [q.id]: answer }));
    if (q.id === "hasDiabetes") {
      if (answer === "yes") setShowDiabetesType(true);
      else { setShowDiabetesType(false); setDiabetesType(null); }
    }
  };

  const canGoNext = () => {
    if (!currentAnswer) return false;
    if (q.id === "hasDiabetes" && currentAnswer === "yes" && !diabetesType) return false;
    return true;
  };

  const next = () => {
    if (!canGoNext()) return;
    if (!isLast) { setCurrentQ(currentQ + 1); setShowDiabetesType(false); }
    else {
      const toBoolean = (a: Answer | undefined) => a === "yes";
      saveUser({
        clinical: {
          hba1c: stored.hba1c ?? 5.5, systolicBP: stored.systolicBP ?? 115, diastolicBP: stored.diastolicBP ?? 75,
          cholesterol: stored.cholesterol, hasDiabetes: toBoolean(answers.hasDiabetes),
          hasHypertension: toBoolean(answers.hasHypertension), hasCardiovascular: toBoolean(answers.hasCardiovascular),
          familyHistoryDiabetes: false, familyHistoryHeart: false, diabetesType: diabetesType ?? undefined,
        } as any,
      });
      navigate("/setup/lifestyle");
    }
  };

  const prev = () => {
    if (showDiabetesType) { setShowDiabetesType(false); return; }
    if (currentQ > 0) setCurrentQ(currentQ - 1);
    else navigate("/setup/stats");
  };

  const renderOptions = (opts: { id: string; label: string; description: string }[], selectedId: string | null | undefined, onSelect: (id: string) => void) =>
    opts.map((opt) => {
      const isSelected = selectedId === opt.id;
      return (
        <motion.button key={opt.id} onClick={() => onSelect(opt.id)} whileTap={{ scale: 0.98 }}
          className={`w-full flex items-center justify-between p-5 rounded-2xl border-2 text-left transition-colors ${isSelected ? "border-primary bg-primary/5 shadow-sm" : "bg-card border-border"}`}>
          <div>
            <p className={`text-base font-bold ${isSelected ? "text-primary" : "text-foreground"}`}>{opt.label}</p>
            <p className="text-muted-foreground text-xs mt-0.5">{opt.description}</p>
          </div>
          {isSelected && (
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">✓</span>
            </div>
          )}
        </motion.button>
      );
    });

  return (
    <div className="phone-container min-h-dvh flex flex-col px-5 pt-14 mobile-bottom-safe bg-background">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted-foreground text-xs font-medium">Step 4 of 5</span>
          <span className="text-primary text-xs font-medium">80%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <div className="flex flex-col flex-1">
        <div className="mb-8">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
            {showDiabetesType ? <HelpCircle className="w-6 h-6 text-warning" strokeWidth={1.8} /> : <Heart className="w-6 h-6 text-destructive" strokeWidth={1.8} />}
          </div>
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-widest mb-2">
            {showDiabetesType ? "More Details" : `Health History · ${currentQ + 1} of ${questions.length}`}
          </p>
          <h1 className="text-3xl font-black text-foreground mb-2">{showDiabetesType ? "What type of diabetes?" : q.text}</h1>
          <p className="text-muted-foreground text-sm">{showDiabetesType ? "This helps us tailor your plan more accurately." : q.subtitle}</p>
        </div>
        <div className="flex flex-col gap-3 flex-1">
          {showDiabetesType ? renderOptions(diabetesTypeOptions, diabetesType, (id) => setDiabetesType(id as DiabetesType))
            : renderOptions(answerOptions, currentAnswer, selectAnswer as (id: string) => void)}
        </div>
      </div>


      <div className="flex gap-3 mt-8 shrink-0">
        <button onClick={prev} className="w-14 h-14 rounded-xl flex items-center justify-center text-muted-foreground bg-card">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <motion.button onClick={next} disabled={!canGoNext()} className="flex-1 gradient-blue text-primary-foreground font-bold py-4 rounded-xl glow-blue disabled:opacity-40 flex items-center justify-center gap-2" whileTap={{ scale: 0.98 }}>
          {isLast && !showDiabetesType ? "Continue" : "Next"} <ArrowRight className="w-5 h-5" />
        </motion.button>
      </div>
    </div>
  );
}

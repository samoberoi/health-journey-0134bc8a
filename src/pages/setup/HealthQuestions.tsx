import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, CheckCircle, XCircle, HelpCircle,
  Syringe, Ban, BedDouble, Coffee, Smile, Moon,
  Armchair, Footprints, PersonStanding, Dumbbell,
  Leaf, Sun, AlertTriangle, Flame
} from "lucide-react";
import { LucideIcon } from "lucide-react";

type Option = { id: string; icon: LucideIcon; iconColor: string; label: string; sublabel?: string };
type Question = { id: string; question: string; subtitle: string; options: Option[] };

const questions: Question[] = [
  { id: "diabetes_management", question: "Managing your diabetes?", subtitle: "This helps us understand where you're starting from.", options: [
    { id: "yes", icon: CheckCircle, iconColor: "text-primary", label: "Yes, actively", sublabel: "On medication / monitoring" },
    { id: "no", icon: XCircle, iconColor: "text-destructive", label: "No, not yet", sublabel: "Haven't started" },
    { id: "unsure", icon: HelpCircle, iconColor: "text-warning", label: "Not sure", sublabel: "Let's figure it out" },
  ]},
  { id: "insulin", question: "Are you on insulin?", subtitle: "We'll adapt your plan based on your current treatment.", options: [
    { id: "yes", icon: Syringe, iconColor: "text-primary", label: "Yes", sublabel: "Currently on insulin" },
    { id: "no", icon: Ban, iconColor: "text-muted-foreground", label: "No", sublabel: "Not on insulin" },
  ]},
  { id: "sleep", question: "How's your sleep?", subtitle: "Sleep is deeply linked to metabolic health.", options: [
    { id: "restless", icon: AlertTriangle, iconColor: "text-destructive", label: "Restless", sublabel: "< 5 hours, poor quality" },
    { id: "okay", icon: Coffee, iconColor: "text-warning", label: "Okay-ish", sublabel: "5-6 hours, interrupted" },
    { id: "good", icon: Smile, iconColor: "text-primary", label: "Pretty good", sublabel: "6-7 hours, mostly fine" },
    { id: "solid", icon: Moon, iconColor: "text-secondary", label: "Solid sleeper", sublabel: "7-8+ hours, rested" },
  ]},
  { id: "activity", question: "How active are you?", subtitle: "Your current fitness level shapes your plan.", options: [
    { id: "sedentary", icon: Armchair, iconColor: "text-muted-foreground", label: "Sedentary", sublabel: "Mostly desk / sitting" },
    { id: "light", icon: Footprints, iconColor: "text-warning", label: "Light", sublabel: "Occasional walks" },
    { id: "active", icon: PersonStanding, iconColor: "text-primary", label: "Active", sublabel: "3-4x workouts/week" },
    { id: "very_active", icon: Dumbbell, iconColor: "text-secondary", label: "Very Active", sublabel: "Daily intense training" },
  ]},
  { id: "stress", question: "What's your stress level?", subtitle: "Chronic stress spikes blood glucose — we account for this.", options: [
    { id: "chill", icon: Leaf, iconColor: "text-secondary", label: "Super chill", sublabel: "Mostly relaxed" },
    { id: "mild", icon: Sun, iconColor: "text-warning", label: "Mild", sublabel: "Some stress, manageable" },
    { id: "moderate", icon: Flame, iconColor: "text-primary", label: "Moderate", sublabel: "Often stressed" },
    { id: "high", icon: AlertTriangle, iconColor: "text-destructive", label: "High", sublabel: "Very stressed, burnout-ish" },
  ]},
];

export default function HealthQuestions() {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const q = questions[currentQ];
  const progress = Math.round(((currentQ + 1) / questions.length) * 100);

  const answer = (id: string) => {
    const newAnswers = { ...answers, [q.id]: id };
    setAnswers(newAnswers);
    setTimeout(() => {
      if (currentQ < questions.length - 1) setCurrentQ(currentQ + 1);
      else navigate("/setup/score");
    }, 350);
  };

  return (
    <div className="phone-container min-h-dvh flex flex-col px-5 pt-14 mobile-bottom-safe bg-background">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-muted-foreground text-xs font-medium">Health check {currentQ + 1}/{questions.length}</span>
          <span className="text-primary text-xs font-medium">{progress}%</span>
        </div>
        <Progress value={progress} className="h-1.5" />
      </div>

      <div className="flex flex-col flex-1">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-foreground mb-2">{q.question}</h1>
          <p className="text-muted-foreground text-sm">{q.subtitle}</p>
        </div>
        <div className="flex flex-col gap-3 flex-1">
          {q.options.map((opt) => {
            const Icon = opt.icon;
            const isSelected = answers[q.id] === opt.id;
            return (
              <motion.button key={opt.id} onClick={() => answer(opt.id)} whileTap={{ scale: 0.98 }}
                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-colors ${isSelected ? "border-primary bg-primary/10" : "bg-card border-border"}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isSelected ? "bg-primary/20" : "liquid-glass"}`}>
                  <Icon className={`w-5 h-5 ${opt.iconColor}`} strokeWidth={1.8} />
                </div>
                <div className="text-left flex-1">
                  <p className="text-foreground font-semibold text-sm">{opt.label}</p>
                  {opt.sublabel && <p className="text-muted-foreground text-xs mt-0.5">{opt.sublabel}</p>}
                </div>
                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>


      {currentQ > 0 && (
        <button onClick={() => setCurrentQ(currentQ - 1)} className="flex items-center gap-2 text-muted-foreground mt-6 w-fit">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.8} /><span className="text-sm">Previous</span>
        </button>
      )}
    </div>
  );
}

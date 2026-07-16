import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import PageTransition from "@/components/PageTransition";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import BiometricGate from "@/components/BiometricGate";
import { isNative } from "@/lib/biometric";

import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProfileSyncProvider } from "@/components/ProfileSyncProvider";
import { ConfirmProvider } from "@/components/ConfirmProvider";
import { LanguageProvider } from "@/contexts/LanguageContext";
import AutoTranslator from "@/components/AutoTranslator";

import Splash from "./pages/Splash";
import LanguageSelect from "./pages/LanguageSelect";
import Auth from "./pages/Auth";
import BasicDetails from "./pages/setup/BasicDetails";
import BodyStats from "./pages/setup/BodyStats";
import ClinicalData from "./pages/setup/ClinicalData";
import LifestyleQuestions from "./pages/setup/LifestyleQuestions";
import HealthScore from "./pages/setup/HealthScore";
import Purpose from "./pages/setup/Purpose";
import HealthQuestions from "./pages/setup/HealthQuestions";
import Plans from "./pages/Plans";
import Payment from "./pages/Payment";
import TestPay from "./pages/TestPay";
import Dashboard from "./pages/Dashboard";
import Tour from "./pages/Tour";
import NotFound from "./pages/NotFound";
import CoachDashboard from "./pages/CoachDashboard";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsersInsights from "./pages/admin/AdminUsersInsights";
import NotificationsPage from "./pages/NotificationsPage";
import PartnerDashboard from "./pages/PartnerDashboard";


// Phase 0 — Entry Experience
import RealityHook from "./pages/onboarding/RealityHook";
import TensionScreen from "./pages/onboarding/TensionScreen";
import BreakPattern from "./pages/onboarding/BreakPattern";

// Phase 1 — Proof & Hope
import TransformationStory from "./pages/onboarding/TransformationStory";
import AuthorityStatement from "./pages/onboarding/AuthorityStatement";
import PunchFramework from "./pages/onboarding/PunchFramework";
import StartAssessment from "./pages/onboarding/StartAssessment";

// Phase 3 — Transformation Insight
import AnalyzingScreen from "./pages/onboarding/AnalyzingScreen";
import InsightScreen from "./pages/onboarding/InsightScreen";
import HopeScreen from "./pages/onboarding/HopeScreen";
import ProjectionPreview from "./pages/onboarding/ProjectionPreview";

// Phase 4 — Deep Profiling
import DeepProfiling from "./pages/setup/DeepProfiling";

// Phase 5 — Processing & Interpretation
import ProcessingScreen from "./pages/onboarding/ProcessingScreen";
import ScoreInterpretation from "./pages/onboarding/ScoreInterpretation";

// Phase 6 — Trajectory
import TrajectoryScreen from "./pages/onboarding/TrajectoryScreen";

// Phase 8 — Commitment
import CommitmentScreen from "./pages/onboarding/CommitmentScreen";

// Phase 9 — Day One


const queryClient = new QueryClient();

const PUBLIC_ENTRY_ROUTES = new Set([
  "/",
  "/language",
  "/reality-hook",
  "/tension",
  "/break-pattern",
  "/transformation",
  "/authority",
  "/punch",
  "/start-assessment",
  "/auth",
]);

function NativeSessionRedirect() {
  const { session, loading, ready } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNative() || loading || !ready || !session) return;
    if (PUBLIC_ENTRY_ROUTES.has(location.pathname)) {
      navigate("/home", { replace: true });
    }
  }, [loading, location.pathname, navigate, ready, session]);

  return null;
}

function NativeAuthStartupGate({ children }: { children: ReactNode }) {
  const { loading, ready } = useAuth();

  if (isNative() && (loading || !ready)) {
    return (
      <div className="min-h-dvh w-full bg-background flex items-center justify-center text-foreground">
        <div className="h-6 w-6 rounded-full border-2 border-primary/25 border-t-primary animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}

function AnimatedRoutes() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0 });
  }, [location.pathname]);
  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={location.pathname}>

        {/* Phase 0 — Entry */}
        <Route path="/" element={<PageTransition><Splash /></PageTransition>} />
        <Route path="/language" element={<PageTransition><LanguageSelect /></PageTransition>} />

        <Route path="/reality-hook" element={<PageTransition><RealityHook /></PageTransition>} />
        <Route path="/tension" element={<PageTransition><TensionScreen /></PageTransition>} />
        <Route path="/break-pattern" element={<PageTransition><BreakPattern /></PageTransition>} />

        {/* Phase 1 — Proof & Hope */}
        <Route path="/transformation" element={<PageTransition><TransformationStory /></PageTransition>} />
        <Route path="/authority" element={<PageTransition><AuthorityStatement /></PageTransition>} />
        <Route path="/punch" element={<PageTransition><PunchFramework /></PageTransition>} />
        <Route path="/start-assessment" element={<PageTransition><StartAssessment /></PageTransition>} />

        {/* Phase 2 — Smart Screening */}
        <Route path="/auth" element={<PageTransition><Auth /></PageTransition>} />
        <Route path="/setup/purpose" element={<PageTransition><Purpose /></PageTransition>} />
        <Route path="/setup/basic-details" element={<PageTransition><BasicDetails /></PageTransition>} />
        <Route path="/setup/stats" element={<PageTransition><BodyStats /></PageTransition>} />
        <Route path="/setup/clinical" element={<PageTransition><ClinicalData /></PageTransition>} />
        <Route path="/setup/lifestyle" element={<PageTransition><LifestyleQuestions /></PageTransition>} />
        <Route path="/setup/health" element={<PageTransition><HealthQuestions /></PageTransition>} />

        {/* Phase 3 — Transformation Insight */}
        <Route path="/analyzing" element={<PageTransition><AnalyzingScreen /></PageTransition>} />
        <Route path="/insight" element={<PageTransition><InsightScreen /></PageTransition>} />
        <Route path="/hope" element={<PageTransition><HopeScreen /></PageTransition>} />
        <Route path="/projection-preview" element={<PageTransition><ProjectionPreview /></PageTransition>} />

        {/* Phase 4 — Deep Profiling */}
        <Route path="/setup/deep-profiling" element={<PageTransition><DeepProfiling /></PageTransition>} />

        {/* Phase 5 — Result Engine */}
        <Route path="/processing" element={<PageTransition><ProcessingScreen /></PageTransition>} />
        <Route path="/setup/score" element={<PageTransition><HealthScore /></PageTransition>} />
        <Route path="/score-interpretation" element={<PageTransition><ScoreInterpretation /></PageTransition>} />

        {/* Phase 6 — Trajectory */}
        <Route path="/trajectory" element={<PageTransition><TrajectoryScreen /></PageTransition>} />

        {/* Phase 7 — Plans */}
        <Route path="/plans" element={<PageTransition><Plans /></PageTransition>} />

        {/* Phase 8 — Commitment */}
        <Route path="/commitment" element={<PageTransition><CommitmentScreen /></PageTransition>} />

        {/* Phase 8 — Payment */}
        <Route path="/payment" element={<PageTransition><Payment /></PageTransition>} />
        <Route path="/test-pay" element={<PageTransition><TestPay /></PageTransition>} />

        {/* Phase 9 — Day One */}
        

        {/* Product */}
        <Route path="/tour" element={<PageTransition><Tour /></PageTransition>} />
        <Route path="/home" element={<PageTransition><Dashboard /></PageTransition>} />
        <Route path="/dashboard" element={<PageTransition><Dashboard /></PageTransition>} />
        <Route path="/coach-dashboard" element={<PageTransition><CoachDashboard /></PageTransition>} />
        <Route path="/admin-dashboard" element={<PageTransition><AdminDashboard /></PageTransition>} />
        <Route path="/admin/users-insights" element={<PageTransition><AdminUsersInsights /></PageTransition>} />
        <Route path="/partner-dashboard" element={<PageTransition><PartnerDashboard /></PageTransition>} />
        <Route path="/notifications" element={<PageTransition><NotificationsPage /></PageTransition>} />


        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <LanguageProvider>
            <AutoTranslator />
            <ProfileSyncProvider>
              <ConfirmProvider>
                <AppErrorBoundary>
                  <BiometricGate>
                    <NativeAuthStartupGate>
                      <NativeSessionRedirect />
                      <AnimatedRoutes />
                    </NativeAuthStartupGate>
                  </BiometricGate>
                </AppErrorBoundary>
              </ConfirmProvider>
            </ProfileSyncProvider>
          </LanguageProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

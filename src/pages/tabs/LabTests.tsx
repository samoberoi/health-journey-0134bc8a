import PatientLabTests from "@/components/PatientLabTests";
import AppErrorBoundary from "@/components/AppErrorBoundary";

export default function LabTestsTab({ foundationMode = false }: { foundationMode?: boolean } = {}) {
  return (
    <div className="theme-supplements px-4 md:px-6 pt-3 md:pt-8 space-y-5">
      <div
        className="rounded-2xl p-5 md:p-6 text-white shadow-card relative overflow-hidden"
        style={{ background: foundationMode ? "var(--pillar-supplements)" : "var(--bbdo-ink)" }}
      >
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <p className="text-[11px] font-bold tracking-[0.18em] uppercase text-white/80 break-words">
          {foundationMode ? "Day-1 Essential" : "Your Reports"}
        </p>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight mt-1 break-words leading-tight">
          {foundationMode ? "Get your baseline — BBDO Basic" : "Recommended tests & reports"}
        </h1>
        <p className="text-sm text-white/85 mt-1 max-w-xl break-words">
          {foundationMode
            ? "A lab test is critical to personalise your plan. We strongly recommend BBDO Basic to lock in your baseline. Once your report is in, your Health Profile & body map unlock on Home."
            : "Tests recommended by your coach plus all your past reports in one place."}
        </p>
      </div>
      <AppErrorBoundary
        fallbackTitle="Lab tests need a refresh"
        fallbackMessage="Please refresh once. Your bookings are saved and will appear here after the screen reloads."
      >
        <PatientLabTests alwaysShow foundationMode={foundationMode} />
      </AppErrorBoundary>
    </div>
  );
}

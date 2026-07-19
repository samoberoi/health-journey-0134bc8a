import thyrocareLogo from "@/assets/thyrocare-logo.svg";

type ThyrocarePoweredByProps = {
  variant?: "light" | "dark";
  className?: string;
};

export default function ThyrocarePoweredBy({ variant = "light", className = "" }: ThyrocarePoweredByProps) {
  const isLight = variant === "light";

  return (
    <div
      className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 ring-1 ${
        isLight
          ? "bg-white ring-white shadow-md"
          : "bg-card ring-border shadow-sm"
      } ${className}`}
      aria-label="Powered by Thyrocare"
    >
      <span className="text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground/80 leading-none whitespace-nowrap">
        Powered by
      </span>
      <img
        src={thyrocareLogo}
        alt="Thyrocare"
        className="h-6 md:h-7 w-auto object-contain"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

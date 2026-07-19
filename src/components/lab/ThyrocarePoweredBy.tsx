import thyrocareLogo from "@/assets/thyrocare-logo.svg";

type ThyrocarePoweredByProps = {
  variant?: "light" | "dark";
  className?: string;
};

export default function ThyrocarePoweredBy({ variant = "light", className = "" }: ThyrocarePoweredByProps) {
  const isLight = variant === "light";

  return (
    <div
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 ring-1 ${
        isLight
          ? "bg-white ring-white shadow-md"
          : "bg-card ring-border shadow-sm"
      } ${className}`}
      aria-label="Powered by Thyrocare"
    >
      <span className="text-[8px] font-black uppercase tracking-[0.14em] text-muted-foreground/80 leading-none whitespace-nowrap">
        Powered by
      </span>
      <img
        src={thyrocareLogo}
        alt="Thyrocare"
        className="h-5 w-auto object-contain"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

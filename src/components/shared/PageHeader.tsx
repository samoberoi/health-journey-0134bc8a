import { cn } from "@/lib/utils";

interface Props {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  className?: string;
}

/**
 * Unified screen header. Every tab / subscreen opens with this
 * so users see the same visual "you are here" pattern everywhere.
 */
export default function PageHeader({ eyebrow, title, subtitle, right, className }: Props) {
  return (
    <header className={cn("px-5 pt-5 pb-4 flex items-start justify-between gap-4", className)}>
      <div className="flex-1 min-w-0">
        {eyebrow && (
          <div className="bbdo-eyebrow mb-1.5 text-muted-foreground break-words">{eyebrow}</div>
        )}
        <h1 className="text-[22px] sm:text-[26px] leading-[1.1] tracking-tight font-semibold text-foreground break-words">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-muted-foreground leading-snug break-words">{subtitle}</p>
        )}
      </div>
      {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
    </header>
  );
}

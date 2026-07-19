type ThyrocarePoweredByProps = {
  variant?: "light" | "dark";
  className?: string;
};

export default function ThyrocarePoweredBy({ variant = "light", className = "" }: ThyrocarePoweredByProps) {
  const isLight = variant === "light";

  return (
    <div
      className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1.5 ring-1 ${
        isLight
          ? "bg-background/95 text-foreground ring-white/70 shadow-sm"
          : "bg-card text-foreground ring-border shadow-sm"
      } ${className}`}
      aria-label="Powered by ThyroKare"
    >
      <span className="text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground leading-none whitespace-nowrap">
        Powered by
      </span>
      <span className="inline-flex items-center" aria-hidden="true">
        <svg viewBox="0 0 142 28" className="h-4 w-[82px]" role="img">
          <title>ThyroKare</title>
          <path d="M8 5.2h7.7v3.1h-2.2v14.5H10V8.3H8V5.2Z" fill="#1C9BD7" />
          <path d="M18.1 5.2h3.5v6.8c.8-.8 1.8-1.2 3-1.2 2.7 0 4.4 1.9 4.4 4.9v7.1h-3.5v-6.6c0-1.4-.7-2.2-1.9-2.2s-2 .8-2 2.2v6.6h-3.5V5.2Z" fill="#1C9BD7" />
          <path d="M31.2 11.1h3.7l2.7 7 2.5-7h3.6l-5.2 12.7c-1 2.4-2.2 3.4-4.4 3.4-.9 0-1.8-.2-2.6-.6l.9-2.7c.4.2.9.3 1.3.3.7 0 1.1-.3 1.5-1.1l-4.6-12Z" fill="#1C9BD7" />
          <path d="M45.5 11.1h3.5v2.3c.7-1.6 1.8-2.6 3.8-2.5v3.7h-.2c-2.3 0-3.6 1.3-3.6 4.1v4.1h-3.5V11.1Z" fill="#1C9BD7" />
          <path d="M53.8 17c0-3.4 2.7-6.2 6.4-6.2s6.4 2.7 6.4 6.1c0 3.4-2.7 6.2-6.4 6.2s-6.4-2.7-6.4-6.1Zm9.3 0c0-1.7-1.2-3.1-2.9-3.1s-2.9 1.3-2.9 3c0 1.7 1.2 3.1 2.9 3.1s2.9-1.3 2.9-3Z" fill="#1C9BD7" />
          <path d="M69.5 5.2h3.6v7.7l6.6-7.7h4.3l-6.7 7.6 7 10h-4.2l-5.2-7.5-1.8 2v5.5h-3.6V5.2Z" fill="#E4232E" />
          <path d="M84.5 19.4c0-2.6 2-3.8 4.9-3.8 1.2 0 2.1.2 3 .5v-.2c0-1.4-.9-2.2-2.6-2.2-1.3 0-2.3.3-3.4.7l-.9-2.7c1.4-.6 2.7-.9 4.8-.9 1.9 0 3.3.5 4.2 1.4.9.9 1.3 2.2 1.3 3.8v6.8h-3.4v-1.3c-.8.9-2 1.5-3.7 1.5-2.3 0-4.2-1.3-4.2-3.6Zm8- .8V18c-.6-.3-1.4-.5-2.2-.5-1.5 0-2.4.6-2.4 1.7 0 .9.8 1.5 1.9 1.5 1.6 0 2.7-.9 2.7-2.1Z" fill="#E4232E" />
          <path d="M98.8 11.1h3.5v2.3c.7-1.6 1.8-2.6 3.8-2.5v3.7h-.2c-2.3 0-3.6 1.3-3.6 4.1v4.1h-3.5V11.1Z" fill="#E4232E" />
          <path d="M107.1 17c0-3.4 2.4-6.2 5.9-6.2 4 0 5.8 3.1 5.8 6.4 0 .3 0 .6-.1.9h-8.2c.3 1.5 1.4 2.3 2.9 2.3 1.1 0 2-.4 2.9-1.2l2 1.8c-1.1 1.4-2.8 2.2-4.9 2.2-3.6-.1-6.3-2.6-6.3-6.2Zm8.3-1c-.2-1.5-1.1-2.5-2.4-2.5-1.4 0-2.3 1-2.5 2.5h4.9Z" fill="#E4232E" />
          <circle cx="128.8" cy="14" r="10.5" fill="#1C9BD7" opacity="0.14" />
          <path d="M124.1 14.7h3.8v3.8h2.5v-3.8h3.8v-2.5h-3.8V8.4h-2.5v3.8h-3.8v2.5Z" fill="#E4232E" />
        </svg>
      </span>
    </div>
  );
}
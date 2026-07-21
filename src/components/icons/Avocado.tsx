import { forwardRef, HTMLAttributes } from "react";
import avocadoAsset from "@/assets/avocado.png.asset.json";

interface AvocadoProps extends Omit<HTMLAttributes<HTMLSpanElement>, "children"> {
  size?: number | string;
  /** Accepted for Lucide-icon API compatibility. Ignored — image is full-color. */
  strokeWidth?: number | string;
  /** Accepted for Lucide-icon API compatibility. Ignored. */
  color?: string;
  /** Accepted for Lucide-icon API compatibility. Ignored. */
  fill?: string;
}

/**
 * Cute kawaii avocado icon rendered as a transparent PNG.
 *
 * Drop-in replacement for a Lucide icon: accepts the same size / className
 * props, so callers like `<Icon className="w-4 h-4" />` continue to size it
 * correctly. Because the PNG is transparent, whatever background the parent
 * surface uses shows through — the icon inherits the surrounding look & feel.
 */
const Avocado = forwardRef<HTMLSpanElement, AvocadoProps>(
  ({ size, className, style, strokeWidth: _sw, color: _c, fill: _f, ...props }, ref) => {
    const dimStyle =
      size != null
        ? { width: typeof size === "number" ? `${size}px` : size, height: typeof size === "number" ? `${size}px` : size }
        : undefined;
    return (
      <span
        ref={ref}
        aria-hidden="true"
        className={`inline-flex items-center justify-center align-middle ${className ?? ""}`}
        style={{ ...dimStyle, ...style }}
        {...props}
      >
        <img
          src={avocadoAsset.url}
          alt=""
          draggable={false}
          className="w-full h-full object-contain select-none pointer-events-none"
        />
      </span>
    );
  }
);
Avocado.displayName = "Avocado";

export default Avocado;

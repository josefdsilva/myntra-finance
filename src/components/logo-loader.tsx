import { cn } from "@/lib/utils";

/**
 * Animated version of the bynku mark: seven bars grouped 4+3, bouncing up
 * and down to signal loading. Mirrors public/favicon.svg so the brand stays
 * consistent while a route/menu resolves.
 */
export function LogoLoader({
  className,
  size = 32,
  label = "Loading",
}: {
  className?: string;
  size?: number;
  label?: string;
}) {
  // Stagger delays so the bars ripple instead of moving in unison.
  const delays = [0, 90, 180, 270, 120, 210, 300];
  // Bar width and gap scale with size (in px) so the bounce reads crisply at any
  // size — a small pill loader looks as lively as the big boot splash, instead
  // of cramping to a static blur.
  const bar = Math.max(2, Math.round(size * 0.12));
  const gap = Math.max(2, Math.round(size * 0.06));
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-flex items-end", className)}
      style={{ height: size, gap }}
    >
      {delays.map((d, i) => (
        <span
          key={i}
          className="logo-loader-bar inline-block rounded-full bg-primary"
          style={{
            width: bar,
            // extra gap between the group of 4 and the group of 3
            marginLeft: i === 4 ? gap : undefined,
            animationDelay: `${d}ms`,
          }}
        />
      ))}
    </span>
  );
}

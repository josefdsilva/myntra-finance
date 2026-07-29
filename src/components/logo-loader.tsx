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
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-flex items-end gap-[3px]", className)}
      style={{ height: size, width: size }}
    >
      {delays.map((d, i) => (
        <span
          key={i}
          className={cn(
            "logo-loader-bar inline-block w-[8%] rounded-full bg-primary",
            // small visual gap between the group of 4 and the group of 3
            i === 4 && "ml-[6%]",
          )}
          style={{ animationDelay: `${d}ms` }}
        />
      ))}
    </span>
  );
}

import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaTo?: string;
  onCta?: () => void;
  className?: string;
};

/**
 * Friendly "nothing here yet" panel used across the app. Explains *why* the
 * screen matters and points the user at the setup screen that fills it in.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  ctaTo,
  onCta,
  className,
}: EmptyStateProps) {
  return (
    <Card className={cn("border-dashed bg-muted/30", className)}>
      <CardContent className="flex flex-col items-center text-center gap-3 py-10 px-6">
        {Icon && (
          <div className="size-11 rounded-full bg-primary/10 text-primary grid place-items-center">
            <Icon className="size-5" />
          </div>
        )}
        <div className="space-y-1 max-w-md">
          <h3 className="font-medium">{title}</h3>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {ctaLabel && (ctaTo || onCta) && (
          <div className="pt-1">
            {ctaTo ? (
              <Button asChild size="sm">
                <Link to={ctaTo}>{ctaLabel}</Link>
              </Button>
            ) : (
              <Button size="sm" onClick={onCta}>
                {ctaLabel}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

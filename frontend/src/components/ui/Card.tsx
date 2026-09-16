import { cn } from "@/lib/cn";

/**
 * Card chrome, tuned for density.
 *
 * Padding here is deliberately tight: the dashboard's job is to fit the whole
 * picture on a 1440x900 laptop without scrolling, and card padding repeated
 * across eleven panels is where that budget is won or lost. Readability is
 * held by keeping type sizes intact and taking the space out of the gaps
 * instead.
 */
export function Card({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-lg border border-surface-200 bg-white shadow-sm",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-2 border-b border-surface-200 px-3.5 py-2.5",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: React.ComponentProps<"h3">) {
  return (
    <h3
      className={cn(
        "text-[13px] leading-tight font-semibold text-navy-900",
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      className={cn("mt-0.5 text-[11px] leading-snug text-surface-500", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardBody({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div className={cn("px-3.5 py-3", className)} {...props}>
      {children}
    </div>
  );
}

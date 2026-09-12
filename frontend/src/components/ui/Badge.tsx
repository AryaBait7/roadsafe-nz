import { cn } from "@/lib/cn";
import type { CrashSeverity } from "@/types";

type Tone = "neutral" | "info" | "warning" | "placeholder";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-100 text-surface-700 border-surface-200",
  info: "bg-accent-500/10 text-accent-600 border-accent-500/20",
  warning: "bg-safety-400/15 text-navy-800 border-safety-500/30",
  placeholder: "bg-safety-400/20 text-navy-900 border-safety-500/40",
};

export function Badge({
  tone = "neutral",
  className,
  children,
  ...props
}: React.ComponentProps<"span"> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        tones[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * Marks a panel whose numbers are NOT real NZTA data.
 *
 * Required wherever `meta.source === "placeholder"`. Placeholder figures must
 * never be presentable as crash statistics.
 */
export function PlaceholderBadge({ title }: { title?: string }) {
  return (
    <Badge tone="placeholder" title={title ?? "Not real NZTA data"}>
      Placeholder
    </Badge>
  );
}

const severityStyles: Record<CrashSeverity, string> = {
  "Fatal Crash": "bg-severity-fatal/10 text-severity-fatal border-severity-fatal/25",
  "Serious Crash":
    "bg-severity-serious/10 text-severity-serious border-severity-serious/25",
  "Minor Crash": "bg-severity-minor/15 text-navy-800 border-severity-minor/30",
  "Non-Injury Crash":
    "bg-severity-none/15 text-surface-700 border-severity-none/30",
};

export function SeverityBadge({ severity }: { severity: CrashSeverity }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold",
        severityStyles[severity],
      )}
    >
      {severity}
    </span>
  );
}

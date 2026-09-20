import { cn } from "@/lib/cn";

interface SelectProps extends React.ComponentProps<"select"> {
  label: string;
  options: readonly string[];
  /** Shown as the "no filter applied" option. */
  placeholder?: string;
  /** Marks the control as rejected, for both sighted and assistive users. */
  invalid?: boolean;
  /** Id of the message explaining why, announced with the control. */
  describedBy?: string;
}

/**
 * Native <select> rather than a custom dropdown: keyboard navigation, mobile
 * pickers and screen-reader support all work without reimplementation.
 */
export function Select({
  label,
  options,
  placeholder = "All",
  className,
  id,
  invalid = false,
  describedBy,
  ...props
}: SelectProps) {
  const selectId = id ?? `select-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="flex flex-col gap-1">
      <label
        htmlFor={selectId}
        className="text-[10px] font-medium tracking-wide text-surface-400"
      >
        {label}
      </label>
      <select
        id={selectId}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-8 rounded-md border bg-navy-800 px-2 text-xs text-white",
          // Colour is not the only signal: the message below names the
          // problem, and aria-invalid carries it to assistive technology.
          invalid
            ? "border-safety-400 focus:border-safety-300"
            : "border-navy-600 hover:border-navy-500 focus:border-accent-400",
          className,
        )}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

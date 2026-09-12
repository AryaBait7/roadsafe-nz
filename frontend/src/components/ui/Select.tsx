import { cn } from "@/lib/cn";

interface SelectProps extends React.ComponentProps<"select"> {
  label: string;
  options: readonly string[];
  /** Shown as the "no filter applied" option. */
  placeholder?: string;
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
  ...props
}: SelectProps) {
  const selectId = id ?? `select-${label.toLowerCase().replace(/\s+/g, "-")}`;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={selectId}
        className="text-xs font-medium text-surface-300"
      >
        {label}
      </label>
      <select
        id={selectId}
        className={cn(
          "h-9 rounded-md border border-navy-600 bg-navy-800 px-2.5 text-sm text-white",
          "hover:border-navy-500 focus:border-accent-400",
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

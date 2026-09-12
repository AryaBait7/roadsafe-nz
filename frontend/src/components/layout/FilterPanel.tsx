import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import type { FilterOptions } from "@/types";

/**
 * Sidebar filters.
 *
 * Options are injected rather than fetched here so this stays presentational
 * and the shell can render before any data exists. Wiring the controls to URL
 * search params happens in Stage 3.
 *
 * Date range is a year range, not a date picker: CAS has no finer time
 * resolution than `crashYear`, and a day-level picker would imply precision
 * the dataset does not have.
 */
export function FilterPanel({ options }: { options?: FilterOptions }) {
  const years = options
    ? Array.from({ length: options.yearMax - options.yearMin + 1 }, (_, i) =>
        String(options.yearMin + i),
      )
    : [];

  return (
    <div className="space-y-4 border-t border-navy-700 px-4 py-5">
      <h2 className="text-[11px] font-semibold tracking-wider text-surface-400 uppercase">
        Filters
      </h2>

      <div className="grid grid-cols-2 gap-2">
        <Select label="Year from" options={years} placeholder="Earliest" />
        <Select label="Year to" options={years} placeholder="Latest" />
      </div>

      <Select label="Region" options={options?.regions ?? []} />
      <Select label="Road type" options={options?.roadTypes ?? []} />
      <Select
        label="Speed environment"
        options={options?.speedEnvironments ?? []}
      />
      <Select label="Crash severity" options={options?.severities ?? []} />

      <Button className="w-full" size="sm">
        Apply filters
      </Button>
    </div>
  );
}

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { parseFilters, toSearchParams } from "@/lib/filters";
import type { CrashFilters, FilterOptions } from "@/types";

/**
 * Global filters.
 *
 * The URL is the source of truth; this form holds only the *pending*
 * selection until Apply. That keeps a half-built filter set out of the
 * address bar and stops every dropdown change from triggering a navigation
 * and a server round-trip.
 *
 * Date range is year granularity because `crashYear` is the finest time
 * resolution CAS publishes — a day picker would imply precision the dataset
 * does not have.
 */

function FilterForm({
  options,
  current,
}: {
  options?: FilterOptions;
  current: CrashFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [draft, setDraft] = useState<CrashFilters>(current);

  const set = (key: keyof CrashFilters) => (value: string) =>
    setDraft((previous) => ({
      ...previous,
      [key]: value === "" ? undefined : value,
    }));

  const setYear = (key: "yearFrom" | "yearTo") => (value: string) =>
    setDraft((previous) => ({
      ...previous,
      [key]: value === "" ? undefined : Number(value),
    }));

  const apply = () => {
    const query = toSearchParams(draft).toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const reset = () => {
    setDraft({});
    router.push(pathname);
  };

  const years = options
    ? Array.from({ length: options.yearMax - options.yearMin + 1 }, (_, i) =>
        String(options.yearMin + i),
      )
    : [];

  const unchanged =
    toSearchParams(draft).toString() === toSearchParams(current).toString();
  const isEmpty = toSearchParams(draft).toString() === "";

  return (
    <div className="space-y-4 border-t border-navy-700 px-4 py-5">
      <h2 className="text-[11px] font-semibold tracking-wider text-surface-400 uppercase">
        Filters
      </h2>

      <div className="grid grid-cols-2 gap-2">
        <Select
          label="Year from"
          options={years}
          placeholder="Earliest"
          value={draft.yearFrom ?? ""}
          onChange={(event) => setYear("yearFrom")(event.target.value)}
        />
        <Select
          label="Year to"
          options={years}
          placeholder="Latest"
          value={draft.yearTo ?? ""}
          onChange={(event) => setYear("yearTo")(event.target.value)}
        />
      </div>

      <Select
        label="Region"
        options={options?.regions ?? []}
        value={draft.region ?? ""}
        onChange={(event) => set("region")(event.target.value)}
      />
      <Select
        label="Road type"
        options={options?.roadTypes ?? []}
        value={draft.roadType ?? ""}
        onChange={(event) => set("roadType")(event.target.value)}
      />
      <Select
        label="Speed environment"
        options={options?.speedEnvironments ?? []}
        value={draft.speedEnvironment ?? ""}
        onChange={(event) => set("speedEnvironment")(event.target.value)}
      />
      <Select
        label="Crash severity"
        options={options?.severities ?? []}
        value={draft.severity ?? ""}
        onChange={(event) => set("severity")(event.target.value)}
      />

      <div className="flex gap-2 pt-1">
        <Button size="sm" className="flex-1" onClick={apply} disabled={unchanged}>
          Apply filters
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={reset}
          disabled={isEmpty && unchanged}
        >
          Reset
        </Button>
      </div>
    </div>
  );
}

export function FilterPanel({ options }: { options?: FilterOptions }) {
  const searchParams = useSearchParams();
  const current = parseFilters(Object.fromEntries(searchParams.entries()));

  // Keyed on the query string so a URL change (chip removal, Reset, browser
  // back) remounts the form with fresh state. Re-syncing inside an effect
  // would work too, but it causes a cascading render and the linter is right
  // to flag it — remounting is the idiomatic way to reset state from a prop.
  return (
    <FilterForm
      key={searchParams.toString()}
      options={options}
      current={current}
    />
  );
}

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
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
  // Filtered pages render on the server, so a new view can take a moment.
  // Navigating inside a transition keeps the current page on screen and
  // exposes that wait, instead of a button that appears to do nothing.
  const [isPending, startTransition] = useTransition();
  const navigate = (href: string) => startTransition(() => router.push(href));

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
    navigate(query ? `${pathname}?${query}` : pathname);
  };

  const reset = () => {
    setDraft({});
    navigate(pathname);
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
    <div
      className="space-y-2.5 border-t border-navy-700 px-3 py-3.5"
      aria-busy={isPending}
    >
      <h2 className="text-[10px] font-semibold tracking-wider text-surface-400 uppercase">
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
        <Button
          size="sm"
          className="flex-1"
          onClick={apply}
          disabled={unchanged || isPending}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-1.5">
              <span
                aria-hidden
                className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
              Updating…
            </span>
          ) : (
            "Apply filters"
          )}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={reset}
          disabled={(isEmpty && unchanged) || isPending}
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

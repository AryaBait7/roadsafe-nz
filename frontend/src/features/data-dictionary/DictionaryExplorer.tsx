"use client";

import { Fragment, useDeferredValue, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/states/EmptyState";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/formatters";
import type { DataDictionaryField, MlRole } from "@/types";

const USAGE_FILTERS = {
  all: { label: "All columns", test: () => true },
  dashboard: {
    label: "Used in the dashboard",
    test: (f: DataDictionaryField) => f.usedInDashboard,
  },
  ml: {
    label: "Model target or candidate",
    test: (f: DataDictionaryField) => f.ml === "Target" || f.ml === "Candidate",
  },
  excluded: {
    label: "Excluded from the model",
    test: (f: DataDictionaryField) => f.ml === "Excluded",
  },
  derived: {
    label: "Derived by the pipeline",
    test: (f: DataDictionaryField) => f.derived,
  },
  sparse: {
    label: "Over 50% missing",
    test: (f: DataDictionaryField) => f.missingPct > 50,
  },
} as const;

type UsageFilter = keyof typeof USAGE_FILTERS;

const ML_LABEL: Record<MlRole, string> = {
  Target: "Target",
  Candidate: "Candidate",
  Excluded: "Excluded",
  No: "—",
};

const ML_TITLE: Record<MlRole, string> = {
  Target: "The value the model will predict",
  Candidate: "Planned model input — no model has been trained yet",
  Excluded: "Never a model input: it encodes the outcome or is an identifier",
  No: "Not planned as a model input",
};

const controlClass =
  "h-8 rounded-md border border-surface-200 bg-white px-2 text-xs text-navy-900 " +
  "hover:border-surface-300 focus:border-accent-500";

function MissingBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="tabular w-11 text-right">
        {pct === 0 ? "0%" : pct < 0.1 ? "<0.1%" : `${pct.toFixed(1)}%`}
      </span>
      <span
        aria-hidden
        className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-surface-100 sm:block"
      >
        <span
          className="block h-full rounded-full bg-navy-600"
          style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
        />
      </span>
    </div>
  );
}

export function DictionaryExplorer({
  fields,
}: {
  fields: DataDictionaryField[];
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [usage, setUsage] = useState<UsageFilter>("all");
  const deferredQuery = useDeferredValue(query);

  const groups = useMemo(
    () => [...new Set(fields.map((f) => f.group))],
    [fields],
  );

  const visible = useMemo(() => {
    const needle = deferredQuery.trim().toLowerCase();
    const test = USAGE_FILTERS[usage].test;

    return fields.filter(
      (f) =>
        (!group || f.group === group) &&
        test(f) &&
        (!needle ||
          f.name.toLowerCase().includes(needle) ||
          (f.description ?? "").toLowerCase().includes(needle)),
    );
  }, [fields, deferredQuery, group, usage]);

  const byGroup = useMemo(() => {
    const map = new Map<string, DataDictionaryField[]>();
    for (const f of visible) {
      map.set(f.group, [...(map.get(f.group) ?? []), f]);
    }
    return map;
  }, [visible]);

  const isFiltered = query !== "" || group !== "" || usage !== "all";

  return (
    <div>
      <div className="flex flex-wrap items-end gap-2 border-b border-surface-100 pb-3">
        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <label
            htmlFor="dictionary-search"
            className="text-[10px] font-medium tracking-wide text-surface-500"
          >
            Search
          </label>
          <input
            id="dictionary-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Field name or description, e.g. speed, weather"
            className={cn(controlClass, "w-full placeholder:text-surface-400")}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="dictionary-group"
            className="text-[10px] font-medium tracking-wide text-surface-500"
          >
            Group
          </label>
          <select
            id="dictionary-group"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className={controlClass}
          >
            <option value="">All groups</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="dictionary-usage"
            className="text-[10px] font-medium tracking-wide text-surface-500"
          >
            Show
          </label>
          <select
            id="dictionary-usage"
            value={usage}
            onChange={(e) => setUsage(e.target.value as UsageFilter)}
            className={controlClass}
          >
            {Object.entries(USAGE_FILTERS).map(([key, value]) => (
              <option key={key} value={key}>
                {value.label}
              </option>
            ))}
          </select>
        </div>

        {isFiltered ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setGroup("");
              setUsage("all");
            }}
            className="h-8 rounded-md px-2 text-xs font-medium text-accent-600 hover:bg-accent-500/10"
          >
            Clear
          </button>
        ) : null}
      </div>

      <p aria-live="polite" className="py-2 text-[11px] text-surface-500">
        Showing {formatNumber(visible.length)} of {formatNumber(fields.length)}{" "}
        columns
      </p>

      {visible.length === 0 ? (
        <EmptyState
          title="No columns match"
          description="Try a different search term or clear the filters."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-xs">
            <caption className="sr-only">
              CAS dataset columns with type, example value, completeness and usage
            </caption>
            <thead>
              <tr className="border-b border-surface-200 text-left text-[11px] text-surface-500">
                <th scope="col" className="py-2 pr-3 font-medium">Field</th>
                <th scope="col" className="py-2 pr-3 font-medium">Description</th>
                <th scope="col" className="py-2 pr-3 font-medium">Type</th>
                <th scope="col" className="py-2 pr-3 font-medium">Example</th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">Missing</th>
                <th scope="col" className="py-2 pr-3 text-center font-medium">Dashboard</th>
                <th scope="col" className="py-2 font-medium">Model</th>
              </tr>
            </thead>
            <tbody>
              {[...byGroup].map(([name, rows]) => (
                <Fragment key={name}>
                  <tr className="bg-surface-50">
                    <th
                      scope="colgroup"
                      colSpan={7}
                      className="px-2 py-1.5 text-left text-[10px] font-semibold tracking-wide text-surface-500 uppercase"
                    >
                      {name}{" "}
                      <span className="font-normal normal-case">
                        · {rows.length}
                      </span>
                    </th>
                  </tr>
                  {rows.map((f) => (
                    <tr
                      key={f.name}
                      className="border-b border-surface-100 align-top last:border-0"
                    >
                      <th scope="row" className="py-2 pr-3 text-left font-normal">
                        <code className="font-mono text-[12px] font-medium text-navy-900">
                          {f.name}
                        </code>
                        {f.derived ? (
                          <Badge tone="info" className="ml-1.5 align-middle">
                            Derived
                          </Badge>
                        ) : null}
                      </th>
                      <td className="max-w-md py-2 pr-3 leading-relaxed text-surface-700">
                        {f.description ?? (
                          <span className="text-surface-400 italic">
                            Not yet documented
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap text-surface-700">
                        {f.type}
                        <span className="block text-[10px] text-surface-400">
                          {formatNumber(f.distinct)} distinct
                        </span>
                      </td>
                      <td className="max-w-40 py-2 pr-3">
                        {f.example === null ? (
                          <span className="text-surface-400">—</span>
                        ) : (
                          <code
                            className="block truncate font-mono text-[11px] text-navy-800"
                            title={f.example}
                          >
                            {f.example}
                          </code>
                        )}
                      </td>
                      <td className="py-2 pr-3 text-navy-900">
                        <MissingBar pct={f.missingPct} />
                      </td>
                      <td className="py-2 pr-3 text-center">
                        {f.usedInDashboard ? (
                          <span className="font-semibold text-accent-600">
                            Yes
                          </span>
                        ) : (
                          <span className="text-surface-400">—</span>
                        )}
                      </td>
                      <td className="py-2 whitespace-nowrap" title={ML_TITLE[f.ml]}>
                        {f.ml === "No" ? (
                          <span className="text-surface-400">—</span>
                        ) : (
                          <Badge
                            tone={
                              f.ml === "Excluded"
                                ? "warning"
                                : f.ml === "Target"
                                  ? "info"
                                  : "neutral"
                            }
                          >
                            {ML_LABEL[f.ml]}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

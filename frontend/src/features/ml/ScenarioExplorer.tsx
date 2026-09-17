"use client";

import { useMemo, useState } from "react";
import { DIVERGING } from "@/lib/chart-theme";
import { formatNumber, formatPercent } from "@/lib/formatters";
import type { ScenarioGrid } from "@/types";

/**
 * Pick conditions, see what the model says about a crash under them.
 *
 * Every combination was scored by the model in the pipeline, so this is a
 * lookup, not an approximation: the figure shown is the model's own output.
 * The contributions come from SHAP, so they add up to the prediction rather
 * than being a separate story about it.
 *
 * The wording is deliberately careful throughout. The model answers "if a
 * crash is reported under these conditions, how likely is it to be serious or
 * fatal" — it says nothing about how likely a crash is.
 */
export function ScenarioExplorer({ grid }: { grid: ScenarioGrid }) {
  const [choice, setChoice] = useState<string[]>(() =>
    grid.dimensions.map((dimension) => dimension.options[0].value),
  );

  const lookup = useMemo(
    () => new Map(grid.scenarios.map((scenario) => [scenario.key, scenario])),
    [grid.scenarios],
  );

  const scenario = lookup.get(choice.join("|"));
  const average = useMemo(
    () =>
      grid.scenarios.reduce((sum, row) => sum + row.probability, 0) /
      grid.scenarios.length,
    [grid.scenarios],
  );

  const thin = scenario ? scenario.trainingCrashes < grid.minSupport : false;
  const thinCount = useMemo(
    () =>
      grid.scenarios.filter((row) => row.trainingCrashes < grid.minSupport)
        .length,
    [grid.scenarios, grid.minSupport],
  );

  const widest = Math.max(
    ...(scenario?.contributions ?? []).map((c) => Math.abs(c.shap)),
    0.01,
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="grid gap-2.5 sm:grid-cols-2">
        {grid.dimensions.map((dimension, index) => (
          <div key={dimension.column} className="flex flex-col gap-1">
            <label
              htmlFor={`scenario-${dimension.column}`}
              className="text-[10px] font-medium tracking-wide text-surface-500"
            >
              {dimension.label}
            </label>
            <select
              id={`scenario-${dimension.column}`}
              value={choice[index]}
              onChange={(event) =>
                setChoice((current) =>
                  current.map((value, i) =>
                    i === index ? event.target.value : value,
                  ),
                )
              }
              className="h-8 rounded-md border border-surface-200 bg-white px-2 text-xs text-navy-900 hover:border-surface-300 focus:border-accent-500"
            >
              {dimension.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>

      <div className="rounded-md border border-surface-200 p-3">
        {scenario ? (
          <>
            <p className="text-[11px] text-surface-500">
              If a crash is reported under these conditions, the model puts its
              chance of being serious or fatal at
            </p>
            <p className="tabular mt-1 text-[32px] leading-none font-semibold text-navy-900">
              {formatPercent(scenario.probability, 1)}
            </p>
            <p className="mt-1 text-[11px] text-surface-500">
              against {formatPercent(average, 1)} averaged across every
              combination here.
            </p>

            {thin ? (
              <p className="mt-2 rounded-md border border-safety-500/40 bg-safety-400/10 p-2 text-[11px] leading-snug text-navy-800">
                <span className="font-medium">
                  Only {formatNumber(scenario.trainingCrashes)} crashes in the
                  training years match these conditions.
                </span>{" "}
                The model still answers, but it is extrapolating into a corner
                of the data it has barely seen, and this figure should not be
                read as evidence. {formatNumber(thinCount)} of{" "}
                {formatNumber(grid.scenarios.length)} combinations here are that
                thin.
              </p>
            ) : (
              <p className="mt-2 text-[11px] leading-snug text-surface-500">
                Based on {formatNumber(scenario.trainingCrashes)} matching
                crashes in the training years, of which{" "}
                {scenario.observedSevereRate === null
                  ? "none"
                  : formatPercent(scenario.observedSevereRate, 1)}{" "}
                were serious or fatal. That figure spans every region and
                traffic control, while the model&rsquo;s estimate holds those at
                the values listed below, so the two are close cousins rather
                than the same number.
              </p>
            )}

            <p className="mt-3 text-[10px] font-medium tracking-wide text-surface-500 uppercase">
              What moved it
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {scenario.contributions.map((contribution) => {
                const worse = contribution.shap >= 0;

                return (
                  <li
                    key={contribution.label}
                    className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-2"
                  >
                    <span
                      className="truncate text-[11px] text-surface-700"
                      title={contribution.label}
                    >
                      {contribution.label}
                    </span>
                    <span className="relative block h-3">
                      <span
                        aria-hidden
                        className="absolute inset-y-0 left-1/2 w-px bg-surface-300"
                      />
                      <span
                        className="absolute top-1/2 h-2.5 -translate-y-1/2 transition-[width] duration-300"
                        style={{
                          [worse ? "left" : "right"]: "50%",
                          width: `${(Math.abs(contribution.shap) / widest) * 50}%`,
                          backgroundColor: worse
                            ? DIVERGING.above
                            : DIVERGING.below,
                          borderRadius: worse ? "0 3px 3px 0" : "3px 0 0 3px",
                        }}
                      />
                    </span>
                    <span
                      className="tabular text-right text-[11px] font-medium"
                      style={{
                        color: worse ? DIVERGING.above : DIVERGING.below,
                      }}
                    >
                      {contribution.shap >= 0 ? "+" : "−"}
                      {Math.abs(contribution.shap).toFixed(2)}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-[10px] leading-snug text-surface-500">
              SHAP values in log-odds, relative to the model&rsquo;s average
              prediction. Positive pushes towards a severe outcome.
            </p>
          </>
        ) : (
          <p className="text-[11px] text-surface-500">
            That combination was not scored.
          </p>
        )}
      </div>
    </div>
  );
}

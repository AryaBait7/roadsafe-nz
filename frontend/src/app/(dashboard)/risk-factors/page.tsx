import { PageHeader } from "@/components/layout/PageHeader";
import { FilterSummary } from "@/components/layout/FilterSummary";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { DivergingBars } from "@/components/charts/DivergingBars";
import { DataTable } from "@/components/charts/DataTable";
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { EmptyState } from "@/components/states/EmptyState";
import { parseFilters } from "@/lib/filters";
import { formatNumber, formatPercent } from "@/lib/formatters";
import {
  getAdjustedAssociations,
  getSeverityLift,
} from "@/services/analyticsService";
import type { AdjustedAssociations } from "@/types";

export const metadata = { title: "Risk Factors" };

/**
 * A rate computed from a handful of crashes swings wildly. Below this many,
 * a condition is reported in the table but kept out of the chart, where its
 * bar length would imply a confidence the sample does not support.
 */
const MIN_SAMPLE = 5000;

export default async function RiskFactorsPage({
  searchParams,
}: PageProps<"/risk-factors">) {
  const filters = parseFilters(await searchParams);
  const [{ data }, associations] = await Promise.all([
    getSeverityLift(filters),
    getAdjustedAssociations(),
  ]);
  const adjusted = associations.data;

  // Two exclusions, for different reasons.
  //
  // "Unknown" buckets are absent information, not conditions — and they
  // produce some of the largest deviations in the dataset. Crashes with no
  // recorded speed limit are 22.9% severe against a 6.7% baseline, which
  // would rank "unknown" as the country's foremost risk factor. Light
  // condition "Unknown" runs the other way at 0.3%, appearing as the single
  // most protective factor. Both are recording artefacts.
  const charted = data.factors.filter(
    (factor) => !factor.isMissingData && factor.crashCount >= MIN_SAMPLE,
  );
  const excluded = data.factors.filter(
    (factor) => factor.isMissingData || factor.crashCount < MIN_SAMPLE,
  );

  const strongest = charted[0];
  const weakest = charted.at(-1);

  return (
    <>
      <PageHeader
        title="Risk Factors"
        description="Conditions associated with more or less severe crash outcomes."
      />
      <FilterSummary filters={filters} pathname="/risk-factors" />

      <div className="space-y-3 p-4">
        {charted.length === 0 ? (
          <EmptyState
            title="Not enough data for these filters"
            description="Widen the year range or clear a filter to compare conditions."
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
              <ChartPanel
                className="xl:col-span-7"
                title="Severity against the baseline"
                description={`How each condition's serious-or-fatal rate compares with the overall ${formatPercent(data.baseline)}. Conditions with fewer than ${formatNumber(MIN_SAMPLE)} crashes are in the table only; faded bars are within chance of the baseline (95% Wilson interval).`}
                chart={
                  <DivergingBars data={charted} baseline={data.baseline} />
                }
                table={
                  <DataTable
                    caption="Severe rate by condition, against the baseline"
                    rows={data.factors}
                    columns={[
                      { header: "Condition", cell: (row) => row.factor },
                      { header: "Category", cell: (row) => row.category },
                      {
                        header: "Crashes",
                        numeric: true,
                        cell: (row) => formatNumber(row.crashCount),
                      },
                      {
                        header: "Severe",
                        numeric: true,
                        cell: (row) => formatNumber(row.severeCount),
                      },
                      {
                        header: "Rate",
                        numeric: true,
                        cell: (row) => formatPercent(row.severeRate),
                      },
                      {
                        header: "95% interval",
                        numeric: true,
                        cell: (row) =>
                          `${formatPercent(row.severeRateInterval[0])}–${formatPercent(row.severeRateInterval[1])}`,
                      },
                      {
                        header: "vs baseline",
                        numeric: true,
                        cell: (row) =>
                          row.distinguishable
                            ? `${row.lift >= 0 ? "+" : "−"}${(Math.abs(row.lift) * 100).toFixed(2)}pp`
                            : "not distinguishable",
                      },
                    ]}
                  />
                }
              />

              <div className="flex flex-col gap-3 xl:col-span-5">
                <Card>
                  <CardHeader>
                    <CardTitle>What this does and does not show</CardTitle>
                  </CardHeader>
                  <CardBody className="space-y-2.5 text-[11px] leading-relaxed text-surface-600">
                    <p>
                      These are <strong>associations</strong>, not causes. CAS
                      records the conditions present when a crash was reported;
                      it has no field for what caused one. A condition sitting
                      above the baseline means crashes recorded under it tended
                      to be more serious — not that it made them so.
                    </p>
                    <p>
                      Much of what appears here is likely standing in for speed.
                      Open rural roads carry higher limits and longer emergency
                      response times, and both push outcomes toward the severe
                      end regardless of what else was recorded.
                    </p>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>
                      Adverse weather looks safer, and isn&rsquo;t
                    </CardTitle>
                  </CardHeader>
                  <CardBody className="space-y-2.5 text-[11px] leading-relaxed text-surface-600">
                    <p>
                      Crashes in rain, fog, snow or hail are{" "}
                      <strong>less</strong> likely to be serious than the
                      average crash. That is a real result in this dataset, and
                      the most likely reading is that bad weather makes people
                      slow down, so the crashes that do happen carry less
                      energy.
                    </p>
                    <p>
                      It is emphatically not evidence that poor weather is safe.
                      This page measures severity{" "}
                      <em>given that a crash occurred</em> — it says nothing
                      about how often crashes happen, and CAS contains no record
                      of journeys that ended without incident.
                    </p>
                  </CardBody>
                </Card>

                {excluded.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Held out of the chart</CardTitle>
                    </CardHeader>
                    <CardBody>
                      <ul className="space-y-1.5 text-[11px] text-surface-600">
                        {excluded.map((factor) => (
                          <li
                            key={`${factor.category}-${factor.factor}`}
                            className="flex items-baseline justify-between gap-3"
                          >
                            <span className="min-w-0 truncate">
                              {factor.factor}{" "}
                              <span className="text-surface-500">
                                ({factor.category})
                              </span>
                            </span>
                            <span className="tabular shrink-0 text-surface-500">
                              {formatNumber(factor.crashCount)} ·{" "}
                              {formatPercent(factor.severeRate)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-[10px] leading-relaxed text-surface-500">
                        &ldquo;Unknown&rdquo; is missing information rather than
                        a condition, and it skews hard in both directions:
                        crashes with no recorded speed limit are far more severe
                        than average, while those with no recorded light
                        condition are far less. Both are recording artefacts.
                        The rest are simply too small a sample to chart.
                      </p>
                    </CardBody>
                  </Card>
                ) : null}
              </div>
            </div>

            {strongest && weakest ? (
              <Card>
                <CardBody className="flex flex-wrap items-baseline gap-x-8 gap-y-2 text-[11px] text-surface-500">
                  <span>
                    Most associated with severity:{" "}
                    <span className="font-semibold text-navy-900">
                      {strongest.factor}
                    </span>{" "}
                    at {formatPercent(strongest.severeRate)} (
                    {strongest.lift >= 0 ? "+" : "−"}
                    {(Math.abs(strongest.lift) * 100).toFixed(2)}pp)
                  </span>
                  <span>
                    Least:{" "}
                    <span className="font-semibold text-navy-900">
                      {weakest.factor}
                    </span>{" "}
                    at {formatPercent(weakest.severeRate)} (
                    {weakest.lift >= 0 ? "+" : "−"}
                    {(Math.abs(weakest.lift) * 100).toFixed(2)}pp)
                  </span>
                  <span className="text-surface-500">
                    Baseline {formatPercent(data.baseline)} across{" "}
                    {formatNumber(
                      data.factors.reduce(
                        (max, f) => Math.max(max, f.crashCount),
                        0,
                      ),
                    )}{" "}
                    crashes in the largest category.
                  </span>
                </CardBody>
              </Card>
            ) : null}
            <Card>
              <CardHeader>
                <div className="min-w-0">
                  <CardTitle>
                    One condition at a time, or all of them together
                  </CardTitle>
                  <CardDescription>
                    Conditions travel together: unsealed roads are mostly rural
                    and fast. The crude column compares one condition against
                    everything else; the adjusted column comes from a single
                    logistic regression holding the other conditions fixed. An
                    odds ratio above 1 means higher odds of a serious or fatal
                    outcome than the reference level.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardBody>
                <DataTable
                  caption="Crude and adjusted odds ratios for a serious or fatal outcome"
                  rows={adjusted.terms}
                  columns={[
                    { header: "Condition", cell: (row) => row.factor },
                    {
                      header: "Compared with",
                      cell: (row) => (
                        <span className="text-surface-500">
                          {row.reference}
                        </span>
                      ),
                    },
                    {
                      header: "Crashes",
                      numeric: true,
                      cell: (row) => formatNumber(row.crashCount),
                    },
                    {
                      header: "Crude odds ratio",
                      numeric: true,
                      cell: (row) => (
                        <OddsRatio
                          value={row.crude.oddsRatio}
                          interval={row.crude.interval}
                        />
                      ),
                    },
                    {
                      header: "Adjusted odds ratio",
                      numeric: true,
                      cell: (row) => (
                        <OddsRatio
                          value={row.adjusted.oddsRatio}
                          interval={row.adjusted.interval}
                        />
                      ),
                    },
                  ]}
                />

                <div className="mt-3 grid gap-2 text-[11px] leading-relaxed text-surface-600 lg:grid-cols-2">
                  <p>
                    <span className="font-medium text-navy-900">
                      What changes when the other conditions are held fixed.
                    </span>{" "}
                    Unsealed road falls from{" "}
                    {formatOdds(
                      termFor(adjusted, "Unsealed road")?.crude.oddsRatio,
                    )}{" "}
                    to{" "}
                    {formatOdds(
                      termFor(adjusted, "Unsealed road")?.adjusted.oddsRatio,
                    )}
                    , and state highway &ndash; open road from{" "}
                    {formatOdds(
                      termFor(adjusted, "State highway - open road")?.crude
                        .oddsRatio,
                    )}{" "}
                    to{" "}
                    {formatOdds(
                      termFor(adjusted, "State highway - open road")?.adjusted
                        .oddsRatio,
                    )}
                    , below the reference. Most of what the crude figures showed
                    was the speed environment those roads carry &mdash; the one
                    term that strengthens once the others are included.
                  </p>
                  <p>
                    <span className="font-medium text-navy-900">Limits.</span>{" "}
                    {adjusted.model}, fitted on{" "}
                    {formatNumber(adjusted.coverage.modelledRows)} complete
                    cases ({formatNumber(adjusted.coverage.excludedRows)}{" "}
                    excluded: {adjusted.coverage.reason.toLowerCase()}). It
                    describes association, not cause, and only severity{" "}
                    <em>given a crash was reported</em>. The sidebar filters do
                    not apply: the model is fitted once over the whole dataset,
                    and estimates from different slices would not be comparable.
                    It explains little of the variation overall (McFadden pseudo
                    R&sup2; {adjusted.pseudoR2.toFixed(3)}), which is expected:
                    severity turns mostly on specifics CAS does not record.
                  </p>
                </div>
              </CardBody>
            </Card>
          </>
        )}
      </div>
    </>
  );
}

/** An odds ratio with its interval, so the estimate is never read as exact. */
function OddsRatio({
  value,
  interval,
}: {
  value: number;
  interval: [number, number];
}) {
  // An interval spanning 1 means even the direction is uncertain.
  const clear = interval[0] > 1 || interval[1] < 1;

  return (
    <span className={clear ? undefined : "text-surface-500"}>
      <span className="tabular font-medium">{value.toFixed(2)}</span>
      <span className="tabular block text-[10px] text-surface-500">
        {interval[0].toFixed(2)}&ndash;{interval[1].toFixed(2)}
      </span>
    </span>
  );
}

function termFor(data: AdjustedAssociations, factor: string) {
  return data.terms.find((term) => term.factor === factor);
}

function formatOdds(value: number | undefined) {
  return value === undefined ? "—" : value.toFixed(2);
}

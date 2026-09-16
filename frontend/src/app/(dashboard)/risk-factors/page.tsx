import { PageHeader } from "@/components/layout/PageHeader";
import { FilterSummary } from "@/components/layout/FilterSummary";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { DivergingBars } from "@/components/charts/DivergingBars";
import { DataTable } from "@/components/charts/DataTable";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@/components/ui/Card";
import { EmptyState } from "@/components/states/EmptyState";
import { parseFilters } from "@/lib/filters";
import { formatNumber, formatPercent } from "@/lib/formatters";
import { getSeverityLift } from "@/services/analyticsService";

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
  const { data } = await getSeverityLift(filters);

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
                description={`How each condition's serious-or-fatal rate compares with the overall ${formatPercent(data.baseline)}. Conditions with fewer than ${formatNumber(MIN_SAMPLE)} crashes are in the table only.`}
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
                        header: "vs baseline",
                        numeric: true,
                        cell: (row) =>
                          `${row.lift >= 0 ? "+" : "−"}${(Math.abs(row.lift) * 100).toFixed(2)}pp`,
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
                      Much of what appears here is likely standing in for
                      speed. Open rural roads carry higher limits and longer
                      emergency response times, and both push outcomes toward
                      the severe end regardless of what else was recorded.
                    </p>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Adverse weather looks safer, and isn&rsquo;t</CardTitle>
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
                      It is emphatically not evidence that poor weather is
                      safe. This page measures severity{" "}
                      <em>given that a crash occurred</em> — it says nothing
                      about how often crashes happen, and CAS contains no
                      record of journeys that ended without incident.
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
                              <span className="text-surface-400">
                                ({factor.category})
                              </span>
                            </span>
                            <span className="tabular shrink-0 text-surface-400">
                              {formatNumber(factor.crashCount)} ·{" "}
                              {formatPercent(factor.severeRate)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 text-[10px] leading-relaxed text-surface-400">
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
                  <span className="text-surface-400">
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
          </>
        )}
      </div>
    </>
  );
}

import { PageHeader } from "@/components/layout/PageHeader";
import { FilterSummary } from "@/components/layout/FilterSummary";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/states/EmptyState";
import { CsvExportButton } from "@/features/reports/CsvExportButton";
import { PrintButton } from "@/features/reports/PrintButton";
import { describeFilters, parseFilters } from "@/lib/filters";
import { formatNumber, formatPercent, formatYearRange } from "@/lib/formatters";
import { getSummary } from "@/services/dashboardService";
import {
  getRegionBreakdown,
  getSeverityBreakdown,
  getTrends,
} from "@/services/crashService";
import { getHotspots, getSeverityLift } from "@/services/analyticsService";

export const metadata = { title: "Reports" };

const pp = (lift: number) =>
  `${lift >= 0 ? "+" : "-"}${(Math.abs(lift) * 100).toFixed(2)}`;

/**
 * Nothing on this page is a pre-made document. The summary is written from
 * the live aggregates for the current filters, and every download is built in
 * the browser from the same rows — so an export always matches what the other
 * pages show. Reports that need systems not yet built are listed as planned,
 * with no download attached.
 */
export default async function ReportsPage({
  searchParams,
}: PageProps<"/reports">) {
  const filters = parseFilters(await searchParams);

  const [summary, trends, severity, regions, lift, hotspots] =
    await Promise.all([
      getSummary(filters),
      getTrends(filters),
      getSeverityBreakdown(filters),
      getRegionBreakdown(filters),
      getSeverityLift(filters),
      getHotspots(filters),
    ]);

  const s = summary.data;
  const scope = formatYearRange(s.yearFrom, s.yearTo);
  const chips = describeFilters(filters);
  const scopeText = chips.length
    ? chips.map((c) => `${c.label}: ${c.value}`).join(" · ")
    : "All crashes, no filters";
  const fileScope = s.totalCrashes > 0 ? `${s.yearFrom}-${s.yearTo}` : "empty";

  const severeShare =
    s.totalCrashes === 0
      ? 0
      : (s.seriousCrashes + s.fatalCrashes) / s.totalCrashes;
  const topRegions = regions.data
    .filter((r) => r.region !== "Unknown")
    .slice(0, 3);
  const reliable = lift.data.factors.filter(
    (f) => !f.isMissingData && f.crashCount >= 5000,
  );

  const exports = [
    {
      title: "Crashes by year",
      description: "Totals, serious or fatal counts and rate per year.",
      filename: `roadsafe-nz_trends_${fileScope}.csv`,
      columns: ["year", "crashes", "serious_or_fatal", "severe_rate"],
      rows: trends.data.map((r) => [
        r.year,
        r.totalCrashes,
        r.severeCrashes,
        Number(r.severeRate.toFixed(4)),
      ]),
    },
    {
      title: "Crashes by severity",
      description: "Count and share for each CAS severity level.",
      filename: `roadsafe-nz_severity_${fileScope}.csv`,
      columns: ["severity", "crashes", "share"],
      rows: severity.data.map((r) => [
        r.severity,
        r.count,
        Number(r.share.toFixed(4)),
      ]),
    },
    {
      title: "Crashes by region",
      description: "Regional council areas ranked by crash volume.",
      filename: `roadsafe-nz_regions_${fileScope}.csv`,
      columns: ["region", "crashes", "serious_or_fatal", "severe_rate"],
      rows: regions.data.map((r) => [
        r.region,
        r.crashCount,
        r.severeCount,
        Number(r.severeRate.toFixed(4)),
      ]),
    },
    {
      title: "Conditions against the baseline",
      description:
        "Every condition with its 95% interval, including those held out of the chart.",
      filename: `roadsafe-nz_conditions_${fileScope}.csv`,
      columns: [
        "condition",
        "category",
        "crashes",
        "serious_or_fatal",
        "severe_rate",
        "severe_rate_ci_low",
        "severe_rate_ci_high",
        "lift_pp",
        "distinguishable_from_baseline",
        "is_missing_data",
      ],
      rows: lift.data.factors.map((r) => [
        r.factor,
        r.category,
        r.crashCount,
        r.severeCount,
        Number(r.severeRate.toFixed(4)),
        Number(r.severeRateInterval[0].toFixed(4)),
        Number(r.severeRateInterval[1].toFixed(4)),
        Number((r.lift * 100).toFixed(2)),
        r.distinguishable ? "yes" : "no",
        r.isMissingData ? "yes" : "no",
      ]),
    },
    {
      title: "Territorial authorities",
      description: "Hotspot ranking with centroid coordinates.",
      filename: `roadsafe-nz_hotspots_${fileScope}.csv`,
      columns: [
        "area",
        "region",
        "crashes",
        "serious_or_fatal",
        "severe_rate",
        "latitude",
        "longitude",
      ],
      rows: hotspots.data.map((r) => [
        r.name,
        r.region,
        r.crashCount,
        r.severeCount,
        Number(r.severeRate.toFixed(4)),
        r.latitude,
        r.longitude,
      ]),
    },
  ];

  const planned = [
    {
      title: "Regional PDF reports",
      description:
        "Formatted per-region documents with maps and trend commentary.",
      needs: "Server-side report generation (Stage 22).",
    },
    {
      title: "Model evaluation report",
      description:
        "Metrics, confusion matrix and SHAP explanations for the severity model.",
      needs: "A trained model (Stage 20).",
    },
    {
      title: "Scheduled summaries",
      description: "Periodic emailed summaries when new CAS data is published.",
      needs: "Backend jobs and a data refresh pipeline (Stages 22–24).",
    },
  ];

  return (
    <>
      <PageHeader
        title="Reports"
        description="A summary of the current view, and exports of the data behind it."
        actions={<PrintButton />}
      />
      <div className="print:hidden">
        <FilterSummary filters={filters} pathname="/reports" />
      </div>

      <div className="space-y-3 p-4">
        {s.totalCrashes === 0 ? (
          <EmptyState
            title="No crashes match these filters"
            description="Widen the year range or clear a filter to produce a report."
          />
        ) : (
          <>
            <Card className="print:border-0 print:shadow-none">
              <CardHeader>
                <div className="min-w-0">
                  <CardTitle>Summary of the current view</CardTitle>
                  <CardDescription>
                    {scopeText} · generated from NZTA Crash Analysis System data
                  </CardDescription>
                </div>
              </CardHeader>
              <CardBody className="grid gap-5 text-[12px] leading-relaxed text-surface-700 lg:grid-cols-3">
                <section>
                  <h4 className="text-[11px] font-semibold tracking-wide text-surface-500 uppercase">
                    Headline
                  </h4>
                  <p className="mt-1.5">
                    Between {scope},{" "}
                    <strong>{formatNumber(s.totalCrashes)}</strong> crashes were
                    recorded. {formatNumber(s.seriousCrashes)} were serious and{" "}
                    {formatNumber(s.fatalCrashes)} fatal —{" "}
                    {formatPercent(severeShare)} of the total. They killed{" "}
                    {formatNumber(s.peopleKilled)} people and injured{" "}
                    {formatNumber(s.peopleInjured)}.
                  </p>
                </section>

                <section>
                  <h4 className="text-[11px] font-semibold tracking-wide text-surface-500 uppercase">
                    Where
                  </h4>
                  <ul className="mt-1.5 space-y-1">
                    {topRegions.map((r) => (
                      <li key={r.region}>
                        <strong>{r.region}</strong>:{" "}
                        {formatNumber(r.crashCount)} crashes,{" "}
                        {formatPercent(r.severeRate)} serious or fatal
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h4 className="text-[11px] font-semibold tracking-wide text-surface-500 uppercase">
                    Conditions
                  </h4>
                  <ul className="mt-1.5 space-y-1">
                    {reliable.slice(0, 2).map((f) => (
                      <li key={`hi-${f.category}-${f.factor}`}>
                        <strong>{f.factor}</strong>:{" "}
                        {formatPercent(f.severeRate)} severe ({pp(f.lift)}pp vs
                        baseline)
                      </li>
                    ))}
                    {reliable.slice(-1).map((f) => (
                      <li key={`lo-${f.category}-${f.factor}`}>
                        <strong>{f.factor}</strong>:{" "}
                        {formatPercent(f.severeRate)} severe ({pp(f.lift)}pp vs
                        baseline)
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-surface-500">
                    Associations with severity, not causes. Baseline{" "}
                    {formatPercent(lift.data.baseline)}.
                  </p>
                </section>
              </CardBody>
            </Card>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-12 print:hidden">
              <Card className="xl:col-span-8">
                <CardHeader>
                  <div className="min-w-0">
                    <CardTitle>Data exports</CardTitle>
                    <CardDescription>
                      CSV files built from the figures above, for the same
                      filters.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardBody>
                  <ul className="divide-y divide-surface-100">
                    {exports.map((item) => (
                      <li
                        key={item.filename}
                        className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-medium text-navy-900">
                            {item.title}
                          </p>
                          <p className="text-[11px] text-surface-500">
                            {item.description}{" "}
                            <span className="text-surface-500">
                              {formatNumber(item.rows.length)} rows ·{" "}
                              <code>{item.filename}</code>
                            </span>
                          </p>
                        </div>
                        <div className="shrink-0">
                          <CsvExportButton
                            filename={item.filename}
                            columns={item.columns}
                            rows={item.rows}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>

              <Card className="xl:col-span-4">
                <CardHeader>
                  <div className="min-w-0">
                    <CardTitle>Planned reports</CardTitle>
                    <CardDescription>
                      Not available yet — nothing to download.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardBody>
                  <ul className="space-y-3">
                    {planned.map((item) => (
                      <li key={item.title}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[12px] font-medium text-navy-900">
                            {item.title}
                          </p>
                          <Badge
                            tone="neutral"
                            className="shrink-0 whitespace-nowrap"
                          >
                            Planned
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-[11px] text-surface-500">
                          {item.description}
                        </p>
                        <p className="mt-0.5 text-[10px] text-surface-500">
                          Needs: {item.needs}
                        </p>
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
}

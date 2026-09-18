import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterSummary } from "@/components/layout/FilterSummary";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { BarList } from "@/components/charts/BarList";
import { Donut } from "@/components/charts/Donut";
import { TrendChart } from "@/components/charts/TrendChart";
import { DataTable } from "@/components/charts/DataTable";
import { CrashMapLoader } from "@/components/maps/CrashMapLoader";
import { packPoints } from "@/lib/mapPack";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { EmptyState } from "@/components/states/EmptyState";
import { KpiRow } from "@/features/dashboard/KpiRow";
import { ModelPreview } from "@/features/dashboard/ModelPreview";
import { parseFilters, toSearchParams } from "@/lib/filters";
import { formatNumber, formatPercent, formatYearRange } from "@/lib/formatters";
import { SEVERITY_COLORS, SEVERITY_ORDER } from "@/lib/chart-theme";
import {
  getFilterOptions,
  getSummaryComparison,
} from "@/services/dashboardService";
import {
  getLightConditions,
  getMapGridDegrees,
  getMapPoints,
  getUnmappedCrashCount,
  getRoadTypes,
  getSeverityBreakdown,
  getTrends,
} from "@/services/crashService";
import { getContributingFactors } from "@/services/analyticsService";
import { getFeatureImportance, getModelMetrics } from "@/services/mlService";

/**
 * Rendered per request: the data comes from the API, so the build must not
 * depend on it being up. Fetches are still cached for 60s (see http.ts), so
 * repeated views cost one upstream request, not one per visitor.
 */
export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const filters = parseFilters(await searchParams);
  const hasFilters = toSearchParams(filters).toString() !== "";

  // Independent aggregates over the same cube — awaiting them in sequence
  // would serialise nine reads for no reason.
  const [
    comparison,
    severity,
    factors,
    light,
    roadTypes,
    trends,
    options,
    importance,
    modelMetrics,
    mapPoints,
    gridDegrees,
    unmapped,
  ] = await Promise.all([
    getSummaryComparison(filters),
    getSeverityBreakdown(filters),
    getContributingFactors(filters),
    getLightConditions(filters),
    getRoadTypes(filters),
    getTrends(filters),
    getFilterOptions(),
    getFeatureImportance(),
    getModelMetrics(),
    getMapPoints(filters),
    getMapGridDegrees(),
    getUnmappedCrashCount(filters),
  ]);

  const summary = comparison.data.current;

  // The latest year is incomplete, so plotting it makes the series look like
  // crashes collapsed. Dropped from the lines, kept in the tables.
  const partialYear = options.data.latestYearIsPartial
    ? options.data.yearMax
    : null;
  const withoutPartial = trends.data.filter((p) => p.year !== partialYear);
  const trendPoints = withoutPartial.length > 0 ? withoutPartial : trends.data;
  const partialExcluded = withoutPartial.length !== trends.data.length;

  const severitySlices = SEVERITY_ORDER.map((level) => {
    const item = severity.data.find((s) => s.severity === level);
    return item
      ? { name: level, value: item.count, color: SEVERITY_COLORS[level] }
      : null;
  }).filter((slice) => slice !== null);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of road crash trends and risk insights across New Zealand"
        actions={
          <div className="flex items-center gap-2 text-[11px]">
            <span className="rounded-md border border-surface-200 px-2.5 py-1 text-surface-700">
              {formatYearRange(summary.yearFrom, summary.yearTo)}
            </span>
            {hasFilters ? (
              <Link
                href="/dashboard"
                className="rounded-md border border-surface-200 px-2.5 py-1 font-medium text-surface-500 transition-colors hover:bg-surface-100 hover:text-navy-900"
              >
                Reset
              </Link>
            ) : null}
          </div>
        }
      />
      <FilterSummary filters={filters} pathname="/dashboard" />

      <div className="space-y-3 p-4">
        <KpiRow summary={summary} previous={comparison.data.previous} />

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          {/* Row 1 — 5 / 3 / 4 of twelve columns. */}
          <ChartPanel
            className="xl:col-span-5"
            title="Crash trends over time"
            description={
              partialExcluded
                ? `Volume and severe share by year. ${partialYear} excluded as a partial year; kept in the table.`
                : "Volume and the share that were serious or fatal, by year."
            }
            chart={
              // Two measures on different scales, so two charts rather than
              // one with a second y-axis.
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-[10px] font-medium text-surface-500">
                    Crashes per year
                  </p>
                  <TrendChart
                    kind="count"
                    valueKey="Crashes"
                    height={150}
                    data={trendPoints.map((p) => ({
                      year: p.year,
                      value: p.totalCrashes,
                    }))}
                  />
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-medium text-surface-500">
                    Serious or fatal share
                  </p>
                  <TrendChart
                    kind="rate"
                    valueKey="Severe rate"
                    height={150}
                    data={trendPoints.map((p) => ({
                      year: p.year,
                      value: p.severeRate,
                    }))}
                  />
                </div>
              </div>
            }
            table={
              <DataTable
                caption="Crashes and severe rate by year"
                rows={trends.data}
                columns={[
                  { header: "Year", cell: (row) => row.year },
                  {
                    header: "Crashes",
                    numeric: true,
                    cell: (row) => formatNumber(row.totalCrashes),
                  },
                  {
                    header: "Severe",
                    numeric: true,
                    cell: (row) => formatNumber(row.severeCrashes),
                  },
                  {
                    header: "Rate",
                    numeric: true,
                    cell: (row) => formatPercent(row.severeRate),
                  },
                ]}
              />
            }
          />

          <ChartPanel
            className="xl:col-span-3"
            title="Crashes by severity"
            description="Share of crashes at each severity level."
            chart={
              <Donut
                data={severitySlices}
                centreValue={summary.totalCrashes}
                centreLabel="Total"
                size={140}
              />
            }
            table={
              <DataTable
                caption="Crashes by severity"
                rows={severity.data}
                columns={[
                  { header: "Severity", cell: (row) => row.severity },
                  {
                    header: "Crashes",
                    numeric: true,
                    cell: (row) => formatNumber(row.count),
                  },
                  {
                    header: "Share",
                    numeric: true,
                    cell: (row) => formatPercent(row.share),
                  },
                ]}
              />
            }
          />

          <ChartPanel
            className="xl:col-span-4"
            title="Conditions present at crashes"
            description="Associations, not causes — CAS records no contributing-factor field."
            chart={
              <BarList
                data={factors.data.map((factor) => ({
                  label: factor.factor,
                  value: factor.crashCount,
                  rate: factor.severeRate,
                }))}
              />
            }
            table={
              <DataTable
                caption="Conditions recorded at crashes"
                rows={factors.data}
                columns={[
                  { header: "Condition", cell: (row) => row.factor },
                  {
                    header: "Crashes",
                    numeric: true,
                    cell: (row) => formatNumber(row.crashCount),
                  },
                  {
                    header: "Severe rate",
                    numeric: true,
                    cell: (row) => formatPercent(row.severeRate),
                  },
                ]}
              />
            }
          />

          {/* Row 2 — the map holds the left five columns across both rows. */}
          <Card className="flex flex-col xl:col-span-5 xl:row-span-2">
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>New Zealand crash hotspots</CardTitle>
                <CardDescription>
                  Density on a {gridDegrees}° grid. Click a cell for its
                  figures.
                  {unmapped > 0
                    ? ` ${formatNumber(unmapped)} ${unmapped === 1 ? "crash" : "crashes"} without a usable location ${unmapped === 1 ? "is" : "are"} not shown.`
                    : null}
                </CardDescription>
              </div>
            </CardHeader>
            <CardBody className="flex min-h-0 flex-1 flex-col">
              {mapPoints.data.length === 0 ? (
                <EmptyState
                  title="No crashes match these filters"
                  description="Try widening the year range or clearing the region filter."
                />
              ) : (
                <CrashMapLoader
                  points={packPoints(mapPoints.data)}
                  gridDegrees={gridDegrees}
                  height="430px"
                />
              )}
            </CardBody>
          </Card>

          <ChartPanel
            className="xl:col-span-4"
            title="Crashes by light condition"
            description="CAS records no time of day — light condition is the closest real signal."
            chart={
              <BarList
                data={light.data.map((item) => ({
                  label: item.lightCondition,
                  value: item.crashCount,
                  rate: item.severeRate,
                }))}
              />
            }
            table={
              <DataTable
                caption="Crashes by light condition"
                rows={light.data}
                columns={[
                  { header: "Light", cell: (row) => row.lightCondition },
                  {
                    header: "Crashes",
                    numeric: true,
                    cell: (row) => formatNumber(row.crashCount),
                  },
                  {
                    header: "Severe rate",
                    numeric: true,
                    cell: (row) => formatPercent(row.severeRate),
                  },
                ]}
              />
            }
          />

          <ChartPanel
            className="xl:col-span-3"
            title="Crashes by road type"
            description="State highway or local road, urban or open."
            chart={
              <BarList
                data={roadTypes.data.map((item) => ({
                  label: item.roadType,
                  value: item.crashCount,
                  rate: item.severeRate,
                }))}
              />
            }
            table={
              <DataTable
                caption="Crashes by road type"
                rows={roadTypes.data}
                columns={[
                  { header: "Road type", cell: (row) => row.roadType },
                  {
                    header: "Crashes",
                    numeric: true,
                    cell: (row) => formatNumber(row.crashCount),
                  },
                  {
                    header: "Severe rate",
                    numeric: true,
                    cell: (row) => formatPercent(row.severeRate),
                  },
                ]}
              />
            }
          />

          {/* Row 3 — beside the map. */}
          <ChartPanel
            className="xl:col-span-4"
            title="ML model insight"
            description="Factors associated with serious and fatal crashes."
            isPlaceholder={modelMetrics.meta.source === "placeholder"}
            chart={
              <ModelPreview importance={importance} metrics={modelMetrics} />
            }
          />

          <Card className="flex flex-col xl:col-span-3">
            <CardHeader>
              <CardTitle>Model summary</CardTitle>
            </CardHeader>
            <CardBody className="flex flex-1 flex-col justify-between gap-3">
              <p className="text-[11px] leading-relaxed text-surface-500">
                The classifier estimates how severe a crash is likely to be{" "}
                <em>given that a crash occurred</em>. It cannot predict whether
                a crash will happen: this dataset contains only crashes, so it
                holds no examples of roads where nothing went wrong.
              </p>
              <Link
                href="/ml-insights"
                className="text-[11px] font-medium text-accent-600 hover:underline"
              >
                View full model report →
              </Link>
            </CardBody>
          </Card>
        </div>

        <p className="text-[10px] text-surface-500">
          Data source: Waka Kotahi NZ Transport Agency, Crash Analysis System
          (CAS). {summary.yearTo} is a partial year.
        </p>
      </div>
    </>
  );
}

import { PageHeader } from "@/components/layout/PageHeader";
import { FilterSummary } from "@/components/layout/FilterSummary";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { BarList } from "@/components/charts/BarList";
import { SeverityBar } from "@/components/charts/SeverityBar";
import { TrendChart } from "@/components/charts/TrendChart";
import { DataTable } from "@/components/charts/DataTable";
import { KpiRow } from "@/features/dashboard/KpiRow";
import { ModelPreview } from "@/features/dashboard/ModelPreview";
import { parseFilters } from "@/lib/filters";
import { formatNumber, formatPercent } from "@/lib/formatters";
import { getFilterOptions, getSummary } from "@/services/dashboardService";
import {
  getLightConditions,
  getRoadTypes,
  getSeverityBreakdown,
  getTrends,
} from "@/services/crashService";
import { getContributingFactors } from "@/services/analyticsService";
import { getFeatureImportance } from "@/services/mlService";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: PageProps<"/dashboard">) {
  const filters = parseFilters(await searchParams);

  // Independent aggregates over the same cube — awaiting them in sequence
  // would serialise seven reads for no reason.
  const [summary, severity, factors, light, roadTypes, trends, options, importance] =
    await Promise.all([
      getSummary(filters),
      getSeverityBreakdown(filters),
      getContributingFactors(filters),
      getLightConditions(filters),
      getRoadTypes(filters),
      getTrends(filters),
      getFilterOptions(),
      getFeatureImportance(),
    ]);

  // The most recent year is incomplete, so plotting it makes the series look
  // like crashes collapsed. Dropped from the line, kept in the table. Guarded
  // so filtering *to* that year alone still charts something.
  const partialYear = options.data.latestYearIsPartial
    ? options.data.yearMax
    : null;
  const withoutPartial = trends.data.filter((p) => p.year !== partialYear);
  const trendPoints = withoutPartial.length > 0 ? withoutPartial : trends.data;
  const partialExcluded = withoutPartial.length !== trends.data.length;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of road crash patterns across New Zealand."
      />
      <FilterSummary filters={filters} pathname="/dashboard" />

      <div className="space-y-4 p-6">
        <KpiRow summary={summary.data} />

        <ChartPanel
          title="Crash trends over time"
          description={
            partialExcluded
              ? `Crash volume and the share that were serious or fatal, by year. ${partialYear} is excluded as a partial year of data; it remains in the table.`
              : "Crash volume and the share that were serious or fatal, by year."
          }
          chart={
            // Two measures on different scales, so two charts rather than one
            // with a second y-axis: 705k crashes and a ~7% rate cannot share
            // an axis without inventing a relationship between them.
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-[11px] font-medium text-surface-500">
                  Crashes per year
                </p>
                <TrendChart
                  kind="count"
                  valueKey="Crashes"
                  data={trendPoints.map((p) => ({
                    year: p.year,
                    value: p.totalCrashes,
                  }))}
                />
              </div>
              <div>
                <p className="mb-2 text-[11px] font-medium text-surface-500">
                  Serious or fatal, share of crashes
                </p>
                <TrendChart
                  kind="rate"
                  valueKey="Severe rate"
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
                  header: "Serious or fatal",
                  numeric: true,
                  cell: (row) => formatNumber(row.severeCrashes),
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

        <div className="grid gap-4 xl:grid-cols-2">
          <ChartPanel
            title="Crashes by severity"
            description="Share of crashes at each severity level."
            chart={<SeverityBar data={severity.data} />}
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
            title="Conditions present at crashes"
            description="Recorded conditions, with the share of each that was severe. These are associations, not causes — CAS has no cause field."
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
                    header: "Severe rate",
                    numeric: true,
                    cell: (row) => formatPercent(row.severeRate),
                  },
                ]}
              />
            }
          />

          <ChartPanel
            title="Crashes by light condition"
            description="CAS records no time of day — light condition is the closest real signal about when a crash happened."
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
                    header: "Severe",
                    numeric: true,
                    cell: (row) => formatNumber(row.severeCount),
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
            title="Crashes by road type"
            description="State highway or local road, urban or open road."
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
                    header: "Severe",
                    numeric: true,
                    cell: (row) => formatNumber(row.severeCount),
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
            title="Machine learning insight"
            description="Factors the severity model weighs most heavily."
            isPlaceholder={importance.meta.source === "placeholder"}
            chart={<ModelPreview importance={importance} />}
          />
        </div>
      </div>
    </>
  );
}

import { PageHeader } from "@/components/layout/PageHeader";
import { FilterSummary } from "@/components/layout/FilterSummary";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { BarList } from "@/components/charts/BarList";
import { TrendChart } from "@/components/charts/TrendChart";
import { DataTable } from "@/components/charts/DataTable";
import { parseFilters } from "@/lib/filters";
import { formatNumber, formatPercent } from "@/lib/formatters";
import { SEVERITY_COLORS } from "@/lib/chart-theme";
import { getFilterOptions } from "@/services/dashboardService";
import {
  getHolidayBreakdown,
  getRegionBreakdown,
  getSeverityTrends,
  getTrends,
} from "@/services/crashService";

export const metadata = { title: "Crash Trends" };

const NON_HOLIDAY = "Not a holiday period";

export default async function CrashTrendsPage({
  searchParams,
}: PageProps<"/crash-trends">) {
  const filters = parseFilters(await searchParams);

  const [trends, severityTrends, regions, holidays, options] =
    await Promise.all([
      getTrends(filters),
      getSeverityTrends(filters),
      getRegionBreakdown(filters),
      getHolidayBreakdown(filters),
      getFilterOptions(),
    ]);

  // The latest year is incomplete, so every trend line drops it while the
  // tables keep it. Guarded so filtering *to* that year still charts data.
  const partialYear = options.data.latestYearIsPartial
    ? options.data.yearMax
    : null;
  const dropPartial = <T extends { year: number }>(points: T[]) => {
    const kept = points.filter((p) => p.year !== partialYear);
    return kept.length > 0 ? kept : points;
  };

  const trendPoints = dropPartial(trends.data);
  const partialExcluded = trendPoints.length !== trends.data.length;

  // "Not a holiday period" is 94% of all crashes, so charting it alongside
  // the four holiday periods would flatten them to slivers. It stays in the
  // table and in the description as the baseline.
  const holidayPeriods = holidays.data.filter((h) => h.period !== NON_HOLIDAY);
  const baseline = holidays.data.find((h) => h.period === NON_HOLIDAY);

  return (
    <>
      <PageHeader
        title="Crash Trends"
        description="How crash volume and severity have shifted over time, by region and across holiday periods."
      />
      <FilterSummary filters={filters} pathname="/crash-trends" />

      <div className="space-y-4 p-6">
        <ChartPanel
          title="Crash volume and severity over time"
          description={
            partialExcluded
              ? `Two measures on different scales, so two charts rather than one with a second axis. ${partialYear} is excluded as a partial year; it remains in the table.`
              : "Two measures on different scales, so two charts rather than one with a second axis."
          }
          chart={
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-[11px] font-medium text-surface-500">
                  Crashes per year
                </p>
                <TrendChart
                  kind="count"
                  valueKey="Crashes"
                  height={220}
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
                  height={220}
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

        <ChartPanel
          title="Each severity level over time"
          description="One chart per level, each on its own scale. Plotted together, Non-Injury crashes would flatten Fatal and Serious into the baseline."
          chart={
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {severityTrends.data.map((series) => (
                <div key={series.severity}>
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-surface-500">
                    <span
                      aria-hidden
                      className="size-2 shrink-0 rounded-[2px]"
                      style={{
                        backgroundColor: SEVERITY_COLORS[series.severity],
                      }}
                    />
                    {series.severity}
                  </p>
                  <TrendChart
                    kind="count"
                    valueKey={series.severity}
                    height={150}
                    color={SEVERITY_COLORS[series.severity]}
                    data={dropPartial(series.points)}
                  />
                </div>
              ))}
            </div>
          }
          table={
            <DataTable
              caption="Crashes per year by severity"
              rows={trends.data.map((point) => ({
                year: point.year,
                counts: severityTrends.data.map(
                  (series) =>
                    series.points.find((p) => p.year === point.year)?.value ?? 0,
                ),
              }))}
              columns={[
                { header: "Year", cell: (row) => row.year },
                ...severityTrends.data.map((series, index) => ({
                  header: series.severity,
                  numeric: true,
                  cell: (row: { counts: number[] }) =>
                    formatNumber(row.counts[index]),
                })),
              ]}
            />
          }
        />

        <div className="grid gap-4 xl:grid-cols-2">
          <ChartPanel
            title="Crashes by region"
            description="Ranked by crash volume, with the share of each region's crashes that were serious or fatal."
            chart={
              <BarList
                data={regions.data.map((region) => ({
                  // Every region name carries the same " Region" suffix;
                  // dropping it for display costs no information.
                  label: region.region.replace(/ Region$/, ""),
                  value: region.crashCount,
                  rate: region.severeRate,
                }))}
              />
            }
            table={
              <DataTable
                caption="Crashes by region"
                rows={regions.data}
                columns={[
                  { header: "Region", cell: (row) => row.region },
                  {
                    header: "Crashes",
                    numeric: true,
                    cell: (row) => formatNumber(row.crashCount),
                  },
                  {
                    header: "Serious or fatal",
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
            title="Holiday periods"
            description={
              baseline
                ? `CAS records no month or weekday, so public-holiday periods are the only seasonality signal available. Outside them, ${formatNumber(baseline.crashCount)} crashes ran ${formatPercent(baseline.severeRate)} severe — the baseline these compare against.`
                : "CAS records no month or weekday, so public-holiday periods are the only seasonality signal available."
            }
            chart={
              <BarList
                data={holidayPeriods.map((period) => ({
                  label: period.period,
                  value: period.crashCount,
                  rate: period.severeRate,
                }))}
              />
            }
            table={
              <DataTable
                caption="Crashes by holiday period"
                rows={holidays.data}
                columns={[
                  { header: "Period", cell: (row) => row.period },
                  {
                    header: "Crashes",
                    numeric: true,
                    cell: (row) => formatNumber(row.crashCount),
                  },
                  {
                    header: "Serious or fatal",
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
        </div>
      </div>
    </>
  );
}

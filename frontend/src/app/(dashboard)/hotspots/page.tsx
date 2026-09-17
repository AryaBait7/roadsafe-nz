import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import { FilterSummary } from "@/components/layout/FilterSummary";
import { ChartPanel } from "@/components/charts/ChartPanel";
import { Donut } from "@/components/charts/Donut";
import { TrendChart } from "@/components/charts/TrendChart";
import { DataTable } from "@/components/charts/DataTable";
import { HotspotMapLoader } from "@/components/maps/HotspotMapLoader";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/Card";
import { EmptyState } from "@/components/states/EmptyState";
import { parseFilters, toSearchParams } from "@/lib/filters";
import { formatNumber, formatPercent } from "@/lib/formatters";
import { SEVERITY_COLORS } from "@/lib/chart-theme";
import {
  getHotspotDetail,
  getHotspots,
  getUnattributedCrashCount,
} from "@/services/analyticsService";
import type { CrashFilters, Hotspot } from "@/types";

export const metadata = { title: "Hotspots" };

/** Preserves the active filters when linking to an area. */
function areaHref(filters: CrashFilters, areaId: string | null): string {
  const params = toSearchParams(filters);
  if (areaId) params.set("area", areaId);
  const query = params.toString();
  return query ? `/hotspots?${query}` : "/hotspots";
}

/**
 * Ranked list. Bars rather than a bare table because the point of a hotspot
 * page is comparing magnitudes at a glance, and a column of numbers makes the
 * reader do that arithmetic themselves.
 */
function RankedAreas({
  hotspots,
  filters,
  selectedId,
}: {
  hotspots: Hotspot[];
  filters: CrashFilters;
  selectedId?: string;
}) {
  const largest = Math.max(...hotspots.map((h) => h.crashCount), 1);

  return (
    <ol className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
      {hotspots.map((hotspot, index) => {
        const isSelected = hotspot.id === selectedId;

        return (
          <li key={hotspot.id}>
            <Link
              href={areaHref(filters, isSelected ? null : hotspot.id)}
              // Selecting an area updates the detail panel beside the list;
              // jumping to the top of the page would lose the reader's place.
              scroll={false}
              aria-current={isSelected ? "true" : undefined}
              className={`grid grid-cols-[1.4rem_minmax(0,1fr)_auto] items-center gap-2 rounded px-1.5 py-1 transition-colors ${
                isSelected
                  ? "bg-accent-500/[0.06] ring-1 ring-accent-500/40"
                  : "hover:bg-surface-100"
              }`}
            >
              <span className="tabular text-[10px] text-surface-500">
                {index + 1}
              </span>

              <span className="min-w-0">
                <span className="block truncate text-[11px] text-surface-700">
                  {hotspot.name}
                </span>
                <span className="mt-0.5 block h-1.5 rounded-full bg-surface-100">
                  <span
                    className="block h-full rounded-full bg-accent-500"
                    style={{
                      width: `${Math.max((hotspot.crashCount / largest) * 100, 1)}%`,
                    }}
                  />
                </span>
              </span>

              <span className="text-right">
                <span className="tabular block text-[11px] font-medium text-navy-900">
                  {formatNumber(hotspot.crashCount)}
                </span>
                <span className="tabular block text-[10px] text-surface-500">
                  {formatPercent(hotspot.severeRate)}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

export default async function HotspotsPage({
  searchParams,
}: PageProps<"/hotspots">) {
  const params = await searchParams;
  const filters = parseFilters(params);

  const rawArea = Array.isArray(params.area) ? params.area[0] : params.area;
  const selectedId = rawArea?.trim() || undefined;

  const [hotspots, unattributed, detail] = await Promise.all([
    getHotspots(filters),
    getUnattributedCrashCount(filters),
    selectedId ? getHotspotDetail(selectedId, filters) : Promise.resolve(null),
  ]);

  const areas = hotspots.data.filter((hotspot) => hotspot.crashCount > 0);
  const selected = detail?.data ?? null;

  // The national rate is pulled down by Auckland's volume; the typical area
  // is much worse. Stating both keeps the ranking honest.
  const nationalSevere =
    areas.reduce((sum, a) => sum + a.severeCount, 0) /
    Math.max(
      areas.reduce((sum, a) => sum + a.crashCount, 0),
      1,
    );
  const sortedRates = [...areas].map((a) => a.severeRate).sort((a, b) => a - b);
  const medianAreaRate = sortedRates.length
    ? sortedRates[Math.floor(sortedRates.length / 2)]
    : 0;

  return (
    <>
      <PageHeader
        title="Hotspots"
        description="Where crashes concentrate, and where they most often turn serious."
      />
      <FilterSummary filters={filters} pathname="/hotspots" />

      <div className="space-y-3 p-4">
        {areas.length === 0 ? (
          <EmptyState
            title="No areas match these filters"
            description="Try widening the year range or clearing the region filter."
          />
        ) : (
          <>
            <Card>
              <CardBody className="flex flex-wrap items-baseline gap-x-8 gap-y-2 text-[11px] text-surface-500">
                <span>
                  <span className="tabular text-base font-semibold text-navy-900">
                    {formatNumber(areas.length)}
                  </span>{" "}
                  areas with crashes
                  {unattributed > 0 ? (
                    <span className="text-surface-500">
                      {" "}
                      · {formatNumber(unattributed)}{" "}
                      {unattributed === 1 ? "crash has" : "crashes have"} no
                      recorded area
                    </span>
                  ) : null}
                </span>
                <span>
                  National severe rate{" "}
                  <span className="tabular font-semibold text-navy-900">
                    {formatPercent(nationalSevere)}
                  </span>
                </span>
                <span>
                  Median area{" "}
                  <span className="tabular font-semibold text-navy-900">
                    {formatPercent(medianAreaRate)}
                  </span>
                </span>
                <span className="max-w-xl text-surface-500">
                  The median area is markedly worse than the national figure
                  because Auckland&rsquo;s volume dominates the average while
                  rural districts carry the highest rates.
                </span>
              </CardBody>
            </Card>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
              <ChartPanel
                className="xl:col-span-4"
                title="Ranked by crash volume"
                description="Select an area to see its breakdown. Percentage is the share that were serious or fatal."
                chart={
                  <RankedAreas
                    hotspots={areas}
                    filters={filters}
                    selectedId={selectedId}
                  />
                }
                table={
                  <DataTable
                    caption="Territorial authorities ranked by crashes"
                    rows={areas}
                    columns={[
                      { header: "Area", cell: (row) => row.name },
                      { header: "Region", cell: (row) => row.region },
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
                        header: "Adjusted",
                        numeric: true,
                        cell: (row) => formatPercent(row.adjustedSevereRate),
                      },
                    ]}
                  />
                }
              />

              <Card className="flex flex-col xl:col-span-8">
                <CardHeader>
                  <div className="min-w-0">
                    <CardTitle>Where they are</CardTitle>
                    <CardDescription>
                      Click an area to select it. Circle size is crash volume;
                      fill is the adjusted serious-or-fatal share, which pulls
                      small districts towards the national rate so a handful of
                      crashes cannot paint an area dark.
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardBody>
                  <HotspotMapLoader
                    hotspots={areas}
                    selectedId={selectedId}
                    height="420px"
                  />
                </CardBody>
              </Card>
            </div>

            {selected ? (
              <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
                <Card className="xl:col-span-3">
                  <CardHeader>
                    <div className="min-w-0">
                      <CardTitle>{selected.area.name}</CardTitle>
                      <CardDescription>{selected.area.region}</CardDescription>
                    </div>
                  </CardHeader>
                  <CardBody className="space-y-2.5">
                    <p className="text-[11px] text-surface-500">
                      Ranked{" "}
                      <span className="font-semibold text-navy-900">
                        #{selected.rank}
                      </span>{" "}
                      of {selected.totalAreas} by crash volume
                    </p>
                    <p className="text-2xl font-semibold text-navy-900">
                      {formatNumber(selected.area.crashCount)}
                    </p>
                    <p className="text-[11px] text-surface-500">
                      crashes ·{" "}
                      <span className="font-medium text-navy-900">
                        {formatNumber(selected.area.severeCount)}
                      </span>{" "}
                      serious or fatal (
                      {formatPercent(selected.area.severeRate)}, 95% CI{" "}
                      {formatPercent(selected.area.severeRateInterval[0])}–
                      {formatPercent(selected.area.severeRateInterval[1])};
                      adjusted {formatPercent(selected.area.adjustedSevereRate)}
                      )
                    </p>
                    <Link
                      href={areaHref(filters, null)}
                      scroll={false}
                      className="inline-block text-[11px] font-medium text-accent-600 hover:underline"
                    >
                      Clear selection
                    </Link>
                  </CardBody>
                </Card>

                <ChartPanel
                  className="xl:col-span-4"
                  title="Severity composition"
                  description={`How crashes in ${selected.area.name} break down.`}
                  chart={
                    <Donut
                      data={selected.severity.map((item) => ({
                        name: item.severity,
                        value: item.count,
                        color: SEVERITY_COLORS[item.severity],
                      }))}
                      centreValue={selected.area.crashCount}
                      centreLabel="Crashes"
                      size={130}
                    />
                  }
                  table={
                    <DataTable
                      caption={`Severity breakdown for ${selected.area.name}`}
                      rows={selected.severity}
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
                  className="xl:col-span-5"
                  title="Crashes per year"
                  description={`${selected.area.name} over time.`}
                  chart={
                    <TrendChart
                      kind="count"
                      valueKey="Crashes"
                      height={170}
                      data={selected.trend.map((point) => ({
                        year: point.year,
                        value: point.totalCrashes,
                      }))}
                    />
                  }
                  table={
                    <DataTable
                      caption={`Crashes per year in ${selected.area.name}`}
                      rows={selected.trend}
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
              </div>
            ) : (
              <Card>
                <CardBody>
                  <EmptyState
                    title="Select an area"
                    description="Choose one from the ranking or the map to see its severity breakdown and trend."
                  />
                </CardBody>
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}

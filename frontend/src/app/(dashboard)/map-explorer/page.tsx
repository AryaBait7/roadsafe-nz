import { PageHeader } from "@/components/layout/PageHeader";
import { FilterSummary } from "@/components/layout/FilterSummary";
import { CrashMapLoader } from "@/components/maps/CrashMapLoader";
import { Card, CardBody, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { EmptyState } from "@/components/states/EmptyState";
import { parseFilters } from "@/lib/filters";
import { formatNumber } from "@/lib/formatters";
import { getMapGridDegrees, getMapPoints } from "@/services/crashService";

export const metadata = { title: "Map Explorer" };

export default async function MapExplorerPage({
  searchParams,
}: PageProps<"/map-explorer">) {
  const filters = parseFilters(await searchParams);

  const [points, gridDegrees] = await Promise.all([
    getMapPoints(filters),
    getMapGridDegrees(),
  ]);

  const totalCrashes = points.data.reduce((sum, p) => sum + p.crashCount, 0);

  // Only the filters the cell grain can actually honour are applied here.
  // Saying so is better than a map that quietly ignores half the sidebar.
  const unsupported = [
    filters.roadType && "road type",
    filters.speedEnvironment && "speed environment",
    filters.severity && "crash severity",
  ].filter(Boolean) as string[];

  return (
    <>
      <PageHeader
        title="Map Explorer"
        description="Where crashes happen across New Zealand, aggregated into a density grid."
      />
      <FilterSummary filters={filters} pathname="/map-explorer" />

      <div className="space-y-4 p-6">
        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle>Crash density</CardTitle>
              <CardDescription>
                {formatNumber(totalCrashes)} crashes across{" "}
                {formatNumber(points.data.length)} cells. Click any cell for its
                figures.
              </CardDescription>
            </div>
          </CardHeader>
          <CardBody>
            {points.data.length === 0 ? (
              <EmptyState
                title="No crashes match these filters"
                description="Try widening the year range or clearing the region filter."
              />
            ) : (
              <CrashMapLoader
                points={points.data}
                gridDegrees={gridDegrees}
              />
            )}
          </CardBody>
        </Card>

        {unsupported.length > 0 ? (
          <Card>
            <CardBody className="text-xs text-surface-500">
              <span className="font-medium text-navy-900">
                Not applied to this map:
              </span>{" "}
              {unsupported.join(", ")}. The density grid carries location, year
              and region only — adding every dimension at cell grain would
              multiply the payload many times over for a view that reads at
              about 5km resolution. Those filters do apply on the other pages,
              and the database query will honour them here once it replaces the
              pre-aggregated grid.
            </CardBody>
          </Card>
        ) : null}
      </div>
    </>
  );
}

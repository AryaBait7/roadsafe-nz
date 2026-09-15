import { PageHeader } from "@/components/layout/PageHeader";
import { FilterSummary } from "@/components/layout/FilterSummary";
import { EmptyState } from "@/components/states/EmptyState";
import { parseFilters } from "@/lib/filters";

export const metadata = { title: "Hotspots" };

export default async function HotspotsPage({ searchParams }: PageProps<"/hotspots">) {
  const filters = parseFilters(await searchParams);

  return (
    <>
      <PageHeader
        title="Hotspots"
        description="Territorial authorities with the highest crash concentrations."
      />
      <FilterSummary filters={filters} pathname="/hotspots" />
      <div className="p-6">
        <EmptyState
          title="Not built yet"
          description="This page is scheduled for Stage 7."
        />
      </div>
    </>
  );
}

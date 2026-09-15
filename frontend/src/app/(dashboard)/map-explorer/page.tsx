import { PageHeader } from "@/components/layout/PageHeader";
import { FilterSummary } from "@/components/layout/FilterSummary";
import { EmptyState } from "@/components/states/EmptyState";
import { parseFilters } from "@/lib/filters";

export const metadata = { title: "Map Explorer" };

export default async function MapExplorerPage({ searchParams }: PageProps<"/map-explorer">) {
  const filters = parseFilters(await searchParams);

  return (
    <>
      <PageHeader
        title="Map Explorer"
        description="Crash locations across New Zealand, aggregated by area."
      />
      <FilterSummary filters={filters} pathname="/map-explorer" />
      <div className="p-6">
        <EmptyState
          title="Not built yet"
          description="This page is scheduled for Stage 6."
        />
      </div>
    </>
  );
}

import { PageHeader } from "@/components/layout/PageHeader";
import { FilterSummary } from "@/components/layout/FilterSummary";
import { EmptyState } from "@/components/states/EmptyState";
import { parseFilters } from "@/lib/filters";

export const metadata = { title: "Crash Trends" };

export default async function CrashTrendsPage({ searchParams }: PageProps<"/crash-trends">) {
  const filters = parseFilters(await searchParams);

  return (
    <>
      <PageHeader
        title="Crash Trends"
        description="How crash volume and severity have shifted year to year."
      />
      <FilterSummary filters={filters} pathname="/crash-trends" />
      <div className="p-6">
        <EmptyState
          title="Not built yet"
          description="This page is scheduled for Stage 5."
        />
      </div>
    </>
  );
}

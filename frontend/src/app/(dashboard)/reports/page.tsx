import { PageHeader } from "@/components/layout/PageHeader";
import { FilterSummary } from "@/components/layout/FilterSummary";
import { EmptyState } from "@/components/states/EmptyState";
import { parseFilters } from "@/lib/filters";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const filters = parseFilters(await searchParams);

  return (
    <>
      <PageHeader
        title="Reports"
        description="Exportable summaries of the current view."
      />
      <FilterSummary filters={filters} pathname="/reports" />
      <div className="p-6">
        <EmptyState
          title="Not built yet"
          description="This page is scheduled for Stage 10."
        />
      </div>
    </>
  );
}

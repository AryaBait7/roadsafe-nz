import { PageHeader } from "@/components/layout/PageHeader";
import { FilterSummary } from "@/components/layout/FilterSummary";
import { EmptyState } from "@/components/states/EmptyState";
import { parseFilters } from "@/lib/filters";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const filters = parseFilters(await searchParams);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Overview of road crash patterns across New Zealand."
      />
      <FilterSummary filters={filters} pathname="/dashboard" />
      <div className="p-6">
        <EmptyState
          title="Not built yet"
          description="This page is scheduled for Stage 4."
        />
      </div>
    </>
  );
}

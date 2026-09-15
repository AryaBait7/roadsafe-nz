import { PageHeader } from "@/components/layout/PageHeader";
import { FilterSummary } from "@/components/layout/FilterSummary";
import { EmptyState } from "@/components/states/EmptyState";
import { parseFilters } from "@/lib/filters";

export const metadata = { title: "Data Dictionary" };

export default async function DataDictionaryPage({ searchParams }: PageProps<"/data-dictionary">) {
  const filters = parseFilters(await searchParams);

  return (
    <>
      <PageHeader
        title="Data Dictionary"
        description="Every CAS field used, what it means, and how complete it is."
      />
      <FilterSummary filters={filters} pathname="/data-dictionary" />
      <div className="p-6">
        <EmptyState
          title="Not built yet"
          description="This page is scheduled for Stage 11."
        />
      </div>
    </>
  );
}

import { PageHeader } from "@/components/layout/PageHeader";
import { FilterSummary } from "@/components/layout/FilterSummary";
import { EmptyState } from "@/components/states/EmptyState";
import { parseFilters } from "@/lib/filters";

export const metadata = { title: "ML Insights" };

export default async function MlInsightsPage({ searchParams }: PageProps<"/ml-insights">) {
  const filters = parseFilters(await searchParams);

  return (
    <>
      <PageHeader
        title="ML Insights"
        description="Severity model performance and the factors driving its predictions."
      />
      <FilterSummary filters={filters} pathname="/ml-insights" />
      <div className="p-6">
        <EmptyState
          title="Not built yet"
          description="This page is scheduled for Stage 9."
        />
      </div>
    </>
  );
}

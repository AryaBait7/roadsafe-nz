import { PageHeader } from "@/components/layout/PageHeader";
import { FilterSummary } from "@/components/layout/FilterSummary";
import { EmptyState } from "@/components/states/EmptyState";
import { parseFilters } from "@/lib/filters";

export const metadata = { title: "Risk Factors" };

export default async function RiskFactorsPage({ searchParams }: PageProps<"/risk-factors">) {
  const filters = parseFilters(await searchParams);

  return (
    <>
      <PageHeader
        title="Risk Factors"
        description="Road, weather and light conditions recorded at severe crashes."
      />
      <FilterSummary filters={filters} pathname="/risk-factors" />
      <div className="p-6">
        <EmptyState
          title="Not built yet"
          description="This page is scheduled for Stage 8."
        />
      </div>
    </>
  );
}

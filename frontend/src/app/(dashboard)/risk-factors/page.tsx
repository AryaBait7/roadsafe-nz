import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/states/EmptyState";

export const metadata = { title: "Risk Factors" };

export default function RiskFactorsPage() {
  return (
    <>
      <PageHeader
        title="Risk Factors"
        description="Road, weather and light conditions recorded at severe crashes."
      />
      <div className="p-6">
        <EmptyState
          title="Not built yet"
          description="This page is scheduled for Stage 8."
        />
      </div>
    </>
  );
}

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/states/EmptyState";

export const metadata = { title: "ML Insights" };

export default function MlInsightsPage() {
  return (
    <>
      <PageHeader
        title="ML Insights"
        description="Severity model performance and the factors driving its predictions."
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

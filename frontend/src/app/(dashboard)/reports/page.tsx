import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/states/EmptyState";

export const metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <>
      <PageHeader
        title="Reports"
        description="Exportable summaries of the current view."
      />
      <div className="p-6">
        <EmptyState
          title="Not built yet"
          description="This page is scheduled for Stage 10."
        />
      </div>
    </>
  );
}

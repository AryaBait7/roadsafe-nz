import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/states/EmptyState";

export const metadata = { title: "Data Dictionary" };

export default function DataDictionaryPage() {
  return (
    <>
      <PageHeader
        title="Data Dictionary"
        description="Every CAS field used, what it means, and how complete it is."
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

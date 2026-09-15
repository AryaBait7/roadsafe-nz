import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/states/EmptyState";

export const metadata = { title: "Map Explorer" };

export default function MapExplorerPage() {
  return (
    <>
      <PageHeader
        title="Map Explorer"
        description="Crash locations across New Zealand, aggregated by area."
      />
      <div className="p-6">
        <EmptyState
          title="Not built yet"
          description="This page is scheduled for Stage 6."
        />
      </div>
    </>
  );
}

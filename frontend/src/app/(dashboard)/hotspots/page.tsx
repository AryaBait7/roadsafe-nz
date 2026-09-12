import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/states/EmptyState";

export const metadata = { title: "Hotspots" };

export default function HotspotsPage() {
  return (
    <>
      <PageHeader
        title="Hotspots"
        description="Territorial authorities with the highest crash concentrations."
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

import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/states/EmptyState";

export const metadata = { title: "Crash Trends" };

export default function CrashTrendsPage() {
  return (
    <>
      <PageHeader
        title="Crash Trends"
        description="How crash volume and severity have shifted year to year."
      />
      <div className="p-6">
        <EmptyState
          title="Not built yet"
          description="This page is scheduled for Stage 4."
        />
      </div>
    </>
  );
}

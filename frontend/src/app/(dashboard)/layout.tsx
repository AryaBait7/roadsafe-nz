import { Sidebar } from "@/components/layout/Sidebar";
import { getFilterOptions } from "@/services/dashboardService";

/**
 * Shell for every analytics page. The landing page sits outside this route
 * group so it renders full-bleed without the sidebar.
 *
 * Filter *options* are fetched here because they are the same on every page.
 * Filter *values* are not: layouts do not receive `searchParams` in the App
 * Router, so each page parses the URL itself and the panel reads it on the
 * client.
 */
export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const { data: filterOptions } = await getFilterOptions();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar options={filterOptions} />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

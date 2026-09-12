import { Sidebar } from "@/components/layout/Sidebar";

/**
 * Shell for every analytics page. The landing page sits outside this route
 * group so it renders full-bleed without the sidebar.
 */
export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar />
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}

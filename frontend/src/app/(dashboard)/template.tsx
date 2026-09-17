/**
 * Re-mounted on every navigation between analytics pages (unlike the layout,
 * which persists), so the entrance motion plays once per page. Filter changes
 * stay on the same page and do not replay it.
 *
 * No transform survives the animation, so it cannot leave a containing block
 * behind for fixed-position descendants.
 */
export default function DashboardTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="motion-safe:animate-[page-in_220ms_ease-out]">
      {children}
    </div>
  );
}

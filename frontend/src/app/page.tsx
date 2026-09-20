import { HeroIntro } from "@/features/landing/HeroIntro";
import {
  LandingFooter,
  LandingSections,
} from "@/features/landing/LandingSections";
import { getSummary } from "@/services/dashboardService";
import { getRoadSafetyUpdates } from "@/services/updatesService";

/**
 * Rendered per request: the data comes from the API, so the build must not
 * depend on it being up. Fetches are still cached for 60s (see http.ts), so
 * repeated views cost one upstream request, not one per visitor.
 */
export const dynamic = "force-dynamic";

/**
 * Public landing page.
 *
 * Sits outside the (dashboard) route group so it renders full-bleed with no
 * sidebar. A Server Component: the headline figures are fetched through the
 * same service layer the dashboard uses, so the numbers shown here are real
 * CAS aggregates rather than marketing copy, and they stay correct when the
 * data source becomes the API.
 */
export default async function LandingPage() {
  // In parallel: the updates call is the only one that leaves our own
  // infrastructure, and it resolves to null rather than throwing if the
  // source is down, so it cannot delay or break the rest of the page.
  const [{ data: summary }, news] = await Promise.all([
    getSummary(),
    getRoadSafetyUpdates(),
  ]);

  return (
    <>
      <main>
        <HeroIntro />
        <LandingSections summary={summary} news={news} />
      </main>
      <LandingFooter />
    </>
  );
}

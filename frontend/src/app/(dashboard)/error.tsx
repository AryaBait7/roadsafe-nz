"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/states/ErrorState";

/**
 * Catches anything a page or its services throw, inside the sidebar shell,
 * so navigation keeps working when one page fails.
 *
 * In production Next.js replaces server error messages with a digest, so
 * nothing internal (file paths, stack traces) reaches the browser. The
 * digest is shown because it matches the server log entry. In development
 * the real message is shown, which is what makes a missing fixture
 * ("run generate_frontend_fixtures.py") fixable at a glance.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [isRetrying, startTransition] = useTransition();

  useEffect(() => {
    console.error(error);
  }, [error]);

  // reset() alone only re-renders on the client. These errors come from the
  // server render, so the page has to be fetched again first; doing both in
  // one transition keeps the error visible until the new result arrives.
  const retry = () =>
    startTransition(() => {
      router.refresh();
      reset();
    });

  const detail =
    process.env.NODE_ENV === "development"
      ? error.message
      : "Something went wrong while preparing this page. Try again, or go back to the dashboard.";

  return (
    <div className="p-4">
      <Card>
        <ErrorState
          title="This page could not be loaded"
          message={detail}
          action={
            <div className="flex flex-col items-center gap-2">
              <div className="flex gap-2">
                <Button size="sm" onClick={retry} disabled={isRetrying}>
                  {isRetrying ? "Retrying…" : "Try again"}
                </Button>
                <Link
                  href="/dashboard"
                  className="inline-flex h-8 items-center rounded-md border border-surface-300 bg-white px-3 text-xs font-medium text-navy-900 hover:bg-surface-100"
                >
                  Go to dashboard
                </Link>
              </div>
              {error.digest ? (
                <p className="text-[10px] text-surface-400">
                  Reference: <code>{error.digest}</code>
                </p>
              ) : null}
            </div>
          }
        />
      </Card>
    </div>
  );
}

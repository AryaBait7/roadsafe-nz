import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-navy-950 px-6 text-center">
      <p className="text-[11px] font-semibold tracking-[0.3em] text-safety-400">
        404
      </p>
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        This road doesn&apos;t go anywhere
      </h1>
      <p className="max-w-sm text-sm text-surface-400">
        The page you asked for does not exist. The dashboard has everything
        RoadSafe NZ offers.
      </p>
      <div className="mt-2 flex gap-2">
        <Link
          href="/dashboard"
          className="inline-flex h-10 items-center rounded-md bg-safety-400 px-4 text-sm font-semibold text-navy-950 hover:bg-safety-300"
        >
          Open the dashboard
        </Link>
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded-md border border-navy-700 px-4 text-sm font-medium text-surface-200 hover:bg-navy-800"
        >
          Home
        </Link>
      </div>
    </main>
  );
}

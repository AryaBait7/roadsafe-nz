import Link from "next/link";

/** Temporary. Replaced by the cinematic landing experience in Stage 2. */
export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-navy-950 px-6 text-center">
      <p className="text-[11px] font-semibold tracking-[0.2em] text-safety-400 uppercase">
        New Zealand Road Crash Intelligence
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
        RoadSafe<span className="text-safety-400"> NZ</span>
      </h1>
      <p className="mt-4 max-w-md text-sm text-surface-300">
        Turning crash data into safer-road insights.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex h-11 items-center rounded-md bg-safety-400 px-6 text-sm font-semibold text-navy-950 transition-colors hover:bg-safety-300"
      >
        Explore road safety data →
      </Link>
      <p className="mt-10 text-[11px] text-surface-500">
        Placeholder landing page — the cinematic intro is built in Stage 2.
      </p>
    </div>
  );
}

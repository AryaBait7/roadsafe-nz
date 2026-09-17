"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";
import type { PackedMapPoints } from "@/lib/mapPack";

/**
 * Client-side loader for the map.
 *
 * Leaflet reads `window` at module scope, so it cannot be imported during
 * server rendering — hence `ssr: false`. That option is not permitted inside
 * a Server Component in the App Router, which is why this thin client wrapper
 * exists rather than the page importing the map directly.
 */
const CrashMap = dynamic(() => import("./CrashMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-[70vh] max-h-[60svh] w-full lg:max-h-none" />,
});

export function CrashMapLoader(props: {
  /** Packed on the server with `packPoints` to keep the page HTML small. */
  points: PackedMapPoints;
  gridDegrees: number;
  height?: string;
}) {
  return <CrashMap {...props} />;
}

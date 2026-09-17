"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Hotspot } from "@/types";

/**
 * Leaflet reads `window` at module scope, so it cannot be imported during
 * server rendering — and `ssr: false` is not permitted inside a Server
 * Component, hence this thin client wrapper.
 */
const HotspotMap = dynamic(() => import("./HotspotMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-[420px] max-h-[60svh] w-full lg:max-h-none" />,
});

export function HotspotMapLoader(props: {
  hotspots: Hotspot[];
  selectedId?: string;
  height?: string;
}) {
  return <HotspotMap {...props} />;
}

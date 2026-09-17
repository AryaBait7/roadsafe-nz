"use client";

import "leaflet/dist/leaflet.css";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import { SEQUENTIAL_RAMP_DARK } from "@/lib/chart-theme";
import { formatNumber, formatPercent } from "@/lib/formatters";
import type { Hotspot } from "@/types";

/**
 * Territorial authorities as proportional circles.
 *
 * Two measures, two channels: circle *area* carries crash volume and fill
 * carries severe rate. They are genuinely different quantities, so this is
 * not double-encoding — reading one tells you nothing about the other, which
 * is the point. Auckland is by far the largest circle and one of the palest.
 *
 * Radius scales with the square root of the count. Mapping count to radius
 * directly would exaggerate large areas by the square, which is the classic
 * way a bubble map lies.
 */

/**
 * Severe-rate bins, chosen from the actual distribution across areas rather
 * than from the national average. The national rate is 6.7%, but that is
 * dominated by Auckland's 237k crashes at 4.5%; the median territorial
 * authority sits at 10.1%. Binning around 6.7% would put 40 of 68 areas in
 * one bucket and show nothing.
 */
const RATE_BINS = [
  { max: 0.07, label: "Under 7%" },
  { max: 0.1, label: "7–10%" },
  { max: 0.12, label: "10–12%" },
  { max: Infinity, label: "12% and over" },
];

const MAINLAND_BOUNDS: [[number, number], [number, number]] = [
  [-47.5, 166.0],
  [-34.3, 179.0],
];

function binFor(rate: number): number {
  return RATE_BINS.findIndex((bin) => rate < bin.max);
}

function unwrapLongitude(longitude: number): number {
  return longitude < 0 ? longitude + 360 : longitude;
}

function InvalidateOnResize() {
  const map = useMap();

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    const settle = window.setTimeout(() => map.invalidateSize(), 180);

    return () => {
      observer.disconnect();
      window.clearTimeout(settle);
    };
  }, [map]);

  return null;
}

export default function HotspotMap({
  hotspots,
  selectedId,
  height = "420px",
}: {
  hotspots: Hotspot[];
  selectedId?: string;
  height?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Keep every active filter; only the selected area changes. Building the
  // URL from `area` alone silently cleared the year and region filters.
  const hrefFor = (areaId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("area", areaId);
    return `/hotspots?${params}`;
  };

  const largest = Math.max(...hotspots.map((h) => h.crashCount), 1);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-surface-500">
        <span className="text-surface-500">
          Circle size = crashes · fill = severe rate
        </span>
        <div className="flex items-center gap-1.5">
          {RATE_BINS.map((bin, index) => (
            <span key={bin.label} className="flex items-center gap-1">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: SEQUENTIAL_RAMP_DARK[index] }}
              />
              {bin.label}
            </span>
          ))}
        </div>
      </div>

      <div
        style={{ height }}
        className="isolate max-h-[60svh] overflow-hidden rounded-md border border-navy-800 lg:max-h-none"
      >
        <MapContainer
          className="map-dark"
          bounds={MAINLAND_BOUNDS}
          scrollWheelZoom
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />

          {hotspots.map((hotspot) => {
            const isSelected = hotspot.id === selectedId;

            return (
              <CircleMarker
                key={hotspot.id}
                center={[hotspot.latitude, unwrapLongitude(hotspot.longitude)]}
                // sqrt keeps circle *area* proportional to the count.
                radius={
                  4 + Math.sqrt(hotspot.crashCount / largest) * 22
                }
                pathOptions={{
                  color: isSelected ? "#ffc72c" : "transparent",
                  weight: isSelected ? 2 : 0,
                  fillColor:
                    SEQUENTIAL_RAMP_DARK[Math.max(binFor(hotspot.severeRate), 0)],
                  fillOpacity: 0.78,
                }}
                eventHandlers={{
                  click: () =>
                    router.push(hrefFor(hotspot.id), { scroll: false }),
                }}
              >
                {/* Tooltip rather than popup: this is a scan-and-compare map,
                    so hovering many areas quickly should not require
                    dismissing anything. */}
                <Tooltip direction="top" offset={[0, -4]}>
                  <span className="text-[11px] font-semibold">
                    {hotspot.name}
                  </span>
                  <br />
                  <span className="text-[11px]">
                    {formatNumber(hotspot.crashCount)} crashes ·{" "}
                    {formatPercent(hotspot.severeRate)} severe
                  </span>
                </Tooltip>
              </CircleMarker>
            );
          })}

          <InvalidateOnResize />
        </MapContainer>
      </div>
    </div>
  );
}

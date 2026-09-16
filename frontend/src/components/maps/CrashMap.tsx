"use client";

import "leaflet/dist/leaflet.css";
import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  Polygon,
} from "geojson";
import type { Layer, PathOptions } from "leaflet";
import { useMemo, useState } from "react";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import { SEQUENTIAL_RAMP } from "@/lib/chart-theme";
import { formatNumber, formatPercent } from "@/lib/formatters";
import type { MapCrashPoint } from "@/types";

/**
 * Crash density across New Zealand.
 *
 * Cells, not points. 705,609 markers cannot be rendered, and publishing exact
 * coordinates would expose the location of individual incidents in which real
 * people were killed or injured — every question this map answers works at
 * grid resolution.
 *
 * All 6,103 cells go into one GeoJSON layer rather than 6,103 React
 * components, and the map uses Leaflet's canvas renderer: reconciling
 * thousands of components per pan would make the map unusable.
 */

/**
 * Fixed log-decade bins, deliberately not quantiles.
 *
 * The distribution is extreme — median 11 crashes per cell, max 25,172, with
 * the top 1% of cells holding over half of all crashes — so linear breaks put
 * the entire country in one bin. Quantile breaks fix that but recompute
 * whenever the user filters, which repaints cells whose value never changed.
 * Colour must follow the entity, not its rank, so the bins are fixed.
 */
const BINS = [
  { min: 1, max: 10, label: "1–10" },
  { min: 11, max: 100, label: "11–100" },
  { min: 101, max: 1000, label: "101–1,000" },
  { min: 1001, max: Infinity, label: "1,001+" },
];

/** Mainland NZ. The Chatham Islands sit east of the antimeridian; see below. */
const MAINLAND_BOUNDS: [[number, number], [number, number]] = [
  [-47.5, 166.0],
  [-34.3, 179.0],
];

type Measure = "all" | "severe";

function binIndex(value: number): number {
  return BINS.findIndex((bin) => value >= bin.min && value <= bin.max);
}

/**
 * Leaflet plots longitude on a continuous axis, so the Chatham Islands at
 * roughly -176.7 would otherwise sit most of a world away from a mainland at
 * +166 to +179 and stretch the viewport across the globe. Shifting them past
 * 180 puts them where they belong geographically — just east of the mainland.
 */
function unwrapLongitude(longitude: number): number {
  return longitude < 0 ? longitude + 360 : longitude;
}

function toFeatureCollection(
  points: MapCrashPoint[],
  gridDegrees: number,
  measure: Measure,
): FeatureCollection<Polygon> {
  const half = gridDegrees / 2;

  return {
    type: "FeatureCollection",
    features: points
      .map((point) => {
        const value =
          measure === "severe" ? point.severeCount : point.crashCount;
        const lon = unwrapLongitude(point.longitude);

        return {
          type: "Feature" as const,
          properties: {
            value,
            crashCount: point.crashCount,
            severeCount: point.severeCount,
            region: point.region,
            latitude: point.latitude,
            longitude: point.longitude,
          },
          geometry: {
            type: "Polygon" as const,
            coordinates: [
              [
                [lon - half, point.latitude - half],
                [lon + half, point.latitude - half],
                [lon + half, point.latitude + half],
                [lon - half, point.latitude + half],
                [lon - half, point.latitude - half],
              ],
            ],
          },
        };
      })
      // A cell with no severe crashes has nothing to show on the severe view.
      .filter((feature) => feature.properties.value > 0),
  };
}

// Leaflet's style and per-feature callbacks are generic over every geometry
// type, so they cannot be narrowed to Polygon here even though every feature
// this layer receives is one — Leaflet's own signature must be honoured.
function styleFeature(feature?: Feature<Geometry, GeoJsonProperties>): PathOptions {
  const value = (feature?.properties?.value as number) ?? 0;
  const index = Math.max(binIndex(value), 0);

  return {
    // No stroke: at this cell size a border is more ink than the fill and
    // merges neighbouring cells into a grid of lines.
    stroke: false,
    fillColor: SEQUENTIAL_RAMP[index],
    fillOpacity: 0.75,
  };
}

/**
 * Popups are built as DOM nodes with textContent rather than an HTML string.
 * These labels are data, and concatenating data into innerHTML is the wrong
 * habit even when the data is your own.
 */
function bindPopup(feature: Feature<Geometry, GeoJsonProperties>, layer: Layer) {
  const props = feature.properties ?? {};
  const crashCount = props.crashCount as number;
  const severeCount = props.severeCount as number;

  const root = document.createElement("div");
  root.className = "text-xs";

  const heading = document.createElement("p");
  heading.className = "font-semibold";
  heading.textContent = String(props.region ?? "Unknown region");
  root.append(heading);

  const rows: [string, string][] = [
    ["Crashes", formatNumber(crashCount)],
    ["Serious or fatal", formatNumber(severeCount)],
    [
      "Severe rate",
      crashCount > 0 ? formatPercent(severeCount / crashCount) : "—",
    ],
    [
      "Cell centre",
      `${(props.latitude as number).toFixed(2)}, ${(props.longitude as number).toFixed(2)}`,
    ],
  ];

  for (const [label, value] of rows) {
    const line = document.createElement("p");
    line.textContent = `${label}: ${value}`;
    root.append(line);
  }

  layer.bindPopup(root);
}

export default function CrashMap({
  points,
  gridDegrees,
  height = "70vh",
}: {
  points: MapCrashPoint[];
  gridDegrees: number;
  height?: string;
}) {
  const [measure, setMeasure] = useState<Measure>("all");

  const collection = useMemo(
    () => toFeatureCollection(points, gridDegrees, measure),
    [points, gridDegrees, measure],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label="Measure"
          className="inline-flex overflow-hidden rounded-md border border-surface-200"
        >
          {(
            [
              ["all", "All crashes"],
              ["severe", "Serious & fatal"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setMeasure(key)}
              aria-pressed={measure === key}
              className={
                measure === key
                  ? "bg-navy-900 px-3 py-1.5 text-[11px] font-medium text-white"
                  : "bg-white px-3 py-1.5 text-[11px] font-medium text-surface-500 hover:bg-surface-100"
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-[11px] text-surface-500">
          <span>Crashes per cell</span>
          {BINS.map((bin, index) => (
            <span key={bin.label} className="flex items-center gap-1">
              <span
                aria-hidden
                className="size-2.5 rounded-[2px]"
                style={{ backgroundColor: SEQUENTIAL_RAMP[index] }}
              />
              {bin.label}
            </span>
          ))}
        </div>
      </div>

      <div
        style={{ height }}
        className="overflow-hidden rounded-md border border-surface-200"
      >
        <MapContainer
          bounds={MAINLAND_BOUNDS}
          scrollWheelZoom
          preferCanvas
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {/* Keyed on the measure so the layer rebuilds when it changes —
              GeoJSON does not re-style in place on a data swap. */}
          <GeoJSON
            key={measure}
            data={collection}
            style={styleFeature}
            onEachFeature={bindPopup}
          />
        </MapContainer>
      </div>

      <p className="text-[11px] text-surface-500">
        {formatNumber(collection.features.length)} grid cells at{" "}
        {gridDegrees}° (about {Math.round(gridDegrees * 111)}km). Individual
        crash locations are never published — each cell is an aggregate.
      </p>
    </div>
  );
}

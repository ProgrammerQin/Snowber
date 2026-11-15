"use client";

import dynamic from "next/dynamic";
import type { RouteMapProps } from "./route-map";

export type { MapRoute, MapStart, MapStop } from "./route-map";

// Leaflet touches `window`, so the map renders only in the browser.
const LazyRouteMap = dynamic(() => import("./route-map"), {
  ssr: false,
  loading: () => <div className="h-[360px] w-full animate-pulse rounded-lg bg-muted" aria-label="Loading map" />,
});

export function RouteMap(props: RouteMapProps) {
  return <LazyRouteMap {...props} />;
}

/** Distinct colors for cleaners' routes on shared maps. */
export const ROUTE_COLORS = ["#2563eb", "#db2777", "#16a34a", "#ea580c", "#7c3aed", "#0891b2", "#ca8a04", "#dc2626", "#4f46e5", "#059669"];
export const WAITING_COLOR = "#64748b";

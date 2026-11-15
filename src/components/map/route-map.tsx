"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { LatLng } from "@/lib/geo";

// Leaflet + OpenStreetMap tiles. Loaded only in the browser (see ./index.tsx).

export type MapStop = LatLng & { id: string; label: string; color: string; order?: number | null; dashed?: boolean };
export type MapRoute = { id: string; color: string; points: LatLng[]; dashed?: boolean };
export type MapStart = LatLng & { id: string; label: string; color: string };

export type RouteMapProps = {
  center: LatLng;
  stops: MapStop[];
  routes?: MapRoute[];
  starts?: MapStart[];
  height?: number;
};

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join("|");
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView([points[0].lat, points[0].lng], 16);
    else map.fitBounds(points.map((p) => [p.lat, p.lng] as [number, number]), { padding: [32, 32], maxZoom: 17 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` captures the points
  }, [map, key]);
  return null;
}

export default function RouteMap({ center, stops, routes = [], starts = [], height = 360 }: RouteMapProps) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={15}
      scrollWheelZoom={false}
      style={{ height }}
      className="w-full overflow-hidden rounded-lg border"
      aria-label="Map of stops"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      {routes.map((route) => (
        <Polyline
          key={route.id}
          positions={route.points.map((p) => [p.lat, p.lng] as [number, number])}
          pathOptions={{ color: route.color, weight: 4, opacity: 0.75, dashArray: route.dashed ? "6 8" : undefined }}
        />
      ))}
      {starts.map((s) => (
        <CircleMarker key={`start-${s.id}`} center={[s.lat, s.lng]} radius={7} pathOptions={{ color: s.color, weight: 3, fillColor: "#ffffff", fillOpacity: 1 }}>
          <Tooltip direction="top">{s.label}</Tooltip>
        </CircleMarker>
      ))}
      {stops.map((stop) => (
        <CircleMarker
          key={stop.id}
          center={[stop.lat, stop.lng]}
          radius={10}
          pathOptions={{ color: "#ffffff", weight: 2, fillColor: stop.color, fillOpacity: stop.dashed ? 0.45 : 0.95, dashArray: stop.dashed ? "3 3" : undefined }}
        >
          {/* Pin labels only on short routes; on busy maps they show on hover/tap. */}
          <Tooltip direction="top" permanent={stop.order != null && stops.length <= 6}>
            {stop.order != null ? `${stop.order}. ` : ""}
            {stop.label}
          </Tooltip>
        </CircleMarker>
      ))}
      <FitBounds points={[...stops, ...starts]} />
    </MapContainer>
  );
}

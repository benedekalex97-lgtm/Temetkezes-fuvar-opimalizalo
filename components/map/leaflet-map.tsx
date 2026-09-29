"use client";

import "leaflet/dist/leaflet.css";
import type { LayerGroup, Map as LMap } from "leaflet";
import { useEffect, useRef, useState } from "react";
import { URGENT_COLOR, type MapData, type MarkerKind } from "./map-data";

const MARKER_STYLE: Record<MarkerKind, { radius: number; fill: string; stroke: string }> = {
  depot: { radius: 8, fill: "#1d5461", stroke: "#ffffff" },
  cold_storage: { radius: 7, fill: "#46555a", stroke: "#ffffff" },
  crematorium: { radius: 7, fill: "#6b5a3e", stroke: "#ffffff" },
  office: { radius: 5.5, fill: "#ffffff", stroke: "#1d5461" },
  pickup: { radius: 3.5, fill: "#a7b0b3", stroke: "#ffffff" },
  pickup_used: { radius: 5.5, fill: "#ffffff", stroke: "#46555a" },
  pickup_urgent: { radius: 7, fill: URGENT_COLOR, stroke: "#ffffff" },
};

/**
 * Leaflet-térkép CARTO Positron csempékkel (API-kulcs nélkül). Ha a csempék
 * nem töltődnek be, `onTileFailure` jelez, és a szülő sematikus nézetre vált.
 */
export default function LeafletMap({ data, onTileFailure }: { data: MapData; onTileFailure: () => void }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<{ map: LMap; layer: LayerGroup; L: typeof import("leaflet") } | null>(null);
  const fitted = useRef(false);
  const failureRef = useRef(onTileFailure);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    failureRef.current = onTileFailure;
  }, [onTileFailure]);

  useEffect(() => {
    let cancelled = false;
    let timeout: number | undefined;
    let map: LMap | undefined;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !container.current) return;
      map = L.map(container.current, { scrollWheelZoom: false, zoomSnap: 0.25, attributionControl: true });
      map.attributionControl.setPrefix(false);
      const tiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd",
        maxZoom: 18,
        attribution: "© OpenStreetMap-közreműködők © CARTO",
      });
      let loaded = 0;
      let errors = 0;
      tiles.on("tileload", () => {
        loaded += 1;
      });
      tiles.on("tileerror", () => {
        errors += 1;
        if (errors >= 4 && loaded === 0) failureRef.current();
      });
      timeout = window.setTimeout(() => {
        if (loaded === 0) failureRef.current();
      }, 8000);
      tiles.addTo(map);
      const layer = L.layerGroup().addTo(map);
      mapRef.current = { map, layer, L };
      setReady(true);
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const current = mapRef.current;
    if (!ready || !current) return;
    const { map, layer, L } = current;
    layer.clearLayers();

    for (const r of data.routes) {
      if (r.points.length < 2) continue;
      L.polyline(
        r.points.map((p) => [p.lat, p.lng] as [number, number]),
        {
          color: r.color,
          weight: r.weight,
          opacity: r.opacity,
          dashArray: r.dashed ? "8 7" : undefined,
          lineJoin: "round",
        },
      )
        .bindTooltip(r.label, { sticky: true, className: "map-label" })
        .addTo(layer);
    }
    for (const m of data.markers) {
      const s = MARKER_STYLE[m.kind];
      const marker = L.circleMarker([m.coords.lat, m.coords.lng], {
        radius: s.radius,
        color: s.stroke,
        weight: 2,
        fillColor: s.fill,
        fillOpacity: 1,
      })
        .bindPopup(`<strong>${m.name}</strong><br/><span style="color:#758288">${m.address}</span>`)
        .addTo(layer);
      if (m.showLabel) {
        marker.bindTooltip(m.shortName, { permanent: true, direction: "right", offset: [8, 0], className: "map-label" });
      }
    }
    for (const v of data.vehicles) {
      L.marker([v.position.lat, v.position.lng], {
        icon: L.divIcon({
          className: "",
          html: `<div class="vehicle-pin" style="background:${v.color};width:34px;height:20px">${v.vehicleId}</div>`,
          iconSize: [34, 20],
          iconAnchor: [17, 10],
        }),
        zIndexOffset: 1000,
      })
        .bindTooltip(`${v.vehicleId}: ${v.activity} (szimulált pozíció)`, { className: "map-label" })
        .addTo(layer);
    }
    if (!fitted.current) {
      const all = [...data.markers.filter((m) => m.showLabel).map((m) => m.coords), ...data.vehicles.map((v) => v.position)];
      map.fitBounds(L.latLngBounds(all.map((c) => [c.lat, c.lng] as [number, number])), { padding: [24, 24] });
      fitted.current = true;
    }
  }, [data, ready]);

  return <div ref={container} className="h-full w-full" role="application" aria-label="Becsült útvonalak térképe" />;
}

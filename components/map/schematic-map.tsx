"use client";

import { useMemo } from "react";
import type { Coordinates } from "@/lib/domain/types";
import { URGENT_COLOR, type MapData, type MarkerKind } from "./map-data";

const TARGET_ASPECT = 2.1;

/** A Duna közelítő vonala Budapesten (sematikus, tájékozódáshoz). */
const DANUBE: Coordinates[] = [
  { lat: 47.63, lng: 19.075 },
  { lat: 47.6, lng: 19.065 },
  { lat: 47.575, lng: 19.058 },
  { lat: 47.55, lng: 19.05 },
  { lat: 47.528, lng: 19.046 },
  { lat: 47.51, lng: 19.045 },
  { lat: 47.497, lng: 19.047 },
  { lat: 47.486, lng: 19.055 },
  { lat: 47.472, lng: 19.064 },
  { lat: 47.455, lng: 19.068 },
  { lat: 47.435, lng: 19.058 },
  { lat: 47.41, lng: 19.045 },
  { lat: 47.38, lng: 19.03 },
];

const FILL: Record<MarkerKind, string> = {
  depot: "#1d5461",
  cold_storage: "#46555a",
  crematorium: "#6b5a3e",
  office: "#ffffff",
  pickup: "#a7b0b3",
  pickup_used: "#ffffff",
  pickup_urgent: URGENT_COLOR,
};
const RADIUS: Record<MarkerKind, number> = {
  depot: 9,
  cold_storage: 8,
  crematorium: 8,
  office: 6,
  pickup: 4,
  pickup_used: 6,
  pickup_urgent: 8,
};

/**
 * Sematikus útvonalnézet — külső csempeszolgáltatás nélkül. Egyszerű
 * egyenes szakaszokkal ábrázolt becsült útvonal, közelítő arányokkal.
 */
export function SchematicMap({ data }: { data: MapData }) {
  const { project, width, height } = useMemo(() => {
    const pts = [...data.markers.map((m) => m.coords), ...data.vehicles.map((v) => v.position)];
    const minLat = Math.min(...pts.map((p) => p.lat)) - 0.012;
    const maxLat = Math.max(...pts.map((p) => p.lat)) + 0.012;
    let minLng = Math.min(...pts.map((p) => p.lng)) - 0.02;
    let maxLng = Math.max(...pts.map((p) => p.lng)) + 0.06;
    const k = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
    // A keret szélesebb legyen, hogy a kártyát kitöltse (kb. 2:1 arány).
    const minSpanLng = ((maxLat - minLat) * TARGET_ASPECT) / k;
    if (maxLng - minLng < minSpanLng) {
      const extra = (minSpanLng - (maxLng - minLng)) / 2;
      minLng -= extra;
      maxLng += extra;
    }
    const w = 1000;
    const h = Math.round((w * (maxLat - minLat)) / ((maxLng - minLng) * k));
    return {
      width: w,
      height: h,
      project: (c: Coordinates) => ({
        x: ((c.lng - minLng) / (maxLng - minLng)) * w,
        y: ((maxLat - c.lat) / (maxLat - minLat)) * h,
      }),
    };
  }, [data]);

  const path = (points: Coordinates[]) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${project(p).x.toFixed(1)},${project(p).y.toFixed(1)}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="h-full w-full" role="img" aria-label="Sematikus útvonalnézet">
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" stroke="#e6e4de" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="#f7f6f2" />
      <rect width={width} height={height} fill="url(#grid)" />
      <path d={path(DANUBE)} fill="none" stroke="#c9dce3" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
      <text {...project({ lat: 47.585, lng: 19.068 })} className="fill-[#8fb2bf] text-[14px] italic" dx="10">
        Duna
      </text>

      {data.routes.map((r) =>
        r.points.length > 1 ? (
          <path
            key={r.key}
            d={path(r.points)}
            fill="none"
            stroke={r.color}
            strokeWidth={r.weight * 1.2}
            strokeOpacity={r.opacity}
            strokeDasharray={r.dashed ? "10 8" : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <title>{r.label}</title>
          </path>
        ) : null,
      )}

      {data.markers.map((m) => {
        const p = project(m.coords);
        const stroke = m.kind === "office" ? "#1d5461" : m.kind === "pickup_used" ? "#46555a" : "#ffffff";
        return (
          <g key={m.id}>
            <circle cx={p.x} cy={p.y} r={RADIUS[m.kind]} fill={FILL[m.kind]} stroke={stroke} strokeWidth={2.5}>
              <title>{`${m.name} — ${m.address}`}</title>
            </circle>
            {m.showLabel && (
              <text
                x={m.kind === "depot" ? p.x - RADIUS[m.kind] - 5 : p.x + RADIUS[m.kind] + 5}
                y={m.kind === "depot" ? p.y + 18 : p.y + 4}
                textAnchor={m.kind === "depot" ? "end" : "start"}
                className="fill-[#1b2a2f] text-[13px] font-medium"
                paintOrder="stroke"
                stroke="#f7f6f2"
                strokeWidth={4}
              >
                {m.shortName}
              </text>
            )}
          </g>
        );
      })}

      {data.vehicles.map((v) => {
        const p = project(v.position);
        return (
          <g key={v.vehicleId} transform={`translate(${p.x - 22},${p.y - 12})`}>
            <rect width="44" height="24" rx="12" fill={v.color} stroke="#fff" strokeWidth="2.5" />
            <text x="22" y="16" textAnchor="middle" className="fill-white font-mono text-[12px] font-semibold">
              {v.vehicleId}
            </text>
            <title>{`${v.vehicleId}: ${v.activity} (szimulált pozíció)`}</title>
          </g>
        );
      })}
    </svg>
  );
}

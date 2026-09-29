import type { Coordinates } from "./types";

/**
 * Szimulált utazási modell — DEMÓ-PARAMÉTEREK, nem valós útvonaltervezés.
 *
 * Légvonal × kanyargóssági szorzó, egységes városi átlagsebesség és fix
 * indulási/parkolási ráhagyás. Nem veszi figyelembe a forgalmat, a napszakot
 * vagy a tényleges úthálózatot. Az eredmény „Szimulált ETA”, nem hiteles.
 */
export const TRAVEL_MODEL = {
  roadFactor: 1.3,
  averageSpeedKmh: 32,
  fixedOverheadMinutes: 4,
} as const;

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

export function estimatedRoadKm(a: Coordinates, b: Coordinates): number {
  return haversineKm(a, b) * TRAVEL_MODEL.roadFactor;
}

/** Szimulált menetidő percben. Azonos helyen 0. */
export function travelMinutes(a: Coordinates, b: Coordinates): number {
  const km = estimatedRoadKm(a, b);
  if (km < 0.05) return 0;
  return Math.round(TRAVEL_MODEL.fixedOverheadMinutes + (km / TRAVEL_MODEL.averageSpeedKmh) * 60);
}

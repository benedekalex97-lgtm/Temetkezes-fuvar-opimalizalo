import type { Coordinates } from "./types";

/**
 * Budapesti kerületközéppontok (közelítő, demó). Új felvételi helynél, ha a
 * diszpécser nem ad meg koordinátát, az irányítószám kerületkódjából
 * becsüljük — a helytörzs ezt „becsült koordináta” jelöléssel mutatja.
 */
const DISTRICT_CENTERS: Record<number, Coordinates> = {
  1: { lat: 47.4966, lng: 19.0395 },
  2: { lat: 47.539, lng: 18.986 },
  3: { lat: 47.567, lng: 19.038 },
  4: { lat: 47.565, lng: 19.09 },
  5: { lat: 47.5, lng: 19.052 },
  6: { lat: 47.507, lng: 19.065 },
  7: { lat: 47.501, lng: 19.073 },
  8: { lat: 47.489, lng: 19.083 },
  9: { lat: 47.475, lng: 19.089 },
  10: { lat: 47.483, lng: 19.15 },
  11: { lat: 47.46, lng: 19.02 },
  12: { lat: 47.499, lng: 18.99 },
  13: { lat: 47.53, lng: 19.071 },
  14: { lat: 47.518, lng: 19.108 },
  15: { lat: 47.562, lng: 19.117 },
  16: { lat: 47.52, lng: 19.19 },
  17: { lat: 47.48, lng: 19.26 },
  18: { lat: 47.435, lng: 19.2 },
  19: { lat: 47.445, lng: 19.14 },
  20: { lat: 47.43, lng: 19.115 },
  21: { lat: 47.42, lng: 19.07 },
  22: { lat: 47.42, lng: 19.02 },
  23: { lat: 47.395, lng: 19.115 },
};

/** Budapest közelítő befoglaló doboza (ellenőrzéshez). */
export const BUDAPEST_BOUNDS = { minLat: 47.34, maxLat: 47.62, minLng: 18.92, maxLng: 19.34 };

/** Budapesti irányítószám (1011–1239) → kerület száma, egyébként null. */
export function districtFromPostalCode(address: string): number | null {
  const match = /\b1(\d{2})\d\b/.exec(address);
  if (!match) return null;
  const district = Number(match[1]);
  return district >= 1 && district <= 23 ? district : null;
}

export function validateBudapestAddress(address: string): string | null {
  const trimmed = address.trim();
  if (trimmed.length < 8) return "Adj meg teljes címet (irányítószám, település, utca, házszám).";
  const hasBudapest = /budapest/i.test(trimmed);
  const district = districtFromPostalCode(trimmed);
  if (!hasBudapest && district === null) {
    return "A felvételi helytörzs budapesti címeket kezel (D-09): adj meg budapesti irányítószámot vagy „Budapest” megjelölést.";
  }
  if (/\b[2-9]\d{3}\b/.test(trimmed) && district === null) {
    return "Az irányítószám nem budapesti.";
  }
  return null;
}

export function approximateBudapestCoords(address: string): Coordinates | null {
  const district = districtFromPostalCode(address);
  if (district === null) return null;
  return { ...DISTRICT_CENTERS[district] };
}

export function isWithinBudapest(c: Coordinates): boolean {
  return (
    c.lat >= BUDAPEST_BOUNDS.minLat &&
    c.lat <= BUDAPEST_BOUNDS.maxLat &&
    c.lng >= BUDAPEST_BOUNDS.minLng &&
    c.lng <= BUDAPEST_BOUNDS.maxLng
  );
}

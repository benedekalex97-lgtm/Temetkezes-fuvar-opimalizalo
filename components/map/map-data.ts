import { activeSuggestion, routePoints, vehicleSnapshot } from "@/lib/domain/selectors";
import { currentPlan } from "@/lib/domain/store";
import type { Coordinates, DemoState } from "@/lib/domain/types";

export type MarkerKind = "depot" | "cold_storage" | "crematorium" | "office" | "pickup" | "pickup_used" | "pickup_urgent";

export interface MapMarker {
  id: string;
  name: string;
  shortName: string;
  address: string;
  coords: Coordinates;
  kind: MarkerKind;
  showLabel: boolean;
}

export interface MapRoute {
  key: string;
  vehicleId: string;
  color: string;
  points: Coordinates[];
  dashed: boolean;
  weight: number;
  opacity: number;
  label: string;
}

export interface MapVehicle {
  vehicleId: string;
  color: string;
  position: Coordinates;
  activity: string;
}

export interface MapData {
  markers: MapMarker[];
  routes: MapRoute[];
  vehicles: MapVehicle[];
  hasProposal: boolean;
}

export const URGENT_COLOR = "#8b2c3a";

export function buildMapData(state: DemoState): MapData {
  const plan = currentPlan(state);
  const suggestion = activeSuggestion(state);
  const usedLocationIds = new Set<string>();
  for (const a of plan.assignments) {
    const t = state.tasks.find((x) => x.id === a.taskId)!;
    usedLocationIds.add(t.fromLocationId);
    usedLocationIds.add(t.toLocationId);
  }
  const urgentPickupIds = new Set(
    state.tasks.filter((t) => t.priority === "urgent" && t.status !== "completed").map((t) => t.fromLocationId),
  );

  const markers: MapMarker[] = [
    ...state.locations.map((l) => ({
      id: l.id,
      name: l.name,
      shortName: l.shortName,
      address: l.address,
      coords: l.coords,
      kind: l.kind as MarkerKind,
      showLabel: l.kind !== "office" || usedLocationIds.has(l.id),
    })),
    ...state.pickupLocations
      .filter((p) => p.active || usedLocationIds.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        shortName: p.shortName,
        address: p.address,
        coords: p.coords,
        kind: (urgentPickupIds.has(p.id) ? "pickup_urgent" : usedLocationIds.has(p.id) ? "pickup_used" : "pickup") as MarkerKind,
        showLabel: urgentPickupIds.has(p.id) || usedLocationIds.has(p.id),
      })),
  ];

  const routes: MapRoute[] = [];
  const changedVehicles = new Set<string>();
  if (suggestion) {
    for (const v of state.vehicles) {
      const before = plan.assignments.filter((a) => a.vehicleId === v.id).map((a) => a.taskId).join();
      const after = suggestion.proposedAssignments.filter((a) => a.vehicleId === v.id).map((a) => a.taskId).join();
      if (before !== after) changedVehicles.add(v.id);
    }
  }
  for (const v of state.vehicles) {
    const { points } = routePoints(state, plan, v.id);
    routes.push({
      key: `${v.id}-plan`,
      vehicleId: v.id,
      color: v.color,
      points,
      dashed: false,
      weight: 3.5,
      opacity: changedVehicles.has(v.id) ? 0.35 : 0.85,
      label: `${v.id} becsült útvonal (jóváhagyott terv)`,
    });
    if (suggestion && changedVehicles.has(v.id)) {
      routes.push({
        key: `${v.id}-proposal`,
        vehicleId: v.id,
        color: v.color,
        points: routePoints(state, { assignments: suggestion.proposedAssignments }, v.id).points,
        dashed: true,
        weight: 3.5,
        opacity: 0.95,
        label: `${v.id} javasolt útvonal`,
      });
    }
  }
  // A sürgős feladat útvonala (javasolt vagy jóváhagyott) bordóval kiemelve.
  for (const t of state.tasks.filter((x) => x.priority === "urgent" && x.status !== "completed")) {
    const a =
      plan.assignments.find((x) => x.taskId === t.id) ??
      suggestion?.proposedAssignments.find((x) => x.taskId === t.id && suggestion.taskId === t.id);
    if (!a) continue;
    const coordsOf = (id: string) =>
      state.locations.find((l) => l.id === id)?.coords ?? state.pickupLocations.find((p) => p.id === id)!.coords;
    routes.push({
      key: `${t.id}-urgent`,
      vehicleId: a.vehicleId,
      color: URGENT_COLOR,
      points: [coordsOf(a.departureFromLocationId), coordsOf(t.fromLocationId), coordsOf(t.toLocationId)],
      dashed: !plan.assignments.some((x) => x.taskId === t.id),
      weight: 4.5,
      opacity: 1,
      label: `${t.id} sürgős felvétel`,
    });
  }

  const vehicles: MapVehicle[] = state.vehicles.map((v) => {
    const snap = vehicleSnapshot(state, v.id, plan);
    return { vehicleId: v.id, color: v.color, position: snap.position, activity: snap.activity };
  });

  return { markers, routes, vehicles, hasProposal: Boolean(suggestion) };
}

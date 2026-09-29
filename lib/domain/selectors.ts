/**
 * UI-hoz készített, tiszta lekérdezések. Domainlogikát nem tartalmaznak,
 * csak a meglévő állapotból számolnak.
 */
import {
  buildContext,
  crewOfVehicle,
  returnToDepot,
  shiftOfCrew,
  vehicleAssignments,
} from "./schedule";
import { currentPlan, displayStatus, openSuggestionFor } from "./store";
import type {
  AnyLocation,
  Assignment,
  Coordinates,
  DemoState,
  DisplayStatus,
  Minutes,
  OptimizationSuggestion,
  PlanVersion,
  Task,
  Vehicle,
} from "./types";

export function locationById(state: DemoState, id: string): AnyLocation {
  const op = state.locations.find((l) => l.id === id);
  if (op) return { registry: "operational", ...op };
  const p = state.pickupLocations.find((l) => l.id === id);
  if (p) return { registry: "pickup", ...p };
  throw new Error(`Ismeretlen helyszín: ${id}`);
}

export function taskOf(state: DemoState, id: string): Task | undefined {
  return state.tasks.find((t) => t.id === id);
}

export function assignmentFor(plan: PlanVersion, taskId: string): Assignment | undefined {
  return plan.assignments.find((a) => a.taskId === taskId);
}

/** A legutóbbi nyitott javaslat (az irányítópulton ez jelenik meg). */
export function activeSuggestion(state: DemoState): OptimizationSuggestion | null {
  const open = state.suggestions.filter((s) => s.status === "open");
  return open[open.length - 1] ?? null;
}

/** A legutóbbi optimalizálói (nem diszpécseri) javaslat — a tervösszevetéshez. */
export function latestOptimizerSuggestion(state: DemoState): OptimizationSuggestion | null {
  const list = state.suggestions.filter((s) => s.origin === "optimizer");
  return list[list.length - 1] ?? null;
}

export function suggestionsForTask(state: DemoState, taskId: string): OptimizationSuggestion[] {
  return state.suggestions.filter(
    (s) => s.taskId === taskId || s.candidates.some((c) => c.moves.some((m) => m.taskId === taskId)),
  );
}

export function decisionsForTask(state: DemoState, taskId: string) {
  const suggestionIds = suggestionsForTask(state, taskId).map((s) => s.id);
  return state.decisions.filter((d) => d.taskId === taskId || suggestionIds.includes(d.suggestionId));
}

export interface TaskRow {
  task: Task;
  status: DisplayStatus;
  assignment: Assignment | undefined;
  /** Nyitott javaslat szerinti időzítés, ha a feladat még nincs a tervben. */
  suggestedArrival: Minutes | null;
  suggestedVehicleId: string | null;
  plannedArrival: Minutes | null;
}

export function taskRows(state: DemoState): TaskRow[] {
  const plan = currentPlan(state);
  return state.tasks.map((task) => {
    const assignment = assignmentFor(plan, task.id);
    const open = openSuggestionFor(state, task.id);
    const chosen = open?.candidates.find((c) => c.vehicleId === open.chosenVehicleId);
    const delay = task.reportedDelayMinutes ?? 0;
    return {
      task,
      status: displayStatus(state, task),
      assignment,
      suggestedArrival: chosen?.arrivalAtFrom ?? null,
      suggestedVehicleId: open?.chosenVehicleId ?? null,
      plannedArrival: assignment ? assignment.arrivalAtFrom + delay : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Járműállapot a szimulált időpontban
// ---------------------------------------------------------------------------

export interface VehicleSnapshot {
  vehicle: Vehicle;
  crewName: string;
  crewSize: number;
  shiftLabel: string;
  shiftEnd: Minutes;
  dayTaskEnd: Minutes;
  onCall: boolean;
  remainingShift: number;
  remainingDayWindow: number;
  activity: string;
  activityKind: "moving" | "on_site" | "idle";
  position: Coordinates;
  currentTaskId: string | null;
  nextTask: { taskId: string; departure: Minutes } | null;
  assignments: Assignment[];
  returnToDepotAt: Minutes | null;
}

function lerp(a: Coordinates, b: Coordinates, t: number): Coordinates {
  const k = Math.min(1, Math.max(0, t));
  return { lat: a.lat + (b.lat - a.lat) * k, lng: a.lng + (b.lng - a.lng) * k };
}

export function vehicleSnapshot(state: DemoState, vehicleId: string, plan: PlanVersion = currentPlan(state)): VehicleSnapshot {
  const ctx = buildContext(state);
  const vehicle = state.vehicles.find((v) => v.id === vehicleId)!;
  const crew = crewOfVehicle(ctx, vehicleId);
  const shift = shiftOfCrew(ctx, crew);
  const list = vehicleAssignments(plan, vehicleId);
  const now = state.now;
  const coords = (id: string) => ctx.coordsOf(id);
  const label = (id: string) => ctx.labelOf(id);

  let activity = `Várakozik: ${label(vehicle.depotLocationId)}`;
  let activityKind: VehicleSnapshot["activityKind"] = "idle";
  let position = coords(vehicle.depotLocationId);
  let currentTaskId: string | null = null;

  for (const a of list) {
    const task = state.tasks.find((t) => t.id === a.taskId)!;
    const delay = task.status === "in_progress" ? (task.reportedDelayMinutes ?? 0) : 0;
    const arrival = a.arrivalAtFrom + delay;
    const pickupDone = a.serviceStart + delay + task.serviceAtFrom;
    const arrivalTo = a.arrivalAtTo + delay;
    const end = a.end + delay;
    if (now < a.departure) break;
    currentTaskId = a.taskId;
    if (now < arrival) {
      activityKind = "moving";
      activity = `Úton: ${label(task.fromLocationId)} felé`;
      position = lerp(coords(a.departureFromLocationId), coords(task.fromLocationId), (now - a.departure) / Math.max(1, arrival - a.departure));
    } else if (now < pickupDone) {
      activityKind = "on_site";
      activity = `Helyszínen: ${label(task.fromLocationId)}`;
      position = coords(task.fromLocationId);
    } else if (now < arrivalTo) {
      activityKind = "moving";
      activity = `Úton: ${label(task.toLocationId)} felé`;
      position = lerp(coords(task.fromLocationId), coords(task.toLocationId), (now - pickupDone) / Math.max(1, arrivalTo - pickupDone));
    } else if (now < end) {
      activityKind = "on_site";
      activity = `Átadás: ${label(task.toLocationId)}`;
      position = coords(task.toLocationId);
    } else {
      currentTaskId = null;
      activityKind = "idle";
      activity = `Szabad: ${label(task.toLocationId)}`;
      position = coords(task.toLocationId);
    }
  }

  const next = list.find((a) => a.departure > now && a.taskId !== currentTaskId);
  return {
    vehicle,
    crewName: crew.name,
    crewSize: crew.memberCodes.length,
    shiftLabel: shift.label,
    shiftEnd: shift.end,
    dayTaskEnd: shift.dayTaskWindow.end,
    onCall: shift.onCall,
    remainingShift: shift.end - now,
    remainingDayWindow: Math.max(0, shift.dayTaskWindow.end - now),
    activity,
    activityKind,
    position,
    currentTaskId,
    nextTask: next ? { taskId: next.taskId, departure: next.departure } : null,
    assignments: list,
    returnToDepotAt: returnToDepot(ctx, vehicle, list),
  };
}

// ---------------------------------------------------------------------------
// Irányítópult-mutatók
// ---------------------------------------------------------------------------

export interface DashboardKpis {
  crewsOnDuty: number;
  crewsTotal: number;
  activeVehicles: number;
  vehiclesTotal: number;
  urgentOrAtRisk: Task[];
  unassigned: Task[];
  nextDeadline: { task: Task; at: Minutes } | null;
  dayCrewRemaining: number;
  onCallRemaining: number;
}

export function dashboardKpis(state: DemoState): DashboardKpis {
  const rows = taskRows(state);
  const now = state.now;
  const crewsOnDuty = state.shifts.filter((s) => s.start <= now && now < s.end).length;
  const snapshots = state.vehicles.map((v) => vehicleSnapshot(state, v.id));
  const activeVehicles = snapshots.filter((s) => s.activityKind !== "idle" || s.nextTask !== null).length;
  const urgentOrAtRisk = rows
    .filter(
      (r) =>
        r.status === "at_risk" ||
        (r.task.priority === "urgent" && r.task.status !== "completed"),
    )
    .map((r) => r.task);
  const unassigned = rows
    .filter((r) => ["new", "unassigned", "suggested"].includes(r.task.status))
    .map((r) => r.task);
  const deadlines = rows
    .filter((r) => r.task.latestArrival !== null && r.task.latestArrival >= now && r.task.status !== "completed")
    .sort((a, b) => a.task.latestArrival! - b.task.latestArrival!);
  const dayShift = state.shifts.find((s) => !s.onCall);
  const onCall = state.shifts.find((s) => s.onCall);
  return {
    crewsOnDuty,
    crewsTotal: state.shifts.length,
    activeVehicles,
    vehiclesTotal: state.vehicles.length,
    urgentOrAtRisk,
    unassigned,
    nextDeadline: deadlines[0] ? { task: deadlines[0].task, at: deadlines[0].task.latestArrival! } : null,
    dayCrewRemaining: dayShift ? dayShift.end - now : 0,
    onCallRemaining: onCall ? onCall.end - now : 0,
  };
}

/** Egy jármű útvonalpontjai (becsült, légvonalas szakaszok) a megadott tervben. */
export function routePoints(state: DemoState, plan: PlanVersion | { assignments: Assignment[] }, vehicleId: string): {
  points: Coordinates[];
  stops: { locationId: string; taskId: string; kind: "from" | "to" }[];
} {
  const ctx = buildContext(state);
  const vehicle = state.vehicles.find((v) => v.id === vehicleId)!;
  const list = plan.assignments.filter((a) => a.vehicleId === vehicleId).sort((a, b) => a.departure - b.departure);
  const points: Coordinates[] = [ctx.coordsOf(vehicle.depotLocationId)];
  const stops: { locationId: string; taskId: string; kind: "from" | "to" }[] = [];
  for (const a of list) {
    const task = state.tasks.find((t) => t.id === a.taskId)!;
    points.push(ctx.coordsOf(task.fromLocationId));
    stops.push({ locationId: task.fromLocationId, taskId: task.id, kind: "from" });
    if (task.toLocationId !== task.fromLocationId) {
      points.push(ctx.coordsOf(task.toLocationId));
      stops.push({ locationId: task.toLocationId, taskId: task.id, kind: "to" });
    }
  }
  if (list.length > 0) points.push(ctx.coordsOf(vehicle.depotLocationId));
  return { points, stops };
}

export type PlanDiffKind = "same" | "new" | "moved_in" | "moved_out" | "retimed" | "removed";

/** Egy terv feladatainak összevetése a reggeli tervvel. */
export function diffAgainst(base: PlanVersion, other: { assignments: Assignment[] }, vehicleId: string) {
  const baseList = base.assignments.filter((a) => a.vehicleId === vehicleId);
  const otherList = other.assignments
    .filter((a) => a.vehicleId === vehicleId)
    .sort((a, b) => a.departure - b.departure);
  const rows = otherList.map((a) => {
    const inBase = base.assignments.find((b) => b.taskId === a.taskId);
    let kind: PlanDiffKind = "same";
    if (!inBase) kind = "new";
    else if (inBase.vehicleId !== vehicleId) kind = "moved_in";
    else if (inBase.departure !== a.departure || inBase.end !== a.end) kind = "retimed";
    return { assignment: a, kind, fromVehicleId: inBase?.vehicleId ?? null };
  });
  const gone = baseList
    .filter((b) => !otherList.some((a) => a.taskId === b.taskId))
    .map((b) => {
      const moved = other.assignments.find((a) => a.taskId === b.taskId);
      return {
        assignment: b,
        kind: (moved ? "moved_out" : "removed") as PlanDiffKind,
        toVehicleId: moved?.vehicleId ?? null,
      };
    });
  return { rows, gone };
}

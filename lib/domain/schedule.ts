/**
 * Menetrend-szimuláció: egy jármű feladatsorának időzítése a szimulált
 * utazási modell alapján, valamint a demóban ellenőrzött kemény korlátok.
 *
 * Minden időablak, szolgáltatási idő és ráhagyás DEMÓ-PARAMÉTER.
 */
import { formatClock } from "./time";
import { travelMinutes } from "./travel";
import type {
  Assignment,
  AssignmentSource,
  Coordinates,
  Crew,
  DemoState,
  Minutes,
  PlanVersion,
  Shift,
  Task,
  TaskStatus,
  Vehicle,
} from "./types";

/** Riasztástól indulásig számolt előkészítési idő (demó-paraméter). */
export const DISPATCH_PREP_MINUTES = 8;
/** Ennyi perc alatti tartalék már késésveszélynek számít. */
export const LATE_RISK_THRESHOLD_MINUTES = 10;
/** Sürgős haláleseti felvétel kiérkezési határa a bejelentéstől (D-08). */
export const URGENT_ARRIVAL_LIMIT_MINUTES = 120;

export interface PlanningContext {
  now: Minutes;
  vehicles: Vehicle[];
  crews: Crew[];
  shifts: Shift[];
  tasks: Task[];
  coordsOf: (locationId: string) => Coordinates;
  labelOf: (locationId: string) => string;
  officeHoursOf: (locationId: string) => { start: Minutes; end: Minutes } | null;
}

export function buildContext(
  state: Pick<DemoState, "now" | "vehicles" | "crews" | "shifts" | "tasks" | "locations" | "pickupLocations">,
  overrides: Partial<Pick<PlanningContext, "now" | "tasks">> = {},
): PlanningContext {
  const byId = new Map<string, { coords: Coordinates; label: string; hours: { start: Minutes; end: Minutes } | null }>();
  for (const l of state.locations) {
    byId.set(l.id, {
      coords: l.coords,
      label: l.shortName,
      hours: l.openingHours ? { start: l.openingHours.start, end: l.openingHours.end } : null,
    });
  }
  for (const p of state.pickupLocations) {
    byId.set(p.id, { coords: p.coords, label: p.shortName, hours: null });
  }
  const get = (id: string) => {
    const hit = byId.get(id);
    if (!hit) throw new Error(`Ismeretlen helyszín: ${id}`);
    return hit;
  };
  return {
    now: overrides.now ?? state.now,
    vehicles: state.vehicles,
    crews: state.crews,
    shifts: state.shifts,
    tasks: overrides.tasks ?? state.tasks,
    coordsOf: (id) => get(id).coords,
    labelOf: (id) => get(id).label,
    officeHoursOf: (id) => get(id).hours,
  };
}

// ---------------------------------------------------------------------------
// Segédfüggvények
// ---------------------------------------------------------------------------

const STARTED: TaskStatus[] = ["completed", "in_progress"];
const LOCKED: TaskStatus[] = ["completed", "in_progress", "manually_locked"];

/** Teljesített, folyamatban lévő vagy kézzel rögzített feladat — nem mozgatható. */
export function isLockedStatus(status: TaskStatus): boolean {
  return LOCKED.includes(status);
}

export function isStartedStatus(status: TaskStatus): boolean {
  return STARTED.includes(status);
}

export function taskById(ctx: Pick<PlanningContext, "tasks">, id: string): Task {
  const task = ctx.tasks.find((t) => t.id === id);
  if (!task) throw new Error(`Ismeretlen feladat: ${id}`);
  return task;
}

export function vehicleById(ctx: Pick<PlanningContext, "vehicles">, id: string): Vehicle {
  const v = ctx.vehicles.find((x) => x.id === id);
  if (!v) throw new Error(`Ismeretlen jármű: ${id}`);
  return v;
}

export function crewOfVehicle(ctx: Pick<PlanningContext, "vehicles" | "crews">, vehicleId: string): Crew {
  const vehicle = vehicleById(ctx, vehicleId);
  const crew = ctx.crews.find((c) => c.id === vehicle.defaultCrewId);
  if (!crew) throw new Error(`Nincs csapat a járműhöz: ${vehicleId}`);
  return crew;
}

export function shiftOfCrew(ctx: Pick<PlanningContext, "shifts">, crew: Crew): Shift {
  const shift = ctx.shifts.find((s) => s.id === crew.shiftId);
  if (!shift) throw new Error(`Nincs műszak a csapathoz: ${crew.id}`);
  return shift;
}

export function travelBetween(ctx: PlanningContext, fromId: string, toId: string): number {
  if (fromId === toId) return 0;
  return travelMinutes(ctx.coordsOf(fromId), ctx.coordsOf(toId));
}

export function vehicleAssignments(plan: PlanVersion, vehicleId: string): Assignment[] {
  return plan.assignments
    .filter((a) => a.vehicleId === vehicleId)
    .sort((a, b) => a.departure - b.departure);
}

/** Telephelyre való visszaérkezés szimulált ideje az utolsó feladat után. */
export function returnToDepot(ctx: PlanningContext, vehicle: Vehicle, assignments: Assignment[]): Minutes | null {
  if (assignments.length === 0) return null;
  const last = [...assignments].sort((a, b) => a.end - b.end)[assignments.length - 1];
  const task = taskById(ctx, last.taskId);
  return last.end + travelBetween(ctx, task.toLocationId, vehicle.depotLocationId);
}

// ---------------------------------------------------------------------------
// Egy feladat időzítése
// ---------------------------------------------------------------------------

export interface Cursor {
  locationId: string;
  time: Minutes;
}

export function timeTask(
  ctx: PlanningContext,
  task: Task,
  vehicle: Vehicle,
  crew: Crew,
  cursor: Cursor,
  opts: { minDeparture?: Minutes; fixedServiceStart?: Minutes; source: AssignmentSource },
): Assignment {
  const toPickup = travelBetween(ctx, cursor.locationId, task.fromLocationId);
  let departure = Math.max(cursor.time, opts.minDeparture ?? Number.NEGATIVE_INFINITY);
  const targetStart = opts.fixedServiceStart ?? task.earliestStart;
  if (targetStart !== null && targetStart !== undefined) {
    // Nem érkezünk feleslegesen korán: annyival később indulunk.
    departure = Math.max(departure, targetStart - toPickup);
  }
  const arrivalAtFrom = departure + toPickup;
  const serviceStart = Math.max(arrivalAtFrom, targetStart ?? arrivalAtFrom);
  const pickupDone = serviceStart + task.serviceAtFrom;
  const arrivalAtTo = pickupDone + travelBetween(ctx, task.fromLocationId, task.toLocationId);
  const end = task.toLocationId === task.fromLocationId ? pickupDone : arrivalAtTo + task.serviceAtTo;
  return {
    taskId: task.id,
    vehicleId: vehicle.id,
    crewId: crew.id,
    departureFromLocationId: cursor.locationId,
    departure,
    arrivalAtFrom,
    serviceStart,
    arrivalAtTo: task.toLocationId === task.fromLocationId ? pickupDone : arrivalAtTo,
    end,
    source: opts.source,
  };
}

/** Kiérkezési tartalék percben (negatív = késés). Határidő nélkül null. */
export function deadlineSlack(task: Task, assignment: Pick<Assignment, "arrivalAtFrom">): number | null {
  if (task.latestArrival === null) return null;
  return task.latestArrival - assignment.arrivalAtFrom;
}

/** Az adott feladat a műszak ügyeleti részében is végezhető-e. */
export function isOnCallTask(task: Task): boolean {
  return task.type === "urgent_death_pickup";
}

/**
 * Kemény korlátok (a határidőn kívül): járműképesség, létszám, műszak,
 * napi feladatablak, telephelyre visszaérés, irodai nyitvatartás.
 */
export function eligibilityProblems(task: Task, vehicle: Vehicle, crew: Crew): string[] {
  const problems: string[] = [];
  if (!vehicle.capabilities.includes(task.requiredCapability)) {
    problems.push(
      task.requiredCapability === "deceased_transport"
        ? `${vehicle.id} ${vehicle.kindLabel.toLowerCase()}: a demó-konfigurációban elhunyt szállítására nem használható.`
        : `${vehicle.id} nincs beállítva erre a feladattípusra.`,
    );
  }
  if (crew.memberCodes.length < task.requiredCrewSize) {
    problems.push(
      `${crew.name} ${crew.memberCodes.length} fős, a feladathoz ${task.requiredCrewSize} fő szükséges.`,
    );
  }
  return problems;
}

export function timingProblems(
  ctx: PlanningContext,
  task: Task,
  vehicle: Vehicle,
  shift: Shift,
  a: Assignment,
): string[] {
  const problems: string[] = [];
  if (a.departure < shift.start) {
    problems.push(`Indulás (${formatClock(a.departure)}) a műszakkezdés (${formatClock(shift.start)}) előtt.`);
  }
  if (a.end > shift.end) {
    problems.push(`A feladat ${formatClock(a.end)}-kor érne véget, a műszak ${formatClock(shift.end)}-kor zárul.`);
  }
  if (!(shift.onCall && isOnCallTask(task)) && a.end > shift.dayTaskWindow.end) {
    problems.push(
      `Napi feladat ${formatClock(a.end)}-ig tartana; a napi feladatablak ${formatClock(shift.dayTaskWindow.end)}-kor zárul.`,
    );
  }
  if (shift.mustReturnToDepotByEnd) {
    const back = a.end + travelBetween(ctx, task.toLocationId, vehicle.depotLocationId);
    if (back > shift.end) {
      problems.push(
        `Visszaérkezés a telephelyre ${formatClock(back)} — a műszak ${formatClock(shift.end)}-kor véget ér.`,
      );
    }
  }
  const fromHours = ctx.officeHoursOf(task.fromLocationId);
  if (fromHours && (a.serviceStart < fromHours.start || a.serviceStart + task.serviceAtFrom > fromHours.end)) {
    problems.push(`${ctx.labelOf(task.fromLocationId)} nyitvatartásán kívül esne (${formatClock(a.serviceStart)}).`);
  }
  const toHours = ctx.officeHoursOf(task.toLocationId);
  if (
    toHours &&
    task.toLocationId !== task.fromLocationId &&
    (a.arrivalAtTo < toHours.start || a.arrivalAtTo + task.serviceAtTo > toHours.end)
  ) {
    problems.push(`${ctx.labelOf(task.toLocationId)} nyitvatartásán kívül érkezne (${formatClock(a.arrivalAtTo)}).`);
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Jármű aktuális helyzete és hátralévő sora
// ---------------------------------------------------------------------------

export interface Anchor extends Cursor {
  lastStartedTaskId: string | null;
}

/** Hol és mikortól szabad a jármű a szimulált „most” időpontban. */
export function vehicleAnchor(ctx: PlanningContext, plan: PlanVersion, vehicleId: string): Anchor {
  const vehicle = vehicleById(ctx, vehicleId);
  const shift = shiftOfCrew(ctx, crewOfVehicle(ctx, vehicleId));
  const started = vehicleAssignments(plan, vehicleId).filter((a) => isStartedStatus(taskById(ctx, a.taskId).status));
  if (started.length === 0) {
    return { locationId: vehicle.depotLocationId, time: Math.max(ctx.now, shift.start), lastStartedTaskId: null };
  }
  const last = started[started.length - 1];
  const task = taskById(ctx, last.taskId);
  return {
    locationId: task.toLocationId,
    time: Math.max(ctx.now, last.end + (task.reportedDelayMinutes ?? 0)),
    lastStartedTaskId: task.id,
  };
}

export type SequenceRole = "target" | "movable" | "pinned";

export interface SequenceItem {
  task: Task;
  role: SequenceRole;
  minDeparture?: Minutes;
  fixedServiceStart?: Minutes;
  source: AssignmentSource;
}

/** A még el nem kezdett, tervben lévő feladatok sorrendben. */
export function remainingItems(ctx: PlanningContext, plan: PlanVersion, vehicleId: string): SequenceItem[] {
  return vehicleAssignments(plan, vehicleId)
    .filter((a) => !isStartedStatus(taskById(ctx, a.taskId).status))
    .map((a) => {
      const task = taskById(ctx, a.taskId);
      return task.status === "manually_locked"
        ? { task, role: "pinned" as const, fixedServiceStart: a.serviceStart, source: a.source }
        : { task, role: "movable" as const, minDeparture: ctx.now, source: a.source };
    });
}

export interface SequenceResult {
  placed: Assignment[];
  dropped: { taskId: string; reasons: string[] }[];
  targetAssignment: Assignment | null;
  targetProblems: string[];
  pinnedConflicts: string[];
  returnToDepotAt: Minutes | null;
}

/**
 * Egy jármű feladatsorának szimulálása. A mozgatható feladat kiesik
 * (dropped), ha nem fér bele; a célfeladat és a rögzített feladat nem esik
 * ki — ezek problémáit külön listázzuk, hogy a diszpécser lássa.
 */
export function simulateSequence(
  ctx: PlanningContext,
  vehicleId: string,
  anchor: Cursor,
  items: SequenceItem[],
): SequenceResult {
  const vehicle = vehicleById(ctx, vehicleId);
  const crew = crewOfVehicle(ctx, vehicleId);
  const shift = shiftOfCrew(ctx, crew);
  const placed: Assignment[] = [];
  const dropped: SequenceResult["dropped"] = [];
  const targetProblems: string[] = [];
  const pinnedConflicts: string[] = [];
  let targetAssignment: Assignment | null = null;
  let cursor: Cursor = { locationId: anchor.locationId, time: anchor.time };

  items.forEach((item, index) => {
    const a = timeTask(ctx, item.task, vehicle, crew, cursor, {
      minDeparture: item.minDeparture,
      fixedServiceStart: item.fixedServiceStart,
      source: item.source,
    });
    const problems: string[] = [];

    if (item.role === "pinned") {
      if (item.fixedServiceStart !== undefined && a.serviceStart !== item.fixedServiceStart) {
        pinnedConflicts.push(
          `A kézzel rögzített ${item.task.id} (${formatClock(item.fixedServiceStart)}) nem érhető el időben — legkorábban ${formatClock(a.arrivalAtFrom)}.`,
        );
      }
      placed.push(a);
      cursor = { locationId: item.task.toLocationId, time: a.end };
      return;
    }

    problems.push(...eligibilityProblems(item.task, vehicle, crew));
    problems.push(...timingProblems(ctx, item.task, vehicle, shift, a));
    const slack = deadlineSlack(item.task, a);
    if (item.role === "movable" && slack !== null && slack < 0) {
      problems.push(
        `Kiérkezés ${formatClock(a.arrivalAtFrom)}, a határ ${formatClock(item.task.latestArrival!)} — nem tartható.`,
      );
    }
    const nextPinned = items.slice(index + 1).find((i) => i.role === "pinned");
    if (nextPinned && nextPinned.fixedServiceStart !== undefined) {
      const reach = a.end + travelBetween(ctx, item.task.toLocationId, nextPinned.task.fromLocationId);
      if (reach > nextPinned.fixedServiceStart) {
        problems.push(
          `Ütközne a kézzel rögzített ${nextPinned.task.id} feladattal (${formatClock(nextPinned.fixedServiceStart)}).`,
        );
      }
    }

    if (item.role === "movable" && problems.length > 0) {
      dropped.push({ taskId: item.task.id, reasons: problems });
      return;
    }
    if (item.role === "target") {
      targetAssignment = a;
      targetProblems.push(...problems);
    }
    placed.push(a);
    cursor = { locationId: item.task.toLocationId, time: a.end };
  });

  return {
    placed,
    dropped,
    targetAssignment,
    targetProblems,
    pinnedConflicts,
    returnToDepotAt: placed.length ? returnToDepot(ctx, vehicle, placed) : null,
  };
}

/** Reggeli terv felépítése: minden feladat a megadott sorrendben, 07:00-s telephelyi indulással. */
export function buildMorningAssignments(
  ctx: PlanningContext,
  order: Record<string, { taskId: string; fixedServiceStart?: Minutes }[]>,
): Assignment[] {
  const result: Assignment[] = [];
  for (const vehicle of ctx.vehicles) {
    const shift = shiftOfCrew(ctx, crewOfVehicle(ctx, vehicle.id));
    const items: SequenceItem[] = (order[vehicle.id] ?? []).map((o) => ({
      task: taskById(ctx, o.taskId),
      role: o.fixedServiceStart !== undefined ? "pinned" : "movable",
      fixedServiceStart: o.fixedServiceStart,
      minDeparture: shift.start,
      source: "morning_plan",
    }));
    const sim = simulateSequence(ctx, vehicle.id, { locationId: vehicle.depotLocationId, time: shift.start }, items);
    const timing = sim.placed.flatMap((a) => timingProblems(ctx, taskById(ctx, a.taskId), vehicle, shift, a));
    if (sim.dropped.length > 0 || sim.pinnedConflicts.length > 0 || timing.length > 0) {
      throw new Error(
        `A reggeli seed terv nem konzisztens (${vehicle.id}): ${JSON.stringify(sim.dropped)} ${sim.pinnedConflicts.join(" ")} ${timing.join(" ")}`,
      );
    }
    result.push(...sim.placed);
  }
  return result;
}

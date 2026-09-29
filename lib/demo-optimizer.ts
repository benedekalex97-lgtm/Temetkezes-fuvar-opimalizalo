/**
 * DEMÓ OPTIMALIZÁLÓ
 *
 * Ez determinisztikus demólogika, nem production optimalizálómotor.
 *
 * - Nem VROOM, nem OSRM, nem valós útvonaltervezés: a menetidő a
 *   `lib/domain/travel.ts` szimulált modelljéből jön („Szimulált ETA”).
 * - Csak javasol: bemenetként megkapja az aktuális jóváhagyott tervet, és
 *   egy új `OptimizationSuggestion` objektumot ad vissza. A bemenetet nem
 *   módosítja, tervet nem hagy jóvá. A jóváhagyás kizárólag diszpécseri
 *   döntéssel történik (lásd `lib/domain/store.ts`).
 * - Teljesített, folyamatban lévő és kézzel rögzített feladatot nem mozgat.
 *
 * Döntési sorrend egy célfeladat jelöltjeinél (lexikografikus):
 *   1. alkalmas jármű és csapat (képesség, létszám),
 *   2. nincs kemény ütközés (műszak, napi ablak, rögzített feladat, nyitvatartás),
 *   3. tartja a kiérkezési határt,
 *   4. kevesebb kiosztatlanul maradó áthelyezett feladat,
 *   5. sürgős haláleseti felvételnél az ügyeleti csapat előnyben (D-08),
 *   6. korábbi szimulált kiérkezés.
 */
import { PRIORITY_RANK, TASK_TYPE_LABEL } from "./domain/labels";
import {
  DISPATCH_PREP_MINUTES,
  crewOfVehicle,
  deadlineSlack,
  eligibilityProblems,
  isLockedStatus,
  remainingItems,
  returnToDepot,
  shiftOfCrew,
  simulateSequence,
  taskById,
  vehicleAnchor,
  vehicleAssignments,
  vehicleById,
  type PlanningContext,
  type SequenceItem,
  type SequenceResult,
} from "./domain/schedule";
import { formatClock, formatDuration } from "./domain/time";
import type {
  Assignment,
  CandidateEvaluation,
  Minutes,
  OptimizationSuggestion,
  PlanVersion,
  SuggestionWarning,
  Task,
  TaskMove,
  VehicleImpact,
} from "./domain/types";

export const REASON_REQUIRED_MESSAGE = "Ehhez a döntéshez rövid indoklás szükséges.";

export const OPTIMIZER_DISCLAIMER = "Ez determinisztikus demólogika, nem production optimalizálómotor.";

export interface OptimizerInput {
  ctx: PlanningContext;
  plan: PlanVersion;
  taskId: string;
  suggestionId: string;
  /** Diszpécseri változat: kötelező jármű és/vagy legkorábbi indulás. */
  request?: { vehicleId?: string | null; departure?: Minutes | null };
}

interface CandidateWork {
  evaluation: CandidateEvaluation;
  hardProblems: string[];
  assignmentsByVehicle: Map<string, Assignment[]>;
  unresolved: string[];
}

// ---------------------------------------------------------------------------
// Beillesztés egy jármű sorába
// ---------------------------------------------------------------------------

interface Insertion {
  position: number;
  sim: SequenceResult;
}

function feasibilityRank(sim: SequenceResult, task: Task): [number, number, number, number] {
  const a = sim.targetAssignment!;
  const hard = sim.targetProblems.length + sim.pinnedConflicts.length;
  const slack = deadlineSlack(task, a);
  const late = slack !== null && slack < 0 ? 1 : 0;
  const tieBreak = task.priority === "urgent" ? a.arrivalAtFrom : (sim.returnToDepotAt ?? a.end);
  return [hard > 0 ? 1 : 0, late, sim.dropped.length, tieBreak];
}

function compareTuple(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

/**
 * A célfeladatot a jármű hátralévő sorának minden lehetséges pozíciójába
 * beilleszti, és a legjobbat adja vissza. Rögzített feladat elé/mögé
 * kerülhet, de azt nem mozdítja.
 */
function bestInsertion(
  ctx: PlanningContext,
  plan: PlanVersion,
  vehicleId: string,
  target: Task,
  minDeparture: Minutes,
  allowDisplacement: boolean,
): Insertion {
  const anchor = vehicleAnchor(ctx, plan, vehicleId);
  const rest = remainingItems(ctx, plan, vehicleId).filter((i) => i.task.id !== target.id);
  const targetItem: SequenceItem = { task: target, role: "target", minDeparture, source: "optimizer" };
  // Magasabb prioritású feladat nem kerülhet egy alacsonyabb mögé kényszerből:
  // a pozíciók közül a rangsor választ.
  let best: Insertion | null = null;
  for (let position = 0; position <= rest.length; position++) {
    const items = [...rest.slice(0, position), targetItem, ...rest.slice(position)];
    const sim = simulateSequence(ctx, vehicleId, anchor, items);
    if (!allowDisplacement && sim.dropped.length > 0) continue;
    // Csak alacsonyabb prioritású feladat szorulhat ki.
    const displacesHigher = sim.dropped.some(
      (d) => PRIORITY_RANK[taskById(ctx, d.taskId).priority] >= PRIORITY_RANK[target.priority],
    );
    if (displacesHigher) continue;
    const candidate = { position, sim };
    if (!best || compareTuple(feasibilityRank(sim, target), feasibilityRank(best.sim, target)) < 0) {
      best = candidate;
    }
  }
  if (!best) {
    // Nincs kiszorítás nélküli pozíció: a lista végére tesszük, a problémák láthatók maradnak.
    const items = [...rest, targetItem];
    return { position: rest.length, sim: simulateSequence(ctx, vehicleId, anchor, items) };
  }
  return best;
}

// ---------------------------------------------------------------------------
// Kiszorult feladat áthelyezése másik járműre
// ---------------------------------------------------------------------------

function relocate(
  ctx: PlanningContext,
  plan: PlanVersion,
  displaced: Task,
  excludedVehicleIds: string[],
): { vehicleId: string; sim: SequenceResult } | null {
  const options: { vehicleId: string; sim: SequenceResult }[] = [];
  for (const vehicle of ctx.vehicles) {
    if (excludedVehicleIds.includes(vehicle.id)) continue;
    const crew = crewOfVehicle(ctx, vehicle.id);
    if (eligibilityProblems(displaced, vehicle, crew).length > 0) continue;
    const ins = bestInsertion(ctx, plan, vehicle.id, displaced, ctx.now, false);
    const ok =
      ins.sim.targetProblems.length === 0 &&
      ins.sim.pinnedConflicts.length === 0 &&
      ins.sim.dropped.length === 0 &&
      (deadlineSlack(displaced, ins.sim.targetAssignment!) ?? 0) >= 0;
    if (ok) options.push({ vehicleId: vehicle.id, sim: ins.sim });
  }
  options.sort(
    (a, b) =>
      a.sim.targetAssignment!.arrivalAtFrom - b.sim.targetAssignment!.arrivalAtFrom ||
      a.vehicleId.localeCompare(b.vehicleId),
  );
  return options[0] ?? null;
}

// ---------------------------------------------------------------------------
// Egy jármű értékelése a célfeladatra
// ---------------------------------------------------------------------------

function evaluateVehicle(
  ctx: PlanningContext,
  plan: PlanVersion,
  target: Task,
  vehicleId: string,
  requestedDeparture: Minutes | null,
): CandidateWork {
  const vehicle = vehicleById(ctx, vehicleId);
  const crew = crewOfVehicle(ctx, vehicleId);
  const shift = shiftOfCrew(ctx, crew);
  const ineligible = eligibilityProblems(target, vehicle, crew);
  const baseEval: CandidateEvaluation = {
    vehicleId,
    crewId: crew.id,
    eligible: ineligible.length === 0,
    ineligibleReasons: ineligible,
    feasible: false,
    infeasibleReasons: [],
    departureFromLocationId: null,
    departure: null,
    arrivalAtFrom: null,
    deadline: target.latestArrival,
    slackMinutes: null,
    meetsDeadline: false,
    end: null,
    returnToDepotAt: null,
    displacedTaskIds: [],
    moves: [],
    unresolvedTaskIds: [],
    warnings: [],
  };
  if (ineligible.length > 0) {
    return { evaluation: baseEval, hardProblems: ineligible, assignmentsByVehicle: new Map(), unresolved: [] };
  }

  const anchor = vehicleAnchor(ctx, plan, vehicleId);
  const earliest = target.priority === "urgent" ? ctx.now + DISPATCH_PREP_MINUTES : ctx.now;
  const minDeparture = Math.max(earliest, requestedDeparture ?? earliest);
  const warnings: SuggestionWarning[] = [];
  if (requestedDeparture !== null && requestedDeparture < anchor.time) {
    warnings.push({
      level: "warning",
      message: `${vehicleId} ${formatClock(anchor.time)} előtt nem szabad; a kért ${formatClock(requestedDeparture)}-s indulás helyett legkorábban ${formatClock(anchor.time)}.`,
    });
  }

  const ins = bestInsertion(ctx, plan, vehicleId, target, minDeparture, true);
  const a = ins.sim.targetAssignment!;
  const hardProblems = [...ins.sim.targetProblems, ...ins.sim.pinnedConflicts];
  const slack = deadlineSlack(target, a);
  const meetsDeadline = slack === null || slack >= 0;

  const assignmentsByVehicle = new Map<string, Assignment[]>();
  assignmentsByVehicle.set(vehicleId, ins.sim.placed);

  // Kiszorult (alacsonyabb prioritású) feladatok áthelyezése.
  const moves: TaskMove[] = [];
  const unresolved: string[] = [];
  let workingPlan = plan;
  for (const d of ins.sim.dropped) {
    const displaced = taskById(ctx, d.taskId);
    const reloc = relocate(ctx, workingPlan, displaced, [vehicleId]);
    if (!reloc) {
      unresolved.push(displaced.id);
      continue;
    }
    const relocVehicle = vehicleById(ctx, reloc.vehicleId);
    const relocShift = shiftOfCrew(ctx, crewOfVehicle(ctx, reloc.vehicleId));
    const placed = reloc.sim.placed;
    assignmentsByVehicle.set(reloc.vehicleId, placed);
    // A következő kiszorult feladat már a frissített sorral számol.
    workingPlan = {
      ...workingPlan,
      assignments: [...workingPlan.assignments.filter((x) => x.vehicleId !== reloc.vehicleId), ...placed],
    };
    const back = returnToDepot(ctx, relocVehicle, placed);
    moves.push({
      taskId: displaced.id,
      fromVehicleId: vehicleId,
      toVehicleId: reloc.vehicleId,
      newArrivalAtFrom: reloc.sim.targetAssignment!.arrivalAtFrom,
      newEnd: reloc.sim.targetAssignment!.end,
      fitsShift: back === null || !relocShift.mustReturnToDepotByEnd || back <= relocShift.end,
      returnToDepotAt: back,
      shiftEnd: relocShift.end,
    });
  }

  if (slack !== null && slack >= 0 && slack < 30) {
    warnings.push({ level: "warning", message: `Szűk kiérkezési tartalék: ${formatDuration(slack)}.` });
  }
  const back = ins.sim.returnToDepotAt;
  if (shift.mustReturnToDepotByEnd && back !== null && back <= shift.end && shift.end - back < 15) {
    warnings.push({
      level: "warning",
      message: `${crew.name}: a telephelyre ${formatClock(back)}-kor érne vissza, ${formatDuration(shift.end - back)} a műszakvégig.`,
    });
  }
  const nextPinned = ins.sim.placed.find(
    (p) => taskById(ctx, p.taskId).status === "manually_locked" && p.serviceStart >= a.end,
  );
  if (nextPinned) {
    const gap = nextPinned.departure - a.end;
    if (gap >= 0 && gap < 20) {
      warnings.push({
        level: "warning",
        message: `Szoros csatlakozás a kézzel rögzített ${nextPinned.taskId} feladathoz: ${formatDuration(gap)} tartalék.`,
      });
    }
  }
  if (!meetsDeadline) {
    warnings.push({
      level: "critical",
      message: `A kiérkezési határ (${formatClock(target.latestArrival!)}) nem tartható: szimulált kiérkezés ${formatClock(a.arrivalAtFrom)}.`,
    });
  }
  for (const u of unresolved) {
    warnings.push({
      level: "critical",
      message: `${u} nem fér el más járművön — elfogadás esetén kiosztatlan marad.`,
    });
  }

  const infeasibleReasons = [...hardProblems];
  if (!meetsDeadline) infeasibleReasons.push("A kiérkezési határ nem tartható.");

  return {
    evaluation: {
      ...baseEval,
      feasible: hardProblems.length === 0 && meetsDeadline,
      infeasibleReasons,
      departureFromLocationId: a.departureFromLocationId,
      departure: a.departure,
      arrivalAtFrom: a.arrivalAtFrom,
      slackMinutes: slack,
      meetsDeadline,
      end: a.end,
      returnToDepotAt: back,
      displacedTaskIds: ins.sim.dropped.map((d) => d.taskId),
      moves,
      unresolvedTaskIds: unresolved,
      warnings,
    },
    hardProblems,
    assignmentsByVehicle,
    unresolved,
  };
}

function candidateRank(ctx: PlanningContext, target: Task, c: CandidateWork): number[] {
  const e = c.evaluation;
  const shift = shiftOfCrew(ctx, crewOfVehicle(ctx, e.vehicleId));
  const onCallPreferred = target.type === "urgent_death_pickup" && shift.onCall ? 0 : 1;
  return [
    e.eligible ? 0 : 1,
    c.hardProblems.length > 0 ? 1 : 0,
    e.meetsDeadline ? 0 : 1,
    c.unresolved.length,
    onCallPreferred,
    e.arrivalAtFrom ?? Number.MAX_SAFE_INTEGER,
  ];
}

// ---------------------------------------------------------------------------
// Szöveges indoklás
// ---------------------------------------------------------------------------

function buildRationale(
  ctx: PlanningContext,
  target: Task,
  chosen: CandidateWork | null,
  all: CandidateWork[],
  origin: OptimizationSuggestion["origin"],
): string[] {
  const lines: string[] = [];
  if (!chosen || !chosen.evaluation.eligible) {
    lines.push("Nincs alkalmas jármű–csapat pár a feladatra; a döntés a diszpécseré.");
    return lines;
  }
  const e = chosen.evaluation;
  const vehicle = vehicleById(ctx, e.vehicleId);
  const crew = crewOfVehicle(ctx, e.vehicleId);
  const shift = shiftOfCrew(ctx, crew);

  if (origin === "dispatcher_variant") {
    lines.push(`Diszpécseri változat: ${vehicle.id} + ${crew.name}, a kért paraméterekkel újraszámolva.`);
  } else if (target.type === "urgent_death_pickup" && shift.onCall) {
    lines.push(
      `${vehicle.id} + ${crew.name}: az ügyeleti jármű és a 07:00–07:00 ügyeletes kétfős csapat (D-08), a haláleseti felvétel elsődleges erőforrása.`,
    );
  } else {
    lines.push(`${vehicle.id} + ${crew.name}: alkalmas jármű és csapat, a legkorábbi érvényes időpontot adja.`);
  }

  if (e.departure !== null && e.arrivalAtFrom !== null) {
    lines.push(
      `Indulás ${formatClock(e.departure)} (${ctx.labelOf(e.departureFromLocationId!)}), szimulált kiérkezés ${ctx.labelOf(target.fromLocationId)}: ${formatClock(e.arrivalAtFrom)}.`,
    );
  }
  if (target.latestArrival !== null && e.slackMinutes !== null) {
    lines.push(
      e.meetsDeadline
        ? `A ${formatClock(target.latestArrival)}-es kiérkezési határ teljesül, ${formatDuration(e.slackMinutes)} tartalékkal.`
        : `A ${formatClock(target.latestArrival)}-es kiérkezési határ NEM teljesül (${formatDuration(-e.slackMinutes)} késés).`,
    );
  }

  for (const m of e.moves) {
    const moved = taskById(ctx, m.taskId);
    const toCrew = crewOfVehicle(ctx, m.toVehicleId);
    lines.push(
      `${m.taskId} (${TASK_TYPE_LABEL[moved.type].toLowerCase()}, ${moved.priority === "low" ? "alacsony prioritású" : "normál prioritású"}) ütközne; áthelyezés ${m.fromVehicleId} → ${m.toVehicleId} (${toCrew.name}), szimulált kiérkezés ${formatClock(m.newArrivalAtFrom)}${moved.latestArrival !== null ? ` (határ ${formatClock(moved.latestArrival)})` : ""}.`,
    );
    if (m.returnToDepotAt !== null) {
      lines.push(
        `${toCrew.name} visszaérkezése a telephelyre ${formatClock(m.returnToDepotAt)}, a műszak ${formatClock(m.shiftEnd)}-kor zárul — ${m.fitsShift ? `belefér (${formatDuration(m.shiftEnd - m.returnToDepotAt)} tartalék)` : "NEM fér bele"}.`,
      );
    }
  }

  const lockedOnChosen = (chosen.assignmentsByVehicle.get(e.vehicleId) ?? [])
    .map((x) => taskById(ctx, x.taskId))
    .filter((t) => t.status === "manually_locked");
  for (const t of lockedOnChosen) {
    lines.push(`A kézzel rögzített ${t.id} változatlan marad.`);
  }

  if (origin === "optimizer") {
    for (const other of all) {
      if (other === chosen) continue;
      const o = other.evaluation;
      if (!o.eligible) {
        lines.push(`${o.vehicleId} nem választható: ${o.ineligibleReasons.join(" ")}`);
      } else if (!o.feasible) {
        lines.push(`${o.vehicleId} nem megfelelő: ${o.infeasibleReasons.join(" ")}`);
      } else if (o.arrivalAtFrom !== null) {
        lines.push(
          `${o.vehicleId} is alkalmas lenne (kiérkezés ${formatClock(o.arrivalAtFrom)}${o.slackMinutes !== null ? `, ${formatDuration(o.slackMinutes)} tartalék` : ""}), a diszpécser módosítással választhatja.`,
        );
      }
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Belépési pont
// ---------------------------------------------------------------------------

/**
 * Javaslat készítése egy feladatra. A bemeneti tervet NEM módosítja; a
 * visszaadott `proposedAssignments` egy új lista.
 */
export function createSuggestion(input: OptimizerInput): OptimizationSuggestion {
  const { ctx, plan, taskId, suggestionId, request } = input;
  const target = taskById(ctx, taskId);
  if (isLockedStatus(target.status)) {
    throw new Error(`${taskId} teljesített, folyamatban lévő vagy kézzel rögzített — nem tervezhető át.`);
  }
  // A célfeladat már szerepelhet a tervben (pl. jóváhagyott, újratervezendő): kivesszük.
  const basePlan: PlanVersion = { ...plan, assignments: plan.assignments.filter((a) => a.taskId !== taskId) };

  const requestedVehicle = request?.vehicleId ?? null;
  const requestedDeparture = request?.departure ?? null;
  const vehicleIds = ctx.vehicles.map((v) => v.id);
  const all = vehicleIds.map((id) =>
    evaluateVehicle(
      ctx,
      basePlan,
      target,
      id,
      requestedVehicle === null || id === requestedVehicle ? requestedDeparture : null,
    ),
  );

  const ranked = [...all].sort((a, b) => compareTuple(candidateRank(ctx, target, a), candidateRank(ctx, target, b)));
  const chosen = requestedVehicle ? all.find((c) => c.evaluation.vehicleId === requestedVehicle)! : ranked[0];

  const origin: OptimizationSuggestion["origin"] = request ? "dispatcher_variant" : "optimizer";
  const warnings: SuggestionWarning[] = [...chosen.evaluation.warnings];
  if (!chosen.evaluation.eligible) {
    warnings.unshift({ level: "critical", message: chosen.evaluation.ineligibleReasons.join(" ") });
  }
  for (const p of chosen.hardProblems) {
    if (chosen.evaluation.eligible) warnings.push({ level: "critical", message: p });
  }
  warnings.push({
    level: "info",
    message: "Szimulált ETA és becsült útvonal — nem valós idejű forgalmi adat, nem hiteles menetidő.",
  });

  // Javasolt terv: az érintett járművek sora cserélve, minden más változatlan.
  let proposedAssignments: Assignment[] = basePlan.assignments.map((a) => ({ ...a }));
  const touchedVehicles = chosen.evaluation.eligible ? [...chosen.assignmentsByVehicle.keys()] : [];
  for (const vid of touchedVehicles) {
    const startedIds = new Set(
      vehicleAssignments(basePlan, vid)
        .filter((a) => isLockedStatus(taskById(ctx, a.taskId).status) && taskById(ctx, a.taskId).status !== "manually_locked")
        .map((a) => a.taskId),
    );
    const keptStarted = proposedAssignments.filter((a) => a.vehicleId === vid && startedIds.has(a.taskId));
    const newOnes = chosen.assignmentsByVehicle.get(vid)!.map((a) => {
      const original = basePlan.assignments.find((x) => x.taskId === a.taskId && x.vehicleId === vid);
      const t = taskById(ctx, a.taskId);
      // Rögzített feladat: az eredeti hozzárendelés marad érvényben.
      if (original && t.status === "manually_locked") return { ...original };
      const unchanged =
        original && original.departure === a.departure && original.arrivalAtFrom === a.arrivalAtFrom && original.end === a.end;
      if (unchanged) return { ...original };
      return { ...a, source: origin === "dispatcher_variant" ? ("dispatcher" as const) : ("optimizer" as const) };
    });
    proposedAssignments = [
      ...proposedAssignments.filter((a) => a.vehicleId !== vid),
      ...keptStarted,
      ...newOnes,
    ];
  }
  // Az át nem helyezhető kiszorult feladatok kikerülnek a tervből.
  const unassignedTaskIds = chosen.evaluation.eligible ? chosen.unresolved : [];
  proposedAssignments = proposedAssignments.filter((a) => !unassignedTaskIds.includes(a.taskId));
  if (!chosen.evaluation.eligible || chosen.evaluation.departure === null) {
    proposedAssignments = proposedAssignments.filter((a) => a.taskId !== taskId);
  }

  const impacts: VehicleImpact[] = ctx.vehicles
    .filter((v) => touchedVehicles.includes(v.id))
    .map((v) => {
      const shift = shiftOfCrew(ctx, crewOfVehicle(ctx, v.id));
      const before = vehicleAssignments(plan, v.id);
      const after = proposedAssignments.filter((a) => a.vehicleId === v.id).sort((a, b) => a.departure - b.departure);
      const afterBack = returnToDepot(ctx, v, after);
      // Ügyeleti csapatnál nincs kötelező visszaérkezés a napi ablak végéig.
      return {
        vehicleId: v.id,
        before: { taskIds: before.map((a) => a.taskId), returnToDepotAt: returnToDepot(ctx, v, before) },
        after: { taskIds: after.map((a) => a.taskId), returnToDepotAt: afterBack },
        shiftEnd: shift.end,
        marginMinutes: shift.mustReturnToDepotByEnd && afterBack !== null ? shift.end - afterBack : null,
      };
    });

  return {
    id: suggestionId,
    taskId,
    createdAt: ctx.now,
    basePlanId: plan.id,
    origin,
    requested: request ? { vehicleId: requestedVehicle, departure: requestedDeparture } : null,
    feasible: chosen.evaluation.feasible && chosen.unresolved.length === 0,
    chosenVehicleId: chosen.evaluation.eligible ? chosen.evaluation.vehicleId : null,
    candidates: all.map((c) => c.evaluation),
    proposedAssignments,
    unassignedTaskIds,
    rationale: buildRationale(ctx, target, chosen, all, origin),
    warnings,
    impacts,
    status: "open",
  };
}

/**
 * Elfogadhatóság: alkalmatlan jármű, kemény ütközés vagy elavult alapterv
 * esetén nem fogadható el. Határidő-mulasztásnál csak indoklással.
 */
export function acceptanceCheck(
  suggestion: OptimizationSuggestion,
  currentPlanId: string,
  reason: string,
): { ok: boolean; blockers: string[]; requiresReason: boolean } {
  const blockers: string[] = [];
  const chosen = suggestion.candidates.find((c) => c.vehicleId === suggestion.chosenVehicleId);
  if (suggestion.status !== "open") blockers.push("A javaslat már nem nyitott.");
  if (suggestion.basePlanId !== currentPlanId) {
    blockers.push("A javaslat egy korábbi tervverzióra épül — készíts újat.");
  }
  if (!chosen || !chosen.eligible) blockers.push("Nincs alkalmas jármű a javaslatban.");
  const hard = chosen ? chosen.infeasibleReasons.filter((r) => r !== "A kiérkezési határ nem tartható.") : [];
  if (hard.length > 0) blockers.push(...hard);
  const requiresReason = !suggestion.feasible || suggestion.origin === "dispatcher_variant";
  if (requiresReason && reason.trim().length < 3) {
    blockers.push(REASON_REQUIRED_MESSAGE);
  }
  return { ok: blockers.length === 0, blockers, requiresReason };
}

/**
 * Demóállapot kezelése: tiszta reducer, UI-tól független.
 *
 * Alapelv (D-03): a javaslat (OptimizationSuggestion) és a jóváhagyott terv
 * (PlanVersion) külön objektum. Terv csak diszpécseri döntéssel jön létre.
 */
import { acceptanceCheck, createSuggestion } from "../demo-optimizer";
import { approximateBudapestCoords, validateBudapestAddress } from "./geo";
import { buildContext, deadlineSlack, LATE_RISK_THRESHOLD_MINUTES, isLockedStatus } from "./schedule";
import { createSeedState, createUrgentEventTask, URGENT_EVENT_TASK_ID } from "./seed";
import type {
  DecisionAction,
  DemoState,
  DisplayStatus,
  Minutes,
  OptimizationSuggestion,
  PickupLocation,
  PickupLocationKind,
  PlanVersion,
  Task,
  TaskStatus,
} from "./types";

export interface NewPickupLocationInput {
  name: string;
  address: string;
  kind: PickupLocationKind;
  coords?: { lat: number; lng: number } | null;
  accessNote?: string;
  timeWindow?: { start: Minutes; end: Minutes } | null;
  dataSource?: string;
}

export type DemoAction =
  | { type: "LOAD_URGENT_EVENT" }
  | { type: "CREATE_URGENT_TASK"; pickupLocationId: string }
  | { type: "REQUEST_SUGGESTION"; taskId: string }
  | { type: "CREATE_VARIANT"; taskId: string; vehicleId: string | null; departure: Minutes | null }
  | { type: "DISCARD_VARIANT"; suggestionId: string }
  | { type: "ACCEPT_SUGGESTION"; suggestionId: string; reason: string }
  | { type: "REJECT_SUGGESTION"; suggestionId: string; reason: string }
  | { type: "ADD_PICKUP_LOCATION"; input: NewPickupLocationInput }
  | { type: "SET_PICKUP_ACTIVE"; id: string; active: boolean }
  | { type: "RESET" }
  | { type: "HYDRATE"; state: DemoState };

export class DemoActionError extends Error {}

// ---------------------------------------------------------------------------
// Lekérdezések
// ---------------------------------------------------------------------------

export function currentPlan(state: DemoState): PlanVersion {
  const plan = state.planVersions.find((p) => p.id === state.currentPlanId);
  if (!plan) throw new Error("Nincs aktuális terv.");
  return plan;
}

export function morningPlan(state: DemoState): PlanVersion {
  return state.planVersions.find((p) => p.id === state.morningPlanId)!;
}

export function openSuggestionFor(state: DemoState, taskId: string): OptimizationSuggestion | null {
  const open = state.suggestions.filter((s) => s.taskId === taskId && s.status === "open");
  return open[open.length - 1] ?? null;
}

export function latestSuggestionFor(state: DemoState, taskId: string): OptimizationSuggestion | null {
  const all = state.suggestions.filter((s) => s.taskId === taskId || s.proposedAssignments.some((a) => a.taskId === taskId && a.source !== "morning_plan"));
  return all[all.length - 1] ?? null;
}

/** Megjelenítési státusz: a tárolt státusz, vagy „Késésveszély”, ha a tartalék kicsi. */
export function displayStatus(state: DemoState, task: Task): DisplayStatus {
  if (task.status === "completed" || task.status === "manually_locked" || task.status === "unassigned") {
    return task.status;
  }
  if (task.latestArrival !== null) {
    const assignment = currentPlan(state).assignments.find((a) => a.taskId === task.id);
    const suggestion = openSuggestionFor(state, task.id);
    const arrival =
      assignment?.arrivalAtFrom ??
      suggestion?.candidates.find((c) => c.vehicleId === suggestion.chosenVehicleId)?.arrivalAtFrom ??
      null;
    if (arrival !== null) {
      const slack = deadlineSlack(task, { arrivalAtFrom: arrival + (task.reportedDelayMinutes ?? 0) });
      if (slack !== null && slack < LATE_RISK_THRESHOLD_MINUTES) return "at_risk";
    }
  }
  return task.status;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function nextId(prefix: string, n: number, pad = 3): string {
  return `${prefix}-${String(n).padStart(pad, "0")}`;
}

function setTaskStatus(tasks: Task[], ids: string[], status: TaskStatus): Task[] {
  return tasks.map((t) => (ids.includes(t.id) ? { ...t, status } : t));
}

function requestSuggestion(
  state: DemoState,
  taskId: string,
  request?: { vehicleId: string | null; departure: Minutes | null },
): DemoState {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) throw new DemoActionError(`Ismeretlen feladat: ${taskId}`);
  if (isLockedStatus(task.status)) {
    throw new DemoActionError(`${taskId} teljesített, folyamatban lévő vagy kézzel rögzített — nem tervezhető át.`);
  }
  const n = state.counters.suggestion + 1;
  const suggestion = createSuggestion({
    ctx: buildContext(state),
    plan: currentPlan(state),
    taskId,
    suggestionId: nextId("JAV", n),
    request,
  });
  // Ugyanarra a feladatra korábban nyitott javaslat(ok) elavulnak.
  const suggestions = state.suggestions.map((s) =>
    s.taskId === taskId && s.status === "open" && (!request || s.origin === "dispatcher_variant")
      ? { ...s, status: "superseded" as const }
      : s,
  );
  return {
    ...state,
    suggestions: [...suggestions, suggestion],
    tasks: task.status === "approved" ? state.tasks : setTaskStatus(state.tasks, [taskId], "suggested"),
    counters: { ...state.counters, suggestion: n },
  };
}

function decide(state: DemoState, suggestionId: string, reason: string, accept: boolean): DemoState {
  const suggestion = state.suggestions.find((s) => s.id === suggestionId);
  if (!suggestion) throw new DemoActionError(`Ismeretlen javaslat: ${suggestionId}`);
  const decisionNo = state.counters.decision + 1;
  const decisionId = nextId("DD", decisionNo);

  if (!accept) {
    if (suggestion.status !== "open") throw new DemoActionError("A javaslat már nem nyitott.");
    if (reason.trim().length < 3) throw new DemoActionError("Az elutasításhoz rövid indoklás szükséges.");
    const rejectedIds = state.suggestions
      .filter((s) => s.taskId === suggestion.taskId && s.status === "open")
      .map((s) => s.id);
    const task = state.tasks.find((t) => t.id === suggestion.taskId)!;
    return {
      ...state,
      suggestions: state.suggestions.map((s) => (rejectedIds.includes(s.id) ? { ...s, status: "rejected" as const } : s)),
      decisions: [
        ...state.decisions,
        {
          id: decisionId,
          suggestionId,
          taskId: suggestion.taskId,
          action: "rejected",
          decidedAt: state.now,
          reason: reason.trim(),
          resultingPlanId: null,
        },
      ],
      // A terv változatlan; a feladat kiosztatlan marad (ha még nem volt tervben).
      tasks: task.status === "approved" ? state.tasks : setTaskStatus(state.tasks, [suggestion.taskId], "unassigned"),
      counters: { ...state.counters, decision: decisionNo },
    };
  }

  const check = acceptanceCheck(suggestion, state.currentPlanId, reason);
  if (!check.ok) throw new DemoActionError(check.blockers.join(" "));

  const planNo = state.counters.plan + 1;
  const action: DecisionAction = suggestion.origin === "dispatcher_variant" ? "modified" : "accepted";
  const plan: PlanVersion = {
    id: nextId("PV", planNo, 1),
    label: `Jóváhagyott terv v${planNo}`,
    kind: "approved",
    createdAt: state.now,
    basedOnPlanId: state.currentPlanId,
    assignments: suggestion.proposedAssignments.map((a) => ({ ...a })),
    decisionId,
  };
  const closedIds = state.suggestions
    .filter((s) => s.taskId === suggestion.taskId && s.status === "open" && s.id !== suggestionId)
    .map((s) => s.id);
  let tasks = setTaskStatus(state.tasks, [suggestion.taskId], "approved");
  tasks = setTaskStatus(tasks, suggestion.unassignedTaskIds, "unassigned");

  return {
    ...state,
    planVersions: [...state.planVersions, plan],
    currentPlanId: plan.id,
    suggestions: state.suggestions.map((s) => {
      if (s.id === suggestionId) return { ...s, status: "accepted" as const };
      if (closedIds.includes(s.id)) return { ...s, status: "superseded" as const };
      return s;
    }),
    decisions: [
      ...state.decisions,
      {
        id: decisionId,
        suggestionId,
        taskId: suggestion.taskId,
        action,
        decidedAt: state.now,
        reason: reason.trim(),
        resultingPlanId: plan.id,
      },
    ],
    tasks,
    counters: { ...state.counters, decision: decisionNo, plan: planNo },
  };
}

function addPickupLocation(state: DemoState, input: NewPickupLocationInput): DemoState {
  const name = input.name.trim();
  const address = input.address.trim();
  if (name.length < 3) throw new DemoActionError("Adj meg legalább 3 karakteres nevet.");
  const addressProblem = validateBudapestAddress(address);
  if (addressProblem) throw new DemoActionError(addressProblem);
  const duplicate = state.pickupLocations.some(
    (p) => p.address.toLocaleLowerCase("hu") === address.toLocaleLowerCase("hu"),
  );
  if (duplicate) throw new DemoActionError("Ez a cím már szerepel a helytörzsben.");
  const approx = input.coords ? null : approximateBudapestCoords(address);
  const coords = input.coords ?? approx;
  if (!coords) throw new DemoActionError("A koordináta nem becsülhető: adj meg irányítószámot vagy koordinátát.");

  const n = state.counters.pickup + 1;
  const location: PickupLocation = {
    id: nextId("P", n),
    name,
    shortName: name.length > 28 ? `${name.slice(0, 26)}…` : name,
    address,
    kind: input.kind,
    coords,
    coordsApproximated: !input.coords,
    accessNote: input.accessNote?.trim() || "Nincs megadva — ellenőrizendő.",
    timeWindow: input.timeWindow ?? null,
    dataSource: input.dataSource?.trim() || "Diszpécseri rögzítés (demó)",
    verification: "unverified",
    lastCheckedLabel: "Nem ellenőrzött",
    active: true,
    createdBy: "dispatcher",
  };
  return {
    ...state,
    pickupLocations: [...state.pickupLocations, location],
    counters: { ...state.counters, pickup: n },
  };
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case "LOAD_URGENT_EVENT": {
      if (state.tasks.some((t) => t.id === URGENT_EVENT_TASK_ID)) return state;
      return { ...state, tasks: [...state.tasks, createUrgentEventTask()], urgentEventLoaded: true };
    }
    case "CREATE_URGENT_TASK": {
      const pickup = state.pickupLocations.find((p) => p.id === action.pickupLocationId);
      if (!pickup) throw new DemoActionError("Ismeretlen felvételi hely.");
      if (!pickup.active) throw new DemoActionError("Inaktív felvételi hely nem választható.");
      // F-2026-100 a 11:22-es eseménynek van fenntartva.
      let n = state.counters.task + 1;
      while (state.tasks.some((t) => t.id === `F-2026-${n}`) || n === 100) n++;
      const task = createUrgentEventTask(`F-2026-${n}`, pickup.id, state.now);
      return { ...state, tasks: [...state.tasks, task], counters: { ...state.counters, task: n } };
    }
    case "REQUEST_SUGGESTION":
      return requestSuggestion(state, action.taskId);
    case "CREATE_VARIANT":
      return requestSuggestion(state, action.taskId, { vehicleId: action.vehicleId, departure: action.departure });
    case "DISCARD_VARIANT": {
      const target = state.suggestions.find((s) => s.id === action.suggestionId);
      if (!target || target.origin !== "dispatcher_variant" || target.status !== "open") {
        throw new DemoActionError("Csak nyitott diszpécseri változat vethető el.");
      }
      return {
        ...state,
        suggestions: state.suggestions.map((s) => (s.id === target.id ? { ...s, status: "superseded" as const } : s)),
      };
    }
    case "ACCEPT_SUGGESTION":
      return decide(state, action.suggestionId, action.reason, true);
    case "REJECT_SUGGESTION":
      return decide(state, action.suggestionId, action.reason, false);
    case "ADD_PICKUP_LOCATION":
      return addPickupLocation(state, action.input);
    case "SET_PICKUP_ACTIVE":
      return {
        ...state,
        pickupLocations: state.pickupLocations.map((p) => (p.id === action.id ? { ...p, active: action.active } : p)),
      };
    case "RESET":
      return createSeedState();
    case "HYDRATE":
      return action.state;
  }
}

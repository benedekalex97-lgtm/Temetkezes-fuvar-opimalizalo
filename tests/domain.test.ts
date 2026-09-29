import { describe, expect, it } from "vitest";
import { acceptanceCheck, createSuggestion } from "@/lib/demo-optimizer";
import {
  buildContext,
  crewOfVehicle,
  shiftOfCrew,
  simulateSequence,
  timingProblems,
  timeTask,
  vehicleById,
} from "@/lib/domain/schedule";
import { createSeedState, createUrgentEventTask, MORNING_PLAN_ID, URGENT_EVENT_TASK_ID } from "@/lib/domain/seed";
import { currentPlan, demoReducer, DemoActionError, displayStatus } from "@/lib/domain/store";
import { formatClock, hm } from "@/lib/domain/time";
import type { DemoState, Task } from "@/lib/domain/types";

function withUrgentEvent(): DemoState {
  return demoReducer(createSeedState(), { type: "LOAD_URGENT_EVENT" });
}

function withSuggestion(): DemoState {
  return demoReducer(withUrgentEvent(), { type: "REQUEST_SUGGESTION", taskId: URGENT_EVENT_TASK_ID });
}

describe("1. sürgős kiérkezési határ", () => {
  it("a 11:22-kor érkező sürgős feladat kiérkezési határideje 13:22", () => {
    const state = withUrgentEvent();
    const task = state.tasks.find((t) => t.id === URGENT_EVENT_TASK_ID)!;
    expect(task.reportedAt).toBe(hm(11, 22));
    expect(task.latestArrival).toBe(hm(13, 22));
    expect(formatClock(task.latestArrival!)).toBe("13:22");
    expect(task.priority).toBe("urgent");
    expect(task.fromLocationId).toBe("P-007"); // Szent Imre
    expect(task.toLocationId).toBe("L-BOCSKAI");
    expect(task.requiredCrewSize).toBe(2);
  });

  it("a határ a felvételi címre való kiérkezésre vonatkozik, nem a teljes fuvar végére", () => {
    const state = withSuggestion();
    const s = state.suggestions[0];
    const chosen = s.candidates.find((c) => c.vehicleId === s.chosenVehicleId)!;
    expect(chosen.arrivalAtFrom!).toBeLessThanOrEqual(hm(13, 22));
    expect(chosen.meetsDeadline).toBe(true);
    // A teljes fuvar vége a határ után is lehet — ez megengedett.
    expect(chosen.end!).toBeGreaterThan(hm(13, 22));
  });
});

describe("2. J-03 nem szállíthat elhunytat", () => {
  it("J-03 alkalmatlan jelölt a sürgős felvételre", () => {
    const s = withSuggestion().suggestions[0];
    const j03 = s.candidates.find((c) => c.vehicleId === "J-03")!;
    expect(j03.eligible).toBe(false);
    expect(j03.ineligibleReasons.join(" ")).toMatch(/elhunyt szállítására nem használható/);
    expect(s.chosenVehicleId).not.toBe("J-03");
    expect(s.proposedAssignments.some((a) => a.vehicleId === "J-03" && a.taskId === URGENT_EVENT_TASK_ID)).toBe(false);
  });

  it("diszpécseri változatként sem fogadható el J-03", () => {
    let state = withSuggestion();
    state = demoReducer(state, { type: "CREATE_VARIANT", taskId: URGENT_EVENT_TASK_ID, vehicleId: "J-03", departure: null });
    const variant = state.suggestions[state.suggestions.length - 1];
    expect(variant.chosenVehicleId).toBeNull();
    expect(acceptanceCheck(variant, state.currentPlanId, "teszt indoklás").ok).toBe(false);
    expect(() =>
      demoReducer(state, { type: "ACCEPT_SUGGESTION", suggestionId: variant.id, reason: "teszt indoklás" }),
    ).toThrow(DemoActionError);
  });
});

describe("3. B és C csapat nem nyúlhat 15:00 utánra", () => {
  const state = createSeedState();
  const ctx = buildContext(state);

  function lateTask(capability: Task["requiredCapability"], crewSize: number): Task {
    return {
      ...createUrgentEventTask("F-TEST-1"),
      type: capability === "deceased_transport" ? "planned_institutional_transfer" : "urn_delivery",
      priority: "normal",
      requiredCapability: capability,
      requiredCrewSize: crewSize,
      earliestStart: hm(14, 30),
      latestArrival: null,
      fromLocationId: capability === "deceased_transport" ? "P-007" : "L-CSOMOR",
      toLocationId: capability === "deceased_transport" ? "L-BOCSKAI" : "L-IRODA-BECSI",
    };
  }

  it.each([
    ["J-02", "deceased_transport", 2],
    ["J-03", "urn_logistics", 1],
  ] as const)("%s nem kap 15:00 utánra nyúló feladatot", (vehicleId, capability, size) => {
    const task = lateTask(capability, size);
    const vehicle = vehicleById(ctx, vehicleId);
    const crew = crewOfVehicle(ctx, vehicleId);
    const shift = shiftOfCrew(ctx, crew);
    expect(shift.end).toBe(hm(15));
    const a = timeTask({ ...ctx, tasks: [...ctx.tasks, task] }, task, vehicle, crew, { locationId: "L-TELEPHELY", time: hm(14) }, { source: "optimizer" });
    expect(a.end).toBeGreaterThan(hm(15));
    const problems = timingProblems({ ...ctx, tasks: [...ctx.tasks, task] }, task, vehicle, shift, a);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join(" ")).toMatch(/15:00/);
  });

  it("a mozgatott feladat csak akkor kerül J-02-re, ha a visszaérkezés 15:00 előtt van", () => {
    const s = withSuggestion().suggestions[0];
    const move = s.candidates.find((c) => c.vehicleId === "J-01")!.moves[0];
    expect(move.toVehicleId).toBe("J-02");
    expect(move.fitsShift).toBe(true);
    expect(move.returnToDepotAt!).toBeLessThanOrEqual(hm(15));
  });
});

describe("4. A csapat ügyelete", () => {
  it("az A csapat műszakja másnap 07:00-ig tart, napi ablaka 15:00-ig", () => {
    const state = createSeedState();
    const shift = state.shifts.find((s) => s.crewId === "A")!;
    expect(shift.start).toBe(hm(7));
    expect(shift.end).toBe(hm(31));
    expect(formatClock(shift.end)).toBe("holnap 07:00");
    expect(shift.onCall).toBe(true);
    expect(shift.dayTaskWindow.end).toBe(hm(15));
  });

  it("sürgős haláleseti felvételt 15:00 után is vállalhat, B csapat nem", () => {
    const state = createSeedState();
    const ctx = buildContext(state);
    const task = { ...createUrgentEventTask("F-TEST-2", "P-007", hm(16)) };
    const ctx2 = { ...ctx, now: hm(16), tasks: [...ctx.tasks, task] };
    for (const [vehicleId, ok] of [["J-01", true], ["J-02", false]] as const) {
      const vehicle = vehicleById(ctx2, vehicleId);
      const crew = crewOfVehicle(ctx2, vehicleId);
      const a = timeTask(ctx2, task, vehicle, crew, { locationId: "L-BOCSKAI", time: hm(16) }, { source: "optimizer" });
      expect(timingProblems(ctx2, task, vehicle, shiftOfCrew(ctx2, crew), a).length === 0).toBe(ok);
    }
  });
});

describe("5. teljesített és kézzel rögzített feladat nem mozgatható", () => {
  it("a javaslat nem változtat teljesített, folyamatban lévő vagy rögzített hozzárendelésen", () => {
    const state = withSuggestion();
    const before = currentPlan(state).assignments;
    const s = state.suggestions[0];
    for (const id of ["F-2026-091", "F-2026-092", "F-2026-093", "F-2026-094", "F-2026-095", "F-2026-096", "F-2026-098"]) {
      expect(s.proposedAssignments.find((a) => a.taskId === id)).toEqual(before.find((a) => a.taskId === id));
    }
  });

  it("zárolt feladatra nem kérhető javaslat", () => {
    const state = createSeedState();
    expect(() => demoReducer(state, { type: "REQUEST_SUGGESTION", taskId: "F-2026-091" })).toThrow(DemoActionError);
    expect(() => demoReducer(state, { type: "REQUEST_SUGGESTION", taskId: "F-2026-098" })).toThrow(DemoActionError);
  });

  it("a rögzített feladat ütközése esetén a jármű nem kerül kiválasztásra", () => {
    const state = createSeedState();
    const ctx = buildContext(state);
    const plan = currentPlan(state);
    // Rögzített feladat 12:00-ra J-01-en: a sürgős felvétel nem fér elé.
    const tasks = ctx.tasks.map((t) => (t.id === "F-2026-097" ? { ...t, status: "manually_locked" as const } : t));
    const urgent = createUrgentEventTask();
    const suggestion = createSuggestion({
      ctx: { ...ctx, tasks: [...tasks, urgent] },
      plan,
      taskId: urgent.id,
      suggestionId: "JAV-T",
    });
    expect(suggestion.chosenVehicleId).toBe("J-02");
    const j01 = suggestion.candidates.find((c) => c.vehicleId === "J-01")!;
    expect(j01.feasible).toBe(false);
    // A rögzített feladat elé nem fér be, mögötte viszont már késne.
    expect(j01.meetsDeadline).toBe(false);
    expect(suggestion.proposedAssignments.find((a) => a.taskId === "F-2026-097")).toEqual(
      plan.assignments.find((a) => a.taskId === "F-2026-097"),
    );
  });
});

describe("6. a javaslat nem módosítja a jóváhagyott tervet", () => {
  it("a javaslat készítése után a jóváhagyott terv változatlan", () => {
    const state = withUrgentEvent();
    const planBefore = structuredClone(currentPlan(state));
    const next = demoReducer(state, { type: "REQUEST_SUGGESTION", taskId: URGENT_EVENT_TASK_ID });
    expect(next.currentPlanId).toBe(MORNING_PLAN_ID);
    expect(next.planVersions).toHaveLength(1);
    expect(currentPlan(next)).toEqual(planBefore);
    expect(currentPlan(next).assignments.some((a) => a.taskId === URGENT_EVENT_TASK_ID)).toBe(false);
    const s = next.suggestions[0];
    expect(s.status).toBe("open");
    expect(s.chosenVehicleId).toBe("J-01");
    expect(s.proposedAssignments).not.toBe(currentPlan(next).assignments);
    expect(next.tasks.find((t) => t.id === URGENT_EVENT_TASK_ID)!.status).toBe("suggested");
  });

  it("az optimalizáló nem mutálja a bemenetét", () => {
    const state = withUrgentEvent();
    const frozen = structuredClone(state);
    createSuggestion({ ctx: buildContext(state), plan: currentPlan(state), taskId: URGENT_EVENT_TASK_ID, suggestionId: "X" });
    expect(state).toEqual(frozen);
  });

  it("javasolja J-01-et és F-2026-097 áthelyezését J-02-re", () => {
    const s = withSuggestion().suggestions[0];
    expect(s.chosenVehicleId).toBe("J-01");
    const move = s.candidates.find((c) => c.vehicleId === "J-01")!.moves;
    expect(move.map((m) => [m.taskId, m.fromVehicleId, m.toVehicleId])).toEqual([["F-2026-097", "J-01", "J-02"]]);
    expect(s.rationale.join(" ")).toMatch(/13:22/);
    expect(s.feasible).toBe(true);
  });

  it("elutasításnál a terv változatlan, a feladat kiosztatlan", () => {
    let state = withSuggestion();
    state = demoReducer(state, { type: "REJECT_SUGGESTION", suggestionId: state.suggestions[0].id, reason: "Telefonon egyeztetve" });
    expect(state.currentPlanId).toBe(MORNING_PLAN_ID);
    expect(state.decisions[0].action).toBe("rejected");
    expect(state.tasks.find((t) => t.id === URGENT_EVENT_TASK_ID)!.status).toBe("unassigned");
  });
});

describe("7. elfogadás külön tervverziót hoz létre", () => {
  it("elfogadás után a reggeli terv, a javaslat és a jóváhagyott terv elkülönül", () => {
    let state = withSuggestion();
    const morning = structuredClone(currentPlan(state));
    const suggestionId = state.suggestions[0].id;
    state = demoReducer(state, { type: "ACCEPT_SUGGESTION", suggestionId, reason: "" });
    expect(state.planVersions).toHaveLength(2);
    const approved = currentPlan(state);
    expect(approved.id).not.toBe(MORNING_PLAN_ID);
    expect(approved.kind).toBe("approved");
    expect(approved.basedOnPlanId).toBe(MORNING_PLAN_ID);
    expect(state.planVersions[0]).toEqual(morning);
    expect(state.suggestions[0].status).toBe("accepted");
    expect(state.decisions).toHaveLength(1);
    expect(state.decisions[0]).toMatchObject({ action: "accepted", resultingPlanId: approved.id, suggestionId });
    expect(approved.assignments.find((a) => a.taskId === URGENT_EVENT_TASK_ID)?.vehicleId).toBe("J-01");
    expect(approved.assignments.find((a) => a.taskId === "F-2026-097")?.vehicleId).toBe("J-02");
    expect(morning.assignments.find((a) => a.taskId === "F-2026-097")?.vehicleId).toBe("J-01");
    expect(approved.assignments).not.toBe(state.suggestions[0].proposedAssignments);
    expect(state.tasks.find((t) => t.id === URGENT_EVENT_TASK_ID)!.status).toBe("approved");
  });

  it("diszpécseri módosítás (J-02, későbbi indulás) indoklással külön verzió", () => {
    let state = withSuggestion();
    state = demoReducer(state, { type: "CREATE_VARIANT", taskId: URGENT_EVENT_TASK_ID, vehicleId: "J-02", departure: hm(12) });
    const variant = state.suggestions[state.suggestions.length - 1];
    expect(variant.origin).toBe("dispatcher_variant");
    expect(variant.chosenVehicleId).toBe("J-02");
    const c = variant.candidates.find((x) => x.vehicleId === "J-02")!;
    expect(c.departure).toBe(hm(12));
    expect(c.meetsDeadline).toBe(true);
    expect(() => demoReducer(state, { type: "ACCEPT_SUGGESTION", suggestionId: variant.id, reason: "" })).toThrow(/indoklás/);
    state = demoReducer(state, { type: "ACCEPT_SUGGESTION", suggestionId: variant.id, reason: "A csapat tartalékban marad" });
    expect(state.decisions[0].action).toBe("modified");
    expect(currentPlan(state).assignments.find((a) => a.taskId === URGENT_EVENT_TASK_ID)?.vehicleId).toBe("J-02");
    // J-01 megtartja a saját feladatát.
    expect(currentPlan(state).assignments.find((a) => a.taskId === "F-2026-097")?.vehicleId).toBe("J-01");
  });

  it("a diszpécseri változat elvethető, az optimalizálói javaslat nyitva marad", () => {
    let state = withSuggestion();
    state = demoReducer(state, { type: "CREATE_VARIANT", taskId: URGENT_EVENT_TASK_ID, vehicleId: "J-02", departure: null });
    const variant = state.suggestions[state.suggestions.length - 1];
    state = demoReducer(state, { type: "DISCARD_VARIANT", suggestionId: variant.id });
    expect(state.suggestions.map((s) => s.status)).toEqual(["open", "superseded"]);
    expect(state.currentPlanId).toBe(MORNING_PLAN_ID);
  });

  it("elavult (korábbi tervre épülő) javaslat nem fogadható el", () => {
    let state = withSuggestion();
    const oldId = state.suggestions[0].id;
    state = demoReducer(state, { type: "REQUEST_SUGGESTION", taskId: "F-2026-099" });
    state = demoReducer(state, { type: "ACCEPT_SUGGESTION", suggestionId: state.suggestions[1].id, reason: "" });
    expect(() => demoReducer(state, { type: "ACCEPT_SUGGESTION", suggestionId: oldId, reason: "" })).toThrow(/korábbi tervverzióra/);
  });
});

describe("8. felvételi helytörzs", () => {
  it("új budapesti felvételi hely hozzáadható, a koordináta a kerületből becsülhető", () => {
    const state = createSeedState();
    const next = demoReducer(state, {
      type: "ADD_PICKUP_LOCATION",
      input: { name: "Demó Magánklinika", address: "1036 Budapest, Lajos u. 1.", kind: "hospital" },
    });
    expect(next.pickupLocations).toHaveLength(state.pickupLocations.length + 1);
    const added = next.pickupLocations[next.pickupLocations.length - 1];
    expect(added).toMatchObject({ id: "P-013", active: true, verification: "unverified", createdBy: "dispatcher", coordsApproximated: true });
    expect(added.coords.lat).toBeGreaterThan(47.5);
  });

  it("nem budapesti vagy duplikált cím elutasítva", () => {
    const state = createSeedState();
    expect(() =>
      demoReducer(state, { type: "ADD_PICKUP_LOCATION", input: { name: "Vidéki pont", address: "2141 Csömör, Fő u. 2.", kind: "other" } }),
    ).toThrow(DemoActionError);
    expect(() =>
      demoReducer(state, { type: "ADD_PICKUP_LOCATION", input: { name: "Duplikátum", address: "1115 Budapest, Tétényi út 12–16.", kind: "hospital" } }),
    ).toThrow(/már szerepel/);
  });

  it("az új hely sürgős feladat felvételi helyeként használható", () => {
    let state = demoReducer(createSeedState(), {
      type: "ADD_PICKUP_LOCATION",
      input: { name: "Új pont", address: "1045 Budapest, Megyeri út 10.", kind: "other" },
    });
    const id = state.pickupLocations[state.pickupLocations.length - 1].id;
    state = demoReducer(state, { type: "CREATE_URGENT_TASK", pickupLocationId: id });
    const task = state.tasks[state.tasks.length - 1];
    expect(task.id).toBe("F-2026-101");
    state = demoReducer(state, { type: "REQUEST_SUGGESTION", taskId: task.id });
    expect(state.suggestions[0].chosenVehicleId).toBe("J-01");
  });
});

describe("9. demó visszaállítása", () => {
  it("a visszaállítás az eredeti seed állapotot tölti vissza", () => {
    let state = withSuggestion();
    state = demoReducer(state, { type: "ACCEPT_SUGGESTION", suggestionId: state.suggestions[0].id, reason: "" });
    state = demoReducer(state, {
      type: "ADD_PICKUP_LOCATION",
      input: { name: "Ideiglenes", address: "1145 Budapest, Teszt u. 1.", kind: "other" },
    });
    const reset = demoReducer(state, { type: "RESET" });
    expect(reset).toEqual(createSeedState());
    expect(reset.planVersions).toHaveLength(1);
    expect(reset.urgentEventLoaded).toBe(false);
  });

  it("a seed determinisztikus és nem osztozik referencián", () => {
    const a = createSeedState();
    const b = createSeedState();
    expect(a).toEqual(b);
    a.tasks[0].status = "new";
    expect(b.tasks[0].status).toBe("completed");
  });
});

describe("státuszok és reggeli terv", () => {
  it("a reggeli terv 07:00-kor a telephelyről indul, minden feladat időben", () => {
    const state = createSeedState();
    const plan = currentPlan(state);
    for (const v of state.vehicles) {
      const first = plan.assignments.filter((a) => a.vehicleId === v.id).sort((x, y) => x.departure - y.departure)[0];
      expect(first.departureFromLocationId).toBe("L-TELEPHELY");
      expect(first.departure).toBeGreaterThanOrEqual(hm(7));
    }
    expect(plan.assignments.some((a) => a.taskId === "F-2026-099")).toBe(false);
  });

  it("a terepi csúszás késésveszélyt jelez", () => {
    const state = createSeedState();
    expect(displayStatus(state, state.tasks.find((t) => t.id === "F-2026-096")!)).toBe("at_risk");
    expect(displayStatus(state, state.tasks.find((t) => t.id === "F-2026-098")!)).toBe("manually_locked");
  });

  it("simulateSequence nem ejti ki a rögzített feladatot", () => {
    const state = createSeedState();
    const ctx = buildContext(state);
    const pinned = ctx.tasks.find((t) => t.id === "F-2026-098")!;
    const sim = simulateSequence(ctx, "J-01", { locationId: "L-BOCSKAI", time: hm(14, 30) }, [
      { task: pinned, role: "pinned", fixedServiceStart: hm(14, 5), source: "morning_plan" },
    ]);
    expect(sim.placed).toHaveLength(1);
    expect(sim.pinnedConflicts.length).toBe(1);
  });
});

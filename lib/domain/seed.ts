/**
 * Anonimizált demó-munkanap (seed).
 *
 * Forrás: DECISIONS_LOG D-08, D-09; PRODUCT_DOMAIN_SPEC_v0.1 28–29. fejezet;
 * RESEARCH_LOG R-11, R-13. A koordináták közelítő demóadatok. Az
 * időablakok és szolgáltatási idők demó-paraméterek, nem validált szakmai
 * szabályok (OPEN_QUESTIONS Q-05, Q-21, Q-22).
 */
import { buildContext, buildMorningAssignments } from "./schedule";
import { hm } from "./time";
import type { Crew, DemoState, Location, PickupLocation, Shift, Task, Vehicle } from "./types";

export const SCHEMA_VERSION = 3;
export const DEMO_NOW = hm(11, 22);
export const URGENT_EVENT_TASK_ID = "F-2026-100";
export const MORNING_PLAN_ID = "PV-1";

const OFFICE_HOURS = { label: "H–P 08:00–16:00", start: hm(8), end: hm(16), days: "hétfő–péntek" };

export const SEED_LOCATIONS: Location[] = [
  {
    id: "L-TELEPHELY",
    name: "Telephely",
    shortName: "Telephely",
    address: "Budapest XVII., Ferihegyi út 47.",
    kind: "depot",
    coords: { lat: 47.4856, lng: 19.253 },
    internal: true,
    note: "Reggeli indulás, járművek alaphelye, napi visszaérkezés, pénz és iratok leadása. Belső operatív adat.",
  },
  {
    id: "L-BOCSKAI",
    name: "Halottasházi / hűtési pont",
    shortName: "Bocskai u. 56.",
    address: "Budapest XVII., Bocskai István u. 56.",
    kind: "cold_storage",
    coords: { lat: 47.4905, lng: 19.278 },
    internal: true,
    note: "Belső operatív adat. Nyilvános AEVUM-cégkapcsolat nem állítható.",
  },
  {
    id: "L-CSOMOR",
    name: "Csömöri Sírkert és Hamvasztóüzem",
    shortName: "Csömöri Hamvasztó",
    address: "2141 Csömör, Főnix u. 1.",
    kind: "crematorium",
    coords: { lat: 47.542, lng: 19.221 },
    internal: false,
    note: "Hamvasztási célpont (Q-22: célhely ANSWERED, időablakok validálandók).",
  },
  {
    id: "L-IRODA-DEMBINSZKY",
    name: "AEVUM-iroda · Dembinszky utca",
    shortName: "Iroda · Dembinszky u.",
    address: "1071 Budapest, Dembinszky u. 44.",
    kind: "office",
    coords: { lat: 47.5065, lng: 19.079 },
    openingHours: OFFICE_HOURS,
    internal: false,
    note: "Központi iroda (R-11).",
  },
  {
    id: "L-IRODA-ARPAD",
    name: "AEVUM-iroda · Árpád út",
    shortName: "Iroda · Árpád út",
    address: "1042 Budapest, Árpád út 88.",
    kind: "office",
    coords: { lat: 47.561, lng: 19.088 },
    openingHours: OFFICE_HOURS,
    internal: false,
    note: "Újpest (R-11).",
  },
  {
    id: "L-IRODA-PAPKAROLY",
    name: "AEVUM-iroda · Pap Károly utca",
    shortName: "Iroda · Pap Károly u.",
    address: "1139 Budapest, Pap Károly u. 12.",
    kind: "office",
    coords: { lat: 47.533, lng: 19.073 },
    openingHours: OFFICE_HOURS,
    internal: false,
    note: "Angyalföld (R-11).",
  },
  {
    id: "L-IRODA-BECSI",
    name: "AEVUM-iroda · Bécsi út",
    shortName: "Iroda · Bécsi út",
    address: "1032 Budapest, Bécsi út 141–143.",
    kind: "office",
    coords: { lat: 47.5415, lng: 19.0345 },
    openingHours: OFFICE_HOURS,
    internal: false,
    note: "Óbuda (R-11).",
  },
];

function seedPickup(
  id: string,
  name: string,
  shortName: string,
  address: string,
  kind: PickupLocation["kind"],
  lat: number,
  lng: number,
): PickupLocation {
  return {
    id,
    name,
    shortName,
    address,
    kind,
    coords: { lat, lng },
    coordsApproximated: false,
    accessNote: "Átvételi pont, belépési rend és dokumentumigény intézményenként validálandó (Q-21).",
    timeWindow: null,
    dataSource: "Termékgazdai demó-mintapont (R-13) · nem szerződéses partner",
    verification: "demo_seed",
    lastCheckedLabel: "Nem ellenőrzött",
    active: true,
    createdBy: "seed",
  };
}

export const SEED_PICKUP_LOCATIONS: PickupLocation[] = [
  seedPickup("P-001", "Uzsoki Utcai Kórház", "Uzsoki Kórház", "1145 Budapest, Róna u. 196–212.", "hospital", 47.513, 19.113),
  seedPickup("P-002", "Bajcsy-Zsilinszky Kórház", "Bajcsy Kórház", "1106 Budapest, Maglódi út 89–91.", "hospital", 47.48, 19.133),
  seedPickup("P-003", "Péterfy Sándor Utcai Kórház", "Péterfy Kórház", "1076 Budapest, Péterfy Sándor u. 8–20.", "hospital", 47.501, 19.08),
  seedPickup("P-004", "Semmelweis I. Sz. Patológia", "Semmelweis I. Patológia", "1085 Budapest, Üllői út 26.", "pathology", 47.487, 19.068),
  seedPickup("P-005", "Semmelweis kegyeleti iroda", "Semmelweis kegyeleti iroda", "1091 Budapest, Lenhossék u. 42.", "funeral_admin", 47.48, 19.087),
  seedPickup("P-006", "Dél-pesti Centrumkórház, Szent István telephely", "Szent István telephely", "1097 Budapest, Nagyvárad tér 1.", "hospital", 47.478, 19.092),
  seedPickup("P-007", "Szent Imre Egyetemi Oktatókórház", "Szent Imre Kórház", "1115 Budapest, Tétényi út 12–16.", "hospital", 47.464, 19.028),
  seedPickup("P-008", "Szent János Centrumkórház", "Szent János Kórház", "1125 Budapest, Diós árok 1–3.", "hospital", 47.506, 19.007),
  seedPickup("P-009", "Szent Margit Kórház", "Szent Margit Kórház", "1032 Budapest, Bécsi út 132.", "hospital", 47.535, 19.036),
  seedPickup("P-010", "Nyírő Gyula OPAI", "Nyírő Gyula OPAI", "1135 Budapest, Lehel u. 59–61.", "hospital", 47.527, 19.072),
  seedPickup("P-011", "Jahn Ferenc Dél-pesti Kórház", "Jahn Ferenc Kórház", "1204 Budapest, Köves u. 1.", "hospital", 47.429, 19.119),
  seedPickup("P-012", "Heim Pál Gyermekkórház", "Heim Pál Gyermekkórház", "1089 Budapest, Üllői út 86.", "hospital", 47.483, 19.08),
];

export const SEED_VEHICLES: Vehicle[] = [
  {
    id: "J-01",
    name: "J-01",
    kind: "duty_transport",
    kindLabel: "Ügyeleti szállító jármű",
    capabilities: ["deceased_transport"],
    defaultCrewId: "A",
    depotLocationId: "L-TELEPHELY",
    color: "#0f766e",
    note: "Ügyeleti jármű; 07:00–15:00 között napi feladatokat is végez.",
  },
  {
    id: "J-02",
    name: "J-02",
    kind: "day_transport",
    kindLabel: "Nappali szállító jármű",
    capabilities: ["deceased_transport"],
    defaultCrewId: "B",
    depotLocationId: "L-TELEPHELY",
    color: "#3f5aa6",
    note: "Nappali szállítás 07:00–15:00, műszakvégre vissza a telephelyre.",
  },
  {
    id: "J-03",
    name: "J-03",
    kind: "small_logistics",
    kindLabel: "Kis logisztikai jármű",
    capabilities: ["urn_logistics", "cash_documents"],
    defaultCrewId: "C",
    depotLocationId: "L-TELEPHELY",
    color: "#8a5a9e",
    note: "Urnák az irodákba, pénz és iratok vissza a telephelyre. Elhunyt szállítására a demó-konfigurációban nem használható.",
  },
];

export const SEED_CREWS: Crew[] = [
  { id: "A", name: "A csapat", memberCodes: ["A-1", "A-2"], defaultVehicleId: "J-01", shiftId: "S-A" },
  { id: "B", name: "B csapat", memberCodes: ["B-1", "B-2"], defaultVehicleId: "J-02", shiftId: "S-B" },
  { id: "C", name: "C csapat", memberCodes: ["C-1"], defaultVehicleId: "J-03", shiftId: "S-C" },
];

export const SEED_SHIFTS: Shift[] = [
  {
    id: "S-A",
    crewId: "A",
    label: "Ügyelet ma 07:00 – holnap 07:00",
    start: hm(7),
    end: hm(31),
    dayTaskWindow: { start: hm(7), end: hm(15) },
    onCall: true,
    mustReturnToDepotByEnd: false,
  },
  {
    id: "S-B",
    crewId: "B",
    label: "Nappal 07:00–15:00",
    start: hm(7),
    end: hm(15),
    dayTaskWindow: { start: hm(7), end: hm(15) },
    onCall: false,
    mustReturnToDepotByEnd: true,
  },
  {
    id: "S-C",
    crewId: "C",
    label: "Nappal 07:00–15:00",
    start: hm(7),
    end: hm(15),
    dayTaskWindow: { start: hm(7), end: hm(15) },
    onCall: false,
    mustReturnToDepotByEnd: true,
  },
];

const DECEASED = { requiredCapability: "deceased_transport" as const, requiredCrewSize: 2 };

export const SEED_TASKS: Task[] = [
  {
    id: "F-2026-091",
    type: "planned_institutional_transfer",
    priority: "normal",
    fromLocationId: "P-001",
    toLocationId: "L-BOCSKAI",
    reportedAt: hm(6, 30),
    earliestStart: hm(7, 30),
    latestArrival: null,
    serviceAtFrom: 30,
    serviceAtTo: 20,
    ...DECEASED,
    status: "completed",
    note: "Előző napról ütemezett intézményi átvétel.",
  },
  {
    id: "F-2026-092",
    type: "cremation_transfer",
    priority: "normal",
    fromLocationId: "L-BOCSKAI",
    toLocationId: "L-CSOMOR",
    reportedAt: hm(6, 30),
    earliestStart: hm(7, 20),
    latestArrival: null,
    serviceAtFrom: 20,
    serviceAtTo: 20,
    ...DECEASED,
    status: "completed",
    note: "Bocskai → Csömör hamvasztási szállítás.",
  },
  {
    id: "F-2026-093",
    type: "planned_institutional_transfer",
    priority: "normal",
    fromLocationId: "P-002",
    toLocationId: "L-BOCSKAI",
    reportedAt: hm(6, 30),
    earliestStart: hm(10, 30),
    latestArrival: hm(11),
    serviceAtFrom: 30,
    serviceAtTo: 20,
    ...DECEASED,
    status: "in_progress",
    note: "Intézményi átvétel egyeztetett idősávban (demó-időablak).",
  },
  {
    id: "F-2026-094",
    type: "urn_pickup",
    priority: "normal",
    fromLocationId: "L-CSOMOR",
    toLocationId: "L-CSOMOR",
    reportedAt: hm(6, 30),
    earliestStart: hm(8),
    latestArrival: null,
    serviceAtFrom: 20,
    serviceAtTo: 0,
    requiredCapability: "urn_logistics",
    requiredCrewSize: 1,
    status: "completed",
    note: "Urna átvétele a hamvasztóüzemben.",
  },
  {
    id: "F-2026-095",
    type: "urn_delivery",
    priority: "normal",
    fromLocationId: "L-CSOMOR",
    toLocationId: "L-IRODA-DEMBINSZKY",
    reportedAt: hm(6, 30),
    earliestStart: null,
    latestArrival: null,
    serviceAtFrom: 0,
    serviceAtTo: 15,
    requiredCapability: "urn_logistics",
    requiredCrewSize: 1,
    status: "completed",
    note: "Urna kiszállítása a központi irodába.",
  },
  {
    id: "F-2026-096",
    type: "cash_documents_return",
    priority: "normal",
    fromLocationId: "L-IRODA-ARPAD",
    toLocationId: "L-TELEPHELY",
    reportedAt: hm(6, 30),
    earliestStart: hm(11, 15),
    latestArrival: hm(11, 30),
    serviceAtFrom: 15,
    serviceAtTo: 10,
    requiredCapability: "cash_documents",
    requiredCrewSize: 1,
    status: "in_progress",
    note: "Pénz és kapcsolódó iratok átvétele az irodától (demó-átadási sáv 11:15–11:30).",
    reportedDelayMinutes: 9,
    fieldNote: "Terepi jelzés 11:10: forgalmi torlódás, +9 perc (szimulált).",
  },
  {
    id: "F-2026-097",
    type: "planned_institutional_transfer",
    priority: "low",
    fromLocationId: "P-010",
    toLocationId: "L-BOCSKAI",
    reportedAt: hm(6, 30),
    earliestStart: hm(12, 30),
    latestArrival: hm(14),
    serviceAtFrom: 30,
    serviceAtTo: 20,
    ...DECEASED,
    status: "approved",
    note: "Rugalmas intézményi átvétel 12:30–14:00 között; más szállító járműre áthelyezhető.",
  },
  {
    id: "F-2026-098",
    type: "cremation_transfer",
    priority: "normal",
    fromLocationId: "L-BOCSKAI",
    toLocationId: "L-CSOMOR",
    reportedAt: hm(6, 30),
    earliestStart: null,
    latestArrival: null,
    serviceAtFrom: 15,
    serviceAtTo: 15,
    ...DECEASED,
    status: "manually_locked",
    note: "Bocskai → Csömör hamvasztási szállítás egyeztetett átadással.",
    lockReason: "A diszpécser rögzítette: a hamvasztóüzemmel egyeztetett átadási időpont (demó).",
  },
  {
    id: "F-2026-099",
    type: "urn_delivery",
    priority: "normal",
    fromLocationId: "L-CSOMOR",
    toLocationId: "L-IRODA-BECSI",
    reportedAt: hm(10, 5),
    earliestStart: hm(12, 30),
    latestArrival: null,
    serviceAtFrom: 15,
    serviceAtTo: 15,
    requiredCapability: "urn_logistics",
    requiredCrewSize: 1,
    status: "unassigned",
    note: "10:05-kor rögzített igény: urna átvétele Csömörön, kiszállítás az óbudai irodába.",
  },
];

const MORNING_ORDER: Record<string, { taskId: string; fixedServiceStart?: number }[]> = {
  "J-01": [{ taskId: "F-2026-091" }, { taskId: "F-2026-097" }, { taskId: "F-2026-098", fixedServiceStart: hm(14, 5) }],
  "J-02": [{ taskId: "F-2026-092" }, { taskId: "F-2026-093" }],
  "J-03": [{ taskId: "F-2026-094" }, { taskId: "F-2026-095" }, { taskId: "F-2026-096" }],
};

/** 11:22-es sürgős haláleseti felvétel (Szent Imre → Bocskai). */
export function createUrgentEventTask(id = URGENT_EVENT_TASK_ID, pickupLocationId = "P-007", now = DEMO_NOW): Task {
  return {
    id,
    type: "urgent_death_pickup",
    priority: "urgent",
    fromLocationId: pickupLocationId,
    toLocationId: "L-BOCSKAI",
    reportedAt: now,
    earliestStart: null,
    latestArrival: now + 120,
    serviceAtFrom: 30,
    serviceAtTo: 15,
    ...DECEASED,
    status: "new",
    note: "Új haláleseti bejelentés. Kiérkezési határ a felvételi címre: bejelentéstől 2 óra.",
  };
}

export function createSeedState(): DemoState {
  const base = {
    now: DEMO_NOW,
    vehicles: SEED_VEHICLES,
    crews: SEED_CREWS,
    shifts: SEED_SHIFTS,
    tasks: SEED_TASKS,
    locations: SEED_LOCATIONS,
    pickupLocations: SEED_PICKUP_LOCATIONS,
  };
  // A reggeli terv 07:00-kor készült, még egyik feladat sem indult el.
  const morningCtx = buildContext(base, {
    now: hm(7),
    tasks: SEED_TASKS.map((t) => ({ ...t, status: t.status === "manually_locked" ? t.status : "approved" })),
  });
  const assignments = buildMorningAssignments(morningCtx, MORNING_ORDER);

  // Mély másolat, hogy a seed konstansok sose módosuljanak.
  return structuredClone({
    schemaVersion: SCHEMA_VERSION,
    dayLabel: "2026. szeptember 29., kedd",
    ...base,
    planVersions: [
      {
        id: MORNING_PLAN_ID,
        label: "Reggeli terv",
        kind: "morning",
        createdAt: hm(7),
        basedOnPlanId: null,
        assignments,
        decisionId: null,
      },
    ],
    morningPlanId: MORNING_PLAN_ID,
    currentPlanId: MORNING_PLAN_ID,
    suggestions: [],
    decisions: [],
    urgentEventLoaded: false,
    counters: { task: 100, suggestion: 0, decision: 0, plan: 1, pickup: SEED_PICKUP_LOCATIONS.length },
  } satisfies DemoState);
}

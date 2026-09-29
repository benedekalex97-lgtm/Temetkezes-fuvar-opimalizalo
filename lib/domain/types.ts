/**
 * Demo v0.1 domainmodell.
 *
 * Az időpontok a szimulált munkanap éjfélétől számított percek (Minutes).
 * 1440 feletti érték a következő napot jelenti (pl. 1860 = holnap 07:00).
 *
 * Adatminimalizálás (D-05): a modell kizárólag belső azonosítókat,
 * koordinátákat és operatív paramétereket tartalmaz. Elhunytra vagy
 * hozzátartozóra vonatkozó adat nem szerepel benne.
 */

export type Minutes = number;

export interface Coordinates {
  lat: number;
  lng: number;
}

// ---------------------------------------------------------------------------
// Erőforrások
// ---------------------------------------------------------------------------

export type VehicleKind = "duty_transport" | "day_transport" | "small_logistics";

/** Demó-konfigurációban beállított járműképesség. */
export type Capability = "deceased_transport" | "urn_logistics" | "cash_documents";

export interface Vehicle {
  id: string;
  name: string;
  kind: VehicleKind;
  kindLabel: string;
  capabilities: Capability[];
  defaultCrewId: string;
  depotLocationId: string;
  /** Útvonalszín a térképen és az idővonalon. */
  color: string;
  note: string;
}

export interface Crew {
  id: string;
  name: string;
  /** Anonim belső kódok, nem nevek. */
  memberCodes: string[];
  defaultVehicleId: string;
  shiftId: string;
}

export interface Shift {
  id: string;
  crewId: string;
  label: string;
  start: Minutes;
  end: Minutes;
  /** Napi (nem ügyeleti) feladatok végzésének ablaka. */
  dayTaskWindow: { start: Minutes; end: Minutes };
  /** Ügyeleti műszak: sürgős haláleseti felvétel a teljes műszakban vállalható. */
  onCall: boolean;
  /** A műszak végéig a telephelyre vissza kell érni. */
  mustReturnToDepotByEnd: boolean;
}

// ---------------------------------------------------------------------------
// Helyszínek
// ---------------------------------------------------------------------------

export type OperationalLocationKind = "depot" | "cold_storage" | "crematorium" | "office";

export interface Location {
  id: string;
  name: string;
  shortName: string;
  address: string;
  kind: OperationalLocationKind;
  coords: Coordinates;
  openingHours?: { label: string; start: Minutes; end: Minutes; days: string };
  /** Belső operatív adat, nyilvános cégkapcsolatként nem állítható (D-09). */
  internal: boolean;
  note: string;
}

export type PickupLocationKind = "hospital" | "pathology" | "funeral_admin" | "other";

export type VerificationStatus = "demo_seed" | "unverified" | "verified_by_dispatcher";

export interface PickupLocation {
  id: string;
  name: string;
  shortName: string;
  address: string;
  kind: PickupLocationKind;
  coords: Coordinates;
  /** Igaz, ha a koordináta a kerületközéppontból becsült. */
  coordsApproximated: boolean;
  accessNote: string;
  timeWindow: { start: Minutes; end: Minutes } | null;
  dataSource: string;
  verification: VerificationStatus;
  lastCheckedLabel: string;
  active: boolean;
  createdBy: "seed" | "dispatcher";
}

export type AnyLocation =
  | ({ registry: "operational" } & Location)
  | ({ registry: "pickup" } & PickupLocation);

// ---------------------------------------------------------------------------
// Feladatok
// ---------------------------------------------------------------------------

export type TaskType =
  | "urgent_death_pickup"
  | "planned_institutional_transfer"
  | "cremation_transfer"
  | "urn_pickup"
  | "urn_delivery"
  | "cash_documents_return";

export type Priority = "urgent" | "high" | "normal" | "low";

/**
 * Tárolt munkafolyamat-státusz. A „Késésveszély” származtatott jelzés
 * (lásd `deriveRisk`), nem tárolt állapot.
 */
export type TaskStatus =
  | "new"
  | "unassigned"
  | "suggested"
  | "approved"
  | "in_progress"
  | "completed"
  | "manually_locked";

export type DisplayStatus = TaskStatus | "at_risk";

export interface Task {
  id: string;
  type: TaskType;
  priority: Priority;
  fromLocationId: string;
  /** Egyállomásos feladatnál azonos a fromLocationId-val. */
  toLocationId: string;
  reportedAt: Minutes;
  /** Legkorábbi szolgáltatáskezdés a felvételi helyen. */
  earliestStart: Minutes | null;
  /** Legkésőbbi kiérkezés a felvételi helyre (pl. 2 órás határ). */
  latestArrival: Minutes | null;
  serviceAtFrom: number;
  serviceAtTo: number;
  requiredCapability: Capability;
  requiredCrewSize: number;
  status: TaskStatus;
  /** Rövid, személyes adatot nem tartalmazó operatív megjegyzés. */
  note: string;
  lockReason?: string;
  /** Terepről jelzett csúszás percben (szimulált). A tervet nem írja át. */
  reportedDelayMinutes?: number;
  fieldNote?: string;
}

// ---------------------------------------------------------------------------
// Terv, javaslat, döntés
// ---------------------------------------------------------------------------

export type AssignmentSource = "morning_plan" | "optimizer" | "dispatcher";

export interface Assignment {
  taskId: string;
  vehicleId: string;
  crewId: string;
  departureFromLocationId: string;
  departure: Minutes;
  arrivalAtFrom: Minutes;
  serviceStart: Minutes;
  arrivalAtTo: Minutes;
  end: Minutes;
  source: AssignmentSource;
}

export type PlanKind = "morning" | "approved";

export interface PlanVersion {
  id: string;
  label: string;
  kind: PlanKind;
  createdAt: Minutes;
  basedOnPlanId: string | null;
  assignments: Assignment[];
  /** A tervet létrehozó diszpécseri döntés (reggeli tervnél null). */
  decisionId: string | null;
}

export type WarningLevel = "info" | "warning" | "critical";

export interface SuggestionWarning {
  level: WarningLevel;
  message: string;
}

export interface CandidateEvaluation {
  vehicleId: string;
  crewId: string;
  eligible: boolean;
  ineligibleReasons: string[];
  feasible: boolean;
  infeasibleReasons: string[];
  departureFromLocationId: string | null;
  departure: Minutes | null;
  arrivalAtFrom: Minutes | null;
  deadline: Minutes | null;
  slackMinutes: number | null;
  meetsDeadline: boolean;
  end: Minutes | null;
  returnToDepotAt: Minutes | null;
  displacedTaskIds: string[];
  moves: TaskMove[];
  unresolvedTaskIds: string[];
  warnings: SuggestionWarning[];
}

export interface TaskMove {
  taskId: string;
  fromVehicleId: string;
  toVehicleId: string;
  newArrivalAtFrom: Minutes;
  newEnd: Minutes;
  fitsShift: boolean;
  returnToDepotAt: Minutes | null;
  shiftEnd: Minutes;
}

export interface VehicleImpact {
  vehicleId: string;
  before: { taskIds: string[]; returnToDepotAt: Minutes | null };
  after: { taskIds: string[]; returnToDepotAt: Minutes | null };
  shiftEnd: Minutes;
  marginMinutes: number | null;
}

export interface OptimizationSuggestion {
  id: string;
  taskId: string;
  createdAt: Minutes;
  basePlanId: string;
  origin: "optimizer" | "dispatcher_variant";
  /** Diszpécseri változatnál a kért paraméterek. */
  requested: { vehicleId: string | null; departure: Minutes | null } | null;
  feasible: boolean;
  chosenVehicleId: string | null;
  candidates: CandidateEvaluation[];
  proposedAssignments: Assignment[];
  unassignedTaskIds: string[];
  rationale: string[];
  warnings: SuggestionWarning[];
  impacts: VehicleImpact[];
  status: "open" | "accepted" | "rejected" | "superseded";
}

export type DecisionAction = "accepted" | "modified" | "rejected";

export interface DispatcherDecision {
  id: string;
  suggestionId: string;
  taskId: string;
  action: DecisionAction;
  decidedAt: Minutes;
  reason: string;
  resultingPlanId: string | null;
}

// ---------------------------------------------------------------------------
// Demóállapot
// ---------------------------------------------------------------------------

export interface DemoState {
  schemaVersion: number;
  dayLabel: string;
  now: Minutes;
  vehicles: Vehicle[];
  crews: Crew[];
  shifts: Shift[];
  locations: Location[];
  pickupLocations: PickupLocation[];
  tasks: Task[];
  planVersions: PlanVersion[];
  morningPlanId: string;
  currentPlanId: string;
  suggestions: OptimizationSuggestion[];
  decisions: DispatcherDecision[];
  urgentEventLoaded: boolean;
  counters: { task: number; suggestion: number; decision: number; plan: number; pickup: number };
}

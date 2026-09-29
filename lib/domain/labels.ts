import type {
  Capability,
  DecisionAction,
  DisplayStatus,
  OperationalLocationKind,
  PickupLocationKind,
  Priority,
  TaskType,
  VerificationStatus,
} from "./types";

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  urgent_death_pickup: "Haláleseti felvétel",
  planned_institutional_transfer: "Tervezett intézményi szállítás",
  cremation_transfer: "Hamvasztási szállítás",
  urn_pickup: "Urna átvétele",
  urn_delivery: "Urna kiszállítása irodába",
  cash_documents_return: "Pénz és iratok visszaszállítása",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: "Sürgős",
  high: "Magas",
  normal: "Normál",
  low: "Alacsony · áthelyezhető",
};

export const PRIORITY_RANK: Record<Priority, number> = {
  urgent: 3,
  high: 2,
  normal: 1,
  low: 0,
};

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  new: "Új",
  unassigned: "Kiosztatlan",
  suggested: "Javaslat készült",
  approved: "Jóváhagyva",
  in_progress: "Folyamatban",
  completed: "Teljesítve",
  at_risk: "Késésveszély",
  manually_locked: "Kézzel rögzítve",
};

export const STATUS_ORDER: DisplayStatus[] = [
  "new",
  "unassigned",
  "suggested",
  "approved",
  "in_progress",
  "completed",
  "at_risk",
  "manually_locked",
];

export const CAPABILITY_LABEL: Record<Capability, string> = {
  deceased_transport: "Elhunyt szállítása",
  urn_logistics: "Urnalogisztika",
  cash_documents: "Pénz- és iratszállítás",
};

export const OPERATIONAL_KIND_LABEL: Record<OperationalLocationKind, string> = {
  depot: "Telephely",
  cold_storage: "Halottasházi / hűtési pont",
  crematorium: "Hamvasztó",
  office: "AEVUM-iroda",
};

export const PICKUP_KIND_LABEL: Record<PickupLocationKind, string> = {
  hospital: "Kórház",
  pathology: "Patológia",
  funeral_admin: "Kegyeleti iroda",
  other: "Egyéb felvételi pont",
};

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  demo_seed: "Demó mintapont · nem validált",
  unverified: "Új · ellenőrzésre vár",
  verified_by_dispatcher: "Diszpécser által ellenőrizve",
};

export const DECISION_LABEL: Record<DecisionAction, string> = {
  accepted: "Elfogadva",
  modified: "Módosítva és jóváhagyva",
  rejected: "Elutasítva",
};

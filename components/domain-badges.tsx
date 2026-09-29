"use client";

import { AlertTriangle, CheckCircle2, CircleDashed, Clock3, Loader, Lock, Sparkles, Siren, Inbox } from "lucide-react";
import { PRIORITY_LABEL, STATUS_LABEL } from "@/lib/domain/labels";
import type { DisplayStatus, Priority, Vehicle } from "@/lib/domain/types";
import { Badge, cx, type Tone } from "./ui";

const STATUS_TONE: Record<DisplayStatus, Tone> = {
  new: "urgent",
  unassigned: "warn",
  suggested: "primary",
  approved: "ok",
  in_progress: "primary",
  completed: "muted",
  at_risk: "warn",
  manually_locked: "neutral",
};

const STATUS_ICON: Record<DisplayStatus, React.ReactNode> = {
  new: <Siren size={12} />,
  unassigned: <Inbox size={12} />,
  suggested: <Sparkles size={12} />,
  approved: <CheckCircle2 size={12} />,
  in_progress: <Loader size={12} />,
  completed: <CheckCircle2 size={12} />,
  at_risk: <AlertTriangle size={12} />,
  manually_locked: <Lock size={12} />,
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <Badge tone={STATUS_TONE[status]} icon={STATUS_ICON[status]}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  const tone: Tone = priority === "urgent" ? "urgent" : priority === "low" ? "muted" : "neutral";
  return (
    <Badge tone={tone} icon={priority === "urgent" ? <Siren size={12} /> : priority === "low" ? <CircleDashed size={12} /> : <Clock3 size={12} />}>
      {PRIORITY_LABEL[priority]}
    </Badge>
  );
}

export function VehicleTag({ vehicle, crewName, className }: { vehicle: Vehicle; crewName?: string; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]", className)}>
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: vehicle.color }} aria-hidden />
      <span className="font-mono text-[12.5px] font-semibold">{vehicle.id}</span>
      {crewName && <span className="text-ink-3">· {crewName}</span>}
    </span>
  );
}

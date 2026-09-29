"use client";

import { AlarmClock, AlertTriangle, Hourglass, Inbox, Truck, Users } from "lucide-react";
import type { ReactNode } from "react";
import { useDemoState } from "@/lib/client/demo-store";
import { dashboardKpis } from "@/lib/domain/selectors";
import { formatClock, formatDuration } from "@/lib/domain/time";
import { useApp } from "../app-context";
import { cx } from "../ui";

function Kpi({
  label,
  value,
  detail,
  icon,
  tone = "neutral",
  onClick,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon: ReactNode;
  tone?: "neutral" | "urgent" | "warn";
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cx(
        "flex min-w-0 flex-col rounded-xl border bg-surface px-3.5 py-3 text-left shadow-card",
        tone === "urgent" ? "border-urgent-line" : tone === "warn" ? "border-warn-line" : "border-line",
        onClick && "transition-colors hover:bg-subtle",
      )}
    >
      <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink-3">
        <span className={tone === "urgent" ? "text-urgent" : tone === "warn" ? "text-warn" : "text-primary"}>{icon}</span>
        {label}
      </span>
      <span
        className={cx(
          "mt-1 text-[22px] font-semibold leading-7 tabular",
          tone === "urgent" ? "text-urgent" : tone === "warn" ? "text-warn" : "text-ink",
        )}
      >
        {value}
      </span>
      {detail && <span className="mt-0.5 truncate text-[12px] text-ink-3">{detail}</span>}
    </Tag>
  );
}

export function KpiRow() {
  const state = useDemoState();
  const { openTask } = useApp();
  const k = dashboardKpis(state);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <Kpi icon={<Users size={14} />} label="Szolgálatban lévő csapatok" value={`${k.crewsOnDuty} / ${k.crewsTotal}`} detail="A · B · C csapat" />
      <Kpi icon={<Truck size={14} />} label="Aktív járművek" value={`${k.activeVehicles} / ${k.vehiclesTotal}`} detail="úton vagy hátralévő feladattal" />
      <Kpi
        icon={<AlertTriangle size={14} />}
        label="Sürgős / veszélyeztetett"
        value={k.urgentOrAtRisk.length}
        detail={k.urgentOrAtRisk.map((t) => t.id).join(", ") || "nincs"}
        tone={k.urgentOrAtRisk.length ? "urgent" : "neutral"}
        onClick={k.urgentOrAtRisk[0] ? () => openTask(k.urgentOrAtRisk[0].id) : undefined}
      />
      <Kpi
        icon={<Inbox size={14} />}
        label="Kiosztatlan feladatok"
        value={k.unassigned.length}
        detail={k.unassigned.map((t) => t.id).join(", ") || "minden feladat kiosztva"}
        tone={k.unassigned.length ? "warn" : "neutral"}
        onClick={k.unassigned[0] ? () => openTask(k.unassigned[0].id) : undefined}
      />
      <Kpi
        icon={<AlarmClock size={14} />}
        label="Következő határidő"
        value={k.nextDeadline ? formatClock(k.nextDeadline.at) : "—"}
        detail={k.nextDeadline ? `${k.nextDeadline.task.id} · ${formatDuration(k.nextDeadline.at - state.now)} múlva` : "nincs nyitott határidő"}
        tone={k.nextDeadline && k.nextDeadline.at - state.now < 30 ? "warn" : "neutral"}
        onClick={k.nextDeadline ? () => openTask(k.nextDeadline!.task.id) : undefined}
      />
      <Kpi
        icon={<Hourglass size={14} />}
        label="Műszakból hátralévő idő"
        value={formatDuration(k.dayCrewRemaining)}
        detail={`B, C: 15:00-ig · A ügyelet: ${formatDuration(k.onCallRemaining)}`}
      />
    </div>
  );
}

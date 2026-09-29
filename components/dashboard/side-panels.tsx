"use client";

import { AlertTriangle, CheckCircle2, Home, Navigation, Sparkles } from "lucide-react";
import { useDemoState } from "@/lib/client/demo-store";
import { TASK_TYPE_LABEL } from "@/lib/domain/labels";
import { locationById, taskRows, vehicleSnapshot } from "@/lib/domain/selectors";
import { formatClock, formatDuration } from "@/lib/domain/time";
import { useApp } from "../app-context";
import { StatusBadge, VehicleTag } from "../domain-badges";
import { Button, Card, CardHeader, EmptyState, Mono } from "../ui";

export function AttentionList() {
  const state = useDemoState();
  const { openTask, act } = useApp();
  const rows = taskRows(state).filter((r) => ["new", "unassigned", "suggested", "at_risk"].includes(r.status));

  return (
    <Card>
      <CardHeader icon={<AlertTriangle size={17} />} title="Figyelmet igénylő feladatok" subtitle="Új, kiosztatlan, döntésre váró és késésveszélyes feladatok" />
      {rows.length === 0 ? (
        <EmptyState icon={<CheckCircle2 size={22} />} title="Minden feladat rendben" />
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((r) => {
            const from = locationById(state, r.task.fromLocationId);
            const to = locationById(state, r.task.toLocationId);
            const eta = r.plannedArrival ?? r.suggestedArrival;
            return (
              <li key={r.task.id} className="px-4 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => openTask(r.task.id)} className="min-w-0 text-left">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <Mono className={r.task.priority === "urgent" ? "text-urgent" : undefined}>{r.task.id}</Mono>
                      <StatusBadge status={r.status} />
                    </span>
                    <span className="mt-0.5 block text-[13px] text-ink-2">{TASK_TYPE_LABEL[r.task.type]}</span>
                    <span className="block truncate text-[12px] text-ink-3">
                      {from.shortName}
                      {r.task.toLocationId !== r.task.fromLocationId && ` → ${to.shortName}`}
                    </span>
                    {(r.task.latestArrival !== null || eta !== null) && (
                      <span className="mt-0.5 block text-[12px] tabular text-ink-3">
                        {r.task.latestArrival !== null && <>határ {formatClock(r.task.latestArrival)}</>}
                        {eta !== null && <> · szimulált ETA {formatClock(eta)}</>}
                      </span>
                    )}
                    {r.task.fieldNote && <span className="mt-0.5 block text-[12px] text-warn">{r.task.fieldNote}</span>}
                  </button>
                  {(r.task.status === "new" || r.task.status === "unassigned") && (
                    <Button
                      size="sm"
                      variant={r.task.priority === "urgent" ? "urgent" : "secondary"}
                      onClick={() => act({ type: "REQUEST_SUGGESTION", taskId: r.task.id }, `Javaslat elkészült: ${r.task.id}.`)}
                    >
                      <Sparkles size={14} /> Javaslat
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function FleetStatus() {
  const state = useDemoState();
  return (
    <Card>
      <CardHeader icon={<Navigation size={17} />} title="Járművek most" subtitle={`Szimulált állapot ${formatClock(state.now)}-kor`} />
      <ul className="divide-y divide-line">
        {state.vehicles.map((v) => {
          const s = vehicleSnapshot(state, v.id);
          return (
            <li key={v.id} className="px-4 py-2.5 text-[13px]">
              <div className="flex items-center justify-between gap-2">
                <VehicleTag vehicle={v} crewName={`${s.crewName} (${s.crewSize} fő)`} />
                <span className="text-[12px] text-ink-3 tabular">
                  {s.onCall ? `ügyelet ${formatDuration(s.remainingShift)}` : `műszak ${formatDuration(s.remainingShift)}`}
                </span>
              </div>
              <p className="mt-1 text-ink-2">{s.activity}</p>
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-ink-3 tabular">
                {s.nextTask ? (
                  <span>
                    következő: <Mono>{s.nextTask.taskId}</Mono> {formatClock(s.nextTask.departure)}
                  </span>
                ) : (
                  <span>nincs további tervezett feladat</span>
                )}
                {s.returnToDepotAt !== null && (
                  <span className="inline-flex items-center gap-1">
                    <Home size={11} /> {formatClock(s.returnToDepotAt)}
                  </span>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

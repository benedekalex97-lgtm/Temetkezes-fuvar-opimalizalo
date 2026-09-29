"use client";

import { ArrowDown, ArrowRight, Gavel, Lock, MessageSquareWarning, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useDemoState } from "@/lib/client/demo-store";
import { DECISION_LABEL, TASK_TYPE_LABEL } from "@/lib/domain/labels";
import { decisionsForTask, locationById, suggestionsForTask, taskRows } from "@/lib/domain/selectors";
import { formatClock, formatDuration } from "@/lib/domain/time";
import { useApp } from "./app-context";
import { PriorityBadge, StatusBadge, VehicleTag } from "./domain-badges";
import { Badge, Button, Drawer, Mono } from "./ui";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line/70 py-2 text-sm last:border-0">
      <dt className="shrink-0 text-ink-3">{label}</dt>
      <dd className="text-right font-medium text-ink tabular">{children}</dd>
    </div>
  );
}

export function TaskDetailDrawer() {
  const state = useDemoState();
  const { selectedTaskId, closeTask, act } = useApp();
  const router = useRouter();
  const row = taskRows(state).find((r) => r.task.id === selectedTaskId);

  if (!selectedTaskId || !row) {
    return <Drawer open={false} onClose={closeTask} title={null}>{null}</Drawer>;
  }
  const { task, status, assignment } = row;
  const from = locationById(state, task.fromLocationId);
  const to = locationById(state, task.toLocationId);
  const vehicle = state.vehicles.find((v) => v.id === (assignment?.vehicleId ?? row.suggestedVehicleId));
  const crew = vehicle ? state.crews.find((c) => c.id === vehicle.defaultCrewId) : undefined;
  const suggestions = suggestionsForTask(state, task.id);
  const latest = suggestions[suggestions.length - 1];
  const decisions = decisionsForTask(state, task.id);
  const arrival = row.plannedArrival ?? row.suggestedArrival;
  const slack = task.latestArrival !== null && arrival !== null ? task.latestArrival - arrival : null;
  const canRequest = ["new", "unassigned"].includes(task.status);
  const hasOpen = suggestions.some((s) => s.status === "open");

  const rationale = latest
    ? latest.taskId === task.id
      ? latest.rationale
      : latest.rationale.filter((l) => l.includes(task.id))
    : [];

  return (
    <Drawer
      open
      onClose={closeTask}
      title={
        <div className="flex flex-wrap items-center gap-2">
          <Mono className="text-[15px]">{task.id}</Mono>
          <StatusBadge status={status} />
          <PriorityBadge priority={task.priority} />
        </div>
      }
    >
      <p className="text-[15px] font-semibold">{TASK_TYPE_LABEL[task.type]}</p>
      <p className="mt-0.5 text-[13px] text-ink-3">{task.note}</p>

      <div className="mt-4 rounded-xl border border-line bg-subtle p-3">
        <div className="text-[12px] uppercase tracking-wide text-ink-3">Felvételi hely</div>
        <div className="text-sm font-medium">{from.name}</div>
        <div className="text-[13px] text-ink-3">{from.address}</div>
        {task.toLocationId !== task.fromLocationId && (
          <>
            <ArrowDown size={16} className="my-1.5 text-ink-3" />
            <div className="text-[12px] uppercase tracking-wide text-ink-3">Célhely</div>
            <div className="text-sm font-medium">{to.name}</div>
            <div className="text-[13px] text-ink-3">{to.address}</div>
          </>
        )}
      </div>

      {task.lockReason && (
        <div className="mt-3 flex gap-2 rounded-lg border border-line bg-surface p-3 text-[13px] text-ink-2">
          <Lock size={16} className="mt-px shrink-0 text-ink-3" />
          <span>{task.lockReason} Az optimalizáló nem mozgathatja.</span>
        </div>
      )}
      {task.fieldNote && (
        <div className="mt-3 flex gap-2 rounded-lg border border-warn-line bg-warn-soft p-3 text-[13px] text-warn">
          <MessageSquareWarning size={16} className="mt-px shrink-0" />
          <span>{task.fieldNote}</span>
        </div>
      )}

      <dl className="mt-4">
        <Row label="Bejelentés ideje">{formatClock(task.reportedAt)}</Row>
        <Row label="Kiérkezési határ">
          {task.latestArrival !== null ? (
            <span className={task.priority === "urgent" ? "text-urgent" : undefined}>{formatClock(task.latestArrival)}</span>
          ) : (
            <span className="font-normal text-ink-3">nincs</span>
          )}
        </Row>
        <Row label={assignment ? "Tervezett érkezés (szimulált ETA)" : "Javasolt érkezés (szimulált ETA)"}>
          {arrival !== null ? (
            <>
              {formatClock(arrival)}
              {slack !== null && (
                <span className={slack < 10 ? "ml-2 text-warn" : "ml-2 font-normal text-ink-3"}>
                  {slack >= 0 ? `${formatDuration(slack)} tartalék` : `${formatDuration(-slack)} késés`}
                </span>
              )}
            </>
          ) : (
            <span className="font-normal text-ink-3">—</span>
          )}
        </Row>
        {assignment && (
          <Row label="Indulás → befejezés">
            {formatClock(assignment.departure)} → {formatClock(assignment.end)}
          </Row>
        )}
        <Row label="Jármű">
          {vehicle ? (
            <span className="inline-flex items-center gap-2">
              <VehicleTag vehicle={vehicle} />
              {!assignment && <Badge tone="primary">javaslat</Badge>}
            </span>
          ) : (
            <span className="font-normal text-ink-3">nincs kiosztva</span>
          )}
        </Row>
        <Row label="Csapat">{crew ? `${crew.name} (${crew.memberCodes.length} fő)` : "—"}</Row>
        <Row label="Szükséges erőforrás">
          {task.requiredCapability === "deceased_transport" ? "Szállító jármű" : "Logisztikai jármű"} · {task.requiredCrewSize} fő
        </Row>
      </dl>

      <section className="mt-5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Sparkles size={15} className="text-primary" /> Optimalizálói indoklás
        </h3>
        {rationale.length > 0 ? (
          <ul className="mt-2 space-y-1.5 text-[13px] text-ink-2">
            {rationale.map((line, i) => (
              <li key={i} className="flex gap-2">
                <ArrowRight size={13} className="mt-[3px] shrink-0 text-ink-3" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[13px] text-ink-3">
            {task.status === "completed" || task.status === "in_progress" || task.status === "manually_locked"
              ? "A reggeli terv része; az optimalizáló ezt a feladatot nem tervezheti át."
              : "Ehhez a feladathoz még nem készült javaslat."}
          </p>
        )}
      </section>

      <section className="mt-5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold">
          <Gavel size={15} className="text-primary" /> Diszpécseri döntés
        </h3>
        {decisions.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {decisions.map((d) => (
              <li key={d.id} className="rounded-lg border border-line p-2.5 text-[13px]">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={d.action === "rejected" ? "urgent" : "ok"}>{DECISION_LABEL[d.action]}</Badge>
                  <span className="text-ink-3 tabular">
                    {formatClock(d.decidedAt)} · <Mono>{d.suggestionId}</Mono>
                    {d.resultingPlanId && <> → <Mono>{d.resultingPlanId}</Mono></>}
                  </span>
                </div>
                <p className="mt-1 text-ink-2">{d.reason || <span className="text-ink-3">Indoklás nélkül elfogadva.</span>}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5 text-[13px] text-ink-3">Nincs rögzített diszpécseri döntés.</p>
        )}
      </section>

      {(canRequest || hasOpen) && (
        <div className="sticky bottom-0 -mx-5 mt-6 flex flex-wrap gap-2 border-t border-line bg-surface px-5 py-3">
          {canRequest && (
            <Button
              variant={task.priority === "urgent" ? "urgent" : "primary"}
              onClick={() => {
                const r = act({ type: "REQUEST_SUGGESTION", taskId: task.id }, "Javaslat elkészült — döntésre vár.");
                if (r.ok) {
                  closeTask();
                  router.push("/#javaslat");
                }
              }}
            >
              <Sparkles size={16} /> Javaslat készítése
            </Button>
          )}
          {hasOpen && (
            <Button
              variant="primary"
              onClick={() => {
                closeTask();
                router.push("/#javaslat");
              }}
            >
              Ugrás a nyitott javaslathoz
            </Button>
          )}
        </div>
      )}
    </Drawer>
  );
}

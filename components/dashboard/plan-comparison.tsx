"use client";

import { GitCompareArrows, History, Lock } from "lucide-react";
import { useDemoState } from "@/lib/client/demo-store";
import { DECISION_LABEL } from "@/lib/domain/labels";
import { diffAgainst, latestOptimizerSuggestion, type PlanDiffKind } from "@/lib/domain/selectors";
import { currentPlan, morningPlan } from "@/lib/domain/store";
import { formatClock } from "@/lib/domain/time";
import type { Assignment, DemoState } from "@/lib/domain/types";
import { useApp } from "../app-context";
import { VehicleTag } from "../domain-badges";
import { Badge, Card, CardHeader, EmptyState, Mono, cx } from "../ui";

const SUGGESTION_STATUS: Record<string, { label: string; tone: "primary" | "ok" | "urgent" | "muted" }> = {
  open: { label: "döntésre vár", tone: "primary" },
  accepted: { label: "elfogadva", tone: "ok" },
  rejected: { label: "elutasítva", tone: "urgent" },
  superseded: { label: "felülírva", tone: "muted" },
};

function PlanColumn({
  state,
  title,
  meta,
  assignments,
  showDiff,
  empty,
}: {
  state: DemoState;
  title: string;
  meta: React.ReactNode;
  assignments: Assignment[] | null;
  showDiff: boolean;
  empty?: React.ReactNode;
}) {
  const { openTask } = useApp();
  const morning = morningPlan(state);
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface">
      <div className="border-b border-line px-3.5 py-2.5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-ink-3">{meta}</div>
      </div>
      {assignments === null ? (
        empty
      ) : (
        <div className="divide-y divide-line">
          {state.vehicles.map((v) => {
            const { rows, gone } = diffAgainst(morning, { assignments }, v.id);
            return (
              <div key={v.id} className="px-3.5 py-2.5">
                <VehicleTag vehicle={v} crewName={state.crews.find((c) => c.defaultVehicleId === v.id)?.name} />
                <ul className="mt-1.5 space-y-1">
                  {rows.map(({ assignment: a, kind, fromVehicleId }) => {
                    const task = state.tasks.find((t) => t.id === a.taskId)!;
                    return (
                      <li key={a.taskId}>
                        <button
                          onClick={() => openTask(a.taskId)}
                          className={cx(
                            "flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left text-[12.5px] hover:bg-subtle",
                            showDiff && kind === "new" && "bg-urgent-soft",
                            showDiff && kind === "moved_in" && "bg-warn-soft",
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-1.5">
                            {task.status === "manually_locked" && <Lock size={11} className="text-ink-3" />}
                            <Mono className={task.priority === "urgent" ? "text-urgent" : undefined}>{a.taskId}</Mono>
                            {showDiff && <DiffTag kind={kind} other={fromVehicleId} />}
                          </span>
                          <span className="shrink-0 text-ink-3 tabular">
                            {formatClock(a.departure)}–{formatClock(a.end)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {showDiff &&
                    gone.map(({ assignment: a, kind, toVehicleId }) => (
                      <li key={`gone-${a.taskId}`} className="flex items-center justify-between gap-2 px-1.5 py-1 text-[12.5px] text-ink-3">
                        <span className="flex items-center gap-1.5">
                          <Mono className="line-through">{a.taskId}</Mono>
                          <DiffTag kind={kind} other={toVehicleId} />
                        </span>
                      </li>
                    ))}
                  {rows.length === 0 && gone.length === 0 && <li className="px-1.5 text-[12.5px] text-ink-3">Nincs feladat.</li>}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DiffTag({ kind, other }: { kind: PlanDiffKind; other: string | null }) {
  if (kind === "same") return null;
  const map: Record<Exclude<PlanDiffKind, "same">, [string, "urgent" | "warn" | "neutral" | "muted"]> = {
    new: ["új", "urgent"],
    moved_in: [`áthelyezve ${other} →`, "warn"],
    moved_out: [`→ ${other}`, "warn"],
    retimed: ["átidőzítve", "neutral"],
    removed: ["kiosztatlan", "muted"],
  };
  const [label, tone] = map[kind];
  return (
    <Badge tone={tone} className="px-1 py-0 text-[10.5px]">
      {label}
    </Badge>
  );
}

export function PlanComparison() {
  const state = useDemoState();
  const morning = morningPlan(state);
  const current = currentPlan(state);
  const suggestion = latestOptimizerSuggestion(state);
  const approvedDecision = state.decisions.find((d) => d.id === current.decisionId);

  return (
    <Card>
      <CardHeader
        icon={<GitCompareArrows size={17} />}
        title="Tervverziók összevetése"
        subtitle="Az eredeti reggeli terv, az optimalizálói javaslat és a diszpécser által jóváhagyott aktuális terv külön objektum."
      />
      <div className="grid gap-3 p-4 lg:grid-cols-3">
        <PlanColumn
          state={state}
          title="1 · Eredeti reggeli terv"
          meta={
            <>
              <Mono>{morning.id}</Mono> · készült {formatClock(morning.createdAt)} · változatlan
            </>
          }
          assignments={morning.assignments}
          showDiff={false}
        />
        <PlanColumn
          state={state}
          title="2 · Optimalizálói javaslat"
          meta={
            suggestion ? (
              <>
                <Mono>{suggestion.id}</Mono> · {formatClock(suggestion.createdAt)} ·
                <Badge tone={SUGGESTION_STATUS[suggestion.status].tone} className="py-0">
                  {SUGGESTION_STATUS[suggestion.status].label}
                </Badge>
              </>
            ) : (
              "még nem készült"
            )
          }
          assignments={suggestion ? suggestion.proposedAssignments : null}
          showDiff
          empty={
            <EmptyState title="Még nincs javaslat">
              Indítsd el a 11:22-es sürgős eseményt, majd kérj javaslatot. A javaslat nem módosítja a jóváhagyott tervet.
            </EmptyState>
          }
        />
        <PlanColumn
          state={state}
          title="3 · Jóváhagyott aktuális terv"
          meta={
            current.id === morning.id ? (
              <>Még nincs új diszpécseri jóváhagyás — a reggeli terv van érvényben.</>
            ) : (
              <>
                <Mono>{current.id}</Mono> · {formatClock(current.createdAt)} ·
                {approvedDecision && (
                  <Badge tone="ok" className="py-0">
                    {DECISION_LABEL[approvedDecision.action]}
                  </Badge>
                )}
              </>
            )
          }
          assignments={current.assignments}
          showDiff={current.id !== morning.id}
        />
      </div>
    </Card>
  );
}

export function DecisionLog() {
  const state = useDemoState();
  const { openTask } = useApp();
  return (
    <Card>
      <CardHeader icon={<History size={17} />} title="Döntési napló" subtitle="Minden terv csak diszpécseri döntéssel jön létre." />
      {state.decisions.length === 0 ? (
        <EmptyState title="Még nincs diszpécseri döntés">A reggeli terv (PV-1) van érvényben.</EmptyState>
      ) : (
        <ol className="divide-y divide-line">
          {[...state.decisions].reverse().map((d) => (
            <li key={d.id} className="flex flex-wrap items-start justify-between gap-2 px-4 py-2.5 text-[13px]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={d.action === "rejected" ? "urgent" : "ok"}>{DECISION_LABEL[d.action]}</Badge>
                  <button onClick={() => openTask(d.taskId)} className="font-mono text-[12.5px] font-medium text-primary hover:underline">
                    {d.taskId}
                  </button>
                  <span className="text-ink-3">
                    <Mono>{d.suggestionId}</Mono>
                    {d.resultingPlanId ? (
                      <>
                        {" "}→ <Mono>{d.resultingPlanId}</Mono>
                      </>
                    ) : (
                      " · terv változatlan"
                    )}
                  </span>
                </div>
                <p className="mt-0.5 text-ink-2">{d.reason || <span className="text-ink-3">Megjegyzés nélkül.</span>}</p>
              </div>
              <span className="text-ink-3 tabular">{formatClock(d.decidedAt)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

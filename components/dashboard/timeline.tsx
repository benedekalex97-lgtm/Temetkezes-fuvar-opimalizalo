"use client";

import { Home, Lock, Moon } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { useDemoState } from "@/lib/client/demo-store";
import { TASK_TYPE_LABEL } from "@/lib/domain/labels";
import { buildContext, returnToDepot } from "@/lib/domain/schedule";
import { activeSuggestion, diffAgainst, type PlanDiffKind } from "@/lib/domain/selectors";
import { currentPlan, displayStatus, morningPlan } from "@/lib/domain/store";
import { formatClock } from "@/lib/domain/time";
import type { Assignment, DemoState } from "@/lib/domain/types";
import { useApp } from "../app-context";
import { Card, CardHeader, cx } from "../ui";

const START = 7 * 60;
const END = 17 * 60;
const SPAN = END - START;
const pct = (m: number) => `${((Math.min(Math.max(m, START), END) - START) / SPAN) * 100}%`;
const width = (a: number, b: number) => `${((Math.min(b, END) - Math.max(a, START)) / SPAN) * 100}%`;

type Mode = "current" | "suggestion" | "morning";

const DIFF_LABEL: Partial<Record<PlanDiffKind, string>> = {
  new: "új",
  moved_in: "áthelyezve",
  retimed: "átidőzítve",
};

function Block({
  state,
  a,
  color,
  diff,
  fromVehicleId,
  ghost,
}: {
  state: DemoState;
  a: Assignment;
  color: string;
  diff: PlanDiffKind | null;
  fromVehicleId: string | null;
  ghost: boolean;
}) {
  const { openTask } = useApp();
  const task = state.tasks.find((t) => t.id === a.taskId)!;
  const status = displayStatus(state, task);
  const urgent = task.priority === "urgent";
  const c = urgent ? "var(--color-urgent)" : color;
  const pickupDone = a.serviceStart + task.serviceAtFrom;
  const total = Math.max(1, a.end - a.departure);
  const seg = (s: number, e: number) => ({ left: `${((s - a.departure) / total) * 100}%`, width: `${((e - s) / total) * 100}%` });
  const title = `${task.id} · ${TASK_TYPE_LABEL[task.type]}\nIndulás ${formatClock(a.departure)} · szimulált kiérkezés ${formatClock(a.arrivalAtFrom)} · vége ${formatClock(a.end)}${
    fromVehicleId ? `\nÁthelyezve: ${fromVehicleId} → ${a.vehicleId}` : ""
  }`;

  return (
    <button
      type="button"
      onClick={() => openTask(task.id)}
      title={title}
      className={cx(
        "group absolute top-2 bottom-2 overflow-hidden rounded-md border text-left transition-shadow hover:shadow-raised focus-visible:outline-2 focus-visible:outline-primary",
        status === "completed" && "opacity-60",
        status === "manually_locked" && "border-dashed",
        ghost && "border-dashed",
        (status === "in_progress" || status === "at_risk") && "ring-2 ring-offset-1",
      )}
      style={
        {
          left: pct(a.departure),
          width: width(a.departure, a.end),
          borderColor: c,
          backgroundColor: `color-mix(in srgb, ${c} 12%, white)`,
          "--tw-ring-color": status === "at_risk" ? "var(--color-warn)" : c,
        } as CSSProperties
      }
    >
      <span className="absolute inset-y-0" style={{ ...seg(a.serviceStart, pickupDone), backgroundColor: c, opacity: 0.85 }} />
      {task.toLocationId !== task.fromLocationId && (
        <span className="absolute inset-y-0" style={{ ...seg(a.arrivalAtTo, a.end), backgroundColor: c, opacity: 0.55 }} />
      )}
      {status === "completed" && <span className="hatch absolute inset-0" />}
      <span className="relative flex h-full items-center gap-1 px-1.5">
        {status === "manually_locked" && <Lock size={11} className="shrink-0" style={{ color: c }} />}
        <span className="truncate rounded bg-surface/85 px-1 font-mono text-[11px] font-semibold text-ink">{task.id.replace("F-2026-", "")}</span>
        {diff && DIFF_LABEL[diff] && (
          <span
            className={cx(
              "truncate rounded px-1 text-[10px] font-semibold uppercase tracking-wide",
              diff === "new" ? "bg-urgent text-white" : "bg-warn text-white",
            )}
          >
            {DIFF_LABEL[diff]}
          </span>
        )}
      </span>
    </button>
  );
}

export function Timeline() {
  const state = useDemoState();
  const suggestion = activeSuggestion(state);
  const [mode, setMode] = useState<Mode>("current");
  const effectiveMode: Mode = mode === "suggestion" && !suggestion ? "current" : mode;

  const morning = morningPlan(state);
  const plan =
    effectiveMode === "morning"
      ? morning
      : effectiveMode === "suggestion" && suggestion
        ? { ...currentPlan(state), assignments: suggestion.proposedAssignments }
        : currentPlan(state);
  const compareBase = effectiveMode === "suggestion" ? currentPlan(state) : morning;
  const ctx = buildContext(state);
  const hours = Array.from({ length: SPAN / 60 + 1 }, (_, i) => START + i * 60);
  const urgentTasks = state.tasks.filter((t) => t.priority === "urgent" && t.latestArrival !== null);

  const modes: { id: Mode; label: string; disabled?: boolean }[] = [
    { id: "current", label: "Jóváhagyott terv" },
    { id: "suggestion", label: "Javaslat előnézete", disabled: !suggestion },
    { id: "morning", label: "Reggeli terv" },
  ];

  return (
    <Card>
      <CardHeader
        title="Napi idővonal"
        subtitle="07:00–17:00 · a blokkok a menetet, a sötétebb sávok a helyszíni munkát jelölik · Szimulált ETA"
        actions={
          <div className="flex rounded-lg border border-line bg-subtle p-0.5" role="tablist" aria-label="Idővonal nézet">
            {modes.map((m) => (
              <button
                key={m.id}
                role="tab"
                aria-selected={effectiveMode === m.id}
                disabled={m.disabled}
                onClick={() => setMode(m.id)}
                className={cx(
                  "rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                  effectiveMode === m.id ? "bg-surface text-ink shadow-card" : "text-ink-3 hover:text-ink",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        }
      />
      <div className="overflow-x-auto">
        <div className="min-w-[760px] px-4 pb-4 pt-2">
          <div className="grid grid-cols-[132px_1fr]">
            <div />
            <div className="relative h-6">
              {hours.map((h) => (
                <span key={h} className="absolute -translate-x-1/2 text-[11px] text-ink-3 tabular" style={{ left: pct(h) }}>
                  {String(h / 60).padStart(2, "0")}
                </span>
              ))}
              <span
                className="absolute top-0 -translate-x-1/2 rounded bg-ink px-1 text-[10.5px] font-semibold text-white tabular"
                style={{ left: pct(state.now) }}
              >
                {formatClock(state.now)}
              </span>
            </div>
          </div>

          {state.vehicles.map((v) => {
            const crew = state.crews.find((c) => c.id === v.defaultCrewId)!;
            const shift = state.shifts.find((s) => s.id === crew.shiftId)!;
            const { rows } = diffAgainst(compareBase, plan, v.id);
            const list = rows.map((r) => r.assignment);
            const back = returnToDepot(ctx, v, list);
            const urgentHere = urgentTasks.filter((t) => list.some((a) => a.taskId === t.id));
            return (
              <div key={v.id} className="grid grid-cols-[132px_1fr] border-t border-line first:border-t-0">
                <div className="flex flex-col justify-center py-2 pr-3">
                  <span className="flex items-center gap-1.5 text-sm font-semibold">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: v.color }} />
                    <span className="font-mono">{v.id}</span>
                    <span className="font-normal text-ink-3">· {crew.name.replace(" csapat", "")}</span>
                  </span>
                  <span className="mt-0.5 truncate text-[11.5px] text-ink-3">{v.kindLabel}</span>
                </div>
                <div className="relative h-[58px]">
                  {hours.map((h) => (
                    <span key={h} className="absolute inset-y-0 w-px bg-line/70" style={{ left: pct(h) }} />
                  ))}
                  {shift.dayTaskWindow.end < END && (
                    <span
                      className={cx("absolute inset-y-0 right-0", shift.onCall ? "bg-primary-soft/70" : "hatch bg-sunken/80")}
                      style={{ left: pct(shift.dayTaskWindow.end) }}
                    >
                      <span className="absolute left-1.5 top-1 flex items-center gap-1 text-[10.5px] font-medium text-ink-3">
                        {shift.onCall ? (
                          <>
                            <Moon size={11} /> ügyelet holnap 07:00-ig →
                          </>
                        ) : (
                          "műszakon kívül"
                        )}
                      </span>
                    </span>
                  )}
                  {urgentHere.map((t) => (
                    <span
                      key={t.id}
                      className="absolute inset-y-0 z-10 border-l-2 border-dashed border-urgent"
                      style={{ left: pct(t.latestArrival!) }}
                      title={`${t.id} kiérkezési határ ${formatClock(t.latestArrival!)}`}
                    >
                      <span className="absolute bottom-0 left-1 whitespace-nowrap rounded bg-urgent px-1 text-[10px] font-semibold leading-4 text-white tabular">
                        határ {formatClock(t.latestArrival!)}
                      </span>
                    </span>
                  ))}
                  {rows.map((r) => (
                    <Block
                      key={r.assignment.taskId}
                      state={state}
                      a={r.assignment}
                      color={v.color}
                      diff={effectiveMode === "morning" ? null : r.kind}
                      fromVehicleId={r.kind === "moved_in" ? r.fromVehicleId : null}
                      ghost={effectiveMode === "suggestion" && r.kind !== "same"}
                    />
                  ))}
                  {back !== null && back <= END && (
                    <span
                      className="absolute top-1/2 grid size-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-line-strong bg-surface text-ink-3"
                      style={{ left: pct(back) }}
                      title={`Visszaérkezés a telephelyre (szimulált): ${formatClock(back)}`}
                    >
                      <Home size={11} />
                    </span>
                  )}
                  <span className="absolute inset-y-0 w-0.5 bg-ink/80" style={{ left: pct(state.now) }} />
                </div>
              </div>
            );
          })}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-3">
            <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm border border-ink-3 bg-sunken opacity-60 hatch" /> teljesítve</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm border border-ink-3 ring-2 ring-ink-3/60" /> folyamatban</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm border border-dashed border-ink-3" /> kézzel rögzítve / javasolt változás</span>
            <span className="flex items-center gap-1.5"><Home size={12} /> visszaérkezés a telephelyre</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-ink" /> most (szimulált)</span>
          </div>
        </div>
      </div>
    </Card>
  );
}

"use client";

import { ArrowRight, CheckCircle2, Hospital, Siren, Sparkles, XCircle } from "lucide-react";
import { useDemoState } from "@/lib/client/demo-store";
import { URGENT_EVENT_TASK_ID } from "@/lib/domain/seed";
import { assignmentFor, locationById } from "@/lib/domain/selectors";
import { currentPlan } from "@/lib/domain/store";
import { formatClock, formatDuration } from "@/lib/domain/time";
import { useApp } from "../app-context";
import { Button, Mono } from "../ui";

export function UrgentEventCard() {
  const state = useDemoState();
  const { act, openTask } = useApp();
  const task = state.tasks.find((t) => t.id === URGENT_EVENT_TASK_ID);
  const pickup = locationById(state, "P-007");

  if (!task) {
    return (
      <section className="flex flex-col gap-4 rounded-xl border border-dashed border-urgent-line bg-surface p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-urgent-soft text-urgent">
            <Siren size={20} />
          </span>
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-urgent">Szimulált sürgős esemény · 11:22</p>
            <p className="mt-0.5 text-sm text-ink-2">
              Új haláleseti felvétel érkezik: <strong className="font-semibold text-ink">{pickup.name}</strong> →
              Bocskai István u. 56. Kiérkezési határ a felvételi címre: 2 óra.
            </p>
          </div>
        </div>
        <Button
          variant="urgent"
          className="shrink-0"
          onClick={() => {
            const r = act({ type: "LOAD_URGENT_EVENT" }, "11:22 — új sürgős haláleseti bejelentés érkezett.");
            if (r.ok) openTask(URGENT_EVENT_TASK_ID);
          }}
        >
          <Siren size={16} /> 11:22-es esemény indítása
        </Button>
      </section>
    );
  }

  const assignment = assignmentFor(currentPlan(state), task.id);
  const vehicle = assignment ? state.vehicles.find((v) => v.id === assignment.vehicleId) : undefined;

  const base = (
    <div className="flex min-w-0 items-start gap-3">
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-lg ${
          task.status === "approved" ? "bg-ok-soft text-ok" : "pulse-urgent bg-urgent text-white"
        }`}
      >
        {task.status === "approved" ? <CheckCircle2 size={20} /> : <Siren size={20} />}
      </span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 text-[12px] font-semibold uppercase tracking-wide text-urgent">
          Sürgős haláleseti felvétel · bejelentve {formatClock(task.reportedAt)} · <Mono>{task.id}</Mono>
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-ink-2">
          <Hospital size={15} className="text-ink-3" />
          <strong className="font-semibold text-ink">{pickup.name}</strong>
          <ArrowRight size={14} className="text-ink-3" /> Bocskai István u. 56.
          <span className="text-ink-3">·</span>
          Kiérkezési határ: <strong className="font-semibold text-urgent tabular">{formatClock(task.latestArrival!)}</strong>
          <span className="text-ink-3">· 2 fő, szállító jármű</span>
        </p>
        {task.status === "approved" && assignment && vehicle && (
          <p className="mt-1 text-[13px] text-ok">
            Jóváhagyva: {vehicle.id} ({state.crews.find((c) => c.id === assignment.crewId)?.name}) indul{" "}
            {formatClock(assignment.departure)}, szimulált kiérkezés {formatClock(assignment.arrivalAtFrom)} —{" "}
            {formatDuration(task.latestArrival! - assignment.arrivalAtFrom)} tartalék.
          </p>
        )}
        {task.status === "unassigned" && (
          <p className="mt-1 flex items-center gap-1 text-[13px] text-warn">
            <XCircle size={14} /> A diszpécser elutasította a javaslatot — a feladat kiosztatlan.
          </p>
        )}
      </div>
    </div>
  );

  return (
    <section
      className={`flex flex-col gap-3 rounded-xl border p-4 shadow-card sm:flex-row sm:items-center sm:justify-between ${
        task.status === "approved" ? "border-ok-line bg-surface" : "border-urgent-line bg-urgent-soft/60"
      }`}
    >
      {base}
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button onClick={() => openTask(task.id)}>Részletek</Button>
        {(task.status === "new" || task.status === "unassigned") && (
          <Button
            variant="urgent"
            onClick={() => {
              const r = act({ type: "REQUEST_SUGGESTION", taskId: task.id }, "Javaslat elkészült — döntésre vár.");
              if (r.ok) document.getElementById("javaslat")?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            <Sparkles size={16} /> {task.status === "new" ? "Javaslat készítése" : "Új javaslat kérése"}
          </Button>
        )}
        {task.status === "suggested" && (
          <Button
            variant="primary"
            onClick={() => document.getElementById("javaslat")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            Javaslat megtekintése <ArrowRight size={16} />
          </Button>
        )}
      </div>
    </section>
  );
}

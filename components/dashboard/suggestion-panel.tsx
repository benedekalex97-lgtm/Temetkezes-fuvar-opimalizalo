"use client";

import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  CheckCircle2,
  Clock,
  Info,
  PencilLine,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Undo2,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { acceptanceCheck, REASON_REQUIRED_MESSAGE } from "@/lib/demo-optimizer";
import { useDemoState } from "@/lib/client/demo-store";
import { TASK_TYPE_LABEL } from "@/lib/domain/labels";
import { locationById } from "@/lib/domain/selectors";
import { formatClock, formatDuration, parseClock, toTimeInputValue } from "@/lib/domain/time";
import type { DemoState, OptimizationSuggestion } from "@/lib/domain/types";
import { useApp } from "../app-context";
import { VehicleTag } from "../domain-badges";
import { Badge, Button, Card, Field, Mono, cx, inputClass } from "../ui";

type Mode = "idle" | "modify" | "reject";

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "urgent" | "warn" }) {
  return (
    <div className="min-w-0">
      <div className="text-[11.5px] text-ink-3">{label}</div>
      <div
        className={cx(
          "text-[17px] font-semibold leading-6 tabular",
          tone === "ok" ? "text-ok" : tone === "urgent" ? "text-urgent" : tone === "warn" ? "text-warn" : "text-ink",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function CandidateTable({ state, s }: { state: DemoState; s: OptimizationSuggestion }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[380px] text-[12.5px]">
        <thead>
          <tr className="text-left text-ink-3">
            <th className="py-1.5 pr-2 font-medium">Jármű</th>
            <th className="py-1.5 pr-2 font-medium">Kiérkezés</th>
            <th className="py-1.5 pr-2 font-medium">Tartalék</th>
            <th className="py-1.5 font-medium">Értékelés</th>
          </tr>
        </thead>
        <tbody>
          {s.candidates.map((c) => {
            const v = state.vehicles.find((x) => x.id === c.vehicleId)!;
            const chosen = c.vehicleId === s.chosenVehicleId;
            return (
              <tr key={c.vehicleId} className={cx("border-t border-line align-top", chosen && "bg-primary-soft/50")}>
                <td className="py-2 pr-2">
                  <VehicleTag vehicle={v} />
                </td>
                <td className="py-2 pr-2 tabular">{c.arrivalAtFrom !== null ? formatClock(c.arrivalAtFrom) : "—"}</td>
                <td className="py-2 pr-2 tabular">{c.slackMinutes !== null ? formatDuration(c.slackMinutes) : "—"}</td>
                <td className="py-2">
                  {!c.eligible ? (
                    <span className="flex items-start gap-1 text-ink-3">
                      <Ban size={13} className="mt-0.5 shrink-0 text-urgent" />
                      Nem választható: {c.vehicleId === "J-03" ? "kis logisztikai jármű, 1 fő" : c.ineligibleReasons[0]}
                    </span>
                  ) : c.feasible ? (
                    <span className="flex items-center gap-1 text-ok">
                      <CheckCircle2 size={13} /> {chosen ? "Javasolt" : "Alkalmas"}
                      {c.moves.length > 0 && <span className="text-ink-3">· {c.moves.length} áthelyezéssel</span>}
                    </span>
                  ) : (
                    <span className="flex items-start gap-1 text-warn">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {c.infeasibleReasons[0]}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SuggestionPanel({ suggestion: s }: { suggestion: OptimizationSuggestion }) {
  const state = useDemoState();
  const { act } = useApp();
  const [mode, setMode] = useState<Mode>("idle");
  const [reason, setReason] = useState("");
  const task = state.tasks.find((t) => t.id === s.taskId)!;
  const chosen = s.candidates.find((c) => c.vehicleId === s.chosenVehicleId) ?? null;
  const [vehicleId, setVehicleId] = useState<string>(s.chosenVehicleId ?? "J-01");
  const [departure, setDeparture] = useState<string>(chosen?.departure != null ? toTimeInputValue(chosen.departure) : "");
  const stale = s.basePlanId !== state.currentPlanId;
  const check = acceptanceCheck(s, state.currentPlanId, reason);
  const pickup = locationById(state, task.fromLocationId);
  const dest = locationById(state, task.toLocationId);
  const isVariant = s.origin === "dispatcher_variant";
  const crewName = (vid: string) => state.crews.find((c) => c.defaultVehicleId === vid)?.name ?? "";

  // Az üres indoklást nem jelezzük hibaként, amíg a diszpécser nem kezdett gépelni.
  const visibleBlockers = check.blockers.filter((b) => reason.trim().length > 0 || b !== REASON_REQUIRED_MESSAGE);

  const accept = () => {
    const r = act(
      { type: "ACCEPT_SUGGESTION", suggestionId: s.id, reason },
      isVariant ? "A módosított terv jóváhagyva — új tervverzió jött létre." : "Javaslat elfogadva — új tervverzió jött létre.",
    );
    if (r.ok) setReason("");
  };

  return (
    <Card id="javaslat" className="scroll-mt-28 border-primary-line">
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-line bg-primary-soft/50 px-4 py-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-[15px] font-semibold">
            <Sparkles size={16} className="text-primary" />
            {isVariant ? "Diszpécseri változat" : "Optimalizálói javaslat"}
          </h2>
          <p className="mt-0.5 text-[12.5px] text-ink-3">
            <Mono>{s.id}</Mono> · {formatClock(s.createdAt)} · alapterv <Mono>{s.basePlanId}</Mono> · {TASK_TYPE_LABEL[task.type]}{" "}
            <Mono>{task.id}</Mono>
          </p>
        </div>
        <Badge tone="warn" icon={<ShieldCheck size={12} />}>
          Nem lép életbe jóváhagyás nélkül
        </Badge>
      </header>

      <div className="space-y-4 px-4 py-4">
        {stale && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warn-line bg-warn-soft p-3 text-[13px] text-warn">
            <span className="flex items-center gap-1.5">
              <AlertTriangle size={15} /> A javaslat egy korábbi tervverzióra épül; elfogadás előtt frissíteni kell.
            </span>
            <Button size="sm" onClick={() => act({ type: "REQUEST_SUGGESTION", taskId: s.taskId }, "Javaslat frissítve.")}>
              <RefreshCw size={14} /> Frissítés
            </Button>
          </div>
        )}

        {chosen && chosen.eligible ? (
          <div className="rounded-xl border border-line p-3.5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <VehicleTag vehicle={state.vehicles.find((v) => v.id === chosen.vehicleId)!} crewName={crewName(chosen.vehicleId)} className="text-[14px]" />
              <ArrowRight size={14} className="text-ink-3" />
              <span className="font-medium">{pickup.shortName}</span>
              <ArrowRight size={14} className="text-ink-3" />
              <span className="font-medium">{dest.shortName}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
              <Stat label={`Indulás · ${locationById(state, chosen.departureFromLocationId!).shortName}`} value={formatClock(chosen.departure!)} />
              <Stat label="Szimulált kiérkezés" value={formatClock(chosen.arrivalAtFrom!)} />
              <Stat label="Kiérkezési határ" value={task.latestArrival !== null ? formatClock(task.latestArrival) : "—"} tone={task.priority === "urgent" ? "urgent" : undefined} />
              <Stat
                label="Tartalék"
                value={chosen.slackMinutes !== null ? (chosen.meetsDeadline ? formatDuration(chosen.slackMinutes) : `${formatDuration(-chosen.slackMinutes)} késés`) : "—"}
                tone={chosen.slackMinutes === null ? undefined : !chosen.meetsDeadline ? "urgent" : chosen.slackMinutes < 30 ? "warn" : "ok"}
              />
            </div>
            {task.latestArrival !== null && (
              <p className={cx("mt-2.5 flex flex-wrap items-center gap-x-1.5 text-[13px]", chosen.meetsDeadline ? "text-ok" : "text-urgent")}>
                {chosen.meetsDeadline ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                {chosen.meetsDeadline
                  ? `A ${formatClock(task.latestArrival)}-es kiérkezési határ teljesül.`
                  : `A ${formatClock(task.latestArrival)}-es kiérkezési határ nem teljesül.`}
                <span className="w-full pl-[21px] text-[12.5px] text-ink-3">A határ a felvételi címre érkezésre vonatkozik, nem a teljes fuvar végére.</span>
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-urgent-line bg-urgent-soft p-3.5 text-[13px] text-urgent">
            <p className="flex items-center gap-1.5 font-semibold">
              <Ban size={15} /> A választott jármű nem alkalmas.
            </p>
            <p className="mt-1">{s.warnings.find((w) => w.level === "critical")?.message}</p>
          </div>
        )}

        {chosen && chosen.moves.length > 0 && (
          <div className="rounded-xl border border-warn-line bg-warn-soft/60 p-3.5">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-warn">Javasolt áthelyezés</p>
            {chosen.moves.map((m) => {
              const moved = state.tasks.find((t) => t.id === m.taskId)!;
              return (
                <div key={m.taskId} className="mt-1.5 text-[13px] text-ink-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-sm text-ink">
                    <Mono>{m.taskId}</Mono>
                    <span className="text-ink-3">({TASK_TYPE_LABEL[moved.type].toLowerCase()}, alacsony prioritás)</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <VehicleTag vehicle={state.vehicles.find((v) => v.id === m.fromVehicleId)!} />
                    <ArrowRight size={13} className="text-ink-3" />
                    <VehicleTag vehicle={state.vehicles.find((v) => v.id === m.toVehicleId)!} crewName={crewName(m.toVehicleId)} />
                    <span className="text-ink-3">· szimulált kiérkezés {formatClock(m.newArrivalAtFrom)}</span>
                    {moved.latestArrival !== null && <span className="text-ink-3">(határ {formatClock(moved.latestArrival)})</span>}
                  </div>
                  {m.returnToDepotAt !== null && (
                    <p className={cx("mt-1 flex items-center gap-1", m.fitsShift ? "text-ok" : "text-urgent")}>
                      {m.fitsShift ? <Check size={14} /> : <XCircle size={14} />}
                      Visszaérkezés a telephelyre {formatClock(m.returnToDepotAt)} · műszakvég {formatClock(m.shiftEnd)}
                      {m.fitsShift && ` · ${formatDuration(m.shiftEnd - m.returnToDepotAt)} tartalék`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {s.impacts.length > 0 && (
          <div>
            <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-3">Hatás a napi tervekre</p>
            <div className="space-y-1.5">
              {s.impacts.map((imp) => {
                const v = state.vehicles.find((x) => x.id === imp.vehicleId)!;
                return (
                  <div key={imp.vehicleId} className="rounded-lg border border-line px-3 py-2 text-[12.5px]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <VehicleTag vehicle={v} crewName={crewName(v.id)} />
                      <span className="text-ink-3 tabular">
                        visszaérkezés {imp.before.returnToDepotAt !== null ? formatClock(imp.before.returnToDepotAt) : "—"} →{" "}
                        <strong className="font-semibold text-ink">
                          {imp.after.returnToDepotAt !== null ? formatClock(imp.after.returnToDepotAt) : "—"}
                        </strong>
                        {imp.marginMinutes !== null && ` · ${formatDuration(imp.marginMinutes)} a műszakvégig`}
                        {imp.marginMinutes === null && " · ügyeletben marad"}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {imp.after.taskIds.map((id) => (
                        <span
                          key={id}
                          className={cx(
                            "rounded px-1.5 py-px font-mono text-[11.5px]",
                            !imp.before.taskIds.includes(id)
                              ? id === s.taskId
                                ? "bg-urgent text-white"
                                : "bg-warn text-white"
                              : "bg-subtle text-ink-2",
                          )}
                        >
                          {id}
                        </span>
                      ))}
                      {imp.before.taskIds
                        .filter((id) => !imp.after.taskIds.includes(id))
                        .map((id) => (
                          <span key={id} className="rounded bg-subtle px-1.5 py-px font-mono text-[11.5px] text-ink-3 line-through">
                            {id}
                          </span>
                        ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-3">Indoklás</p>
          <ul className="space-y-1.5 text-[13px] text-ink-2">
            {s.rationale.map((line, i) => (
              <li key={i} className="flex gap-2">
                <ArrowRight size={13} className="mt-[3px] shrink-0 text-primary" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-ink-3">Jelöltek összevetése</p>
          <CandidateTable state={state} s={s} />
        </div>

        {s.warnings.length > 0 && (
          <ul className="space-y-1.5">
            {s.warnings.map((w, i) => (
              <li
                key={i}
                className={cx(
                  "flex items-start gap-2 rounded-lg px-3 py-2 text-[12.5px]",
                  w.level === "critical" ? "bg-urgent-soft text-urgent" : w.level === "warning" ? "bg-warn-soft text-warn" : "bg-subtle text-ink-3",
                )}
              >
                {w.level === "info" ? <Info size={14} className="mt-px shrink-0" /> : <AlertTriangle size={14} className="mt-px shrink-0" />}
                {w.message}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Döntés */}
      <div className="border-t border-line bg-subtle/60 px-4 py-4">
        <p className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <Clock size={14} className="text-primary" /> Diszpécseri döntés
        </p>

        {mode === "modify" && (
          <div className="mb-3 space-y-3 rounded-xl border border-line bg-surface p-3">
            <div>
              <span className="mb-1 block text-[13px] font-medium text-ink-2">Jármű és csapat</span>
              <div className="grid gap-1.5 sm:grid-cols-3">
                {s.candidates.map((c) => {
                  const v = state.vehicles.find((x) => x.id === c.vehicleId)!;
                  return (
                    <label
                      key={c.vehicleId}
                      className={cx(
                        "flex cursor-pointer flex-col rounded-lg border px-2.5 py-2 text-[12.5px]",
                        !c.eligible && "cursor-not-allowed opacity-55",
                        vehicleId === c.vehicleId ? "border-primary bg-primary-soft" : "border-line",
                      )}
                      title={c.eligible ? undefined : c.ineligibleReasons.join(" ")}
                    >
                      <span className="flex items-center gap-1.5">
                        <input
                          type="radio"
                          name={`vehicle-${s.id}`}
                          className="accent-[var(--color-primary)]"
                          disabled={!c.eligible}
                          checked={vehicleId === c.vehicleId}
                          onChange={() => setVehicleId(c.vehicleId)}
                        />
                        <VehicleTag vehicle={v} crewName={crewName(v.id)} />
                      </span>
                      <span className="mt-0.5 pl-5 text-ink-3">{c.eligible ? v.kindLabel : "Elhunyt szállítására nem választható"}</span>
                    </label>
                  );
                })}
              </div>
            </div>
            <Field label="Legkorábbi indulás" hint="A jármű ennél korábban nem indulhat; ha még foglalt, a szabaddá válás ideje számít.">
              <input type="time" className={cx(inputClass, "max-w-[160px]")} value={departure} onChange={(e) => setDeparture(e.target.value)} />
            </Field>
            <Field label="Indoklás (kötelező)">
              <textarea
                className={cx(inputClass, "h-16 py-2")}
                placeholder="pl. A csapat tartalékban marad egy várható hívás miatt"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  const dep = departure ? parseClock(departure) : null;
                  const r = act(
                    { type: "CREATE_VARIANT", taskId: s.taskId, vehicleId, departure: dep },
                    "A módosított változat kiszámolva — ellenőrizd, majd hagyd jóvá.",
                  );
                  if (r.ok) setMode("idle");
                }}
              >
                <RefreshCw size={15} /> Változat ellenőrzése
              </Button>
              <Button variant="ghost" onClick={() => setMode("idle")}>
                Mégse
              </Button>
            </div>
          </div>
        )}

        {mode === "reject" && (
          <div className="mb-3 space-y-3 rounded-xl border border-urgent-line bg-surface p-3">
            <Field label="Elutasítás indoka (kötelező)">
              <textarea
                className={cx(inputClass, "h-16 py-2")}
                placeholder="pl. Telefonon egyeztetve, a felvétel később történik"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="urgent"
                disabled={reason.trim().length < 3}
                onClick={() => {
                  const r = act({ type: "REJECT_SUGGESTION", suggestionId: s.id, reason }, "Javaslat elutasítva — a terv nem változott.");
                  if (r.ok) {
                    setReason("");
                    setMode("idle");
                  }
                }}
              >
                <XCircle size={15} /> Elutasítás rögzítése
              </Button>
              <Button variant="ghost" onClick={() => setMode("idle")}>
                Mégse
              </Button>
            </div>
          </div>
        )}

        {mode === "idle" && (
          <>
            <Field label={check.requiresReason ? "Indoklás (kötelező)" : "Megjegyzés (nem kötelező)"}>
              <textarea
                className={cx(inputClass, "h-14 py-2")}
                placeholder={isVariant ? "Miért tér el a diszpécser az optimalizálói javaslattól?" : "Rövid megjegyzés a döntéshez"}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            {visibleBlockers.length > 0 && (
              <ul className="mt-2 space-y-0.5 text-[12.5px] text-urgent">
                {visibleBlockers.map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="primary" onClick={accept} disabled={!check.ok}>
                <Check size={16} /> {isVariant ? "Módosított terv jóváhagyása" : "Elfogadás"}
              </Button>
              <Button onClick={() => setMode("modify")}>
                <PencilLine size={15} /> Módosítás
              </Button>
              {isVariant ? (
                <Button variant="ghost" onClick={() => act({ type: "DISCARD_VARIANT", suggestionId: s.id }, "Visszatérés az optimalizálói javaslathoz.")}>
                  <Undo2 size={15} /> Vissza az eredeti javaslathoz
                </Button>
              ) : (
                <Button variant="urgent-outline" onClick={() => setMode("reject")}>
                  <XCircle size={15} /> Elutasítás
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

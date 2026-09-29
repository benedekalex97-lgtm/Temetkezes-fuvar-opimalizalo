"use client";

import { Ban, Check, Home, Moon, ShieldCheck, Users } from "lucide-react";
import { useApp } from "@/components/app-context";
import { StatusBadge } from "@/components/domain-badges";
import { Badge, Card, CardHeader, Mono } from "@/components/ui";
import { useDemoState } from "@/lib/client/demo-store";
import { CAPABILITY_LABEL, TASK_TYPE_LABEL } from "@/lib/domain/labels";
import { locationById, vehicleSnapshot } from "@/lib/domain/selectors";
import { displayStatus } from "@/lib/domain/store";
import { formatClock, formatDuration } from "@/lib/domain/time";
import type { Capability } from "@/lib/domain/types";

const ALL_CAPABILITIES: Capability[] = ["deceased_transport", "urn_logistics", "cash_documents"];
const DAY_START = 7 * 60;
const DAY_SPAN = 24 * 60;
const pos = (m: number) => `${((m - DAY_START) / DAY_SPAN) * 100}%`;

function ShiftBar({ start, end, dayEnd, onCall, now, color }: { start: number; end: number; dayEnd: number; onCall: boolean; now: number; color: string }) {
  const ticks = [7, 11, 15, 19, 23, 27, 31];
  return (
    <div>
      <div className="relative h-7 rounded-md bg-subtle">
        <span
          className="absolute inset-y-0 rounded-md"
          style={{ left: pos(start), width: `${((dayEnd - start) / DAY_SPAN) * 100}%`, backgroundColor: color, opacity: 0.85 }}
          title="Napi feladatok"
        />
        {onCall && (
          <span
            className="absolute inset-y-0 rounded-r-md"
            style={{ left: pos(dayEnd), width: `${((end - dayEnd) / DAY_SPAN) * 100}%`, backgroundColor: color, opacity: 0.25 }}
            title="Ügyelet"
          />
        )}
        <span className="absolute inset-y-[-3px] w-0.5 bg-ink" style={{ left: pos(now) }} title={`Most: ${formatClock(now)}`} />
      </div>
      <div className="relative mt-1 h-4 text-[10.5px] text-ink-3 tabular">
        {ticks.map((h) => (
          <span key={h} className="absolute -translate-x-1/2" style={{ left: pos(h * 60) }}>
            {String(h % 24).padStart(2, "0")}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function VehiclesPage() {
  const state = useDemoState();
  const { openTask } = useApp();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Járművek és csapatok</h1>
        <p className="text-sm text-ink-3">Jármű–csapat párok és műszakok a D-08 jóváhagyott demóbaseline szerint · anonim csapattagkódok</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {state.vehicles.map((v) => {
          const s = vehicleSnapshot(state, v.id);
          const crew = state.crews.find((c) => c.id === v.defaultCrewId)!;
          const shift = state.shifts.find((x) => x.id === crew.shiftId)!;
          return (
            <Card key={v.id} className="overflow-hidden">
              <div className="h-1.5" style={{ backgroundColor: v.color }} />
              <div className="border-b border-line px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <Mono className="text-lg">{v.id}</Mono>
                    <span className="text-[15px] font-medium text-ink-2">{v.kindLabel}</span>
                  </h2>
                  {shift.onCall && (
                    <Badge tone="primary" icon={<Moon size={12} />}>
                      Ügyelet
                    </Badge>
                  )}
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-2">
                  <Users size={14} className="text-ink-3" /> {crew.name} · {crew.memberCodes.length} fő
                  <span className="text-ink-3">({crew.memberCodes.join(", ")} — anonim kódok)</span>
                </p>
              </div>

              <div className="space-y-4 px-4 py-3.5">
                <div>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="font-medium">{shift.label}</span>
                    <span className="text-ink-3 tabular">még {formatDuration(s.remainingShift)}</span>
                  </div>
                  <ShiftBar start={shift.start} end={shift.end} dayEnd={shift.dayTaskWindow.end} onCall={shift.onCall} now={state.now} color={v.color} />
                  <p className="mt-1 text-[12px] text-ink-3">
                    {shift.onCall
                      ? `Napi feladatok 07:00–15:00 (még ${formatDuration(s.remainingDayWindow)}), utána ügyelet holnap 07:00-ig. Haláleseti felvételnél a kiérkezési határ legfeljebb 2 óra.`
                      : "Új feladat csak akkor kerülhet ide, ha a telephelyre visszaérkezés is belefér 15:00-ig."}
                  </p>
                </div>

                <div className="rounded-lg bg-subtle px-3 py-2 text-[13px]">
                  <div className="text-[11.5px] uppercase tracking-wide text-ink-3">Most ({formatClock(state.now)}, szimulált)</div>
                  <div className="font-medium">{s.activity}</div>
                  <div className="text-[12.5px] text-ink-3">
                    {s.nextTask ? (
                      <>
                        Következő: <Mono>{s.nextTask.taskId}</Mono> indulás {formatClock(s.nextTask.departure)}
                      </>
                    ) : (
                      "Nincs további tervezett indulás"
                    )}
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-ink-3">Demó-konfiguráció</div>
                  <ul className="space-y-1 text-[13px]">
                    {ALL_CAPABILITIES.map((cap) => {
                      const has = v.capabilities.includes(cap);
                      return (
                        <li key={cap} className={has ? "flex items-center gap-1.5 text-ink" : "flex items-center gap-1.5 text-ink-3"}>
                          {has ? <Check size={14} className="text-ok" /> : <Ban size={14} className={cap === "deceased_transport" ? "text-urgent" : "text-ink-3"} />}
                          {CAPABILITY_LABEL[cap]}
                          {!has && cap === "deceased_transport" && <span className="text-urgent">— nem használható</span>}
                        </li>
                      );
                    })}
                  </ul>
                  <p className="mt-1.5 text-[12px] text-ink-3">{v.note}</p>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between text-[12px] font-semibold uppercase tracking-wide text-ink-3">
                    <span>Mai terv (jóváhagyott)</span>
                    {s.returnToDepotAt !== null && (
                      <span className="flex items-center gap-1 normal-case tracking-normal tabular">
                        <Home size={12} /> vissza {formatClock(s.returnToDepotAt)}
                      </span>
                    )}
                  </div>
                  <ul className="divide-y divide-line rounded-lg border border-line">
                    {s.assignments.map((a) => {
                      const task = state.tasks.find((t) => t.id === a.taskId)!;
                      return (
                        <li key={a.taskId}>
                          <button onClick={() => openTask(a.taskId)} className="flex w-full items-start justify-between gap-2 px-3 py-2 text-left hover:bg-subtle">
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5">
                                <Mono className={task.priority === "urgent" ? "text-urgent" : undefined}>{a.taskId}</Mono>
                                <span className="text-[12px] text-ink-3 tabular">
                                  {formatClock(a.departure)}–{formatClock(a.end)}
                                </span>
                              </span>
                              <span className="block truncate text-[12.5px] text-ink-2">
                                {TASK_TYPE_LABEL[task.type]} · {locationById(state, task.fromLocationId).shortName}
                              </span>
                            </span>
                            <StatusBadge status={displayStatus(state, task)} />
                          </button>
                        </li>
                      );
                    })}
                    {s.assignments.length === 0 && <li className="px-3 py-2 text-[13px] text-ink-3">Nincs kiosztott feladat.</li>}
                  </ul>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader icon={<ShieldCheck size={17} />} title="A demóban ellenőrzött szabályok" subtitle="Forrás: DECISIONS_LOG D-08, D-09 · minden más időparaméter demó-feltevés" />
        <ul className="grid gap-x-6 gap-y-2 px-4 py-3.5 text-[13px] text-ink-2 md:grid-cols-2">
          <li>• Haláleseti felvételnél a felvételi címre legfeljebb 2 órán belül ki kell érni (A csapat, D-08).</li>
          <li>• Az A csapat ügyelete ma 07:00-tól holnap 07:00-ig tart; 07:00–15:00 között napi feladatokat is végez.</li>
          <li>• B és C csapat 07:00–15:00 között dolgozik; új feladat csak telephelyi visszaérkezéssel együtt férhet bele.</li>
          <li>• J-03 kis logisztikai jármű: urnák az irodákba, pénz és iratok vissza; elhunyt szállítására nem használható.</li>
          <li>• Elhunyt szállításához szállító jármű és kétfős csapat szükséges.</li>
          <li>• AEVUM-irodák demó-nyitvatartása: hétfő–péntek 08:00–16:00.</li>
          <li>• Teljesített, folyamatban lévő és kézzel rögzített feladat nem mozgatható.</li>
          <li>• Az optimalizáló csak javasol; terv csak diszpécseri döntéssel jön létre (D-03, D-10).</li>
        </ul>
      </Card>
    </div>
  );
}

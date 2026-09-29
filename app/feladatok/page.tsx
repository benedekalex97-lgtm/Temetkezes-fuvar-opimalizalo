"use client";

import { ArrowRight, Plus, Search, Siren, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { useApp } from "@/components/app-context";
import { PriorityBadge, StatusBadge, VehicleTag } from "@/components/domain-badges";
import { Badge, Button, Card, Dialog, EmptyState, Mono, cx, inputClass } from "@/components/ui";
import { getDemoState, useDemoState } from "@/lib/client/demo-store";
import { PICKUP_KIND_LABEL, STATUS_LABEL, STATUS_ORDER, TASK_TYPE_LABEL } from "@/lib/domain/labels";
import { locationById, taskRows, type TaskRow } from "@/lib/domain/selectors";
import { formatClock } from "@/lib/domain/time";
import type { DisplayStatus } from "@/lib/domain/types";

function NewUrgentTaskDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const state = useDemoState();
  const { act, openTask } = useApp();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const options = state.pickupLocations
    .filter((p) => p.active)
    .filter((p) => `${p.name} ${p.address}`.toLocaleLowerCase("hu").includes(query.toLocaleLowerCase("hu")));

  const close = () => {
    setQuery("");
    setSelected(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Új sürgős haláleseti bejelentés"
      width="max-w-xl"
      footer={
        <>
          <Button onClick={close}>Mégse</Button>
          <Button
            variant="urgent"
            disabled={!selected}
            onClick={() => {
              const r = act({ type: "CREATE_URGENT_TASK", pickupLocationId: selected! }, "Új sürgős feladat rögzítve.");
              if (r.ok) {
                close();
                const tasks = getDemoState().tasks;
                openTask(tasks[tasks.length - 1].id);
              }
            }}
          >
            <Siren size={16} /> Bejelentés rögzítése
          </Button>
        </>
      }
    >
      <p className="text-[13px] text-ink-3">
        Bejelentés ideje: <strong className="text-ink">{formatClock(state.now)}</strong> · kiérkezési határ a felvételi címre:{" "}
        <strong className="text-urgent">{formatClock(state.now + 120)}</strong> · cél: Bocskai István u. 56. · 2 fő, szállító
        jármű. Személyes adatot ne rögzíts — csak belső azonosító készül.
      </p>
      <div className="relative mt-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input className={cx(inputClass, "pl-9")} placeholder="Felvételi hely keresése a helytörzsben…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto" role="listbox" aria-label="Felvételi helyek">
        {options.map((p) => (
          <li key={p.id}>
            <button
              role="option"
              aria-selected={selected === p.id}
              onClick={() => setSelected(p.id)}
              className={cx(
                "flex w-full items-start justify-between gap-2 rounded-lg border px-3 py-2 text-left",
                selected === p.id ? "border-urgent bg-urgent-soft" : "border-line hover:bg-subtle",
              )}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">{p.name}</span>
                <span className="block text-[12px] text-ink-3">{p.address}</span>
              </span>
              <Badge tone={p.createdBy === "dispatcher" ? "primary" : "muted"}>{PICKUP_KIND_LABEL[p.kind]}</Badge>
            </button>
          </li>
        ))}
        {options.length === 0 && <li className="px-2 py-4 text-center text-[13px] text-ink-3">Nincs találat. Új helyet a Helyszínek oldalon adhatsz hozzá.</li>}
      </ul>
    </Dialog>
  );
}

export default function TasksPage() {
  const state = useDemoState();
  const { openTask, act } = useApp();
  const [filter, setFilter] = useState<DisplayStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState(false);
  const rows = taskRows(state);

  const counts = useMemo(() => {
    const c = new Map<DisplayStatus, number>();
    for (const r of rows) c.set(r.status, (c.get(r.status) ?? 0) + 1);
    return c;
  }, [rows]);

  const q = query.trim().toLocaleLowerCase("hu");
  const visible = rows
    .filter((r) => filter === "all" || r.status === filter)
    .filter((r) => {
      if (!q) return true;
      const from = locationById(state, r.task.fromLocationId);
      const to = locationById(state, r.task.toLocationId);
      return `${r.task.id} ${TASK_TYPE_LABEL[r.task.type]} ${from.name} ${to.name}`.toLocaleLowerCase("hu").includes(q);
    })
    .sort((a, b) => sortKey(a) - sortKey(b) || a.task.id.localeCompare(b.task.id));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Feladatok</h1>
          <p className="text-sm text-ink-3">Belső azonosítók · személyes adat nélkül (D-05) · Szimulált ETA</p>
        </div>
        <Button variant="urgent" onClick={() => setDialog(true)}>
          <Plus size={16} /> Új sürgős bejelentés
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label="Mind" count={rows.length} />
          {STATUS_ORDER.map((s) => (
            <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)} label={STATUS_LABEL[s]} count={counts.get(s) ?? 0} />
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input className={cx(inputClass, "pl-9")} placeholder="Keresés: azonosító, helyszín…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <Card>
        {visible.length === 0 ? (
          <EmptyState title="Nincs a szűrésnek megfelelő feladat" />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-[13px]">
                <thead className="border-b border-line text-left text-[12px] text-ink-3">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Azonosító</th>
                    <th className="px-3 py-2.5 font-medium">Típus · prioritás</th>
                    <th className="px-3 py-2.5 font-medium">Felvétel → cél</th>
                    <th className="px-3 py-2.5 font-medium">Bejelentve</th>
                    <th className="px-3 py-2.5 font-medium">Kiérkezési határ</th>
                    <th className="px-3 py-2.5 font-medium">Szimulált ETA</th>
                    <th className="px-3 py-2.5 font-medium">Jármű · csapat</th>
                    <th className="px-3 py-2.5 font-medium">Státusz</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((r) => {
                    const from = locationById(state, r.task.fromLocationId);
                    const to = locationById(state, r.task.toLocationId);
                    const vid = r.assignment?.vehicleId ?? r.suggestedVehicleId;
                    const v = state.vehicles.find((x) => x.id === vid);
                    const eta = r.plannedArrival ?? r.suggestedArrival;
                    return (
                      <tr key={r.task.id} className="cursor-pointer align-top hover:bg-subtle/70" onClick={() => openTask(r.task.id)}>
                        <td className="px-4 py-2.5">
                          <Mono className={r.task.priority === "urgent" ? "text-urgent" : undefined}>{r.task.id}</Mono>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-medium">{TASK_TYPE_LABEL[r.task.type]}</div>
                          <div className="mt-1">
                            <PriorityBadge priority={r.task.priority} />
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div>{from.shortName}</div>
                          {r.task.toLocationId !== r.task.fromLocationId && (
                            <div className="flex items-center gap-1 text-ink-3">
                              <ArrowRight size={12} /> {to.shortName}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 tabular">{formatClock(r.task.reportedAt)}</td>
                        <td className={cx("px-3 py-2.5 tabular", r.task.priority === "urgent" && "font-semibold text-urgent")}>
                          {r.task.latestArrival !== null ? formatClock(r.task.latestArrival) : <span className="text-ink-3">—</span>}
                        </td>
                        <td className="px-3 py-2.5 tabular">
                          {eta !== null ? formatClock(eta) : <span className="text-ink-3">—</span>}
                          {!r.assignment && eta !== null && <span className="ml-1 text-[11.5px] text-primary">javaslat</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          {v ? <VehicleTag vehicle={v} crewName={state.crews.find((c) => c.defaultVehicleId === v.id)?.name} /> : <span className="text-ink-3">nincs kiosztva</span>}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                          {(r.task.status === "new" || r.task.status === "unassigned") && (
                            <Button size="sm" variant={r.task.priority === "urgent" ? "urgent" : "secondary"} onClick={() => act({ type: "REQUEST_SUGGESTION", taskId: r.task.id }, `Javaslat elkészült: ${r.task.id} — döntés az irányítópulton.`)}>
                              <Sparkles size={14} /> Javaslat
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-line lg:hidden">
              {visible.map((r) => {
                const from = locationById(state, r.task.fromLocationId);
                const to = locationById(state, r.task.toLocationId);
                const vid = r.assignment?.vehicleId ?? r.suggestedVehicleId;
                const v = state.vehicles.find((x) => x.id === vid);
                const eta = r.plannedArrival ?? r.suggestedArrival;
                return (
                  <li key={r.task.id}>
                    <button className="w-full px-4 py-3 text-left" onClick={() => openTask(r.task.id)}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <Mono className={r.task.priority === "urgent" ? "text-urgent" : undefined}>{r.task.id}</Mono>
                        <StatusBadge status={r.status} />
                      </div>
                      <div className="mt-1 text-sm font-medium">{TASK_TYPE_LABEL[r.task.type]}</div>
                      <div className="text-[12.5px] text-ink-3">
                        {from.shortName}
                        {r.task.toLocationId !== r.task.fromLocationId && ` → ${to.shortName}`}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] tabular text-ink-2">
                        {v ? <VehicleTag vehicle={v} /> : <span className="text-ink-3">nincs kiosztva</span>}
                        {r.task.latestArrival !== null && <span className="text-urgent">határ {formatClock(r.task.latestArrival)}</span>}
                        {eta !== null && <span>ETA {formatClock(eta)}</span>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>

      <NewUrgentTaskDialog open={dialog} onClose={() => setDialog(false)} />
    </div>
  );
}

/** Nyitott sürgős feladatok elöl, utána indulási sorrend, végül a kiosztatlanok. */
function sortKey(r: TaskRow): number {
  if (r.task.priority === "urgent" && r.task.status !== "completed") return -1;
  return r.assignment?.departure ?? 10_000 + r.task.reportedAt;
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors",
        active ? "border-primary bg-primary text-white" : "border-line bg-surface text-ink-2 hover:bg-subtle",
        !active && count === 0 && "text-ink-3",
      )}
    >
      {label}
      <span className={cx("rounded-full px-1.5 text-[11px] tabular", active ? "bg-white/20" : "bg-subtle")}>{count}</span>
    </button>
  );
}

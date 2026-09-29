"use client";

import { Building2, Clock, Flame, Landmark, MapPin, Plus, Search, Snowflake, Warehouse } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useApp } from "@/components/app-context";
import { Badge, Button, Card, CardHeader, Dialog, EmptyState, Field, Mono, cx, inputClass } from "@/components/ui";
import { getDemoState, useDemoState } from "@/lib/client/demo-store";
import { isWithinBudapest } from "@/lib/domain/geo";
import { OPERATIONAL_KIND_LABEL, PICKUP_KIND_LABEL, VERIFICATION_LABEL } from "@/lib/domain/labels";
import { formatClock, parseClock } from "@/lib/domain/time";
import type { OperationalLocationKind, PickupLocationKind } from "@/lib/domain/types";

const KIND_ICON: Record<OperationalLocationKind, ReactNode> = {
  depot: <Warehouse size={18} />,
  cold_storage: <Snowflake size={18} />,
  crematorium: <Flame size={18} />,
  office: <Landmark size={18} />,
};

const EMPTY_FORM = {
  name: "",
  address: "",
  kind: "hospital" as PickupLocationKind,
  lat: "",
  lng: "",
  from: "",
  to: "",
  accessNote: "",
  dataSource: "",
};

function AddPickupDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { act } = useApp();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof EMPTY_FORM) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const close = () => {
    setForm(EMPTY_FORM);
    setError(null);
    onClose();
  };

  const submit = () => {
    let coords: { lat: number; lng: number } | null = null;
    if (form.lat.trim() || form.lng.trim()) {
      const lat = Number(form.lat.replace(",", "."));
      const lng = Number(form.lng.replace(",", "."));
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || !isWithinBudapest({ lat, lng })) {
        setError("A koordináta érvénytelen vagy Budapesten kívül esik.");
        return;
      }
      coords = { lat, lng };
    }
    let timeWindow: { start: number; end: number } | null = null;
    if (form.from || form.to) {
      const start = parseClock(form.from);
      const end = parseClock(form.to);
      if (start === null || end === null || end <= start) {
        setError("Az időablak kezdete legyen korábbi, mint a vége.");
        return;
      }
      timeWindow = { start, end };
    }
    const r = act(
      {
        type: "ADD_PICKUP_LOCATION",
        input: {
          name: form.name,
          address: form.address,
          kind: form.kind,
          coords,
          timeWindow,
          accessNote: form.accessNote,
          dataSource: form.dataSource,
        },
      },
      "Új felvételi hely a helytörzsben.",
    );
    if (r.ok) close();
    else setError(r.error);
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Új budapesti felvételi hely"
      width="max-w-xl"
      footer={
        <>
          <Button onClick={close}>Mégse</Button>
          <Button variant="primary" onClick={submit}>
            <Plus size={16} /> Hozzáadás a helytörzshöz
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Név *" className="sm:col-span-2">
          <input className={inputClass} value={form.name} onChange={set("name")} placeholder="pl. Intézmény átvételi pont" />
        </Field>
        <Field label="Cím *" className="sm:col-span-2" hint="Budapesti irányítószámmal; koordináta nélkül a kerületközéppontból becsüljük.">
          <input className={inputClass} value={form.address} onChange={set("address")} placeholder="1145 Budapest, Példa utca 1." />
        </Field>
        <Field label="Helytípus">
          <select className={inputClass} value={form.kind} onChange={set("kind")}>
            {(Object.keys(PICKUP_KIND_LABEL) as PickupLocationKind[]).map((k) => (
              <option key={k} value={k}>
                {PICKUP_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Koordináta (nem kötelező)">
          <div className="flex gap-2">
            <input className={inputClass} value={form.lat} onChange={set("lat")} placeholder="47,50" inputMode="decimal" aria-label="Szélesség" />
            <input className={inputClass} value={form.lng} onChange={set("lng")} placeholder="19,05" inputMode="decimal" aria-label="Hosszúság" />
          </div>
        </Field>
        <Field label="Átvételi időablak (nem kötelező)">
          <div className="flex items-center gap-2">
            <input type="time" className={inputClass} value={form.from} onChange={set("from")} aria-label="Időablak kezdete" />
            <span className="text-ink-3">–</span>
            <input type="time" className={inputClass} value={form.to} onChange={set("to")} aria-label="Időablak vége" />
          </div>
        </Field>
        <Field label="Adatforrás">
          <input className={inputClass} value={form.dataSource} onChange={set("dataSource")} placeholder="Diszpécseri rögzítés (demó)" />
        </Field>
        <Field label="Kapcsolattartási / belépési megjegyzés" className="sm:col-span-2">
          <textarea className={cx(inputClass, "h-16 py-2")} value={form.accessNote} onChange={set("accessNote")} placeholder="pl. hátsó bejárat, portán jelentkezni" />
        </Field>
      </div>
      {error && <p className="mt-3 rounded-lg bg-urgent-soft px-3 py-2 text-[13px] text-urgent">{error}</p>}
      <p className="mt-3 text-[12px] text-ink-3">
        Az új hely „ellenőrzésre vár” állapotban kerül a törzsbe. Nem jelent szerződéses partnerkapcsolatot.
      </p>
    </Dialog>
  );
}

export default function LocationsPage() {
  const state = useDemoState();
  const { act, notify } = useApp();
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<PickupLocationKind | "all">("all");
  const [showInactive, setShowInactive] = useState(true);
  const [dialog, setDialog] = useState(false);

  const q = query.trim().toLocaleLowerCase("hu");
  const pickups = state.pickupLocations
    .filter((p) => kind === "all" || p.kind === kind)
    .filter((p) => showInactive || p.active)
    .filter((p) => !q || `${p.id} ${p.name} ${p.address}`.toLocaleLowerCase("hu").includes(q));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Helyszínek</h1>
        <p className="text-sm text-ink-3">Operatív helyszínek (D-09) és nyitott budapesti felvételi helytörzs · közelítő demó-koordináták</p>
      </div>

      <Card>
        <CardHeader icon={<Building2 size={17} />} title="Operatív helyszínek" subtitle="Telephely, hűtési pont, hamvasztó és AEVUM-irodák" />
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          {state.locations.map((l) => (
            <div key={l.id} className="rounded-xl border border-line p-3.5">
              <div className="flex items-start justify-between gap-2">
                <span className="grid size-9 place-items-center rounded-lg bg-primary-soft text-primary">{KIND_ICON[l.kind]}</span>
                <div className="flex flex-wrap justify-end gap-1">
                  <Badge tone="neutral">{OPERATIONAL_KIND_LABEL[l.kind]}</Badge>
                  {l.internal && <Badge tone="warn">belső operatív adat</Badge>}
                </div>
              </div>
              <p className="mt-2 text-sm font-semibold">{l.name}</p>
              <p className="text-[13px] text-ink-2">{l.address}</p>
              {l.openingHours && (
                <p className="mt-1 flex items-center gap-1 text-[12.5px] text-ink-3">
                  <Clock size={12} /> {l.openingHours.label} (demó)
                </p>
              )}
              <p className="mt-1.5 text-[12px] text-ink-3">{l.note}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          icon={<MapPin size={17} />}
          title="Budapesti felvételi helytörzs (PickupLocation)"
          subtitle="Kereshető és bővíthető. Lehetséges operatív felvételi pontok — nem igazolt szerződéses AEVUM-partnerek (R-13, Q-21)."
          actions={
            <Button variant="primary" onClick={() => setDialog(true)}>
              <Plus size={16} /> Új felvételi hely
            </Button>
          }
        />
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input className={cx(inputClass, "pl-9")} placeholder="Keresés: név, cím, azonosító…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
<div className="w-full sm:w-56">
          <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as PickupLocationKind | "all")} aria-label="Helytípus szűrő">
            <option value="all">Minden típus</option>
            {(Object.keys(PICKUP_KIND_LABEL) as PickupLocationKind[]).map((k) => (
              <option key={k} value={k}>
                {PICKUP_KIND_LABEL[k]}
              </option>
            ))}
          </select>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" className="accent-[var(--color-primary)]" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Inaktívak mutatása
          </label>
          <span className="ml-auto text-[12.5px] text-ink-3 tabular">
            {pickups.length} / {state.pickupLocations.length} hely
          </span>
        </div>

        {pickups.length === 0 ? (
          <EmptyState title="Nincs találat" />
        ) : (
          <ul className="divide-y divide-line">
            {pickups.map((p) => (
              <li key={p.id} className={cx("grid gap-x-4 gap-y-1.5 px-4 py-3 text-[13px] lg:grid-cols-[minmax(0,2.2fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_auto]", !p.active && "opacity-60")}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Mono className="text-ink-3">{p.id}</Mono>
                    <span className="font-semibold">{p.name}</span>
                    {p.createdBy === "dispatcher" && <Badge tone="primary">új</Badge>}
                  </div>
                  <div className="text-ink-2">{p.address}</div>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    <Badge tone="neutral">{PICKUP_KIND_LABEL[p.kind]}</Badge>
                    <Badge tone={p.verification === "verified_by_dispatcher" ? "ok" : p.verification === "unverified" ? "warn" : "muted"}>
                      {VERIFICATION_LABEL[p.verification]}
                    </Badge>
                  </div>
                </div>
                <div className="text-[12.5px] text-ink-3">
                  <div className="tabular">
                    {p.coords.lat.toFixed(4)}, {p.coords.lng.toFixed(4)}
                    {p.coordsApproximated && <span className="ml-1 text-warn">· kerületből becsült</span>}
                  </div>
                  <div>Időablak: {p.timeWindow ? `${formatClock(p.timeWindow.start)}–${formatClock(p.timeWindow.end)}` : "nem validált"}</div>
                  <div>Utolsó ellenőrzés: {p.lastCheckedLabel}</div>
                </div>
                <div className="text-[12.5px] text-ink-3">
                  <div className="text-ink-2">{p.accessNote}</div>
                  <div className="mt-0.5">Forrás: {p.dataSource}</div>
                </div>
                <div className="flex items-start lg:justify-end">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-2">
                    <span>{p.active ? "Aktív" : "Inaktív"}</span>
                    <button
                      role="switch"
                      aria-checked={p.active}
                      aria-label={`${p.name} aktív`}
                      onClick={() => {
                        const inUse = getDemoState().tasks.some(
                          (t) => t.fromLocationId === p.id && !["completed"].includes(t.status),
                        );
                        act({ type: "SET_PICKUP_ACTIVE", id: p.id, active: !p.active });
                        if (inUse && p.active) notify("info", "A hely nyitott feladatban szerepel — a feladat változatlan marad.");
                      }}
                      className={cx("relative h-5 w-9 rounded-full transition-colors", p.active ? "bg-primary" : "bg-line-strong")}
                    >
                      <span className={cx("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", p.active ? "left-[18px]" : "left-0.5")} />
                    </button>
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AddPickupDialog open={dialog} onClose={() => setDialog(false)} />
    </div>
  );
}

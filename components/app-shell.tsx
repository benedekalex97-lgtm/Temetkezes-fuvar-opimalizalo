"use client";

import { CalendarClock, CheckCircle2, Info, LayoutDashboard, ListChecks, MapPinned, RotateCcw, Truck, XCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useDemoState } from "@/lib/client/demo-store";
import { formatClock } from "@/lib/domain/time";
import { useApp } from "./app-context";
import { TaskDetailDrawer } from "./task-detail";
import { Button, Dialog, cx } from "./ui";

const NAV = [
  { href: "/", label: "Napi irányítópult", icon: LayoutDashboard },
  { href: "/feladatok", label: "Feladatok", icon: ListChecks },
  { href: "/jarmuvek", label: "Járművek és csapatok", icon: Truck },
  { href: "/helyszinek", label: "Helyszínek", icon: MapPinned },
];

function BrandMark() {
  return (
    <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
      <rect width="32" height="32" rx="8" fill="var(--color-primary)" />
      <path d="M8 21.5c3-6.5 6.5-9.5 11-9.5" stroke="#cfe3e6" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="8" cy="21.5" r="2.4" fill="#ffffff" />
      <circle cx="21.5" cy="12" r="3" fill="none" stroke="#ffffff" strokeWidth="2" />
      <circle cx="21.5" cy="12" r="0.9" fill="#ffffff" />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const state = useDemoState();
  const { act, toasts, dismiss } = useApp();
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="relative z-[1000] lg:sticky lg:top-0 border-b border-line bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
        <div className="mx-auto flex max-w-[1560px] flex-wrap items-center gap-x-6 gap-y-2 px-4 pt-3 lg:flex-nowrap lg:px-6 lg:py-2.5">
          <Link href="/" className="flex min-w-0 items-center gap-2.5">
            <BrandMark />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-semibold tracking-tight">Operációs Optimalizáló</div>
              <div className="truncate text-[12px] text-ink-3">Temetkezési diszpécseri irányítópult · Demo v0.1</div>
            </div>
          </Link>

          <nav className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 pb-2 lg:order-none lg:mx-0 lg:w-auto lg:flex-1 lg:overflow-visible lg:px-0 lg:pb-0" aria-label="Fő navigáció">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                    active ? "bg-primary-soft text-primary" : "text-ink-2 hover:bg-subtle hover:text-ink",
                  )}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-line bg-subtle px-2.5 py-1.5" title="A demó egy rögzített szimulált időpontban fut.">
              <CalendarClock size={16} className="text-primary" />
              <div className="leading-tight">
                <div className="text-[11px] uppercase tracking-wide text-ink-3">Szimulált idő</div>
                <div className="text-sm font-semibold tabular">
                  {formatClock(state.now)} <span className="hidden font-normal text-ink-3 sm:inline">· {state.dayLabel}</span>
                </div>
              </div>
            </div>
            <Button variant="ghost" onClick={() => setConfirmReset(true)} title="Demó visszaállítása" className="px-2.5 sm:px-3.5">
              <RotateCcw size={16} />
              <span className="hidden sm:inline">Demó visszaállítása</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="border-b border-line bg-primary-soft/60">
        <div className="mx-auto flex max-w-[1560px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 text-[12.5px] text-primary lg:px-6">
          <span className="font-semibold">Az optimalizáló javasol. A diszpécser dönt.</span>
          <span className="text-ink-3">
            Anonimizált demóadatok · determinisztikus mock optimalizáló · becsült útvonal és szimulált ETA
          </span>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1560px] flex-1 px-4 py-5 lg:px-6">{children}</main>

      <footer className="border-t border-line py-4 text-center text-[12px] text-ink-3">
        Demo v0.1 · nem production rendszer · a helyszínek nem igazolt szerződéses partnerek
      </footer>

      <TaskDetailDrawer />

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Demó visszaállítása"
        footer={
          <>
            <Button onClick={() => setConfirmReset(false)}>Mégse</Button>
            <Button
              variant="primary"
              onClick={() => {
                act({ type: "RESET" }, "A demó visszaállt a reggeli kiinduló állapotra.");
                setConfirmReset(false);
              }}
            >
              <RotateCcw size={16} /> Visszaállítás
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-2">
          A munkanap visszaáll az eredeti seed állapotra: a reggeli terv, a 9 előre betöltött feladat és a 12 mintapontos
          helytörzs. Minden javaslat, diszpécseri döntés, új feladat és új felvételi hely törlődik.
        </p>
      </Dialog>

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[1200] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cx(
              "pointer-events-auto flex max-w-md items-start gap-2 rounded-xl border bg-surface px-3.5 py-2.5 text-sm shadow-raised",
              t.tone === "error" ? "border-urgent-line" : t.tone === "ok" ? "border-ok-line" : "border-line",
            )}
          >
            {t.tone === "error" ? (
              <XCircle size={18} className="mt-px shrink-0 text-urgent" />
            ) : t.tone === "ok" ? (
              <CheckCircle2 size={18} className="mt-px shrink-0 text-ok" />
            ) : (
              <Info size={18} className="mt-px shrink-0 text-primary" />
            )}
            <span className="text-ink">{t.message}</span>
            <button className="ml-1 text-ink-3 hover:text-ink" onClick={() => dismiss(t.id)} aria-label="Értesítés bezárása">
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

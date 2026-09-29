"use client";

/**
 * UI-szintű állapot (kiválasztott feladat, értesítések). A domainállapot a
 * `lib/client/demo-store.ts`-ben van.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { dispatch as storeDispatch, type DispatchResult } from "@/lib/client/demo-store";
import type { DemoAction } from "@/lib/domain/store";

export interface Toast {
  id: number;
  tone: "ok" | "error" | "info";
  message: string;
}

interface AppContextValue {
  selectedTaskId: string | null;
  openTask: (id: string) => void;
  closeTask: () => void;
  toasts: Toast[];
  notify: (tone: Toast["tone"], message: string) => void;
  dismiss: (id: number) => void;
  /** Domainművelet; hiba esetén értesítést is mutat. */
  act: (action: DemoAction, successMessage?: string) => DispatchResult;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback(
    (tone: Toast["tone"], message: string) => {
      seq.current += 1;
      const id = seq.current;
      setToasts((t) => [...t.slice(-2), { id, tone, message }]);
      window.setTimeout(() => dismiss(id), tone === "error" ? 7000 : 4500);
    },
    [dismiss],
  );
  const act = useCallback(
    (action: DemoAction, successMessage?: string) => {
      const result = storeDispatch(action);
      if (!result.ok) notify("error", result.error);
      else if (successMessage) notify("ok", successMessage);
      return result;
    },
    [notify],
  );

  const value = useMemo<AppContextValue>(
    () => ({
      selectedTaskId,
      openTask: setSelectedTaskId,
      closeTask: () => setSelectedTaskId(null),
      toasts,
      notify,
      dismiss,
      act,
    }),
    [selectedTaskId, toasts, notify, dismiss, act],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp csak AppProvider alatt használható.");
  return ctx;
}

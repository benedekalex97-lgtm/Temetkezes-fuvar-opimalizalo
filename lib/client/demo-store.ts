"use client";

/**
 * Böngészőoldali demóállapot: a tiszta reducer köré épített kis store,
 * localStorage-mentéssel. A szerver és a hidratálás a seed állapotot látja
 * (getServerSnapshot), így nincs hidratálási eltérés.
 */
import { useSyncExternalStore } from "react";
import { createSeedState, SCHEMA_VERSION } from "@/lib/domain/seed";
import { demoReducer, DemoActionError, type DemoAction } from "@/lib/domain/store";
import type { DemoState } from "@/lib/domain/types";

const STORAGE_KEY = "temetkezesi-optimalizalo.demo-v0.1";
const SERVER_STATE = createSeedState();

let state: DemoState | null = null;
const listeners = new Set<() => void>();

function load(): DemoState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoState;
      if (parsed?.schemaVersion === SCHEMA_VERSION) return parsed;
    }
  } catch {
    // Privát ablak vagy tiltott tárolás: seed állapottal indulunk.
  }
  return createSeedState();
}

function persist(next: DemoState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // A demó mentés nélkül is működik.
  }
}

function getSnapshot(): DemoState {
  if (state === null) state = load();
  return state;
}

function getServerSnapshot(): DemoState {
  return SERVER_STATE;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Az aktuális állapot eseménykezelőkből (renderelésen kívül). */
export function getDemoState(): DemoState {
  return getSnapshot();
}

export type DispatchResult = { ok: true } | { ok: false; error: string };

export function dispatch(action: DemoAction): DispatchResult {
  try {
    state = demoReducer(getSnapshot(), action);
  } catch (error) {
    if (error instanceof DemoActionError) return { ok: false, error: error.message };
    throw error;
  }
  persist(state);
  listeners.forEach((l) => l());
  return { ok: true };
}

export function useDemoState(): DemoState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

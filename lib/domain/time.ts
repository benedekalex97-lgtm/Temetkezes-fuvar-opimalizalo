import type { Minutes } from "./types";

export const DAY = 24 * 60;

export function hm(hours: number, minutes = 0): Minutes {
  return hours * 60 + minutes;
}

/** „11:22”, következő napra „holnap 07:00”. */
export function formatClock(value: Minutes, opts: { nextDayPrefix?: boolean } = {}): string {
  const { nextDayPrefix = true } = opts;
  const dayOffset = Math.floor(value / DAY);
  const inDay = ((value % DAY) + DAY) % DAY;
  const h = Math.floor(inDay / 60);
  const m = inDay % 60;
  const clock = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  if (dayOffset >= 1 && nextDayPrefix) return `holnap ${clock}`;
  return clock;
}

/** „3 ó 38 p”, „45 p”. */
export function formatDuration(minutes: number): string {
  const sign = minutes < 0 ? "−" : "";
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m} p`;
  if (m === 0) return `${sign}${h} ó`;
  return `${sign}${h} ó ${m} p`;
}

/** „HH:MM” → perc. Érvénytelen bemenetnél null. */
export function parseClock(value: string): Minutes | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function toTimeInputValue(value: Minutes): string {
  return formatClock(value % DAY, { nextDayPrefix: false });
}

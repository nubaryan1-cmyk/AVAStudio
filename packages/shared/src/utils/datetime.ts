import { formatInTimeZone, toZonedTime } from "date-fns-tz";

/** Форматирует дату в заданной таймзоне (IANA, напр. "Europe/Moscow"). */
export function formatInTz(date: Date, timeZone: string, formatStr = "yyyy-MM-dd HH:mm"): string {
  return formatInTimeZone(date, timeZone, formatStr);
}

/** Локальный час (0–23) в заданной таймзоне. */
export function getHourInTz(date: Date, timeZone: string): number {
  return toZonedTime(date, timeZone).getHours();
}

export interface PrimeTimeWindow {
  startHour: number;
  endHour: number;
}

/** Прайм-тайм для постинга (по умолчанию 18:00–22:00 локального времени). */
export function isPrimeTime(
  date: Date,
  timeZone: string,
  window: PrimeTimeWindow = { startHour: 18, endHour: 22 },
): boolean {
  const hour = getHourInTz(date, timeZone);
  return hour >= window.startHour && hour < window.endHour;
}

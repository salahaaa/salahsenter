export type VisibilityScheduleMode = "always" | "date_range" | "daily_window" | "weekly_window" | "monthly_first_week" | "custom_slots";

export type VisibilitySchedule = {
  mode?: VisibilityScheduleMode;
  timezone?: string;
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  weekDays?: number[];
  slots?: Array<{ date?: string | null; weekday?: number | null; startTime: string; endTime: string }>;
};

export const defaultVisibilitySchedule: VisibilitySchedule = { mode: "always", timezone: "Asia/Aden" };

export function normalizeVisibilitySchedule(value: unknown): VisibilitySchedule {
  const raw = (value || {}) as Partial<VisibilitySchedule>;
  const mode = ["always", "date_range", "daily_window", "weekly_window", "monthly_first_week", "custom_slots"].includes(raw.mode || "") ? raw.mode : "always";
  return {
    mode,
    timezone: raw.timezone || "Asia/Aden",
    startDate: raw.startDate || null,
    endDate: raw.endDate || null,
    startTime: raw.startTime || null,
    endTime: raw.endTime || null,
    weekDays: Array.isArray(raw.weekDays) ? raw.weekDays.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6) : [],
    slots: Array.isArray(raw.slots) ? raw.slots.filter((slot) => slot?.startTime && slot?.endTime).map((slot) => ({ date: slot.date || null, weekday: slot.weekday == null ? null : Number(slot.weekday), startTime: slot.startTime, endTime: slot.endTime })) : []
  };
}

function getZonedParts(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "";
  const weekdayName = get("weekday");
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}`, weekday: weekdayMap[weekdayName] ?? now.getUTCDay() };
}

function inDateRange(schedule: VisibilitySchedule, parts: { date: string }) {
  if (schedule.startDate && parts.date < schedule.startDate) return false;
  if (schedule.endDate && parts.date > schedule.endDate) return false;
  return true;
}

function inTimeRange(time: string, start?: string | null, end?: string | null) {
  if (!start || !end) return true;
  if (start <= end) return time >= start && time <= end;
  // crosses midnight
  return time >= start || time <= end;
}

export function isVisibleBySchedule(value: unknown, now = new Date()) {
  const schedule = normalizeVisibilitySchedule(value);
  if (!schedule.mode || schedule.mode === "always") return true;
  const parts = getZonedParts(now, schedule.timezone || "Asia/Aden");
  if (!inDateRange(schedule, parts)) return false;
  if (schedule.mode === "date_range") return true;
  if (schedule.mode === "daily_window") return inTimeRange(parts.time, schedule.startTime, schedule.endTime);
  if (schedule.mode === "weekly_window") return (schedule.weekDays || []).includes(parts.weekday) && inTimeRange(parts.time, schedule.startTime, schedule.endTime);
  if (schedule.mode === "monthly_first_week") return Number(parts.date.slice(-2)) >= 1 && Number(parts.date.slice(-2)) <= 7 && inTimeRange(parts.time, schedule.startTime, schedule.endTime);
  if (schedule.mode === "custom_slots") {
    return (schedule.slots || []).some((slot) => {
      const dateMatches = slot.date ? slot.date === parts.date : slot.weekday == null || Number(slot.weekday) === parts.weekday;
      return dateMatches && inTimeRange(parts.time, slot.startTime, slot.endTime);
    });
  }
  return true;
}

export function filterVisibleBySchedule<T extends { visibilitySchedule?: unknown }>(items: T[], now = new Date()) {
  return items.filter((item) => isVisibleBySchedule(item.visibilitySchedule, now));
}

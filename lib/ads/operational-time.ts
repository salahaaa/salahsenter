export const ADS_OPERATION_TIMEZONE = "Asia/Aden";

/**
 * Yemen has no daylight-saving time. Keeping the operational day in one
 * explicit timezone prevents a merchant seeing a different daily budget than
 * the cron/reporting path at UTC midnight.
 */
export function startOfAdsOperationalDay(value = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ADS_OPERATION_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value || 0);
  // Asia/Aden is UTC+03:00 with no DST.
  return new Date(Date.UTC(read("year"), read("month") - 1, read("day"), 0, 0, 0) - 3 * 60 * 60 * 1000);
}

export function adsOperationalDayRange(value = new Date()) {
  const start = startOfAdsOperationalDay(value);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end, timezone: ADS_OPERATION_TIMEZONE };
}

export function adsOperationalDayKey(value = new Date()) {
  return startOfAdsOperationalDay(value).toISOString().slice(0, 10);
}

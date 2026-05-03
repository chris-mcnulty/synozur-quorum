export type CadenceFrequency = "WEEKLY" | "BIWEEKLY" | "MONTHLY";

export interface ScheduleSpec {
  frequency: CadenceFrequency;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  hour: number;
  minute: number;
  timezone: string;
  lastRunAt?: Date | null;
}

interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

function getZonedParts(date: Date, tz: string): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
  });
  const parts = dtf.formatToParts(date);
  const o: Record<string, string> = {};
  for (const p of parts) o[p.type] = p.value;
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(o.year),
    month: Number(o.month),
    day: Number(o.day),
    hour: Number(o.hour) === 24 ? 0 : Number(o.hour),
    minute: Number(o.minute),
    weekday: weekdayMap[o.weekday ?? "Sun"] ?? 0,
  };
}

function getOffsetMs(date: Date, tz: string): number {
  const parts = getZonedParts(date, tz);
  const asUTC = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    date.getUTCSeconds(),
  );
  return asUTC - date.getTime();
}

function zonedTimeToUtc(
  y: number,
  m: number,
  d: number,
  h: number,
  mi: number,
  tz: string,
): Date {
  let utcMs = Date.UTC(y, m - 1, d, h, mi, 0);
  for (let i = 0; i < 3; i++) {
    const offset = getOffsetMs(new Date(utcMs), tz);
    utcMs = Date.UTC(y, m - 1, d, h, mi, 0) - offset;
  }
  return new Date(utcMs);
}

export function computeNextRun(after: Date, schedule: ScheduleSpec): Date {
  const tz = schedule.timezone || "UTC";
  for (let dayShift = 0; dayShift < 90; dayShift++) {
    const candidateBase = new Date(after.getTime() + dayShift * 86_400_000);
    const parts = getZonedParts(candidateBase, tz);
    const candidate = zonedTimeToUtc(
      parts.year,
      parts.month,
      parts.day,
      schedule.hour,
      schedule.minute,
      tz,
    );
    if (candidate.getTime() <= after.getTime()) continue;

    const candParts = getZonedParts(candidate, tz);

    if (schedule.frequency === "WEEKLY") {
      if (
        schedule.dayOfWeek != null &&
        candParts.weekday !== schedule.dayOfWeek
      ) {
        continue;
      }
    } else if (schedule.frequency === "BIWEEKLY") {
      if (
        schedule.dayOfWeek != null &&
        candParts.weekday !== schedule.dayOfWeek
      ) {
        continue;
      }
      if (schedule.lastRunAt) {
        const diffDays =
          (candidate.getTime() - schedule.lastRunAt.getTime()) / 86_400_000;
        if (diffDays < 13.5) continue;
      }
    } else if (schedule.frequency === "MONTHLY") {
      const dom = schedule.dayOfMonth ?? 1;
      if (candParts.day !== dom) continue;
    }

    return candidate;
  }
  // Fallback: 1 day from now
  return new Date(after.getTime() + 86_400_000);
}

export function renderTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    return variables[key] ?? "";
  });
}

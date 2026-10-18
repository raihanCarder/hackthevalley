import { MAYA_PROFILE } from "../demo/maya";
import { parseLocalDate, type LocalDate } from "../domain/contracts";
import { localToday, validateRange, type DateRange, type JournalProfile } from "./repository";

export function shiftDate(date: LocalDate, days: number): LocalDate {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(0);
  value.setUTCFullYear(year, month - 1, day + days);
  return parseLocalDate(value.toISOString().slice(0, 10));
}

export function defaultSelection(profile: JournalProfile): { range: DateRange; date: LocalDate } {
  const to = profile === "maya" ? MAYA_PROFILE.dateRange.end : localToday();
  const range = { from: profile === "maya" ? MAYA_PROFILE.dateRange.start : shiftDate(to, -41), to };
  return { range, date: to };
}

/** Deep links are selection only; server ownership never comes from URL parameters. */
export function initialSelection(profile: JournalProfile) {
  const selected = defaultSelection(profile);
  if (typeof window === "undefined") return selected;
  const query = new URLSearchParams(window.location.search);
  if (query.get("profile") !== profile) return selected;
  try {
    if (query.has("from") && query.has("to")) selected.range = validateRange({ from: parseLocalDate(query.get("from")), to: parseLocalDate(query.get("to")) });
    if (query.has("date")) {
      selected.date = parseLocalDate(query.get("date"));
      if (selected.date < selected.range.from) selected.range = { from: shiftDate(selected.date, -41), to: selected.date };
      if (selected.date > selected.range.to) selected.range = { from: shiftDate(selected.date, -41), to: selected.date };
    } else selected.date = selected.range.to;
  } catch { return defaultSelection(profile); }
  return selected;
}

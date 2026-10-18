import { MAYA_PROFILE } from "../demo/maya";
import { parseLocalDate, type LocalDate } from "../domain/contracts";
import { localToday, MAX_LIST_DAYS, validateRange, type DateRange, type JournalProfile } from "./repository";

export function shiftDate(date: LocalDate, days: number): LocalDate {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(0);
  value.setUTCFullYear(year, month - 1, day + days);
  return parseLocalDate(value.toISOString().slice(0, 10));
}

/** The range that starts at the first recorded check-in (or the selected date, if earlier) and ends at `to`. */
export function fitRangeToEntries(entries: readonly { localDate: LocalDate }[], date: LocalDate, to: LocalDate): DateRange {
  let from = date < to ? date : to;
  for (const entry of entries) if (entry.localDate < from) from = entry.localDate;
  const earliest = shiftDate(to, -(MAX_LIST_DAYS - 1));
  return { from: from < earliest ? earliest : from, to };
}

export function defaultSelection(profile: JournalProfile): { range: DateRange; date: LocalDate } {
  const to = profile === "maya" ? MAYA_PROFILE.dateRange.end : localToday();
  const range = { from: profile === "maya" ? MAYA_PROFILE.dateRange.start : shiftDate(to, -41), to };
  return { range, date: to };
}

/**
 * Deep links are selection only; server ownership never comes from URL parameters.
 * `linkedRange` is true when the link named both ends of the range, so callers must not refit it.
 */
export function initialSelection(profile: JournalProfile): { range: DateRange; date: LocalDate; linkedRange: boolean } {
  const selected = { ...defaultSelection(profile), linkedRange: false };
  if (typeof window === "undefined") return selected;
  const query = new URLSearchParams(window.location.search);
  if (query.get("profile") !== profile) return selected;
  try {
    if (query.has("from") && query.has("to")) {
      selected.range = validateRange({ from: parseLocalDate(query.get("from")), to: parseLocalDate(query.get("to")) });
      selected.linkedRange = true;
    }
    if (query.has("date")) {
      selected.date = parseLocalDate(query.get("date"));
      if (selected.date < selected.range.from) selected.range = { from: shiftDate(selected.date, -41), to: selected.date };
      if (selected.date > selected.range.to) selected.range = { from: shiftDate(selected.date, -41), to: selected.date };
    } else selected.date = selected.range.to;
  } catch { return { ...defaultSelection(profile), linkedRange: false }; }
  return selected;
}

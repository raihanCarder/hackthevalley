"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_BODY_SHAPE, normalizeShape, type BodyShape } from "./body-shape";

/** The visitor's chosen body shape, kept in this browser only. It never changes saved maps or measurements. */
const KEY = "pain-journal-body-shape";
const CHANGED = "pain-journal-body-shape-changed";

export function readBodyShapePreference(): BodyShape {
  try { return normalizeShape(JSON.parse(window.localStorage.getItem(KEY) ?? "null")); }
  catch { return DEFAULT_BODY_SHAPE; }
}

/** Shared preference: every editor and viewer on the page (and other tabs) follows the latest choice. */
export function useBodyShapePreference(): [BodyShape, (next: BodyShape) => void] {
  // Start from the default for server rendering; the stored choice is read after mounting.
  const [shape, setShape] = useState<BodyShape>(DEFAULT_BODY_SHAPE);
  useEffect(() => {
    const sync = () => setShape(readBodyShapePreference());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(CHANGED, sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener(CHANGED, sync); };
  }, []);
  const update = useCallback((next: BodyShape) => {
    const value = normalizeShape(next);
    setShape(value);
    try { window.localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* still applies for this page */ }
    window.dispatchEvent(new Event(CHANGED));
  }, []);
  return [shape, update];
}

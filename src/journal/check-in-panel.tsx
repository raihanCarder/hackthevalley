"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { parseLocalDate, type LocalDate } from "../domain/contracts";
import { acknowledgeSave, copyPreviousMap, createDraft, editDraft, rejectSave, restoreDraft, saveInput, type JournalDraft } from "./draft";
import { localToday, MAX_NOTE_LENGTH, type JournalRepository, type JournalStorage } from "./repository";
import type { JournalEditorBridge } from "./editor";
import styles from "./journal.module.css";

interface Props { storage: JournalStorage; repository: JournalRepository | null; editor?: JournalEditorBridge; connectionError?: string | null; onBusyChange?: (busy: boolean) => void }

export function CheckInPanel({ storage, repository, editor, connectionError, onBusyChange }: Props) {
  const [draft, setDraft] = useState<JournalDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [readState, setReadState] = useState<"unknown" | "missing" | "recorded" | "error">("unknown");
  const drafts = useRef(new Map<string, JournalDraft>());
  const mapVersions = useRef(new Map<string, number>());
  const active = useRef<JournalDraft | null>(null);
  const selection = useRef(0);
  const loadAbort = useRef<AbortController | null>(null);
  const currentStorage = useRef(storage);
  currentStorage.current = storage;

  function update(next: JournalDraft) {
    active.current = next;
    drafts.current.set(`${currentStorage.current}:${next.localDate}`, next);
    setDraft(next);
  }

  async function selectDate(date: LocalDate) {
    const revision = ++selection.current;
    loadAbort.current?.abort();
    const abort = loadAbort.current = new AbortController();
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const cached = drafts.current.get(`${storage}:${date}`);
    // Saved drafts are re-read so another tab's acknowledged updates are visible.
    const hasEdits = cached && ["unsaved", "saving", "error"].includes(cached.saveState);
    const local = hasEdits ? cached : createDraft(date, zone);
    update(local);
    setMessage(null);
    setReadState("unknown");
    setLoading(false);
    if (hasEdits) {
      try {
        if (editor && cached.maps) await editor.load(cached.maps, { signal: abort.signal });
        else if (editor) await editor.clear({ signal: abort.signal });
      } catch {
        if (revision === selection.current) setMessage("This draft's body map could not be restored. Your note is still here.");
      }
      return;
    }
    mapVersions.current.set(`${storage}:${date}`, (mapVersions.current.get(`${storage}:${date}`) ?? 0) + 1);
    if (editor) await editor.clear({ signal: abort.signal });
    if (revision !== selection.current || !repository) return;
    setLoading(true);
    try {
      const entry = await repository.read("visitor", date, { signal: abort.signal });
      if (revision !== selection.current) return;
      // Do not overwrite notes typed while the read was in flight.
      if (active.current?.revision !== local.revision) return;
      if (editor) {
        if (entry) await editor.load(entry.maps, { signal: abort.signal }); else await editor.clear({ signal: abort.signal });
        if (revision !== selection.current) return;
      }
      update(entry ? restoreDraft(entry) : local);
      setReadState(entry ? "recorded" : "missing");
    } catch (error) {
      if (revision === selection.current) {
        setReadState("error");
        setMessage(error instanceof Error ? error.message : "This check-in could not be opened.");
      }
    } finally { if (revision === selection.current) setLoading(false); }
  }

  useEffect(() => {
    void selectDate(active.current?.localDate ?? localToday());
    return () => { selection.current++; loadAbort.current?.abort(); };
    // Reconnect or editor readiness changes restore the selected date without losing its draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository, editor, storage]);

  useEffect(() => editor?.subscribe(() => {
    const current = active.current;
    if (!current) return;
    const next = editDraft(current, {});
    const key = `${currentStorage.current}:${next.localDate}`;
    const mapVersion = (mapVersions.current.get(key) ?? 0) + 1;
    mapVersions.current.set(key, mapVersion);
    update(next);
    // Keep a detached map with an in-memory draft even if its store/date changes before encoding finishes.
    void editor.snapshot().then(maps => {
      const cached = drafts.current.get(key);
      if (!cached || mapVersions.current.get(key) !== mapVersion) return;
      const withMap = { ...cached, maps };
      drafts.current.set(key, withMap);
      if (`${currentStorage.current}:${active.current?.localDate}` === key && active.current?.revision === cached.revision) update(withMap);
    }).catch(() => { /* The next explicit save reports encoding errors and retains the draft. */ });
  }), [editor]);

  useEffect(() => { onBusyChange?.(busy); return () => onBusyChange?.(false); }, [busy, onBusyChange]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if ([...drafts.current.values()].some(value => ["unsaved", "saving", "error"].includes(value.saveState))) {
        event.preventDefault(); event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  async function save() {
    if (!editor || !repository || !active.current || busy) return;
    setBusy(true); setMessage(null);
    const selected = selection.current;
    const baseline = active.current;
    try {
      const maps = await editor.snapshot();
      if (selected !== selection.current || !active.current) return;
      const submitted = { ...baseline, maps };
      update({ ...active.current, maps: active.current.revision === baseline.revision ? maps : active.current.maps,
        saveState: "saving", error: null });
      const entry = await repository.upsert(saveInput(submitted));
      if (selected === selection.current && active.current) update(acknowledgeSave(active.current, submitted, entry));
    } catch {
      if (selected === selection.current && active.current) update(rejectSave(active.current));
    } finally { setBusy(false); }
  }

  async function prepareMap(kind: "previous" | "empty") {
    if (!editor || !repository || !active.current || busy) return;
    setBusy(true); setMessage(null);
    const selected = selection.current;
    const key = `${currentStorage.current}:${active.current.localDate}`;
    try {
      if (kind === "previous") {
        const entry = await repository.previous("visitor", active.current.localDate);
        if (selected !== selection.current) return;
        if (!entry) { setMessage("There is no earlier recorded check-in to copy."); return; }
        mapVersions.current.set(key, (mapVersions.current.get(key) ?? 0) + 1);
        await editor.load(entry.maps);
        if (selected === selection.current && active.current) { update(copyPreviousMap(active.current, entry)); setReadState("unknown"); }
      } else {
        mapVersions.current.set(key, (mapVersions.current.get(key) ?? 0) + 1);
        await editor.clear();
        const maps = await editor.snapshot();
        if (selected === selection.current && active.current) { update({ ...editDraft(active.current, { maps }), copiedFrom: null }); setReadState("unknown"); }
      }
    } catch (error) {
      if (selected === selection.current) setMessage(error instanceof Error ? error.message : "The body map could not be prepared. Your note is still here.");
    } finally { setBusy(false); }
  }

  async function changeDate(value: string) {
    if (!value || busy) return;
    try {
      const date = parseLocalDate(value);
      if (editor && active.current && ["unsaved", "error", "saving"].includes(active.current.saveState)) {
        const maps = await editor.snapshot();
        if (active.current) update({ ...active.current, maps });
      }
      await selectDate(date);
    } catch { setMessage("Choose a valid calendar date. Your draft has not changed."); }
  }

  if (!draft) return <aside className={styles.panel} role="status">Preparing your check-in…</aside>;
  const unavailable = !repository || !editor;
  const stateText = loading ? "Opening check-in…" : draft.saveState === "saved" ? "Saved check-in" : draft.saveState === "saving" ? "Saving…" : draft.saveState !== "idle" ? "Unsaved draft" : readState === "missing" ? "No check-in recorded" : readState === "error" ? "Check-in unavailable" : "Draft only";
  return <aside className={styles.panel} aria-label="Daily check-in">
    <div className={styles.panelHeader}>
    <div className={styles.dateField}><label htmlFor="check-in-date">Check-in date</label>
      <Input id="check-in-date" type="date" value={draft.localDate} disabled={busy} onChange={event => void changeDate(event.target.value)} />
    </div>
    <Badge variant="outline" className={styles.draftStatus} role="status" aria-live="polite">{stateText}</Badge>
    <div className={styles.mapActions}>
      <Button variant="ghost" type="button" disabled={unavailable || busy || loading} onClick={() => void prepareMap("previous")}><Copy size={14} aria-hidden="true" />Copy previous map</Button>
      <Button variant="ghost" type="button" disabled={unavailable || busy || loading} onClick={() => void prepareMap("empty")}><RotateCcw size={14} aria-hidden="true" />Start with an empty map</Button>
    </div>
    </div>
    {draft.copiedFrom && <p className={styles.source}>Map copied from {draft.copiedFrom}. Save to record it for {draft.localDate}.</p>}
    <div className={styles.composer}>
    <div className={styles.noteField}><label htmlFor="check-in-note">A note for this day <span>(optional)</span></label>
      <Textarea id="check-in-note" rows={2} maxLength={MAX_NOTE_LENGTH} value={draft.note} aria-describedby="note-help note-length"
        placeholder="What would you like to remember?" onChange={event => update(editDraft(active.current!, { note: event.target.value }))} />
    </div>
    <div className={styles.composerFooter}>
      <div className={styles.noteMeta}><span id="note-help">Written in your own words.</span><span id="note-length">{draft.note.length.toLocaleString()} / 4,000</span></div>
      <Button className={styles.save} type="button" disabled={unavailable || busy || loading || readState === "error"} onClick={() => void save()}>{draft.saveState === "error" ? "Retry saving check-in" : draft.saveState === "saving" ? "Saving check-in…" : "Save check-in"}<ArrowUp size={16} aria-hidden="true" /></Button>
    </div>
    </div>
    {(draft.error || message || connectionError) && <p className={styles.error} role="alert">{draft.error ?? message ?? connectionError}</p>}
    {draft.saveState === "saved" && <Link className="text-link" href={`/history?profile=visitor&date=${draft.localDate}`}>View history</Link>}
    {readState === "error" && <Button variant="ghost" type="button" disabled={busy || loading} onClick={() => void selectDate(draft.localDate)}>Retry opening check-in</Button>}
    {unavailable && <p className={styles.explanation}>Saving body maps is not available yet. Your note stays here while this page is open.</p>}
    <p className={styles.explanation}>An empty map is recorded only when you save it. Days you skip stay unrecorded.</p>
    <p className={styles.privacy}>Notes are not sent to an AI service when you save a check-in.</p>
  </aside>;
}

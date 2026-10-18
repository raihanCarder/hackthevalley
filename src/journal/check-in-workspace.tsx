"use client";

import { useEffect, useState, useRef } from "react";
import type { BodyHandle } from "../body/body-handle";
import { createEditorBridge } from "./editor";
import { BodyWorkbench } from "../body/body-workbench";
import { PAIN_LABELS, PAIN_TYPES } from "../domain/contracts";
import { CheckInPanel } from "./check-in-panel";
import { IndexedDbJournal, localVisitorId } from "./indexeddb";
import { HttpJournal } from "./http";
import { journalMapServices, syntheticJournalSource } from "./integrations";
import type { JournalRepository, JournalStorage } from "./repository";
import styles from "./journal.module.css";

interface ServiceStatuses { postgresql: string; gemini: string }

export function CheckInWorkspace() {
  const body = useRef<BodyHandle | null>(null);
  const [editor] = useState(() => createEditorBridge(body));
  const [storage, setStorage] = useState<JournalStorage | null>(null);
  const [preferenceError, setPreferenceError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [repository, setRepository] = useState<JournalRepository | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<ServiceStatuses>({ postgresql: "Checking…", gemini: "Checking…" });

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("pain-journal-storage");
      setStorage(saved === "postgresql" ? "postgresql" : "indexeddb");
      if (!saved) window.localStorage.setItem("pain-journal-storage", "indexeddb");
    } catch { setPreferenceError("Choose a save location. This browser cannot remember your selection."); }
  }, []);

  function chooseStorage(value: JournalStorage) {
    setStorage(value);
    try { window.localStorage.setItem("pain-journal-storage", value); setPreferenceError(null); }
    catch { setPreferenceError("This save location is selected for this page. The browser cannot remember it after reloading."); }
  }

  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/status", { signal: abort.signal, cache: "no-store" }).then(response => response.json()).then(body => {
      setServices({ postgresql: body.services?.postgresql ?? "Unavailable", gemini: body.services?.gemini ?? "Unavailable" });
    }).catch(() => { if (!abort.signal.aborted) setServices({ postgresql: "Unavailable", gemini: "Unknown" }); });
    return () => abort.abort();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let local: IndexedDbJournal | undefined;
    setError(null); setRepository(null);
    if (!storage) return;
    if (storage === "indexeddb") {
      try {
        local = new IndexedDbJournal({ profileId: localVisitorId(window.localStorage), maps: journalMapServices, synthetic: syntheticJournalSource });
        setRepository(local);
      } catch (failure) { setError(failure instanceof Error ? failure.message : "Browser storage is unavailable."); }
    } else {
      const server = new HttpJournal();
      server.bootstrap().then(() => { if (!cancelled) setRepository(server); }).catch(failure => {
        if (!cancelled) setError(failure instanceof Error ? failure.message : "PostgreSQL is unavailable. Your selected store has not changed.");
      });
    }
    return () => { cancelled = true; if (local) void local.close(); };
  }, [storage]);

  return <>
    <div className={styles.storage}>
      <label htmlFor="journal-storage">Save location<select id="journal-storage" disabled={busy} value={storage ?? ""} onChange={event => chooseStorage(event.target.value as JournalStorage)}>
        {!storage && <option value="" disabled>Choose a save location</option>}
        <option value="indexeddb">This browser (IndexedDB)</option><option value="postgresql">Local PostgreSQL</option>
      </select></label>
      <dl className={styles.services} aria-label="Service status"><div><dt>PostgreSQL:</dt><dd>{services.postgresql}</dd></div><div><dt>Gemini:</dt><dd>{services.gemini}</dd></div></dl>
    </div>
    {preferenceError && <p className={styles.error} role="alert">{preferenceError}</p>}
    <div className="check-in-layout"><BodyWorkbench handleRef={body} onChange={editor.notify} />{storage ? <CheckInPanel storage={storage} repository={repository?.storage === storage ? repository : null} editor={editor} connectionError={error} onBusyChange={setBusy} /> : <aside className={styles.panel}>Choose where to save your check-ins.</aside>}</div>
    <div className={styles.sensations} aria-label="Pain sensation legend"><ul>{PAIN_TYPES.map(type => <li key={type}><span className={`sensation-dot ${type}`} aria-hidden="true" />{PAIN_LABELS[type]}</li>)}</ul></div>
  </>;
}

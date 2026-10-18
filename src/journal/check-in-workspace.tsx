"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname } from "next/navigation";
import type { BodyHandle } from "../body/body-handle";
import { createEditorBridge } from "./editor";
import { BodyWorkbench } from "../body/body-workbench";
import { CheckInPanel } from "./check-in-panel";
import { IndexedDbJournal, localVisitorId } from "./indexeddb";
import { HttpJournal } from "./http";
import { journalMapServices, syntheticJournalSource } from "./integrations";
import type { JournalRepository, JournalStorage } from "./repository";
import styles from "./journal.module.css";

interface ServiceStatuses { postgresql: string; gemini: string }

export function CheckInWorkspace({ children }: { children: React.ReactNode }) {
  const details = usePathname() === "/check-in";
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

  // Both views stay mounted in their shared layout, preserving the live map and unsaved notes between tabs.
  return <div className="journal-workspace" data-view={details ? "details" : "map"}>
    {children}
    <div className={styles.mapView} hidden={details}><BodyWorkbench handleRef={body} onChange={editor.notify} /></div>
    <section className={styles.detailsView} hidden={!details} aria-label="Check-in details">
      <header className="page-heading"><div><p className="section-label">Your daily check-in</p><h1>Check-in details</h1></div><p>Add a note and save the body map you’ve been working on.</p></header>
      {preferenceError && <p className={styles.error} role="alert">{preferenceError}</p>}
      {storage ? <CheckInPanel storage={storage} repository={repository?.storage === storage ? repository : null} editor={editor} connectionError={error} onBusyChange={setBusy} /> : <aside className={styles.panel}>Choose where to save your check-ins.</aside>}
    <div className={styles.storage}>
      <label htmlFor="journal-storage">Save location<select id="journal-storage" disabled={busy} value={storage ?? ""} onChange={event => chooseStorage(event.target.value as JournalStorage)}>
        {!storage && <option value="" disabled>Choose a save location</option>}
        <option value="indexeddb">This browser (IndexedDB)</option><option value="postgresql">Local PostgreSQL</option>
      </select></label>
      <dl className={styles.services} aria-label="Service status"><div><dt>PostgreSQL:</dt><dd>{services.postgresql}</dd></div><div><dt>Gemini:</dt><dd>{services.gemini}</dd></div></dl>
    </div>
      <section className={styles.keyboardGuide} aria-labelledby="keyboard-guide-heading"><h2 id="keyboard-guide-heading">Using the body map</h2><p>In Rotate mode, drag to turn the body and scroll to zoom. In Paint mode, drag on the body to mark what you feel.</p><p>With the body focused, use arrow keys to turn, + / − to zoom, and Home to reset the view. Ctrl or ⌘ + Z undoes a stroke.</p></section>
    </section>
  </div>;
}

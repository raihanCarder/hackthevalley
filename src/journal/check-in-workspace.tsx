"use client";

import { useEffect, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();
  const [mapPanel, setMapPanel] = useState<"tools" | "body">("tools");
  function changePanel(panel: "tools" | "body" | "details") {
    if (panel !== "details") setMapPanel(panel);
    if (details !== (panel === "details")) router.push(panel === "details" ? "/check-in" : "/", { scroll: false });
  }
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

  // The scene and details stay mounted, preserving the live map and unsaved notes between panels.
  return <div className="journal-workspace" data-view="map">
    {children}
    <div className={styles.mapView}><BodyWorkbench handleRef={body} onChange={editor.notify} panel={details ? "details" : mapPanel} onPanelChange={changePanel} checkInDetails={
    <section className={styles.detailsView} aria-label="Check-in details">
      <header className={styles.detailsHeading}><h1>Check-in details</h1><p>Add a note and save your body map.</p></header>
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
    } /></div>
  </div>;
}

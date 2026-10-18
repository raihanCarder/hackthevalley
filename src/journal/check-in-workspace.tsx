"use client";

import { useEffect, useId, useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUp, Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BodyHandle } from "../body/body-handle";
import { createEditorBridge } from "./editor";
import { BodyWorkbench } from "../body/body-workbench";
import { decodePaintSnapshot } from "../body/map-utils";
import { MAYA_ENTRIES } from "../demo/maya";
import { CheckInPanel } from "./check-in-panel";
import { HttpJournal } from "./http";
import { useJournalProfile } from "./profile-context";
import { parseLocalDate, type LocalDate } from "../domain/contracts";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { MAX_NOTE_LENGTH } from "./repository";
import styles from "./journal.module.css";

export function CheckInWorkspace({ children }: { children: React.ReactNode }) {
  const { profile, ready, setBusy } = useJournalProfile();
  const details = usePathname() === "/check-in";
  const router = useRouter();
  const [mapPanel, setMapPanel] = useState<"tools" | "body">("tools");
  const [openedYou, setOpenedYou] = useState(false);
  useEffect(() => { if (ready && profile === "visitor") setOpenedYou(true); }, [ready, profile]);
  function changePanel(panel: "tools" | "body" | "details") {
    if (panel !== "details") setMapPanel(panel);
    if (details !== (panel === "details")) router.push(panel === "details" ? "/check-in" : "/", { scroll: false });
  }
  const body = useRef<BodyHandle | null>(null);
  const [editor] = useState(() => createEditorBridge(body));
  const [repository, setRepository] = useState<HttpJournal | null>(null);
  // The workbench attaches its body handle before the first restoration starts.
  useEffect(() => { if (openedYou) setRepository(new HttpJournal()); }, [openedYou]);

  return <div className="journal-workspace" data-view="map">
    {children}
    {!ready && <p role="status">Opening journal…</p>}
    {/* Keep You's editor mounted while viewing Maya, preserving unsaved maps and notes. */}
    {openedYou && <div className={styles.mapView} hidden={profile !== "visitor"}><BodyWorkbench handleRef={body} onChange={editor.notify} panel={details ? "details" : mapPanel} onPanelChange={changePanel} checkInDetails={
      <section className={styles.detailsView} aria-label="Check-in details">
        <header className={styles.detailsHeading}><h1>Check-in details</h1><p>Add a note and save your body map.</p></header>
        <CheckInPanel storage="postgresql" repository={repository} editor={repository ? editor : undefined} onBusyChange={setBusy} />
      </section>
    } /></div>}
    {ready && profile === "maya" && <div className={styles.mapView}><MayaWorkbench panel={details ? "details" : mapPanel} onPanelChange={changePanel} /></div>}
  </div>;
}

function MayaWorkbench({ panel, onPanelChange }: { panel: "tools" | "body" | "details"; onPanelChange(panel: "tools" | "body" | "details"): void }) {
  const id = useId();
  const [date, setDate] = useState<LocalDate>(MAYA_ENTRIES[MAYA_ENTRIES.length - 1].localDate);
  const entry = MAYA_ENTRIES.find(value => value.localDate === date) ?? null;
  const body = useRef<BodyHandle | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!entry) { body.current?.load(null); setError(null); return; }
    setError(null);
    decodePaintSnapshot(entry.maps).then(layers => { if (!cancelled) body.current?.load(layers); })
      .catch(reason => { if (!cancelled) setError(reason instanceof Error ? reason.message : "The sample map could not be opened."); });
    return () => { cancelled = true; };
  }, [entry]);
  return <BodyWorkbench readOnly panel={panel} onPanelChange={onPanelChange} initialLayers={null} handleRef={body}
    checkInDetails={<section className={styles.detailsView} aria-label="Check-in details">
      <header className={styles.detailsHeading}><h1>Check-in details</h1><p>Maya’s synthetic sample, shown as recorded.</p></header>
      <aside className={styles.panel} aria-label="Maya sample check-in">
        <div className={styles.panelHeader}>
          <div className={styles.dateField}><label htmlFor={`${id}-date`}>Check-in date</label>
            <Input id={`${id}-date`} type="date" min={MAYA_ENTRIES[0].localDate} max={MAYA_ENTRIES[MAYA_ENTRIES.length - 1].localDate} value={date}
              onChange={event => { try { setDate(parseLocalDate(event.target.value)); } catch { /* Keep the last valid sample date. */ } }} />
          </div>
          <div className={styles.mapActions}>
            <Button variant="ghost" type="button" disabled><Copy size={14} aria-hidden="true" />Copy previous map</Button>
            <Button variant="ghost" type="button" disabled><RotateCcw size={14} aria-hidden="true" />Start with an empty map</Button>
          </div>
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.composer}>
          <div className={styles.noteField}><label htmlFor={`${id}-note`}>A note for this day <span>(optional)</span></label>
            <Textarea id={`${id}-note`} rows={2} maxLength={MAX_NOTE_LENGTH} value={entry?.note ?? ""} readOnly aria-describedby={`${id}-note-help ${id}-note-length`} />
          </div>
          <div className={styles.composerFooter}>
            <div className={styles.noteMeta}><span id={`${id}-note-help`}>Maya’s fixed sample record.</span><span id={`${id}-note-length`}>{(entry?.note ?? "").length.toLocaleString()} / 4,000</span></div>
            <Button className={styles.save} type="button" disabled>Save check-in<ArrowUp size={16} aria-hidden="true" /></Button>
          </div>
        </div>
      </aside>
    </section>} />;
}

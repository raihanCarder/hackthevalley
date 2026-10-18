"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { JournalProfile } from "./repository";

const ProfileContext = createContext<{
  profile: JournalProfile; ready: boolean; busy: boolean;
  chooseProfile(profile: JournalProfile): void; setBusy(value: boolean): void;
} | null>(null);

/** Preferences only live in the browser. All of You's records live in local PostgreSQL. */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<JournalProfile>("visitor");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const query = new URLSearchParams(window.location.search).get("profile");
    let saved: string | null = null;
    try { saved = window.localStorage.getItem("pain-journal-profile"); } catch { /* Preferences are optional. */ }
    setProfile(query === "maya" || (query === null && saved === "maya") ? "maya" : "visitor");
    setReady(true);
  }, []);
  function chooseProfile(next: JournalProfile) {
    if (busy) return;
    setProfile(next);
    try { window.localStorage.setItem("pain-journal-profile", next); } catch { /* Records do not depend on this preference. */ }
    // A selection-specific deep link must not override the newly selected profile on reload.
    const url = new URL(window.location.href);
    url.search = "";
    window.history.replaceState(null, "", url);
  }
  return <ProfileContext.Provider value={{ profile, ready, busy, chooseProfile, setBusy }}>{children}</ProfileContext.Provider>;
}

export function useJournalProfile() {
  const value = useContext(ProfileContext);
  if (!value) throw new Error("Journal profile provider is missing.");
  return value;
}

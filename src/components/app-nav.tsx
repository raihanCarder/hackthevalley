"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Check, ChevronsUpDown, FileText, History, ScanLine, Sparkles, UserRound } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useJournalProfile } from "@/journal/profile-context";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function AppNav() {
  const pathname = usePathname();
  const { profile, ready, busy, chooseProfile } = useJournalProfile();
  const links = [
    { href: "/", label: "Check-in", icon: ScanLine },
    { href: "/history", label: "History", icon: History },
    { href: "/report", label: "Appointment report", icon: FileText },
  ];

  return <aside className="app-sidebar" aria-label="Journal sidebar">
    <Link className="wordmark" href="/" aria-label="Pain journal home">
      <span className="brand-icon"><Activity size={22} strokeWidth={1.6} aria-hidden="true" /></span>
      <span>pain journal<span className="brand-caption">A little more understanding.</span></span>
    </Link>
    <nav aria-label="Main navigation">{links.map(({ href, label, icon: Icon }) =>
      <Button key={href} asChild variant="ghost" className="nav-link">
        <Link href={href} aria-current={pathname === href || (href === "/" && pathname === "/check-in") ? "page" : undefined}><Icon size={18} strokeWidth={1.7} aria-hidden="true" />{label}</Link>
      </Button>
    )}</nav>
    <Separator className="sidebar-divider" />
    <div className="sidebar-spacer" />
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="sidebar-footer profile-trigger" aria-label={`Switch profile, current profile ${profile === "maya" ? "Maya" : "You"}`} disabled={!ready || busy}>
          <span className="profile-avatar">{profile === "maya" ? <Sparkles size={17} aria-hidden="true" /> : <UserRound size={17} aria-hidden="true" />}</span>
          <span className="profile-label">{profile === "maya" ? "Maya" : "You"}</span>
          <ChevronsUpDown size={16} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal><DropdownMenu.Content className="profile-menu" side="top" align="end" sideOffset={8}>
        <DropdownMenu.RadioGroup value={profile} onValueChange={value => chooseProfile(value as "visitor" | "maya")}>
          <DropdownMenu.RadioItem className="profile-option" value="visitor"><UserRound size={18} aria-hidden="true" /><span>You</span><DropdownMenu.ItemIndicator><Check size={16} aria-hidden="true" /></DropdownMenu.ItemIndicator></DropdownMenu.RadioItem>
          <DropdownMenu.RadioItem className="profile-option" value="maya"><Sparkles size={18} aria-hidden="true" /><span>Maya</span><DropdownMenu.ItemIndicator><Check size={16} aria-hidden="true" /></DropdownMenu.ItemIndicator></DropdownMenu.RadioItem>
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content></DropdownMenu.Portal>
    </DropdownMenu.Root>
  </aside>;
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, FileText, History, ScanLine, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function AppNav() {
  const pathname = usePathname();
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
    <div className="sidebar-hint"><p>Your experience, over time.</p><span>Map what you feel. Notice what changes. Bring it to your next conversation.</span></div>
    <div className="sidebar-footer"><span className="profile-avatar"><UserRound size={17} aria-hidden="true" /></span><div>Your journal<span>Personal prototype</span></div></div>
  </aside>;
}

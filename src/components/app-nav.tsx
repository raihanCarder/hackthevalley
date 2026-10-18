"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Clock3, FileText } from "lucide-react";

export function AppNav() {
  const pathname = usePathname();
  const navItems = [
    { href: "/", label: "Check-in", icon: Activity },
    { href: "/history", label: "History", icon: Clock3 },
    { href: "/report", label: "Appointment report", icon: FileText },
  ] as const;

  return (
    <nav className="nav-group" aria-label="Main navigation">
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`nav-link ${isActive ? "active" : ""}`}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="nav-icon" size={17} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

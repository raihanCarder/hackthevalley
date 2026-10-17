"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppNav() {
  const pathname = usePathname();
  return <nav aria-label="Main navigation">{[["/", "Check-in"], ["/history", "History"], ["/report", "Appointment report"]].map(([href, label]) =>
    <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined}>{label}</Link>
  )}</nav>;
}

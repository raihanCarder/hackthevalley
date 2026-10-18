import type { Metadata } from "next";
import { AppNav } from "@/components/app-nav";
import { ProfileProvider } from "@/journal/profile-context";
import "./globals.css";

export const metadata: Metadata = { title: "feel", applicationName: "feel", description: "Map what you feel. A 3D body map for recording sensations and exploring changes over time." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="dark"><body><ProfileProvider>
    <a className="skip-link" href="#main">Skip to content</a>
    <AppNav />
    <main id="main" tabIndex={-1}>{children}</main>
  </ProfileProvider></body></html>;
}

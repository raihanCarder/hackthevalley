import type { Metadata } from "next";
import { AppNav } from "@/components/app-nav";
import { ProfileProvider } from "@/journal/profile-context";
import "./globals.css";

export const metadata: Metadata = { title: "Pain journal", description: "A body map for your daily pain journal." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className="dark"><body><ProfileProvider>
    <a className="skip-link" href="#main">Skip to content</a>
    <AppNav />
    <main id="main" tabIndex={-1}>{children}</main>
  </ProfileProvider></body></html>;
}

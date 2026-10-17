import type { Metadata } from "next";
import { AppNav } from "@/components/app-nav";
import "./globals.css";

export const metadata: Metadata = { title: "Pain journal", description: "A body map for your daily pain journal." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="app-header"><a className="wordmark" href="/">pain journal<span>A little more understanding.</span></a><AppNav /></header>
    <main id="main">{children}</main>
    <footer className="app-footer"><span>A place to describe what you feel.</span><span>Prototype · body scene foundation</span></footer>
  </body></html>;
}

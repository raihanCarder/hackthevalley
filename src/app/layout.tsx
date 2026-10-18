import type { Metadata } from "next";
import { AppNav } from "@/components/app-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pain journal",
  description: "A rotatable 3D body map for your daily pain journal.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <header className="app-header">
          <a className="wordmark" href="/">
            <span className="brand-dot" aria-hidden="true" />
            <span className="brand-name">pain journal</span>
            <span className="brand-tagline">A little more understanding.</span>
          </a>
          <AppNav />
        </header>
        <main id="main">{children}</main>
        <footer className="app-footer">
          <div className="session-status">
            <span className="status-dot-active" aria-hidden="true" />
            <span>Journal session active</span>
          </div>
          <p className="footer-tagline">A place to describe what you feel.</p>
        </footer>
      </body>
    </html>
  );
}

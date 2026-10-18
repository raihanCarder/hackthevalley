import Link from "next/link";
import { HistoryView } from "@/timeline/history-view";
import { AppNav } from "@/components/app-nav";
import { Info, Sparkles } from "lucide-react";

export default function HistoryPage() {
  return (
    <div className="app-page-layout">
      {/* Consistent Left Navigation Sidebar */}
      <aside className="app-sidebar app-sidebar-compact" aria-label="History navigation">
        <div className="sidebar-top">
          <header className="sidebar-brand">
            <Link href="/" className="wordmark" aria-label="Pain journal home">
              <span className="brand-dot" aria-hidden="true" />
              <span className="brand-name">pain journal</span>
            </Link>
            <span className="brand-tagline">A little more understanding.</span>
          </header>

          <div className="sidebar-nav-container">
            <AppNav />
          </div>
        </div>

        <div className="sidebar-context">
          <div className="history-context-panel">
            <div className="workflow-header">
              <div className="status-pill history-pill">
                <Sparkles size={13} aria-hidden="true" />
                <span>Maya · 6-Week Record</span>
              </div>
              <p className="section-label">Timeline &amp; Analysis</p>
              <h2 className="sidebar-heading">A picture over time</h2>
              <p className="workflow-lead">
                Scrub through 42 days of synthetic history to observe pain progression, intensity shifts, and regional trends.
              </p>
            </div>

            <div className="inspection-card">
              <div className="card-header-row">
                <Info className="card-icon" size={15} aria-hidden="true" />
                <h2>How to analyze</h2>
              </div>
              <p>Use the scrubber slider to step through individual days, or hit Play to watch the animated progression.</p>
              <p className="sub-instruction">Compare specific dates to detect newly marked regions or pain spread.</p>
            </div>
          </div>
        </div>

        <footer className="sidebar-footer">
          <div className="session-status">
            <span className="status-dot-active" aria-hidden="true" />
            <span>Journal session active</span>
          </div>
          <p className="footer-tagline">A place to describe what you feel.</p>
        </footer>
      </aside>

      {/* Main Content Area */}
      <main id="main" className="history-page">
        <header className="page-heading">
          <div>
            <p className="section-label">History &amp; Analysis</p>
            <h1>A picture over time.</h1>
          </div>
          <p>
            Scrub through daily records, replay pain progression, and analyze regional trends without external dependencies.
          </p>
        </header>

        <HistoryView />
      </main>
    </div>
  );
}

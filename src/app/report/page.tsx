import Link from "next/link";
import { AppNav } from "@/components/app-nav";
import { ArrowRight, Info, ShieldCheck } from "lucide-react";

export default function ReportPage() {
  return (
    <div className="app-page-layout">
      {/* Consistent Left Navigation Sidebar */}
      <aside className="app-sidebar app-sidebar-compact" aria-label="Report navigation">
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
          <div className="report-context-panel">
            <div className="workflow-header">
              <div className="status-pill report-pill">
                <ShieldCheck size={13} aria-hidden="true" />
                <span>Appointment Ready</span>
              </div>
              <p className="section-label">Clinical Documentation</p>
              <h2 className="sidebar-heading">Doctor Report</h2>
              <p className="workflow-lead">
                Transform journal history into a concise, printable one-page summary for your next doctor appointment.
              </p>
            </div>

            <div className="inspection-card">
              <div className="card-header-row">
                <Info className="card-icon" size={15} aria-hidden="true" />
                <h2>Objective &amp; Descriptive</h2>
              </div>
              <p>The report summarizes recorded regions, peak sensations, and trends without diagnosing or recommending medical treatment.</p>
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
      <main id="main" className="report-page-container">
        <header className="page-heading">
          <div>
            <p className="section-label">Appointment report</p>
            <h1>Bring your experience with you.</h1>
          </div>
          <p>
            A printable summary will bring together recorded locations, sensations, and changes across your selected dates.
          </p>
        </header>

        <div className="report-preview-card">
          <div className="report-badge-row">
            <span className="report-status-pill">
              <ShieldCheck size={14} aria-hidden="true" />
              Milestone 5 Feature
            </span>
            <span className="report-note-label">Printable PDF &amp; Summary</span>
          </div>
          <h2>Evidence-Based Doctor Summary</h2>
          <p>
            When you visit your physician, pain can be hard to articulate from memory. The appointment report consolidates your daily 3D markings, sensation frequencies, and newly developed areas into an objective, factual document.
          </p>
          <div className="report-features-list">
            <div className="report-feature-item">
              <span className="feature-check" aria-hidden="true">✓</span>
              <div>
                <strong>Front &amp; Back Pain Maps</strong>
                <p>Visual captures of your primary affected regions.</p>
              </div>
            </div>
            <div className="report-feature-item">
              <span className="feature-check" aria-hidden="true">✓</span>
              <div>
                <strong>Timeline Trends &amp; Sensation Breakdown</strong>
                <p>Intensity and coverage metrics across burning, sharp, aching, and tingling pain.</p>
              </div>
            </div>
            <div className="report-feature-item">
              <span className="feature-check" aria-hidden="true">✓</span>
              <div>
                <strong>Purely Descriptive Documentation</strong>
                <p>Objective facts to support patient-doctor conversations without unverified diagnosis.</p>
              </div>
            </div>
          </div>
          <div className="report-action-row">
            <Link className="action-button primary" href="/">
              Explore the body map
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

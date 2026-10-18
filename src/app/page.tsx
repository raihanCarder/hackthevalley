import Link from "next/link";
import { BodyWorkbench } from "@/body/body-workbench";
import { AppNav } from "@/components/app-nav";
import { PAIN_LABELS, PAIN_TYPES } from "@/domain/contracts";
import { Compass, Info } from "lucide-react";

export default function CheckInPage() {
  return (
    <div className="home-screen-layout">
      {/* Left Column: Navigation, Brand, and Check-in Context */}
      <aside className="app-sidebar home-sidebar" aria-label="Check-in controls and navigation">
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
          <div className="checkin-workflow">
            <div className="workflow-header">
              <div className="status-pill">
                <span className="pulse-indicator" aria-hidden="true" />
                <span>Today · Oct 17</span>
              </div>
              <p className="section-label">Your daily check-in</p>
              <h1>Where do you feel it?</h1>
              <p className="workflow-lead">
                Start with your body. Inspect all angles and prepare to record what you feel.
              </p>
            </div>

            <section className="sensations-card" aria-label="Pain sensations">
              <div className="card-header-row">
                <h2>Four sensations</h2>
                <span className="card-badge">Layers</span>
              </div>
              <p className="sensations-hint">Each sensation has an independent visual layer:</p>
              <ul className="sensations-list">
                {PAIN_TYPES.map((type) => (
                  <li key={type} className="sensation-item">
                    <span className={`sensation-dot ${type}`} aria-hidden="true" />
                    <span className="sensation-name">{PAIN_LABELS[type]}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="inspection-card" aria-label="Inspection guidance">
              <div className="card-header-row">
                <Compass className="card-icon" size={15} aria-hidden="true" />
                <h2>Get to know your map</h2>
              </div>
              <p>Turn the body to inspect a location. Left and right always refer to your own body.</p>
              <p className="sub-instruction">Use the view buttons below the stage, or drag to rotate and scroll to zoom.</p>
            </section>

            <section className="milestone-card" aria-label="Preview status">
              <div className="card-header-row">
                <Info className="card-icon" size={15} aria-hidden="true" />
                <h2>Foundation Preview</h2>
              </div>
              <p>Direct 3D painting and daily entry saves are arriving in upcoming milestones.</p>
            </section>
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

      {/* Right Column: 3D Body Model Taking Full Viewport */}
      <main id="main" className="home-stage-area">
        <BodyWorkbench />
      </main>
    </div>
  );
}

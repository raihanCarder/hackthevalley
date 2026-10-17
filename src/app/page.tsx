import { BodyWorkbench } from "@/body/body-workbench";
import { PAIN_LABELS, PAIN_TYPES } from "@/domain/contracts";

export default function CheckInPage() {
  return <>
    <div className="page-heading"><div><p className="section-label">Your daily check-in</p><h1>Where do you feel it?</h1></div><p>Start with your body.<br />Take a moment to look around.</p></div>
    <div className="check-in-layout"><BodyWorkbench /><aside className="instruction-rail">
      <section><span className="step-number">1</span><h2>Get to know your map</h2><p>Turn the body to inspect a location. Left and right always refer to your own body.</p><p>Choose a named view, or drag to rotate. Scroll or pinch to zoom.</p></section>
      <section className="sensations"><h2>Different ways to feel</h2><p>Four sensations will each have their own paint layer.</p><ul>{PAIN_TYPES.map(type => <li key={type}><span className={`sensation-dot ${type}`} aria-hidden="true" />{PAIN_LABELS[type]}</li>)}</ul></section>
      <section className="milestone-note"><h2>The first step</h2><p>This is the body scene preview. Painting and saving check-ins are coming in the next milestones.</p><p>No check-in has been recorded.</p></section>
    </aside></div>
  </>;
}

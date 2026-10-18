import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import styles from "./home.module.css";

export const metadata: Metadata = {
  title: "feel | Map what you feel.",
  description: "Paint where and how pain feels on a rotatable 3D body, record daily check-ins, and explore how your pain changes over time.",
};

export default function HomePage() {
  return <div className={styles.home} data-home-page>
    <header className={styles.hero}>
      <h1>Map what you feel.</h1>
      <p className={styles.subtitle}>
        <span className={styles.expandedCopy}>Paint where and how pain feels on a rotatable 3D body, save daily check-ins,
        and see how intensity, coverage, and patterns change over time.</span>
        <span className={styles.compactCopy}>Paint sensations on a rotatable 3D body, save daily check-ins, and explore how your pain changes over time.</span>
      </p>
      <div className={styles.actions}>
        <Button asChild size="lg"><Link href="/">Open body map</Link></Button>
        <Button asChild size="lg" variant="outline"><Link href="/history">Explore history</Link></Button>
      </div>
    </header>

    <section className={styles.workflow} aria-labelledby="workflow-heading">
      <div className={styles.workflowIntro}>
        <h2 id="workflow-heading">From a daily feeling <br />to a picture over time.</h2>
        <p>A place to record your experience, notice changes, and bring more detail to a conversation.</p>
      </div>
      <dl className={styles.steps}>
        <div>
          <dt>Map what you feel</dt>
          <dd><span className={styles.expandedCopy}>Rotate the body and paint the location and intensity of burning, sharp, aching, or tingling sensations. Add an optional note and save your daily check-in.</span><span className={styles.compactCopy}>Paint location, sensation, and intensity. Add a note and save the day.</span></dd>
        </div>
        <div>
          <dt>See what changes</dt>
          <dd><span className={styles.expandedCopy}>Replay your saved maps, follow regional intensity, coverage, and frequency, and compare two dates to see newly marked areas.</span><span className={styles.compactCopy}>Replay saved maps, follow regional trends, and compare two dates.</span></dd>
        </div>
        <div>
          <dt>Bring the details with you</dt>
          <dd><span className={styles.expandedCopy}>Prepare a printable appointment report with your maps, notes, and recorded observations. It describes your experience without diagnosing or recommending treatment.</span><span className={styles.compactCopy}>Print your maps, notes, and descriptive observations for an appointment.</span></dd>
        </div>
      </dl>
    </section>
  </div>;
}

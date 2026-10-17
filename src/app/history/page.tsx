import { HistoryView } from "@/timeline/history-view";

export default function HistoryPage() {
  return (
    <div className="history-page">
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
    </div>
  );
}

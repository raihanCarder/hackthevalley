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
          Replay saved maps, explore regional trends, and compare recorded changes over time.
        </p>
      </header>

      <HistoryView />
    </div>
  );
}

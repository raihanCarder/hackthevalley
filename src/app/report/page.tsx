import { ReportView } from "@/report/report-view";

export default function ReportPage() {
  return <>
    <div className="page-heading"><div><p className="section-label">Appointment report</p><h1>Bring your experience with you.</h1></div>
      <p>A one-page summary of saved check-ins.<br />It describes records; it does not diagnose.</p></div>
    <ReportView />
  </>;
}

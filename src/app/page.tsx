import { CheckInWorkspace } from "@/journal/check-in-workspace";

export default function CheckInPage() {
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="section-label">Your daily check-in</p>
          <h1>Where do you feel it?</h1>
        </div>
        <p>
          Start with your body.
          <br />
          Take a moment to look around.
        </p>
      </div>
      <CheckInWorkspace />
    </>
  );
}

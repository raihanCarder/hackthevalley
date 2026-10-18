import { CheckInWorkspace } from "@/journal/check-in-workspace";

export default function JournalLayout({ children }: { children: React.ReactNode }) {
  return <CheckInWorkspace>{children}</CheckInWorkspace>;
}

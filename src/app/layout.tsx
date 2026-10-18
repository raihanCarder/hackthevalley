import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pain journal",
  description: "A rotatable 3D body map for your daily pain journal.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}

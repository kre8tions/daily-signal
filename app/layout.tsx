import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Daily Signal",
  description: "AI-curated news — the front page, intelligently edited.",
  openGraph: {
    title: "The Daily Signal",
    description: "AI-curated news — the front page, intelligently edited.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

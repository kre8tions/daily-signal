import type { Metadata } from "next";
import "./globals.css";
import { ClientBody } from "./ClientBody";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* All palette fonts loaded once */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Raleway:ital,wght@0,300;0,400;0,700;1,300&family=Barlow+Condensed:wght@400;700;900&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Oswald:wght@400;600;700&display=swap"
        />
      </head>
      <ClientBody>{children}</ClientBody>
    </html>
  );
}

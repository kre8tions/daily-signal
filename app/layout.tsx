import type { Metadata } from "next";
import "./globals.css";
import { ClientBody } from "./ClientBody";

export const metadata: Metadata = {
  title: "The Daily Signal",
  description: "AI-curated news — the front page, intelligently edited.",
  metadataBase: new URL("https://dailysignal.cc"),
  openGraph: {
    title: "The Daily Signal",
    description: "AI-curated news — the front page, intelligently edited.",
    type: "website",
    url: "https://dailysignal.cc",
    siteName: "The Daily Signal",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Palette fonts */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Raleway:ital,wght@0,300;0,400;0,700;1,300&family=Playfair+Display:ital,wght@0,400;0,700;1,400;1,700&family=Inter:wght@400;500;700&family=Space+Grotesk:wght@400;500;700&display=swap" />
        {/* Quote fonts — daily rotation pool */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Cormorant+Garamond:ital,wght@0,600;1,400;1,600&family=DM+Serif+Display:ital@0;1&family=Cinzel:wght@700;900&family=Fraunces:ital,wght@0,900;1,900&family=Libre+Baskerville:ital,wght@0,700;1,400&family=Bodoni+Moda:ital,wght@0,800;1,500;1,800&family=Spectral:ital,wght@1,600;1,800&display=swap" />
      </head>
      <ClientBody>{children}</ClientBody>
    </html>
  );
}

import { head } from "@vercel/blob";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { S1Insight } from "@/lib/stories";
import { P, contrastColor, CURSIVE_FONT_FAMILY, CURSIVE_FONT_URL } from "@/lib/palette";
import { ShareButton } from "@/app/ShareButton";

export const dynamic = "force-dynamic";

async function fetchInsight(slug: string): Promise<S1Insight | null> {
  try {
    const blob = await head(`s1-insight/v1/${slug}.json`);
    if (!blob) return null;
    const res = await fetch(blob.url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json() as S1Insight;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const insight = await fetchInsight(slug);
  return {
    title: insight ? `${insight.title} — The Daily Signal` : "Insight — The Daily Signal",
    description: insight ? insight.body.split("\n\n")[0].slice(0, 160) : "A personal-development insight from The Daily Signal.",
  };
}

const DOMAIN_LABEL: Record<string, string> = {
  habits: "Habits", learning: "Learning", finance: "Finance", career: "Career",
  relationships: "Relationships", health: "Health", reasoning: "Reasoning", creativity: "Creativity",
};

export default async function InsightPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const insight = await fetchInsight(slug);
  if (!insight) notFound();

  const paragraphs = insight.body.split("\n\n").filter(Boolean);
  const domainLabel = DOMAIN_LABEL[insight.domain] ?? insight.domain;

  return (
    <div style={{ minHeight: "100vh", background: P.articleBg, color: P.ink, fontFamily: P.fontBody, paddingBottom: 80 }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={CURSIVE_FONT_URL} />

      {/* Masthead */}
      <div style={{ paddingTop: 20, paddingBottom: 20, paddingLeft: 24, paddingRight: 24, borderBottom: `1px solid ${P.tint}44` }}>
        <div style={{ maxWidth: 760, marginLeft: "auto", marginRight: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/" style={{ textDecoration: "none", color: P.ink, fontSize: 22, fontWeight: P.dark ? 400 : 900, fontFamily: P.fontHeading, letterSpacing: P.dark ? 3 : -0.5, textTransform: P.dark ? "uppercase" : "none" as const }}>The Daily Signal</a>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", background: P.accent + "18", color: P.accent, textDecoration: "none", paddingTop: 10, paddingBottom: 10, paddingLeft: 22, paddingRight: 22, borderRadius: 50, fontSize: 13, fontWeight: 700, fontFamily: P.fontBody, border: `1px solid ${P.accent}55` }}>Home</a>
        </div>
      </div>

      {/* Hero image */}
      {insight.imageUrl && (
        <div style={{ maxWidth: 760, marginLeft: "auto", marginRight: "auto", marginTop: 32, paddingLeft: 24, paddingRight: 24 }}>
          <div style={{ borderRadius: 16, overflow: "hidden", height: 320 }}>
            <img src={insight.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }} />
          </div>
        </div>
      )}

      <div style={{ maxWidth: 760, marginLeft: "auto", marginRight: "auto", paddingTop: insight.imageUrl ? 32 : 48, paddingLeft: 24, paddingRight: 24 }}>

        {/* Domain pill + Insight label */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" as const, color: P.accent, fontFamily: P.fontBody }}>Insight</span>
          <span style={{ width: 3, height: 3, borderRadius: "50%", background: P.inkLight, display: "inline-block" }} />
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" as const, color: P.inkLight, fontFamily: P.fontBody }}>{domainLabel}</span>
        </div>

        {/* Title + share */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 32 }}>
          <h1 style={{ fontFamily: P.fontHeading, fontSize: "clamp(24px, 5vw, 38px)", fontWeight: P.dark ? 400 : 900, lineHeight: 1.15, color: P.ink, letterSpacing: P.dark ? 1 : -0.5, textTransform: P.dark ? "uppercase" : "none" as const, margin: 0 }}>
            {insight.title}
          </h1>
          <div style={{ flexShrink: 0, paddingTop: 6 }}>
            <ShareButton title={`${insight.title} — The Daily Signal`} url={`/insight/${slug}`} color={P.accent} fontBody={P.fontBody} />
          </div>
        </div>

        {/* News hook callout */}
        {insight.newsHook && (
          <div style={{ background: P.accent + "12", borderLeft: `3px solid ${P.accent}`, paddingTop: 12, paddingBottom: 12, paddingLeft: 18, paddingRight: 18, marginBottom: 28, borderRadius: "0 10px 10px 0" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, marginBottom: 4, fontFamily: P.fontBody }}>Today&apos;s Signal</div>
            <div style={{ fontSize: 15, color: P.inkMid, fontFamily: P.fontBody, lineHeight: 1.5 }}>{insight.newsHook}</div>
          </div>
        )}

        {/* Body */}
        <div style={{ display: "flex", flexDirection: "column", gap: 22, marginBottom: 40 }}>
          {paragraphs.map((para, i) => (
            <p key={i} style={{ fontSize: 18, lineHeight: 1.8, color: i === 0 ? P.ink : P.inkMid, fontFamily: "Georgia, 'Times New Roman', serif", margin: 0 }}>
              {para}
            </p>
          ))}
        </div>

        {/* Micro-action */}
        <div style={{ background: P.accent, borderRadius: 16, paddingTop: 22, paddingBottom: 22, paddingLeft: 26, paddingRight: 26, marginBottom: 40 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" as const, color: contrastColor(P.accent) + "bb", marginBottom: 8, fontFamily: P.fontBody }}>Try This</div>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: contrastColor(P.accent), fontWeight: 600, fontFamily: P.fontBody, margin: 0 }}>{insight.microAction}</p>
        </div>

        {/* Attribution */}
        <div style={{ borderTop: `1px solid ${P.tint}44`, paddingTop: 20, marginBottom: 32 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.inkLight, fontFamily: P.fontBody, marginBottom: 4 }}>Grounded In</div>
          <div style={{ fontSize: 15, color: P.inkMid, fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic" }}>{insight.source}</div>
        </div>

        {/* Nav */}
        <div style={{ borderTop: `1px solid ${P.tint}44`, paddingTop: 24 }}>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", background: P.accent, color: contrastColor(P.accent), textDecoration: "none", paddingTop: 12, paddingBottom: 12, paddingLeft: 24, paddingRight: 24, borderRadius: 50, fontSize: 13, fontWeight: 700, fontFamily: P.fontBody }}>Back to Today&apos;s Edition</a>
        </div>

      </div>
    </div>
  );
}

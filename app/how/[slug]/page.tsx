import { getHowTo } from "@/lib/stories";
import { P, contrastColor, CURSIVE_FONT_FAMILY, CURSIVE_FONT_URL } from "@/lib/palette";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ a?: string }>;
}): Promise<Metadata> {
  const { a } = await searchParams;
  const action = a ? Buffer.from(a, "base64").toString("utf8") : "How To";
  return {
    title: `${action} — The Daily Signal`,
    description: "A simple how-to guide from The Daily Signal.",
  };
}

export default async function HowToPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ a?: string; as?: string; at?: string }>;
}) {
  const { slug } = await params;
  const { a, as: articleSlug, at: articleTitleB64 } = await searchParams;
  const action = a ? Buffer.from(a, "base64").toString("utf8") : null;
  if (!action) notFound();

  const articleTitle = articleTitleB64 ? decodeURIComponent(articleTitleB64) : null;

  const howto = await getHowTo(action, slug);
  if (!howto) notFound();

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

      <div style={{ maxWidth: 760, marginLeft: "auto", marginRight: "auto", paddingTop: 48, paddingLeft: 24, paddingRight: 24 }}>

        {/* "How To" label in cursive */}
        <div style={{ fontSize: 32, color: P.accent, marginBottom: 8, fontFamily: CURSIVE_FONT_FAMILY, lineHeight: 1 }}>How To</div>

        {/* Title */}
        <h1 style={{ fontFamily: P.fontHeading, fontSize: "clamp(24px, 5vw, 38px)", fontWeight: P.dark ? 400 : 900, lineHeight: 1.15, color: P.ink, letterSpacing: P.dark ? 1 : -0.5, textTransform: P.dark ? "uppercase" : "none" as const, marginBottom: 48, marginTop: 8 }}>
          {howto.title}
        </h1>

        {/* Steps */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28, marginBottom: 48 }}>
          {howto.steps.map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              {/* Cursive number, no circle */}
              <div style={{ flexShrink: 0, fontSize: 48, lineHeight: 1, color: P.accent, fontFamily: CURSIVE_FONT_FAMILY, width: 36, textAlign: "center" as const }}>
                {i + 1}
              </div>
              <div style={{ paddingTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: P.accent, marginBottom: 6, fontFamily: P.fontBody }}>{step.heading}</div>
                <div style={{ fontSize: 17, lineHeight: 1.75, color: P.inkMid, fontFamily: "Georgia, 'Times New Roman', serif" }}>{step.instruction}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Why */}
        <div style={{ background: `${P.accent}12`, border: `1px solid ${P.accent}33`, borderRadius: 16, paddingTop: 22, paddingBottom: 22, paddingLeft: 26, paddingRight: 26, marginBottom: 48 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" as const, color: P.accent, marginBottom: 10, fontFamily: P.fontBody }}>Why This Matters</div>
          <p style={{ fontSize: 17, lineHeight: 1.75, color: P.inkMid, fontStyle: "italic", fontFamily: "Georgia, 'Times New Roman', serif", margin: 0 }}>{howto.why}</p>
        </div>

        {/* Nav */}
        <div style={{ borderTop: `1px solid ${P.tint}44`, paddingTop: 24, display: "flex", gap: 16, flexWrap: "wrap" as const, alignItems: "center" }}>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", background: P.accent, color: contrastColor(P.accent), textDecoration: "none", paddingTop: 12, paddingBottom: 12, paddingLeft: 24, paddingRight: 24, borderRadius: 50, fontSize: 13, fontWeight: 700, fontFamily: P.fontBody }}>Home</a>
          {articleSlug && articleTitle && (
            <a href={`/article/${articleSlug}`} style={{ fontSize: 15, color: P.ink, textDecoration: "none", fontFamily: P.fontBody, fontWeight: 600 }}>
              {articleTitle.length > 60 ? articleTitle.slice(0, 60) + "…" : articleTitle}
            </a>
          )}
        </div>

      </div>
    </div>
  );
}

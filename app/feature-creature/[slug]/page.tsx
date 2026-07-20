import { notFound } from "next/navigation";
import { head } from "@vercel/blob";
import type { FeatureCreature } from "@/lib/stories";
import { P, contrastColor, CURSIVE_FONT_FAMILY, CURSIVE_FONT_URL } from "@/lib/palette";
import { ShareButton } from "@/app/ShareButton";
import { DecorativeDivider } from "@/components/DecorativeDivider";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

async function loadFC(slug: string): Promise<FeatureCreature | null> {
  try {
    const existing = await head(`feature-creature/v20/${slug}.json`);
    if (!existing) return null;
    const res = await fetch(existing.url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json() as FeatureCreature;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const fc = await loadFC(slug);
  return {
    title: fc ? `${fc.title} — The Daily Signal` : "Feature Creature — The Daily Signal",
    description: fc?.synopsis ?? "A Feature Creature editorial from The Daily Signal.",
    openGraph: fc?.imageUrl ? { images: [fc.imageUrl] } : undefined,
  };
}

export default async function FeatureCreaturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const fc = await loadFC(slug);
  if (!fc) notFound();

  const angleColors: Record<string, string> = { science: "#27AE8F", build: "#5B8DEF", culture: "#D4517A" };
  const angleEmoji: Record<string, string> = { science: "🔬", build: "🛠️", culture: "🌍" };
  const color = angleColors[fc.angleKey] ?? P.accent;
  const emoji = angleEmoji[fc.angleKey] ?? "🪄";

  // Same seeded pull quote style as regular articles (0=left border, 1=big quotes, 2=decorative divider)
  const slugSeed = slug.split("").reduce((a: number, c: string, i: number) => a + c.charCodeAt(0) * (i + 1), 0);
  const pullQuoteStyle = slugSeed % 3;

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

        {/* Label */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 22 }}>{emoji}</span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" as const, color, fontFamily: P.fontBody }}>Feature Creature</div>
            <div style={{ fontSize: 13, color: P.inkLight, fontFamily: P.fontBody, marginTop: 2 }}>
              <span style={{ color, fontWeight: 600 }}>{fc.angleLabel}</span>
              <span style={{ marginLeft: 8, marginRight: 8 }}>·</span>
              <span>{fc.universe}</span>
            </div>
          </div>
        </div>

        {/* Title */}
        <div style={{ fontFamily: `'${CURSIVE_FONT_FAMILY}', cursive`, fontSize: "clamp(32px, 6vw, 52px)", color, lineHeight: 1.1, marginBottom: 32, fontWeight: 700 }}>{fc.title}</div>

        {/* Hero image */}
        {fc.imageUrl && (
          <div style={{ borderRadius: 20, overflow: "hidden", marginBottom: 36, aspectRatio: "16/9" }}>
            <img src={fc.imageUrl} alt={fc.universe} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} />
          </div>
        )}

        {/* Body with mid-article cursive headers + mid image */}
        <div style={{ marginBottom: 40 }}>
          {fc.body.split("\n\n").filter(Boolean).map((para, i) => (
            <div key={i}>
              {/* Header before paragraph 0 and paragraph 3 */}
              {(i === 0 || i === 3) && fc.headers?.[i === 0 ? 0 : 1] && (
                <div style={{ fontFamily: `'${CURSIVE_FONT_FAMILY}', cursive`, fontSize: 36, color, lineHeight: 1, marginBottom: 12, marginTop: i === 0 ? 0 : 36, fontWeight: 700 }}>
                  {fc.headers[i === 0 ? 0 : 1]}
                </div>
              )}
              <p style={{ fontSize: 19, lineHeight: 1.9, color: P.inkMid, fontFamily: "Georgia, 'Times New Roman', serif", marginTop: 0, marginBottom: 24 }}>{para}</p>
              {/* Mid-article: image2 if available, else pull-quote — placement seeded per edition */}
              {i === (fc.pullQuoteAfterPara ?? 3) - 1 && (
                fc.imageUrl2 ? (
                  <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 32, marginTop: 8, aspectRatio: "16/9" }}>
                    <img src={fc.imageUrl2} alt={`${fc.universe} — ${fc.angleLabel}`} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} />
                  </div>
                ) : fc.pullQuote && pullQuoteStyle === 0 ? (
                  /* Style A: left-border blockquote */
                  <blockquote style={{ borderLeft: `4px solid ${color}`, paddingLeft: 24, marginLeft: 0, marginRight: 0, marginBottom: 28, marginTop: 4 }}>
                    <p style={{ fontSize: 22, fontStyle: "italic", color, lineHeight: 1.5, fontFamily: "Georgia, 'Times New Roman', serif", margin: 0 }}>{fc.pullQuote}</p>
                  </blockquote>
                ) : fc.pullQuote && pullQuoteStyle === 1 ? (
                  /* Style B: large decorative quotation marks */
                  <div style={{ position: "relative", paddingTop: 28, paddingBottom: 28, paddingLeft: 48, paddingRight: 48, marginBottom: 28, marginTop: 4, maxWidth: 720 }}>
                    <span style={{ position: "absolute", top: -8, left: 0, fontSize: 100, lineHeight: 1, color, opacity: 0.18, fontFamily: "Georgia, serif", userSelect: "none" }}>&ldquo;</span>
                    <p style={{ fontSize: 23, fontStyle: "italic", color, lineHeight: 1.55, fontFamily: "Georgia, 'Times New Roman', serif", margin: 0, textAlign: "center" }}>{fc.pullQuote}</p>
                    <span style={{ position: "absolute", bottom: -24, right: 0, fontSize: 100, lineHeight: 1, color, opacity: 0.18, fontFamily: "Georgia, serif", userSelect: "none" }}>&rdquo;</span>
                  </div>
                ) : fc.pullQuote ? (
                  /* Style C: ornamental divider */
                  <DecorativeDivider color={color} index={slugSeed} />
                ) : null
              )}
            </div>
          ))}
        </div>

        {/* Call To Action — cursive header + concluding paragraph */}
        {fc.callToAction && (
          <>
            {fc.ctaHeader && (
              <div style={{ fontFamily: `'${CURSIVE_FONT_FAMILY}', cursive`, fontSize: 36, color, lineHeight: 1, marginBottom: 12, marginTop: 36, fontWeight: 700 }}>
                {fc.ctaHeader}
              </div>
            )}
            <p style={{ fontSize: 19, lineHeight: 1.9, color: P.inkMid, fontFamily: "Georgia, 'Times New Roman', serif", marginTop: 0, marginBottom: 40 }}>{fc.callToAction}</p>
          </>
        )}

        {/* Dig Deeper */}
        {fc.digDeeper && (
          <div style={{ background: `${color}12`, border: `1px solid ${color}33`, borderRadius: 16, paddingTop: 22, paddingBottom: 22, paddingLeft: 26, paddingRight: 26, marginBottom: 48 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" as const, color, marginBottom: 10, fontFamily: P.fontBody }}>Dig Deeper</div>
            <p style={{ fontSize: 17, lineHeight: 1.75, color: P.inkMid, fontStyle: "italic", fontFamily: "Georgia, 'Times New Roman', serif", margin: 0 }}>{fc.digDeeper.replace(/^dig deeper:?\s*/i, "")}</p>
          </div>
        )}

        {/* Nav */}
        <div style={{ borderTop: `1px solid ${P.tint}44`, paddingTop: 24, display: "flex", alignItems: "center", gap: 12 }}>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", background: P.accent, color: contrastColor(P.accent), textDecoration: "none", paddingTop: 12, paddingBottom: 12, paddingLeft: 24, paddingRight: 24, borderRadius: 50, fontSize: 13, fontWeight: 700, fontFamily: P.fontBody }}>Home</a>
          <ShareButton title={fc.title} url={`/feature-creature/${slug}`} color={P.accent} fontBody={P.fontBody} />
        </div>
      </div>
    </div>
  );
}

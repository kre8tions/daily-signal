import { getPageData, getStoryBySlug, getFullArticle, getEdition, urlToSlug, type Story, type ArticleCommentary } from "@/lib/stories";
import { notFound } from "next/navigation";
import { P, SECTION_COLORS, contrastColor } from "@/lib/palette";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const story = await getStoryBySlug(slug);
  if (!story) return { title: "The Daily Signal" };

  const title = story.title;
  const description = story.summary ?? "AI-curated news — the front page, intelligently edited.";
  const image = story.imageUrl;

  return {
    title: `${title} — The Daily Signal`,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      siteName: "The Daily Signal",
      ...(image ? { images: [{ url: image, width: 1200, height: 630, alt: title }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = await getStoryBySlug(slug);
  if (!story) notFound();

  const { stories } = await getPageData();
  const related = stories.filter((s) => s.link !== story.link);
  const { key: editionKey } = getEdition();
  const fullArticle = await getFullArticle(story, related, editionKey);

  const sectionColor = SECTION_COLORS[story.section] ?? "#888";
  const pubDate = new Date(story.pubDate).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  return (
    <div style={{ minHeight: "100vh", background: P.pageBg, color: P.ink, fontFamily: P.fontBody, paddingBottom: 80 }}>

      {/* Masthead */}
      <div style={{ paddingTop: 20, paddingBottom: 20, paddingLeft: 24, paddingRight: 24, borderBottom: `1px solid ${P.tint}44` }}>
        <div style={{ maxWidth: 860, marginLeft: "auto", marginRight: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/" style={{ textDecoration: "none", color: P.ink, fontSize: 22, fontWeight: P.dark ? 400 : 900, fontFamily: P.fontHeading, letterSpacing: P.dark ? 3 : -0.5, textTransform: P.dark ? "uppercase" : "none" as const }}>The Daily Signal</a>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", background: P.accent + "18", color: P.accent, textDecoration: "none", paddingTop: 10, paddingBottom: 10, paddingLeft: 22, paddingRight: 22, borderRadius: 50, fontSize: 13, fontWeight: 700, fontFamily: P.fontBody, border: `1px solid ${P.accent}55` }}>Home</a>
        </div>
      </div>

      <div style={{ maxWidth: 860, marginLeft: "auto", marginRight: "auto", paddingTop: 40, paddingLeft: 24, paddingRight: 24 }}>

        {/* Section pill */}
        <div style={{ marginBottom: 18 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, background: sectionColor + "22", color: sectionColor, paddingTop: 3, paddingBottom: 3, paddingLeft: 9, paddingRight: 9, borderRadius: 20, border: `1px solid ${sectionColor}44`, fontFamily: P.fontBody }}>
            {story.section}
          </span>
        </div>

        {/* Title */}
        <h1 style={{ fontFamily: P.fontHeading, fontSize: "clamp(26px, 5vw, 42px)", fontWeight: P.dark ? 400 : 900, lineHeight: 1.15, color: P.ink, letterSpacing: P.dark ? 1 : -0.5, textTransform: P.dark ? "uppercase" : "none" as const, marginBottom: 20 }}>
          {story.title}
        </h1>

        {/* Meta */}
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: P.inkLight, marginBottom: 30, fontFamily: P.fontBody }}>
          <span style={{ fontWeight: 700, color: P.inkMid }}>{story.source}</span>
          <span>·</span>
          <span>{pubDate}</span>
        </div>

        {/* Hero image */}
        {story.imageUrl && (
          <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 36, aspectRatio: "16/7", position: "relative" }}>
            <img src={story.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${P.accent}22 0%, transparent 60%)` }} />
          </div>
        )}

        {/* Editorial commentary */}
        {fullArticle?.body && (
          <div style={{ marginBottom: 36 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 20 }}>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" as const, color: P.accent, fontFamily: P.fontBody }}>The Signal Take</div>
              {fullArticle.writer && (
                <div style={{ fontSize: 12, color: P.inkLight, fontFamily: P.fontBody, letterSpacing: 0.5 }}>by {fullArticle.writer}</div>
              )}
            </div>
            {fullArticle.header && (
              <div style={{ fontFamily: P.fontHeading, fontSize: "clamp(22px, 4vw, 34px)", fontWeight: P.dark ? 400 : 900, letterSpacing: P.dark ? 2 : -0.5, textTransform: P.dark ? "uppercase" as const : "none" as const, color: sectionColor, lineHeight: 1.1, marginBottom: 20 }}>
                {fullArticle.header}
              </div>
            )}
            {fullArticle.body.split("\n\n").filter(Boolean).map((para, i) => (
              <div key={i}>
                <p style={{ fontSize: 19, lineHeight: 1.9, color: P.ink, marginBottom: 26, fontFamily: "Georgia, 'Times New Roman', serif", maxWidth: 720 }}
                  dangerouslySetInnerHTML={{ __html: para.trim()
                    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                    .replace(/\*(.+?)\*/g, "<em>$1</em>") }} />
                {i === 2 && fullArticle.pullQuote && (
                  <blockquote style={{ borderLeft: `4px solid ${sectionColor}`, paddingLeft: 24, marginLeft: 0, marginRight: 0, marginBottom: 28, marginTop: 4 }}>
                    <p style={{ fontSize: 22, fontStyle: "italic", color: sectionColor, lineHeight: 1.5, fontFamily: "Georgia, 'Times New Roman', serif", margin: 0 }}>{fullArticle.pullQuote}</p>
                  </blockquote>
                )}
              </div>
            ))}
            <div style={{ height: 1, background: `${P.tint}66`, marginTop: 8, marginBottom: 36 }} />
          </div>
        )}

        {/* Key Facts */}
        {story.bullets?.length ? (
          <div style={{ background: P.cardBg, borderRadius: 16, paddingTop: 22, paddingBottom: 22, paddingLeft: 28, paddingRight: 28, marginBottom: 28, boxShadow: P.shadow }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" as const, color: P.accent, marginBottom: 14, fontFamily: P.fontBody }}>Key Facts</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {story.bullets.map((b, i) => (
                <div key={i} style={{ display: "flex", gap: 12, fontSize: 14, lineHeight: 1.6, color: P.inkMid, fontFamily: P.fontBody }}>
                  <span style={{ color: P.accent, flexShrink: 0, fontWeight: 700 }}>*</span>{b}
                </div>
              ))}
            </div>
          </div>
        ) : null}


        {/* Signal Insight */}
        {story.insight && (
          <div style={{ background: `${P.accent}12`, borderRadius: 16, paddingTop: 20, paddingBottom: 20, paddingLeft: 26, paddingRight: 26, marginBottom: 36, border: `1px solid ${P.accent}33` }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" as const, color: P.accent, marginBottom: 8, fontFamily: P.fontBody }}>Signal Insight</div>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: P.inkMid, fontStyle: "italic", fontFamily: P.fontBody, marginBottom: 0 }}>{story.insight}</p>
          </div>
        )}

        {/* Read original */}
        <div style={{ borderTop: `1px solid ${P.tint}55`, paddingTop: 28, marginBottom: 48, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", background: P.accent + "18", color: P.accent, textDecoration: "none", paddingTop: 12, paddingBottom: 12, paddingLeft: 24, paddingRight: 24, borderRadius: 50, fontSize: 13, fontWeight: 700, fontFamily: P.fontBody, border: `1px solid ${P.accent}55` }}>Home</a>
          <div>
            <div style={{ fontSize: 11, color: P.inkLight, marginBottom: 4, fontFamily: P.fontBody }}>Originally published by</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: P.ink, fontFamily: P.fontHeading }}>{story.source}</div>
          </div>
          <a href={story.link} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: P.accent, color: contrastColor(P.accent), textDecoration: "none", paddingTop: 14, paddingBottom: 14, paddingLeft: 28, paddingRight: 28, borderRadius: 50, fontSize: 14, fontWeight: 700, fontFamily: P.fontBody }}>
            Read Full Article
          </a>
        </div>

        {/* Related Stories */}
        {related.length > 0 && (
          <div style={{ marginBottom: 48 }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" as const, color: P.accent, marginBottom: 16, fontFamily: P.fontBody }}>More From Today&apos;s Edition</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {related.slice(0, 5).map((s) => (
                <RelatedCard key={s.link} story={s} />
              ))}
            </div>
          </div>
        )}

        {/* Archive link */}
        <div style={{ borderTop: `1px solid ${P.tint}44`, paddingTop: 20, display: "flex", justifyContent: "center" }}>
          <a href="/archive" style={{ fontSize: 12, color: P.inkLight, textDecoration: "none", fontFamily: P.fontBody, letterSpacing: 1 }}>View Past Editions →</a>
        </div>

      </div>
    </div>
  );
}

function RelatedCard({ story }: { story: Story }) {
  const slug = urlToSlug(story.link);
  const sectionColor = SECTION_COLORS[story.section] ?? "#888";
  return (
    <a href={`/article/${slug}`} style={{ display: "flex", gap: 16, paddingTop: 16, paddingBottom: 16, borderBottom: `1px solid ${P.tint}44`, textDecoration: "none", alignItems: "flex-start" }}>
      {story.imageUrl && (
        <div style={{ width: 72, height: 52, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: P.tint }}>
          <img src={story.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: sectionColor, marginBottom: 4, fontFamily: P.fontBody }}>{story.section}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: P.ink, lineHeight: 1.3, fontFamily: P.fontHeading, textTransform: P.dark ? "uppercase" as const : "none" as const }}>{story.title}</div>
        {story.summary && <div style={{ fontSize: 12, color: P.inkMid, lineHeight: 1.5, marginTop: 4, fontFamily: P.fontBody }}>{story.summary.slice(0, 110)}{story.summary.length > 110 ? "…" : ""}</div>}
      </div>
    </a>
  );
}

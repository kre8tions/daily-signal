import { getPageData, urlToSlug, actionSlug, type Story, type Synthesis, type FeatureCreature } from "@/lib/stories";
import { P, QUOTE_FONT, SECTION_COLORS, TAGLINE, TAGLINE_FONT, ACTION_LABEL, ACTION_EMOJI, CURSIVE_FONT_FAMILY, CURSIVE_FONT_URL } from "@/lib/palette";
import type { Metadata } from "next";
import { EmailCapture } from "./EmailCapture";

export const revalidate = 14400;

export async function generateMetadata(): Promise<Metadata> {
  const { stories, synthesis } = await getPageData();
  const heroImage = stories[0]?.imageUrl;
  const title = synthesis?.theme
    ? `${synthesis.theme} — The Daily Signal`
    : "The Daily Signal";
  const description = synthesis?.observation
    ?? "AI-curated news — the front page, intelligently edited.";

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "The Daily Signal",
      ...(heroImage ? { images: [{ url: heroImage, width: 1200, height: 630, alt: title }] } : {}),
    },
    twitter: {
      card: heroImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(heroImage ? { images: [heroImage] } : {}),
    },
  };
}

function SpaceInvaderSVG({ color }: { color: string }) {
  const frame1 = [
    [2,0],[8,0],
    [3,1],[7,1],
    [2,2],[3,2],[4,2],[5,2],[6,2],[7,2],[8,2],
    [1,3],[2,3],[4,3],[5,3],[6,3],[8,3],[9,3],
    [0,4],[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[7,4],[8,4],[9,4],[10,4],
    [0,5],[2,5],[3,5],[4,5],[5,5],[6,5],[7,5],[8,5],[10,5],
    [0,6],[2,6],[8,6],[10,6],
    [3,7],[4,7],[7,7],[8,7],
  ];
  // Frame 2: claws tuck in, feet spread out
  const frame2 = [
    [2,0],[8,0],
    [3,1],[7,1],
    [2,2],[3,2],[4,2],[5,2],[6,2],[7,2],[8,2],
    [1,3],[2,3],[4,3],[5,3],[6,3],[8,3],[9,3],
    [0,4],[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[7,4],[8,4],[9,4],[10,4],
    [0,5],[2,5],[3,5],[4,5],[5,5],[6,5],[7,5],[8,5],[10,5],
    [1,6],[2,6],[8,6],[9,6],
    [0,7],[1,7],[9,7],[10,7],
  ];
  const S = 4;
  const mode = Math.floor(Date.now() / 14_400_000) % 3; // changes each edition: 0=wiggle 1=float 2=pulse

  if (mode === 0) {
    // Wiggle — two-frame arcade flip
    return (
      <div style={{ width: 44, height: 32, position: "relative" }}>
        <style>{`
          @keyframes si-f1 { 0%,49%{opacity:1} 50%,100%{opacity:0} }
          @keyframes si-f2 { 0%,49%{opacity:0} 50%,100%{opacity:1} }
        `}</style>
        <svg width="44" height="32" viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", top: 0, left: 0, animation: "si-f1 0.8s steps(1) infinite" }}>
          {frame1.map(([x, y]) => <rect key={`${x}-${y}`} x={x*S} y={y*S} width="3.5" height="3.5" fill={color} />)}
        </svg>
        <svg width="44" height="32" viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", top: 0, left: 0, animation: "si-f2 0.8s steps(1) infinite" }}>
          {frame2.map(([x, y]) => <rect key={`${x}-${y}`} x={x*S} y={y*S} width="3.5" height="3.5" fill={color} />)}
        </svg>
      </div>
    );
  }

  if (mode === 1) {
    // Float — gentle up/down bob
    return (
      <div style={{ width: 44, height: 32 }}>
        <style>{`@keyframes si-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }`}</style>
        <svg width="44" height="32" viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg" style={{ animation: "si-float 1.6s ease-in-out infinite" }}>
          {frame1.map(([x, y]) => <rect key={`${x}-${y}`} x={x*S} y={y*S} width="3.5" height="3.5" fill={color} />)}
        </svg>
      </div>
    );
  }

  // Pulse — scale breathe
  return (
    <div style={{ width: 44, height: 32 }}>
      <style>{`@keyframes si-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.15)} }`}</style>
      <svg width="44" height="32" viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg" style={{ animation: "si-pulse 1.4s ease-in-out infinite", transformOrigin: "center" }}>
        {frame1.map(([x, y]) => <rect key={`${x}-${y}`} x={x*S} y={y*S} width="3.5" height="3.5" fill={color} />)}
      </svg>
    </div>
  );
}

function timeAgo(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Pill({ section }: { section: string }) {
  const c = SECTION_COLORS[section] ?? "#888";
  return (
    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, background: c + "22", color: c, paddingTop: 3, paddingBottom: 3, paddingLeft: 9, paddingRight: 9, borderRadius: 20, display: "inline-block", border: `1px solid ${c}44`, fontFamily: P.fontBody }}>
      {section}
    </span>
  );
}

function ArticleLink({ story, children }: { story: Story; children: React.ReactNode }) {
  const slug = urlToSlug(story.link);
  return (
    <a href={`/article/${slug}`} style={{ color: "inherit", textDecoration: "none" }}>
      {children}
    </a>
  );
}

function MorePill({ story }: { story: Story }) {
  const slug = urlToSlug(story.link);
  return (
    <a href={`/article/${slug}`} style={{ textDecoration: "none", position: "absolute", bottom: 18, right: 18 }}>
      <span style={{ display: "inline-block", fontSize: 15, fontWeight: 700, color: P.accent, background: P.accent + "18", border: `1px solid ${P.accent}55`, borderRadius: 50, paddingTop: 8, paddingBottom: 8, paddingLeft: 20, paddingRight: 20, fontFamily: P.fontBody, letterSpacing: 0.3, whiteSpace: "nowrap" as const }}>More</span>
    </a>
  );
}

export default async function Home({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { section: activeSection } = await searchParams;
  const { stories: allStories, synthesis, editionLabel, featureCreature } = await getPageData();

  const sections = Array.from(new Set(allStories.map((s) => s.section)));
  const stories = activeSection
    ? allStories.filter((s) => s.section === activeSection)
    : allStories;

  const [s1, s2, s3, s4, s5, s6, s7, s8, s9] = stories;

  const card: React.CSSProperties = { background: P.cardBg, borderRadius: 20, overflow: "hidden", boxShadow: P.shadow, position: "relative" };
  const imgCard: React.CSSProperties = { ...card, position: "relative", background: P.tint + "44" };
  // Shared headline style — used for ALL story cards for consistency
  const hStyle: React.CSSProperties = {
    fontFamily: P.fontHeading, fontSize: 22, fontWeight: 800,
    lineHeight: 1.15, color: P.ink, letterSpacing: P.dark ? 1 : -0.5,
    textTransform: P.dark ? "uppercase" as const : "none" as const,
    marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
  };
  // Shared body text style — minimum 15px across all cards
  const bodyStyle: React.CSSProperties = { fontSize: 15, lineHeight: 1.7, color: P.inkMid, fontFamily: P.fontBody };
  // Shared insight style
  const insightStyle: React.CSSProperties = { borderLeft: `3px solid ${P.accent}66`, paddingLeft: 12, fontSize: 13, color: P.inkMid, lineHeight: 1.55, fontStyle: "italic", fontFamily: P.fontBody };

  return (
    <div className="ds-page" style={{ minHeight: "100vh", background: P.pageBg, fontFamily: P.fontBody, paddingTop: 24, paddingBottom: 60, paddingLeft: 20, paddingRight: 20, color: P.ink }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={CURSIVE_FONT_URL} />
      {/* Masthead */}
      <div className="ds-masthead" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1200, marginTop: 0, marginBottom: 20, marginLeft: "auto", marginRight: "auto" }}>
        <div>
          <a href="/" style={{ textDecoration: "none", display: "block" }}>
            <span className="ds-masthead-title" style={{ fontSize: 28, fontWeight: P.dark ? 400 : 900, fontFamily: P.fontHeading, letterSpacing: P.dark ? 3 : -0.5, color: P.ink, textTransform: P.dark ? "uppercase" as const : "none" as const, whiteSpace: "nowrap" as const }}>The Daily Signal</span>
          </a>
          <span className="ds-masthead-sub" style={{ fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" as const, color: P.accent, display: "block", marginTop: 4, fontFamily: P.fontBody, whiteSpace: "nowrap" as const }}>Tech · Arts · Culture</span>
        </div>
        <div style={{ textAlign: "right" as const }}>
          <div style={{ fontSize: 11, color: P.inkLight, fontFamily: P.fontBody }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, fontFamily: P.fontBody, marginTop: 3, marginBottom: 0, marginLeft: 0, marginRight: 0 }}>{editionLabel}</div>
        </div>
      </div>

      {/* ── Nav pills + email capture ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1200, marginTop: 0, marginBottom: 14, marginLeft: "auto", marginRight: "auto" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <a href="/" style={{ textDecoration: "none" }}>
            <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, fontFamily: P.fontBody, paddingTop: 6, paddingBottom: 6, paddingLeft: 16, paddingRight: 16, borderRadius: 20, border: `1px solid ${P.accent}`, background: P.accent + "22", color: P.accent }}>Today</span>
          </a>
          <a href="/archive" style={{ textDecoration: "none" }}>
            <span style={{ display: "inline-block", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, fontFamily: P.fontBody, paddingTop: 6, paddingBottom: 6, paddingLeft: 16, paddingRight: 16, borderRadius: 20, border: `1px solid ${P.tint}66`, background: "transparent", color: P.inkLight }}>Archive</span>
          </a>
          <span style={{ fontSize: 26, fontWeight: 700, fontStyle: "normal", fontFamily: `'${CURSIVE_FONT_FAMILY}', cursive`, color: P.accent, marginLeft: 16 }}>{TAGLINE}</span>
        </div>
        <EmailCapture accent={P.accent} ink={P.ink} cardBg={P.cardBg} fontBody={P.fontBody} />
      </div>

      {/* ── Top bento ── */}
      <div className="ds-bento" style={{ display: "grid", gridTemplateColumns: "5fr 7fr", gridTemplateRows: "minmax(380px, auto) minmax(400px, auto) minmax(100px, 140px)", gap: 10, maxWidth: 1200, marginTop: 0, marginBottom: 10, marginLeft: "auto", marginRight: "auto" }}>

        {/* s1: text only, no image, row 1 left */}
        {s1 && (
          <div style={{ ...card, gridColumn: "1", gridRow: "1", paddingTop: 28, paddingBottom: 62, paddingLeft: 28, paddingRight: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            <Pill section={s1.section} />
            <h1 className="ds-card-h" style={hStyle}><ArticleLink story={s1}>{s1.title}</ArticleLink></h1>
            {s1.summary && <p className="ds-card-body" style={{ ...bodyStyle, marginTop: 0, marginBottom: 0 }}>{s1.summary}</p>}
            {s1.bullets?.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {s1.bullets.map((b, i) => (
                  <div key={i} className="ds-card-body" style={{ display: "flex", gap: 14, alignItems: "flex-start", ...bodyStyle }}>
                    <span className="ds-bullet" style={{ color: P.accent, flexShrink: 0, fontSize: 34, lineHeight: 0.75, marginTop: 6, fontWeight: 900, fontFamily: `'${CURSIVE_FONT_FAMILY}', cursive` }}>*</span>{b}
                  </div>
                ))}
              </div>
            ) : null}
            <span className="ds-card-meta" style={{ fontSize: 11, color: P.inkLight, fontFamily: P.fontBody, position: "absolute", bottom: 22, left: 28 }}>{s1.source} · {timeAgo(s1.pubDate)}</span>
            <MorePill story={s1} />
          </div>
        )}

        {/* s1 image: row 1 right */}
        {s1 && (
          <div style={{ ...imgCard, gridColumn: "2", gridRow: "1" }}>
            {s1.imageUrl ? <img src={s1.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${P.gradFrom}, ${P.gradTo})` }} />}
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${P.accent}44 0%, transparent 60%)` }} />
          </div>
        )}

        {/* s2 image card: moved UP to row 2 left */}
        {s2 && (
          <div className="ds-s2-img" style={{ ...imgCard, gridColumn: "1", gridRow: "2" }}>
            {s2.imageUrl ? <img src={s2.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${P.tint}, ${P.accent}66)` }} />}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.05) 55%, transparent 100%)" }} />
            <div style={{ position: "absolute", bottom: 20, left: 20, right: 100 }}>
              <div style={{ marginBottom: 6 }}><Pill section={s2.section} /></div>
              <div className="ds-card-h" style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.15, fontFamily: P.fontHeading, textTransform: P.dark ? "uppercase" as const : "none" as const, letterSpacing: P.dark ? 1 : -0.5, marginBottom: 8 }}>
                <ArticleLink story={s2}>{s2.title}</ArticleLink>
              </div>
              {s2.summary && <div className="ds-card-body" style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,0.80)", fontFamily: P.fontBody }}>{s2.summary}</div>}
            </div>
            <MorePill story={s2} />
          </div>
        )}

        {/* s3: right col, spans rows 2–3, taller */}
        {s3 && (
          <div style={{ gridColumn: "2", gridRow: "2 / 4", ...card, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {s3.imageUrl && (
              <div style={{ position: "relative", flex: "0 0 55%", minHeight: 200 }}>
                <img src={s3.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${P.cardBg} 0%, transparent 50%)` }} />
              </div>
            )}
            <div style={{ paddingTop: 18, paddingBottom: 62, paddingLeft: 22, paddingRight: 22, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              <Pill section={s3.section} />
              <div className="ds-card-h" style={hStyle}><ArticleLink story={s3}>{s3.title}</ArticleLink></div>
              {s3.summary && <div className="ds-card-body" style={bodyStyle}>{s3.summary}</div>}
              {s3.insight && <div className="ds-card-insight" style={insightStyle}>{s3.insight}</div>}
              <span className="ds-card-meta" style={{ fontSize: 11, color: P.inkLight, fontFamily: P.fontBody, position: "absolute", bottom: 22, left: 22 }}>{s3.source} · {timeAgo(s3.pubDate)}</span>
            </div>
            <MorePill story={s3} />
          </div>
        )}

        {/* s2 pullquote: moved DOWN to row 3 left */}
        {s2 && (
          <div style={{ ...card, gridColumn: "1", gridRow: "3", display: "flex", alignItems: "center", paddingTop: 0, paddingBottom: 0, paddingLeft: 28, paddingRight: 100, gap: 18 }}>
            <div style={{ fontSize: 52, color: P.accent, fontFamily: P.fontHeading, flexShrink: 0, lineHeight: 0.8, opacity: 0.35, marginTop: 6 }}>"</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontStyle: "italic", color: P.ink, lineHeight: 1.5, fontFamily: P.fontBody, fontWeight: 500 }}>{s2.pullquote || s2.summary || s2.title}</div>
              <div style={{ fontSize: 10, color: P.inkLight, fontFamily: P.fontBody, marginTop: 6 }}>{s2.source} · {timeAgo(s2.pubDate)}</div>
            </div>
            <MorePill story={s2} />
          </div>
        )}
      </div>

      {/* ── Synthesis ── */}
      {!activeSection && synthesis?.theme && <Synthesis synthesis={synthesis} stories={stories} />}

      {/* ── Row 2: s4–s9 ── */}
      {[s4, s5, s6, s7, s8, s9].filter(Boolean).length > 0 && (
        <div className="ds-row2" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, maxWidth: 1200, marginTop: 0, marginBottom: 0, marginLeft: "auto", marginRight: "auto", alignItems: "stretch" }}>
          {[s4, s5, s6, s7, s8, s9].filter(Boolean).map((s, i) => s && (
            <a key={i} href={`/article/${urlToSlug(s.link)}`} style={{ textDecoration: "none", color: "inherit", display: "flex" }}>
              <div style={{ display: "flex", flexDirection: "column", borderRadius: 20, overflow: "hidden", background: P.cardBg, boxShadow: P.shadow, flex: 1 }}>
                {s.imageUrl && (
                  <div style={{ position: "relative", height: 200, background: P.tint + "44", flexShrink: 0 }}>
                    <img src={s.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, transparent 40%, ${P.cardBg}cc 100%)` }} />
                    <div style={{ position: "absolute", top: 12, left: 14 }}><Pill section={s.section} /></div>
                    <div style={{ position: "absolute", top: 12, right: 14, fontSize: 10, color: "rgba(255,255,255,0.7)", fontFamily: P.fontBody }}>{s.source} · {timeAgo(s.pubDate)}</div>
                  </div>
                )}
                <div style={{ paddingTop: 14, paddingLeft: 22, paddingRight: 22, paddingBottom: 18, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                  {!s.imageUrl && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Pill section={s.section} />
                      <span style={{ fontSize: 10, color: P.inkLight, fontFamily: P.fontBody }}>{s.source} · {timeAgo(s.pubDate)}</span>
                    </div>
                  )}
                  <div className="ds-card-h" style={hStyle}>{s.title}</div>
                  {s.summary && <div className="ds-card-body" style={bodyStyle}>{s.summary}</div>}
                  {s.insight && <div className="ds-card-insight" style={insightStyle}>{s.insight}</div>}
                  <div style={{ marginTop: "auto", paddingTop: 12, display: "flex", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: P.accent, background: P.accent + "18", border: `1px solid ${P.accent}55`, borderRadius: 50, paddingTop: 6, paddingBottom: 6, paddingLeft: 16, paddingRight: 16, fontFamily: P.fontBody, letterSpacing: 0.3, whiteSpace: "nowrap" as const }}>More</span>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* ── Feature Creature ── */}
      {!activeSection && featureCreature && <FeatureCreatureCard fc={featureCreature} />}

    </div>
  );
}

// ── Feature Creature card (compact homepage version) ──────────────────────────
function FeatureCreatureCard({ fc }: { fc: FeatureCreature }) {
  const angleColors: Record<string, string> = { science: "#27AE8F", build: "#5B8DEF", culture: "#D4517A" };
  const angleEmoji: Record<string, string> = { science: "🔬", build: "🛠️", culture: "🌍" };
  const color = angleColors[fc.angleKey] ?? P.accent;
  const emoji = angleEmoji[fc.angleKey] ?? "🪄";
  const slug = fc.editionKey ?? "today";

  return (
    <div style={{ maxWidth: 1200, marginTop: 16, marginBottom: 10, marginLeft: "auto", marginRight: "auto", position: "relative" }}>
      {/* Clock tick border SVG — short dashes evenly spaced like minute markers */}
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", zIndex: 10 } as React.CSSProperties} xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="calc(100% - 6px)" height="calc(100% - 6px)" rx="22" ry="22" fill="none"
          stroke={color} strokeWidth="3"
          strokeDasharray="3 9"
          strokeLinecap="round"
        />
        {/* Outer tick ring — longer marks every ~36px */}
        <rect x="3" y="3" width="calc(100% - 6px)" height="calc(100% - 6px)" rx="22" ry="22" fill="none"
          stroke={color} strokeWidth="7" strokeOpacity="0.35"
          strokeDasharray="1 44"
          strokeLinecap="round"
        />
      </svg>

      <a href={`/feature-creature/${slug}`} style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        <div style={{ background: P.cardBg, borderRadius: 20, overflow: "hidden", boxShadow: P.shadow }}>
          {/* Image */}
          {fc.imageUrl && (
            <div style={{ position: "relative", height: 200, background: P.tint + "44", flexShrink: 0 }}>
              <img src={fc.imageUrl} alt={fc.universe} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, transparent 40%, ${P.cardBg}cc 100%)` }} />
              {/* Badge */}
              <div style={{ position: "absolute", top: 12, left: 14, background: color + "ee", color: "#fff", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, fontFamily: P.fontBody, paddingTop: 4, paddingBottom: 4, paddingLeft: 10, paddingRight: 10, borderRadius: 20, display: "flex", alignItems: "center", gap: 6 }}>
                <span>{emoji}</span> Feature Creature
              </div>
              <div style={{ position: "absolute", top: 12, right: 14, fontSize: 10, color: "rgba(255,255,255,0.7)", fontFamily: P.fontBody }}>{fc.universe}</div>
            </div>
          )}

          <div style={{ paddingTop: 16, paddingLeft: 22, paddingRight: 22, paddingBottom: 22 }}>
            {!fc.imageUrl && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ background: color + "22", color, fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, fontFamily: P.fontBody, paddingTop: 4, paddingBottom: 4, paddingLeft: 10, paddingRight: 10, borderRadius: 20 }}>{emoji} Feature Creature</span>
                <span style={{ fontSize: 10, color: P.inkLight, fontFamily: P.fontBody }}>{fc.universe}</span>
              </div>
            )}
            {/* Angle label */}
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color, fontFamily: P.fontBody, marginBottom: 8 }}>{fc.angleLabel}</div>
            {/* Title in cursive */}
            <div style={{ fontFamily: `'${CURSIVE_FONT_FAMILY}', cursive`, fontSize: 26, color: P.ink, lineHeight: 1.15, marginBottom: 10, fontWeight: 700 }}>{fc.title}</div>
            {/* Synopsis */}
            {fc.synopsis && <div style={{ fontSize: 15, lineHeight: 1.65, color: P.inkMid, fontFamily: P.fontBody, marginBottom: 16 }}>{fc.synopsis}</div>}
            {/* More pill */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <span style={{ fontSize: 13, fontWeight: 700, color, background: color + "18", border: `1px solid ${color}55`, borderRadius: 50, paddingTop: 6, paddingBottom: 6, paddingLeft: 16, paddingRight: 16, fontFamily: P.fontBody, letterSpacing: 0.3 }}>More</span>
            </div>
          </div>
        </div>
      </a>
    </div>
  );
}

// ── Synthesis component ───────────────────────────────────────────────────────
function Synthesis({ synthesis, stories }: { synthesis: Synthesis; stories: Story[] }) {
  return (
    <>
    <div style={{ maxWidth: 1200, marginTop: 0, marginBottom: 10, marginLeft: "auto", marginRight: "auto", position: "relative" }}>
      <div style={{ background: P.cardBg, borderRadius: 24, boxShadow: P.shadow, overflow: "hidden" }}>
        {/* Header band */}
        <div style={{ background: "transparent", paddingTop: 18, paddingBottom: 18, paddingLeft: 28, paddingRight: 28, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 55, height: 55, borderRadius: "50%", background: P.cardBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><SpaceInvaderSVG color={P.accent} /></div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" as const, color: P.accent, marginBottom: 4, fontFamily: P.fontBody }}>The Signal</div>
            <div style={{ fontSize: 22, fontWeight: 400, color: P.ink, lineHeight: 1.1, fontFamily: P.fontHeading, textTransform: P.dark ? "uppercase" as const : "none" as const, letterSpacing: P.dark ? 2 : 0 }}>{synthesis.theme}</div>
          </div>
        </div>
        {/* Sketchy divider line */}
        <div style={{ paddingLeft: 28, paddingRight: 28, marginBottom: 0 }}>
          <svg width="100%" height="12" style={{ display: "block", overflow: "visible" }} xmlns="http://www.w3.org/2000/svg">
            <defs>
              <filter id="sketchy-line" x="-5%" y="-100%" width="110%" height="300%">
                <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed="3" result="noise" />
                <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
            <line x1="0" y1="6" x2="100%" y2="6" stroke={P.accent} strokeWidth="2.5" filter="url(#sketchy-line)" />
          </svg>
        </div>
        {/* Observation */}
        {synthesis.observation && (
          <div style={{ paddingTop: 16, paddingBottom: 14, paddingLeft: 28, paddingRight: 28, borderBottom: `1px solid ${P.tint}44` }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, marginBottom: 8, fontFamily: P.fontBody }}>Observation</div>
            {synthesis.observation.split("\n\n").filter(Boolean).map((para, i) => (
              <p key={i} style={{ fontSize: 17, lineHeight: 1.75, color: P.inkMid, marginTop: 0, marginBottom: i < synthesis.observation.split("\n\n").length - 1 ? 14 : 0, maxWidth: 820, fontFamily: P.fontBody }}>{para}</p>
            ))}
          </div>
        )}
        {/* Insights + Bottom Line */}
        <div className="ds-synthesis-body" style={{ paddingTop: 18, paddingBottom: 24, paddingLeft: 28, paddingRight: 28, display: "grid", gridTemplateColumns: "3fr 2fr", gap: 36 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, marginBottom: 14, fontFamily: P.fontBody }}>Key Insights</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {synthesis.takeaways?.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ flexShrink: 0, fontSize: 22, fontWeight: 900, color: P.accent, fontFamily: P.fontHeading, lineHeight: 1, minWidth: 22, paddingTop: 2 }}>{i + 1}</div>
                  <div style={{ fontSize: 17, lineHeight: 1.65, color: P.inkMid, paddingTop: 3, fontFamily: P.fontBody }}>{t}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="ds-bottom-line" style={{ display: "flex", flexDirection: "column", justifyContent: "center", borderLeft: `1px solid ${P.tint}55`, paddingLeft: 28 }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, marginBottom: 16, fontFamily: P.fontBody }}>The Bottom Line</div>
            <div style={{ fontSize: 10, color: P.accent, opacity: 0.5, fontFamily: P.fontHeading, marginBottom: 4 }}>"</div>
            <div style={{ fontSize: 34, fontWeight: QUOTE_FONT.weight, lineHeight: 1.25, color: P.ink, fontStyle: QUOTE_FONT.style as "italic" | "normal", fontFamily: QUOTE_FONT.family, letterSpacing: -0.3 }}>{synthesis.conclusion}</div>
            <div style={{ fontSize: 10, color: P.accent, opacity: 0.5, fontFamily: P.fontHeading, marginTop: 4, textAlign: "right" as const }}>"</div>
          </div>
        </div>

      </div>
      {/* Sketchy pen-outline border overlay */}
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", zIndex: 10, isolation: "isolate" } as React.CSSProperties} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="sketchy-border" x="-8%" y="-8%" width="116%" height="116%">
            <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
        <rect x="3" y="3" width="99%" height="99%" rx="22" ry="22" fill="none" stroke={P.accent} strokeWidth="4" filter="url(#sketchy-border)" />
      </svg>
    </div>

    {/* ── What To Do — separate card ── */}
    {synthesis.actions?.length > 0 && (
      <div style={{ maxWidth: 1200, marginTop: 16, marginBottom: 10, marginLeft: "auto", marginRight: "auto", position: "relative" }}>
        <div style={{ background: P.cardBg, borderRadius: 24, boxShadow: P.shadow, paddingTop: 28, paddingBottom: 32, paddingLeft: 32, paddingRight: 32 }}>
          <style>{`
            @keyframes action-pop { 0%,100%{transform:scale(1) rotate(-3deg)} 50%{transform:scale(1.3) rotate(5deg)} }
            .action-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
            @media (max-width: 700px) { .action-grid { grid-template-columns: 1fr; } }
          `}</style>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
            <span style={{ fontSize: 36, display: "inline-block", animation: "action-pop 1.2s ease-in-out infinite" }}>{ACTION_EMOJI}</span>
            <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, fontFamily: P.fontBody }}>{ACTION_LABEL}</div>
          </div>
          <div className="action-grid">
            {synthesis.actions.map((action, i) => {
              const slug = actionSlug(action);
              const encoded = Buffer.from(action).toString("base64");
              const relStory = stories[i] ?? stories[0];
              const relSlug = relStory ? urlToSlug(relStory.link) : "";
              const relTitle = relStory ? encodeURIComponent(relStory.title) : "";
              const href = `/how/${slug}?a=${encoded}&as=${relSlug}&at=${relTitle}`;
              return (
                <div key={i} style={{ background: "transparent", border: `2px dashed ${P.accent}`, borderRadius: 14, paddingTop: 16, paddingBottom: 16, paddingLeft: 18, paddingRight: 18, display: "flex", flexDirection: "column", gap: 12, minHeight: 120 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: P.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: P.cardBg, fontFamily: P.fontBody }}>{i + 1}</div>
                    <div style={{ fontSize: 15, lineHeight: 1.6, color: P.ink, fontFamily: P.fontBody }}>{action}</div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "auto" }}>
                    <a href={href} style={{ fontSize: 13, fontWeight: 900, letterSpacing: 1.5, color: P.accent, textDecoration: "none", fontFamily: P.fontBody, textTransform: "uppercase" as const, background: "transparent", border: `1px solid ${P.accent}`, borderRadius: 50, paddingTop: 5, paddingBottom: 5, paddingLeft: 14, paddingRight: 14 }}>How?</a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        {/* Sketchy pen-outline border overlay */}
        <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", zIndex: 10, isolation: "isolate" } as React.CSSProperties} xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="sketchy-border-action" x="-8%" y="-8%" width="116%" height="116%">
              <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed="12" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" />
            </filter>
          </defs>
          <rect x="3" y="3" width="99%" height="99%" rx="22" ry="22" fill="none" stroke={P.accent} strokeWidth="4" filter="url(#sketchy-border-action)" />
        </svg>
      </div>
    )}
    </>
  );
}

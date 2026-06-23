import { getPageData, urlToSlug, type Story, type Synthesis } from "@/lib/stories";
import { P, SECTION_COLORS } from "@/lib/palette";

export const revalidate = 14400; // 4 hours — matches 5-edition day

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

export default async function Home() {
  const { stories, synthesis, editionLabel } = await getPageData();
  const [s1, s2, s3, s4, s5, s6, s7, s8, s9] = stories;

  const card: React.CSSProperties = { background: P.cardBg, borderRadius: 20, overflow: "hidden", boxShadow: P.shadow, position: "relative" };
  const imgCard: React.CSSProperties = { ...card, position: "relative", background: P.tint + "44" };
  const hStyle: React.CSSProperties = {
    fontFamily: P.fontHeading, fontSize: 22, fontWeight: P.dark ? 400 : 800,
    lineHeight: 1.15, color: P.ink, letterSpacing: P.dark ? 1 : -0.5,
    textTransform: P.dark ? "uppercase" as const : "none" as const,
    marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
  };

  return (
    <div className="ds-page" style={{ minHeight: "100vh", background: P.pageBg, fontFamily: P.fontBody, paddingTop: 24, paddingBottom: 60, paddingLeft: 20, paddingRight: 20, color: P.ink }}>
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

      {/* ── Top bento ── */}
      <div className="ds-bento" style={{ display: "grid", gridTemplateColumns: "5fr 7fr", gridTemplateRows: "400px 92px 380px", gap: 10, maxWidth: 1200, marginTop: 0, marginBottom: 10, marginLeft: "auto", marginRight: "auto" }}>

        {s1 && (
          <div style={{ ...card, paddingTop: 28, paddingBottom: 62, paddingLeft: 28, paddingRight: 28, display: "flex", flexDirection: "column", gap: 16, gridRow: "1 / 3" }}>
            <Pill section={s1.section} />
            <h1 style={hStyle}><ArticleLink story={s1}>{s1.title}</ArticleLink></h1>
            {s1.summary && <p style={{ fontSize: 15, lineHeight: 1.7, color: P.inkMid, fontFamily: P.fontBody, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 }}>{s1.summary}</p>}
            {s1.bullets?.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {s1.bullets.map((b, i) => (
                  <div key={i} style={{ display: "flex", gap: 11, fontSize: 14, lineHeight: 1.6, color: P.inkMid, fontFamily: P.fontBody }}>
                    <span style={{ color: P.accent, flexShrink: 0, fontWeight: 700, fontSize: 16 }}>*</span>{b}
                  </div>
                ))}
              </div>
            ) : null}
            <span style={{ fontSize: 11, color: P.inkLight, fontFamily: P.fontBody, position: "absolute", bottom: 22, left: 28 }}>{s1.source} · {timeAgo(s1.pubDate)}</span>
            <MorePill story={s1} />
          </div>
        )}

        {s1 && (
          <div style={{ ...imgCard, gridRow: "1" }}>
            {s1.imageUrl ? <img src={s1.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${P.gradFrom}, ${P.gradTo})` }} />}
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${P.accent}44 0%, transparent 60%)` }} />
          </div>
        )}

        {s2 && (
          <div style={{ ...card, gridColumn: "2", display: "flex", alignItems: "center", paddingTop: 0, paddingBottom: 0, paddingLeft: 28, paddingRight: 100, gap: 18 }}>
            <div style={{ fontSize: 52, color: P.accent, fontFamily: P.fontHeading, flexShrink: 0, lineHeight: 0.8, opacity: 0.35, marginTop: 6 }}>"</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontStyle: "italic", color: P.ink, lineHeight: 1.5, fontFamily: P.fontBody, fontWeight: 500 }}>{s2.pullquote || s2.summary || s2.title}</div>
              <div style={{ fontSize: 10, color: P.inkLight, fontFamily: P.fontBody, marginTop: 6 }}>{s2.source} · {timeAgo(s2.pubDate)}</div>
            </div>
            <MorePill story={s2} />
          </div>
        )}

        {s2 && (
          <div style={{ ...imgCard, gridColumn: "1" }}>
            {s2.imageUrl ? <img src={s2.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} /> : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${P.tint}, ${P.accent}66)` }} />}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.05) 55%, transparent 100%)" }} />
            <div style={{ position: "absolute", bottom: 20, left: 20, right: 100 }}>
              <div style={{ marginBottom: 6, marginTop: 0, marginLeft: 0, marginRight: 0 }}><Pill section={s2.section} /></div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", lineHeight: 1.3, fontFamily: P.fontHeading, textTransform: P.dark ? "uppercase" as const : "none" as const, letterSpacing: P.dark ? 0.5 : 0, marginBottom: 7, marginTop: 0, marginLeft: 0, marginRight: 0 }}>
                <ArticleLink story={s2}>{s2.title}</ArticleLink>
              </div>
              {s2.summary && <div style={{ fontSize: 12, lineHeight: 1.55, color: "rgba(255,255,255,0.72)", fontFamily: P.fontBody }}>{s2.summary}</div>}
            </div>
            <MorePill story={s2} />
          </div>
        )}

        {s3 && (
          <div style={{ gridColumn: "2", ...card, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {s3.imageUrl && (
              <div style={{ position: "relative", height: 130, flexShrink: 0 }}>
                <img src={s3.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${P.cardBg} 0%, transparent 50%)` }} />
              </div>
            )}
            <div style={{ paddingTop: 18, paddingBottom: 62, paddingLeft: 22, paddingRight: 22, display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
              <Pill section={s3.section} />
              <div style={{ fontSize: 17, fontWeight: 700, color: P.ink, lineHeight: 1.3, fontFamily: P.fontHeading, textTransform: P.dark ? "uppercase" as const : "none" as const, letterSpacing: P.dark ? 0.5 : 0 }}>
                <ArticleLink story={s3}>{s3.title}</ArticleLink>
              </div>
              {s3.summary && <div style={{ fontSize: 13, lineHeight: 1.6, color: P.inkMid, fontFamily: P.fontBody }}>{s3.summary}</div>}
              {s3.insight && <div style={{ borderLeft: `3px solid ${P.accent}66`, paddingLeft: 12, fontSize: 12, color: P.inkMid, lineHeight: 1.5, fontStyle: "italic", fontFamily: P.fontBody }}>{s3.insight}</div>}
              <span style={{ fontSize: 11, color: P.inkLight, fontFamily: P.fontBody, position: "absolute", bottom: 22, left: 22 }}>{s3.source} · {timeAgo(s3.pubDate)}</span>
            </div>
            <MorePill story={s3} />
          </div>
        )}
      </div>

      {/* ── Synthesis ── */}
      {synthesis?.theme && <Synthesis synthesis={synthesis} />}

      {/* ── Row 2: s4–s9 ── */}
      {[s4, s5, s6, s7, s8, s9].filter(Boolean).length > 0 && (
        <div className="ds-row2" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, maxWidth: 1200, marginTop: 0, marginBottom: 0, marginLeft: "auto", marginRight: "auto", alignItems: "stretch" }}>
          {[s4, s5, s6, s7, s8, s9].filter(Boolean).map((s, i) => s && (
            <a key={i} href={`/article/${urlToSlug(s.link)}`} style={{ textDecoration: "none", color: "inherit", display: "flex" }}>
              <div style={{ display: "flex", flexDirection: "column", borderRadius: 20, overflow: "hidden", background: P.cardBg, boxShadow: P.shadow, position: "relative", flex: 1, paddingBottom: 62 }}>
                {s.imageUrl && (
                  <div style={{ position: "relative", height: 150, background: P.tint + "44", flexShrink: 0 }}>
                    <img src={s.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to bottom, transparent 50%, ${P.accent}22 100%)` }} />
                    <div style={{ position: "absolute", top: 12, left: 14 }}><Pill section={s.section} /></div>
                  </div>
                )}
                <div style={{ paddingTop: 20, paddingLeft: 22, paddingRight: 22, display: "flex", flexDirection: "column", gap: 10 }}>
                  {!s.imageUrl && <Pill section={s.section} />}
                  <div style={{ fontSize: s.imageUrl ? 15 : 17, fontWeight: 700, color: P.ink, lineHeight: 1.25, fontFamily: P.fontHeading, textTransform: P.dark ? "uppercase" as const : "none" as const, letterSpacing: P.dark ? 0.5 : 0 }}>{s.title}</div>
                  {s.summary && <div style={{ fontSize: s.imageUrl ? 12 : 13, lineHeight: 1.65, color: P.inkMid, fontFamily: P.fontBody }}>{s.summary}</div>}
                  {s.insight && <div style={{ fontSize: 12, lineHeight: 1.55, color: P.accent, fontStyle: "italic", fontFamily: P.fontBody, borderLeft: `2px solid ${P.accent}55`, paddingLeft: 10 }}>{s.insight}</div>}
                </div>
                <span style={{ fontSize: 10, color: P.inkLight, fontFamily: P.fontBody, position: "absolute", bottom: 22, left: 22 }}>{s.source} · {timeAgo(s.pubDate)}</span>
                <MorePill story={s} />
              </div>
            </a>
          ))}
        </div>
      )}

    </div>
  );
}

// ── Synthesis component ───────────────────────────────────────────────────────
function Synthesis({ synthesis }: { synthesis: Synthesis }) {
  return (
    <div style={{ maxWidth: 1200, marginTop: 0, marginBottom: 10, marginLeft: "auto", marginRight: "auto" }}>
      <div style={{ background: P.cardBg, borderRadius: 24, boxShadow: P.shadow, overflow: "hidden" }}>
        {/* Header band */}
        <div style={{ background: `linear-gradient(120deg, ${P.gradFrom}, ${P.gradTo})`, paddingTop: 18, paddingBottom: 18, paddingLeft: 28, paddingRight: 28, display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: P.cardBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>👾</div>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" as const, color: "rgba(255,255,255,0.65)", marginBottom: 4, fontFamily: P.fontBody }}>The Signal</div>
            <div style={{ fontSize: 22, fontWeight: 400, color: "#fff", lineHeight: 1.1, fontFamily: P.fontHeading, textTransform: P.dark ? "uppercase" as const : "none" as const, letterSpacing: P.dark ? 2 : 0 }}>{synthesis.theme}</div>
          </div>
        </div>
        {/* Observation */}
        {synthesis.observation && (
          <div style={{ paddingTop: 16, paddingBottom: 14, paddingLeft: 28, paddingRight: 28, borderBottom: `1px solid ${P.tint}44` }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" as const, color: P.accent, marginBottom: 8, fontFamily: P.fontBody }}>Observation</div>
            <p style={{ fontSize: 14, lineHeight: 1.75, color: P.inkMid, fontStyle: "italic", marginTop: 0, marginBottom: 0, maxWidth: 820, fontFamily: P.fontBody }}>{synthesis.observation}</p>
          </div>
        )}
        {/* Insights + Bottom Line */}
        <div className="ds-synthesis-body" style={{ paddingTop: 18, paddingBottom: 24, paddingLeft: 28, paddingRight: 28, display: "grid", gridTemplateColumns: "3fr 2fr", gap: 36 }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" as const, color: P.accent, marginBottom: 14, fontFamily: P.fontBody }}>Key Insights</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {synthesis.takeaways?.map((t, i) => (
                <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ flexShrink: 0, fontSize: 20, fontWeight: 900, color: P.accent, fontFamily: P.fontHeading, lineHeight: 1, minWidth: 22, paddingTop: 2 }}>{i + 1}</div>
                  <div style={{ fontSize: 13, lineHeight: 1.65, color: P.inkMid, paddingTop: 3, fontFamily: P.fontBody }}>{t}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="ds-bottom-line" style={{ display: "flex", flexDirection: "column", justifyContent: "center", borderLeft: `1px solid ${P.tint}55`, paddingLeft: 28 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" as const, color: P.accent, marginBottom: 16, fontFamily: P.fontBody }}>The Bottom Line</div>
            <div style={{ fontSize: 10, color: P.accent, opacity: 0.5, fontFamily: P.fontHeading, marginBottom: 4 }}>"</div>
            <div style={{ fontSize: 26, fontWeight: P.dark ? 400 : 700, lineHeight: 1.3, color: P.ink, fontStyle: "italic", fontFamily: P.fontHeading, letterSpacing: P.dark ? 0.5 : -0.5, textTransform: P.dark ? "uppercase" as const : "none" as const }}>{synthesis.conclusion}</div>
            <div style={{ fontSize: 10, color: P.accent, opacity: 0.5, fontFamily: P.fontHeading, marginTop: 4, textAlign: "right" as const }}>"</div>
          </div>
        </div>
      </div>
    </div>
  );
}

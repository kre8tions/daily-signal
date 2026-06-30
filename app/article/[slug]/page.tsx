import { getPageData, getStoryBySlug, getFullArticle, getEdition, getWriterAssignments, urlToSlug, type Story, type ArticleCommentary } from "@/lib/stories";
import { notFound } from "next/navigation";
import { P, SECTION_COLORS } from "@/lib/palette";
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

export default async function ArticlePage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ e?: string }> }) {
  const { slug } = await params;
  const { e: editionHint } = await searchParams;
  const story = await getStoryBySlug(slug, editionHint);
  if (!story) notFound();

  const editionKey = editionHint ?? getEdition().key;
  const editionData = await getPageData(editionHint ? { key: editionKey, label: "" } : undefined);
  const related = editionData.stories.filter((s) => s.link !== story.link);
  const storyIndex = editionData.stories.findIndex((s) => s.link === story.link);
  const writerSlots = getWriterAssignments(editionKey);
  const writerIndex = storyIndex >= 0 ? writerSlots[storyIndex] : undefined;
  let fullArticle: ArticleCommentary | null = null;
  try {
    fullArticle = await getFullArticle(story, related, editionKey, writerIndex, true);
  } catch { /* generation failed — render article without commentary */ }

  const sectionColor = SECTION_COLORS[story.section] ?? "#888";
  const pubDate = new Date(story.pubDate).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });

  // Deterministic style seed per article — pull quote style, etc.
  const slugSeed = slug.split("").reduce((a: number, c: string, i: number) => a + c.charCodeAt(0) * (i + 1), 0);
  const pullQuoteStyle = slugSeed % 3; // 0=left border, 1=big quote marks, 2=dots divider only

  // Related: same-section stories first, then others — cap at 3
  const sameSection = related.filter(s => s.section === story.section);
  const otherSection = related.filter(s => s.section !== story.section);
  const relatedStories = [...sameSection, ...otherSection].slice(0, 3);
  const moreFromEdition = related.filter(s => !relatedStories.find(r => r.link === s.link)).slice(0, 5);

  return (
    <div style={{ minHeight: "100vh", background: P.articleBg, color: P.ink, fontFamily: P.fontBody, paddingBottom: 80 }}>

      {/* Masthead */}
      <div style={{ paddingTop: 20, paddingBottom: 20, paddingLeft: 24, paddingRight: 24, borderBottom: `1px solid ${P.tint}44` }}>
        <div style={{ maxWidth: 860, marginLeft: "auto", marginRight: "auto" }}>
          <a href="/" style={{ textDecoration: "none", color: P.ink, fontSize: 22, fontWeight: P.dark ? 400 : 900, fontFamily: P.fontHeading, letterSpacing: P.dark ? 3 : -0.5, textTransform: P.dark ? "uppercase" : "none" as const }}>The Daily Signal</a>
        </div>
      </div>

      <div style={{ maxWidth: 860, marginLeft: "auto", marginRight: "auto", paddingTop: 40, paddingLeft: 24, paddingRight: 24 }}>

        {/* Section pill */}
        <div style={{ marginBottom: 18 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, background: sectionColor + "22", color: sectionColor, paddingTop: 3, paddingBottom: 3, paddingLeft: 9, paddingRight: 9, borderRadius: 20, border: `1px solid ${sectionColor}44`, fontFamily: P.fontBody }}>
            {story.section}
          </span>
        </div>

        {/* Title — prefer writer-voiced ownedTitle once commentary loads, fall back to story title */}
        <h1 style={{ fontFamily: P.fontHeading, fontSize: "clamp(26px, 5vw, 42px)", fontWeight: P.dark ? 400 : 900, lineHeight: 1.15, color: P.ink, letterSpacing: P.dark ? 1 : -0.5, textTransform: P.dark ? "uppercase" : "none" as const, marginBottom: 8 }}>
          {fullArticle?.ownedTitle || story.ownedTitle || story.title}
        </h1>

        {/* Meta */}
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: P.inkLight, marginBottom: 30, fontFamily: P.fontBody }}>
          {fullArticle?.writer && <span style={{ fontWeight: 700, color: P.inkMid }}>{fullArticle.writer}</span>}
          {fullArticle?.writer && <span>·</span>}
          <span>{pubDate}</span>
        </div>

        {/* Hero image */}
        {story.imageUrl && (
          <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 36, aspectRatio: "16/7", position: "relative" }}>
            <img src={story.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} />
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${P.accent}22 0%, transparent 60%)` }} />
          </div>
        )}

        {/* Fallback: summary + bullets when fullArticle not yet cached */}
        {!fullArticle?.body && (story.summary || story.bullets?.length) && (
          <div style={{ marginBottom: 36 }}>
            {story.summary && (
              <p style={{ fontSize: 19, lineHeight: 1.9, color: P.ink, marginBottom: 26, fontFamily: "Georgia, 'Times New Roman', serif", maxWidth: 720 }}>{story.summary}</p>
            )}
            {story.bullets?.map((b, i) => (
              <p key={i} style={{ fontSize: 19, lineHeight: 1.9, color: P.ink, marginBottom: 26, fontFamily: "Georgia, 'Times New Roman', serif", maxWidth: 720 }}>{b}</p>
            ))}
            <div style={{ height: 1, background: `${P.tint}66`, marginTop: 8, marginBottom: 36 }} />
          </div>
        )}

        {/* Editorial commentary */}
        {fullArticle?.body && (
          <div style={{ marginBottom: 36 }}>
            {fullArticle.header && (
              <div style={{ fontFamily: P.fontHeading, fontSize: "clamp(22px, 4vw, 34px)", fontWeight: P.dark ? 400 : 900, letterSpacing: P.dark ? 2 : -0.5, textTransform: P.dark ? "uppercase" as const : "none" as const, color: sectionColor, lineHeight: 1.1, marginBottom: 20 }}>
                {fullArticle.header}
              </div>
            )}
            {fullArticle.body.split("\n\n").filter(Boolean).map((para, i) => (
              <div key={i}>
                {i === 3 && fullArticle.header2 && (
                  <div style={{ fontFamily: P.fontHeading, fontSize: "clamp(20px, 3.5vw, 30px)", fontWeight: P.dark ? 400 : 900, letterSpacing: P.dark ? 2 : -0.5, textTransform: P.dark ? "uppercase" as const : "none" as const, color: sectionColor, lineHeight: 1.1, marginBottom: 16, marginTop: 16 }}>
                    {fullArticle.header2}
                  </div>
                )}
                <p style={{ fontSize: 19, lineHeight: 1.9, color: P.ink, marginBottom: 26, fontFamily: "Georgia, 'Times New Roman', serif", maxWidth: 720 }}
                  dangerouslySetInnerHTML={{ __html: para.trim()
                    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
                    .replace(/\*(.+?)\*/g, "<em>$1</em>") }} />
                {i === (fullArticle.pullQuoteAfterPara ?? 4) - 1 && (
                  fullArticle.imageUrl2 ? (
                    <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 32, marginTop: 8, aspectRatio: "16/9", maxWidth: 720 }}>
                      <img src={fullArticle.imageUrl2} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} />
                    </div>
                  ) : fullArticle.pullQuote && pullQuoteStyle === 0 ? (
                    /* Style A: left-border blockquote */
                    <blockquote style={{ borderLeft: `4px solid ${sectionColor}`, paddingLeft: 24, marginLeft: 0, marginRight: 0, marginBottom: 28, marginTop: 4 }}>
                      <p style={{ fontSize: 22, fontStyle: "italic", color: sectionColor, lineHeight: 1.5, fontFamily: "Georgia, 'Times New Roman', serif", margin: 0 }}>{fullArticle.pullQuote}</p>
                    </blockquote>
                  ) : fullArticle.pullQuote && pullQuoteStyle === 1 ? (
                    /* Style B: large decorative quotation marks */
                    <div style={{ position: "relative", paddingTop: 28, paddingBottom: 28, paddingLeft: 48, paddingRight: 48, marginBottom: 28, marginTop: 4, maxWidth: 720 }}>
                      <span style={{ position: "absolute", top: -8, left: 0, fontSize: 100, lineHeight: 1, color: sectionColor, opacity: 0.18, fontFamily: "Georgia, serif", userSelect: "none" }}>&ldquo;</span>
                      <p style={{ fontSize: 23, fontStyle: "italic", color: sectionColor, lineHeight: 1.55, fontFamily: "Georgia, 'Times New Roman', serif", margin: 0, textAlign: "center" }}>{fullArticle.pullQuote}</p>
                      <span style={{ position: "absolute", bottom: -24, right: 0, fontSize: 100, lineHeight: 1, color: sectionColor, opacity: 0.18, fontFamily: "Georgia, serif", userSelect: "none" }}>&rdquo;</span>
                    </div>
                  ) : (
                    /* Style C: ornamental divider — pick one of 8 seeded by slug */
                    <DecorativeDivider color={sectionColor} index={slugSeed} />
                  )
                )}
              </div>
            ))}
            <div style={{ height: 1, background: `${P.tint}66`, marginTop: 8, marginBottom: 36 }} />
          </div>
        )}

        {/* CTA box — appears on ~20% of articles, seeded per story */}
        {fullArticle?.cta && (
          <div style={{ background: "transparent", border: `2px dashed ${P.accent}`, borderRadius: 16, paddingTop: 22, paddingBottom: 22, paddingLeft: 28, paddingRight: 28, marginBottom: 28, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" as const, color: P.accent, fontFamily: P.fontBody }}>{fullArticle.cta.header}</div>
            <p style={{ fontSize: 16, lineHeight: 1.65, color: P.ink, fontFamily: P.fontBody, margin: 0 }}>{fullArticle.cta.body}</p>
          </div>
        )}

        {/* Key Facts — shown on ~33% of articles that don't have a CTA */}
        {fullArticle?.hasKeyFacts && story.bullets?.length ? (
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
        ) : null }



        {/* Related Stories — same section first */}
        {relatedStories.length > 0 && (
          <div style={{ marginBottom: 40 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" as const, color: P.inkLight, marginBottom: 16, fontFamily: P.fontBody }}>Related Stories</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {relatedStories.map((s) => (
                <RelatedCard key={s.link} story={s} editionKey={editionKey} />
              ))}
            </div>
          </div>
        )}

        {/* More From Today's Edition */}
        {moreFromEdition.length > 0 && (
          <div style={{ marginBottom: 48 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" as const, color: P.accent, marginBottom: 16, fontFamily: P.fontBody }}>More From Today&apos;s Edition</div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {moreFromEdition.map((s) => (
                <RelatedCard key={s.link} story={s} editionKey={editionKey} />
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

function DecorativeDivider({ color, index }: { color: string; index: number }) {
  const c = color;
  const dividers = [
    // 0: Swirl with center diamond
    <svg key={0} viewBox="0 0 400 36" xmlns="http://www.w3.org/2000/svg" width="100%" height="36">
      <path d="M 15 18 C 45 4 85 4 115 18 C 145 32 175 32 193 18" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"/>
      <path d="M 200 9 L 209 18 L 200 27 L 191 18 Z" fill={c}/>
      <path d="M 207 18 C 225 4 255 4 285 18 C 315 32 355 32 385 18" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round"/>
    </svg>,
    // 1: Branch vine with scattered dots
    <svg key={1} viewBox="0 0 400 36" xmlns="http://www.w3.org/2000/svg" width="100%" height="36">
      <path d="M 10 18 Q 70 8 130 18 Q 200 28 270 18 Q 330 8 390 18" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      {([[50,10],[130,26],[200,10],[270,26],[340,10]] as [number,number][]).map(([x,y],i) =>
        <circle key={i} cx={x} cy={y} r="2.8" fill={c}/>
      )}
    </svg>,
    // 2: Diamond-arrow line
    <svg key={2} viewBox="0 0 400 36" xmlns="http://www.w3.org/2000/svg" width="100%" height="36">
      <line x1="28" y1="18" x2="372" y2="18" stroke={c} strokeWidth="1.4"/>
      <path d="M 8 18 L 18 12 L 28 18 L 18 24 Z" fill={c}/>
      <path d="M 372 18 L 382 12 L 392 18 L 382 24 Z" fill={c}/>
      <path d="M 193 11 L 200 18 L 207 11 L 200 4 Z" fill={c}/>
      <path d="M 193 25 L 200 18 L 207 25 L 200 32 Z" fill={c}/>
      {[100,150,250,300].map((x,i) => <circle key={i} cx={x} cy={18} r="2" fill={c}/>)}
    </svg>,
    // 3: Graduated dots line
    <svg key={3} viewBox="0 0 400 36" xmlns="http://www.w3.org/2000/svg" width="100%" height="36">
      <line x1="10" y1="18" x2="390" y2="18" stroke={c} strokeWidth="1.2" opacity={0.4}/>
      {([10,50,90,130,165,195,200,205,235,270,310,350,390] as number[]).map((x,i) => {
        const dist = Math.abs(x - 200);
        const r = Math.max(1.2, 4.5 - dist * 0.018);
        return <circle key={i} cx={x} cy={18} r={r} fill={c}/>;
      })}
    </svg>,
    // 4: Fleur-de-lis with scrolls (simplified)
    <svg key={4} viewBox="0 0 400 44" xmlns="http://www.w3.org/2000/svg" width="100%" height="44">
      <path d="M 20 22 C 60 8 100 36 140 22" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M 260 22 C 300 8 340 36 380 22" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M 140 22 C 160 14 168 8 175 4 C 180 8 185 14 195 22" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M 205 22 C 215 14 220 8 225 4 C 232 8 240 14 260 22" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      <circle cx={200} cy={22} r={4} fill={c}/>
      <path d="M 196 22 C 190 28 185 36 182 40" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M 204 22 C 210 28 215 36 218 40" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
    </svg>,
    // 5: Wavy vine with curls
    <svg key={5} viewBox="0 0 400 36" xmlns="http://www.w3.org/2000/svg" width="100%" height="36">
      <path d="M 10 18 C 40 6 60 30 100 18 C 140 6 160 30 200 18 C 240 6 260 30 300 18 C 340 6 360 30 390 18" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      {[60,160,240,340].map((x,i) => {
        const y = i % 2 === 0 ? 30 : 6;
        return <path key={i} d={`M ${x} ${y} C ${x-6} ${y+(i%2===0?6:-6)} ${x+6} ${y+(i%2===0?6:-6)} ${x} ${y}`} fill="none" stroke={c} strokeWidth="1.5"/>;
      })}
    </svg>,
    // 6: Line with curled ends and graduated dot cluster
    <svg key={6} viewBox="0 0 400 36" xmlns="http://www.w3.org/2000/svg" width="100%" height="36">
      <path d="M 30 18 L 370 18" stroke={c} strokeWidth="1.2"/>
      <path d="M 30 18 C 20 18 12 12 16 6 C 20 0 28 6 28 14" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      <path d="M 370 18 C 380 18 388 12 384 6 C 380 0 372 6 372 14" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"/>
      {[155,170,185,200,215,230,245].map((x,i) => {
        const r = i === 3 ? 5 : i === 2 || i === 4 ? 3.5 : i === 1 || i === 5 ? 2.5 : 1.8;
        return <circle key={i} cx={x} cy={18} r={r} fill={c}/>;
      })}
    </svg>,
    // 7: Arrow with dots
    <svg key={7} viewBox="0 0 400 36" xmlns="http://www.w3.org/2000/svg" width="100%" height="36">
      <line x1="38" y1="18" x2="362" y2="18" stroke={c} strokeWidth="1.4"/>
      <path d="M 10 18 L 26 10 L 22 18 L 26 26 Z" fill={c}/>
      <line x1="10" y1="18" x2="38" y2="18" stroke={c} strokeWidth="1.4"/>
      <path d="M 390 18 L 374 10 L 378 18 L 374 26 Z" fill={c}/>
      <line x1="362" y1="18" x2="390" y2="18" stroke={c} strokeWidth="1.4"/>
      {[175,188,200,212,225].map((x,i) => <circle key={i} cx={x} cy={18} r={i===2?4:2.5} fill={c}/>)}
    </svg>,
  ];
  const d = dividers[index % dividers.length];
  return (
    <div style={{ maxWidth: 680, marginBottom: 32, marginTop: 12, opacity: 0.7 }}>
      {d}
    </div>
  );
}

function RelatedCard({ story, editionKey }: { story: Story; editionKey: string }) {
  const slug = urlToSlug(story.link);
  const sectionColor = SECTION_COLORS[story.section] ?? "#888";
  return (
    <a href={`/article/${slug}?e=${editionKey}`} style={{ display: "flex", gap: 16, paddingTop: 16, paddingBottom: 16, borderBottom: `1px solid ${P.tint}44`, textDecoration: "none", alignItems: "flex-start" }}>
      {story.imageUrl && (
        <div style={{ width: 72, height: 52, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: P.tint }}>
          <img src={story.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} />
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: sectionColor, marginBottom: 4, fontFamily: P.fontBody }}>{story.section}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: P.ink, lineHeight: 1.3, fontFamily: P.fontHeading, textTransform: P.dark ? "uppercase" as const : "none" as const }}>{story.ownedTitle || story.title}</div>
        {story.summary && <div style={{ fontSize: 12, color: P.inkMid, lineHeight: 1.5, marginTop: 4, fontFamily: P.fontBody }}>{story.summary.slice(0, 110)}{story.summary.length > 110 ? "…" : ""}</div>}
      </div>
    </a>
  );
}

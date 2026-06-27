import { getArchivedPageData, getArchiveList, urlToSlug } from "@/lib/stories";
import { notFound } from "next/navigation";
import { P, SECTION_COLORS } from "@/lib/palette";

export const dynamic = "force-dynamic";

function NavPill({ href, label, sub, align }: { href: string; label: string; sub: string; align: "left" | "right" }) {
  return (
    <a href={href} style={{
      display: "flex", flexDirection: "column", gap: 2, textDecoration: "none",
      alignItems: align === "right" ? "flex-end" : "flex-start",
      background: P.cardBg, borderRadius: 14, padding: "12px 20px",
      border: `1px solid ${P.tint}44`, flex: 1, maxWidth: 280,
    }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: P.inkLight, fontFamily: P.fontBody }}>
        {align === "left" ? "← " : ""}{sub}{align === "right" ? " →" : ""}
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: P.ink, fontFamily: P.fontHeading, lineHeight: 1.2 }}>{label}</span>
    </a>
  );
}

export default async function ArchiveEditionPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;

  const [data, archiveList] = await Promise.all([
    getArchivedPageData(key),
    getArchiveList(),
  ]);

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: "#1a1225", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, color: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 32 }}>👾</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Edition not available</div>
        <div style={{ fontSize: 14, opacity: 0.6 }}>This edition was archived before persistent storage was set up.</div>
        <a href="/archive" style={{ marginTop: 8, fontSize: 13, color: "#FAED26", textDecoration: "none" }}>← Back to Archive</a>
      </div>
    );
  }

  const { stories, synthesis, editionLabel, featureCreature } = data;
  const [datePart] = key.split("_");
  const dateStr = new Date(datePart + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  // Prev/next from sorted archive list (newest first)
  const idx = archiveList.findIndex(e => e.key === key);
  const newerEntry = idx > 0 ? archiveList[idx - 1] : null;
  const olderEntry = idx >= 0 && idx < archiveList.length - 1 ? archiveList[idx + 1] : null;

  return (
    <div style={{ minHeight: "100vh", background: P.articleBg, color: P.ink, fontFamily: P.fontBody, paddingBottom: 80 }}>

      {/* Masthead */}
      <div style={{ paddingTop: 20, paddingBottom: 20, paddingLeft: 24, paddingRight: 24, borderBottom: `1px solid ${P.tint}44` }}>
        <div style={{ maxWidth: 1200, marginLeft: "auto", marginRight: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/" style={{ textDecoration: "none", color: P.ink, fontSize: 22, fontWeight: P.dark ? 400 : 900, fontFamily: P.fontHeading, letterSpacing: P.dark ? 3 : -0.5, textTransform: P.dark ? "uppercase" : "none" as const }}>The Daily Signal</a>
          <a href="/archive" style={{ display: "inline-flex", alignItems: "center", background: P.accent + "18", color: P.accent, textDecoration: "none", paddingTop: 10, paddingBottom: 10, paddingLeft: 22, paddingRight: 22, borderRadius: 50, fontSize: 13, fontWeight: 700, fontFamily: P.fontBody, border: `1px solid ${P.accent}55` }}>Archive</a>
        </div>
      </div>

      <div style={{ maxWidth: 1200, marginLeft: "auto", marginRight: "auto", paddingTop: 36, paddingLeft: 20, paddingRight: 20 }}>

        {/* Edition header */}
        <div style={{ marginBottom: 36, paddingBottom: 28, borderBottom: `1px solid ${P.tint}44` }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, marginBottom: 10, fontFamily: P.fontBody }}>{editionLabel} · {dateStr}</div>
          {synthesis.theme && (
            <h1 style={{ fontFamily: P.fontHeading, fontSize: "clamp(26px, 4vw, 44px)", fontWeight: P.dark ? 400 : 900, color: P.ink, letterSpacing: P.dark ? 2 : -0.5, textTransform: P.dark ? "uppercase" : "none" as const, margin: "0 0 14px 0", lineHeight: 1.1 }}>
              {synthesis.theme}
            </h1>
          )}
          {synthesis.observation && (
            <p style={{ fontSize: 16, lineHeight: 1.75, color: P.inkMid, margin: 0, maxWidth: 760, fontFamily: P.fontBody }}>{synthesis.observation}</p>
          )}
        </div>

        {/* Feature Creature card */}
        {featureCreature && (
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: "#8B5CF6", marginBottom: 12, fontFamily: P.fontBody }}>Feature Creature</div>
            <div style={{ background: P.cardBg, borderRadius: 20, overflow: "hidden", boxShadow: P.shadow, display: "flex", flexDirection: "column" as const }}>
              {featureCreature.imageUrl && (
                <div style={{ height: 280, overflow: "hidden" }}>
                  <img src={featureCreature.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%", display: "block" }} />
                </div>
              )}
              <div style={{ padding: "28px 32px 32px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: "#8B5CF6", marginBottom: 8, fontFamily: P.fontBody }}>{featureCreature.universe} · {featureCreature.angleLabel}</div>
                <h2 style={{ fontFamily: P.fontHeading, fontSize: "clamp(20px, 3vw, 28px)", fontWeight: P.dark ? 400 : 800, color: P.ink, margin: "0 0 16px 0", lineHeight: 1.2, letterSpacing: P.dark ? 1 : -0.3, textTransform: P.dark ? "uppercase" : "none" as const }}>
                  {featureCreature.title}
                </h2>
                <p style={{ fontSize: 15, lineHeight: 1.75, color: P.inkMid, margin: "0 0 20px 0", maxWidth: 760, fontFamily: P.fontBody }}>{featureCreature.synopsis}</p>
                {featureCreature.editionKey && (
                  <a href={`/feature-creature/${featureCreature.editionKey}`} style={{ display: "inline-flex", alignItems: "center", background: "#8B5CF6" + "18", color: "#8B5CF6", textDecoration: "none", padding: "10px 22px", borderRadius: 50, fontSize: 13, fontWeight: 700, fontFamily: P.fontBody, border: "1px solid #8B5CF655" }}>
                    Read the full story →
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Key Insights */}
        {synthesis.actions && synthesis.actions.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, marginBottom: 16, fontFamily: P.fontBody }}>Key Insights</div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 12 }}>
              {synthesis.actions.map((action, i) => (
                <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start", background: P.cardBg, borderRadius: 14, padding: "16px 20px", boxShadow: P.shadow }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: P.accent, fontFamily: P.fontHeading, lineHeight: 1, minWidth: 28 }}>{i + 1}</span>
                  <span style={{ fontSize: 15, color: P.ink, lineHeight: 1.65, fontFamily: P.fontBody }}>{action}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stories grid */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.inkLight, marginBottom: 16, fontFamily: P.fontBody }}>Stories</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {stories.map((s) => {
              const slug = urlToSlug(s.link);
              const sectionColor = SECTION_COLORS[s.section] ?? "#888";
              return (
                <a key={s.link} href={`/article/${slug}`} style={{ textDecoration: "none", display: "flex", flexDirection: "column" as const, background: P.cardBg, borderRadius: 16, overflow: "hidden", boxShadow: P.shadow }}>
                  {s.imageUrl && (
                    <div style={{ height: 140, overflow: "hidden" }}>
                      <img src={s.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%", display: "block" }} />
                    </div>
                  )}
                  <div style={{ padding: "18px 20px 20px", flex: 1, display: "flex", flexDirection: "column" as const, gap: 8 }}>
                    <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: sectionColor, fontFamily: P.fontBody }}>{s.section}</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: P.ink, lineHeight: 1.3, fontFamily: P.fontHeading, textTransform: P.dark ? "uppercase" : "none" as const }}>
                      {s.ownedTitle || s.title}
                    </div>
                    {s.summary && <div style={{ fontSize: 12, color: P.inkMid, lineHeight: 1.55, fontFamily: P.fontBody }}>{s.summary.slice(0, 110)}{s.summary.length > 110 ? "…" : ""}</div>}
                    <div style={{ marginTop: "auto", fontSize: 10, color: P.accent, fontFamily: P.fontBody }}>Read more →</div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>

        {/* Bottom Line */}
        {synthesis.conclusion && (
          <div style={{ background: P.cardBg, borderRadius: 16, padding: "28px 36px", boxShadow: P.shadow, marginBottom: 48, borderLeft: `4px solid ${P.accent}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" as const, color: P.accent, marginBottom: 12, fontFamily: P.fontBody }}>The Bottom Line</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: P.ink, fontStyle: "italic", lineHeight: 1.45, fontFamily: P.fontHeading }}>"{synthesis.conclusion}"</div>
          </div>
        )}

        {/* Prev / Next navigation */}
        <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "stretch" }}>
          {olderEntry ? (
            <NavPill href={`/archive/${olderEntry.key}`} label={olderEntry.theme || olderEntry.label} sub="Previous edition" align="left" />
          ) : <div style={{ flex: 1 }} />}
          <a href="/archive" style={{ display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: 12, color: P.inkLight, fontFamily: P.fontBody, padding: "0 16px", flexShrink: 0 }}>All editions</a>
          {newerEntry ? (
            <NavPill href={`/archive/${newerEntry.key}`} label={newerEntry.theme || newerEntry.label} sub="Next edition" align="right" />
          ) : <div style={{ flex: 1 }} />}
        </div>

      </div>
    </div>
  );
}

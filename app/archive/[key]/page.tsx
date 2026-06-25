import { getArchivedPageData, urlToSlug } from "@/lib/stories";
import { notFound } from "next/navigation";
import { P, SECTION_COLORS } from "@/lib/palette";

export const revalidate = 3600;

export default async function ArchiveEditionPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const data = await getArchivedPageData(key);
  if (!data) notFound();

  const { stories, synthesis, editionLabel } = data;
  const [datePart, editionType] = key.split("_");
  const dateStr = new Date(datePart + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <div style={{ minHeight: "100vh", background: P.pageBg, color: P.ink, fontFamily: P.fontBody, paddingBottom: 80 }}>

      {/* Masthead */}
      <div style={{ paddingTop: 20, paddingBottom: 20, paddingLeft: 24, paddingRight: 24, borderBottom: `1px solid ${P.tint}44` }}>
        <div style={{ maxWidth: 1200, marginLeft: "auto", marginRight: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/" style={{ textDecoration: "none", color: P.ink, fontSize: 22, fontWeight: P.dark ? 400 : 900, fontFamily: P.fontHeading, letterSpacing: P.dark ? 3 : -0.5, textTransform: P.dark ? "uppercase" : "none" as const }}>The Daily Signal</a>
          <a href="/archive" style={{ fontSize: 12, color: P.accent, textDecoration: "none", fontFamily: P.fontBody }}>← Archive</a>
        </div>
      </div>

      <div style={{ maxWidth: 1200, marginLeft: "auto", marginRight: "auto", paddingTop: 32, paddingLeft: 20, paddingRight: 20 }}>

        {/* Edition header */}
        <div style={{ marginBottom: 28, paddingBottom: 24, borderBottom: `1px solid ${P.tint}44` }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, marginBottom: 8, fontFamily: P.fontBody }}>{editionLabel} · {dateStr}</div>
          {synthesis.theme && (
            <h1 style={{ fontFamily: P.fontHeading, fontSize: "clamp(22px, 4vw, 36px)", fontWeight: P.dark ? 400 : 900, color: P.ink, letterSpacing: P.dark ? 2 : -0.5, textTransform: P.dark ? "uppercase" : "none" as const }}>
              {synthesis.theme}
            </h1>
          )}
          {synthesis.observation && (
            <p style={{ fontSize: 14, lineHeight: 1.7, color: P.inkMid, fontStyle: "italic", marginTop: 12, maxWidth: 720, fontFamily: P.fontBody }}>{synthesis.observation}</p>
          )}
        </div>

        {/* Stories grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 36 }}>
          {stories.map((s) => {
            const slug = urlToSlug(s.link);
            const sectionColor = SECTION_COLORS[s.section] ?? "#888";
            return (
              <a key={s.link} href={`/article/${slug}`} style={{ textDecoration: "none", display: "flex", flexDirection: "column", background: P.cardBg, borderRadius: 16, overflow: "hidden", boxShadow: P.shadow }}>
                {s.imageUrl && (
                  <div style={{ height: 130, overflow: "hidden" }}>
                    <img src={s.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </div>
                )}
                <div style={{ paddingTop: 18, paddingBottom: 18, paddingLeft: 20, paddingRight: 20, flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: sectionColor, fontFamily: P.fontBody }}>{s.section}</span>
                  <div style={{ fontSize: 15, fontWeight: 700, color: P.ink, lineHeight: 1.3, fontFamily: P.fontHeading, textTransform: P.dark ? "uppercase" as const : "none" as const }}>{s.title}</div>
                  {s.summary && <div style={{ fontSize: 12, color: P.inkMid, lineHeight: 1.55, fontFamily: P.fontBody }}>{s.summary.slice(0, 100)}{s.summary.length > 100 ? "…" : ""}</div>}
                  <div style={{ marginTop: "auto", fontSize: 10, color: P.accent, fontFamily: P.fontBody }}>Read more →</div>
                </div>
              </a>
            );
          })}
        </div>

        {/* Bottom Line */}
        {synthesis.conclusion && (
          <div style={{ background: P.cardBg, borderRadius: 16, paddingTop: 24, paddingBottom: 24, paddingLeft: 32, paddingRight: 32, boxShadow: P.shadow, marginBottom: 32, borderLeft: `4px solid ${P.accent}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase" as const, color: P.accent, marginBottom: 10, fontFamily: P.fontBody }}>The Bottom Line</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: P.ink, fontStyle: "italic", lineHeight: 1.4, fontFamily: P.fontHeading }}>"{synthesis.conclusion}"</div>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "center" }}>
          <a href="/archive" style={{ fontSize: 12, color: P.inkLight, textDecoration: "none", fontFamily: P.fontBody }}>← Back to Archive</a>
        </div>

      </div>
    </div>
  );
}

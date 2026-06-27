import { getPageData, urlToSlug } from "@/lib/stories";
import { P } from "@/lib/palette";

export const dynamic = "force-dynamic";

export default async function SignalDeskPage() {
  const { stories, synthesis, editionLabel } = await getPageData();

  return (
    <div style={{ minHeight: "100vh", background: P.articleBg, color: P.ink, fontFamily: P.fontBody, paddingBottom: 80 }}>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${P.tint}44`, paddingTop: 18, paddingBottom: 18, paddingLeft: 28, paddingRight: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <a href="/" style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.inkLight, textDecoration: "none", fontFamily: P.fontBody }}>← Home</a>
          <span style={{ color: P.tint }}>|</span>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, color: P.accent, fontFamily: P.fontBody }}>Signal Desk</span>
        </div>
        <span style={{ fontSize: 11, color: P.inkLight, fontFamily: P.fontBody }}>{editionLabel}</span>
      </div>

      <div style={{ maxWidth: 1100, marginLeft: "auto", marginRight: "auto", paddingTop: 32, paddingLeft: 24, paddingRight: 24 }}>

        {/* Edition theme */}
        {synthesis.theme && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.inkLight, marginBottom: 4, fontFamily: P.fontBody }}>Edition Theme</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: P.ink, fontFamily: P.fontHeading }}>{synthesis.theme}</div>
          </div>
        )}

        {/* Headline comparison table */}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontFamily: P.fontBody }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${P.accent}` }}>
                <th style={{ textAlign: "left" as const, padding: "8px 12px", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: P.inkLight, whiteSpace: "nowrap" as const }}>#</th>
                <th style={{ textAlign: "left" as const, padding: "8px 12px", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: P.accent, whiteSpace: "nowrap" as const }}>Our Headline</th>
                <th style={{ textAlign: "left" as const, padding: "8px 12px", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: P.inkLight, whiteSpace: "nowrap" as const }}>Original Headline</th>
                <th style={{ textAlign: "left" as const, padding: "8px 12px", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: P.inkLight, whiteSpace: "nowrap" as const }}>Source</th>
                <th style={{ textAlign: "left" as const, padding: "8px 12px", fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: P.inkLight, whiteSpace: "nowrap" as const }}>Section</th>
              </tr>
            </thead>
            <tbody>
              {stories.map((story, i) => {
                const slug = urlToSlug(story.link);
                return (
                  <tr key={i} style={{ borderBottom: `1px solid ${P.tint}44` }}>
                    <td style={{ padding: "12px 12px", color: P.inkLight, fontSize: 11, verticalAlign: "top" as const }}>{i + 1}</td>
                    <td style={{ padding: "12px 12px", verticalAlign: "top" as const }}>
                      <a href={`/article/${slug}`} style={{ color: P.accent, textDecoration: "none", fontWeight: 600, lineHeight: 1.35, display: "block" }}>
                        {story.ownedTitle || <span style={{ color: P.inkLight, fontStyle: "italic" }}>—</span>}
                      </a>
                    </td>
                    <td style={{ padding: "12px 12px", color: P.inkMid, verticalAlign: "top" as const, lineHeight: 1.4 }}>{story.title}</td>
                    <td style={{ padding: "12px 12px", verticalAlign: "top" as const }}>
                      <a href={story.link} target="_blank" rel="noopener noreferrer" style={{ color: P.inkLight, textDecoration: "none", fontSize: 12 }}>
                        {story.source} ↗
                      </a>
                    </td>
                    <td style={{ padding: "12px 12px", verticalAlign: "top" as const }}>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: P.inkLight, background: P.tint + "44", paddingTop: 3, paddingBottom: 3, paddingLeft: 8, paddingRight: 8, borderRadius: 20 }}>{story.section}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

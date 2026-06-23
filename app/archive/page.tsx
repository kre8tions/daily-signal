import { getArchiveList } from "@/lib/stories";
import { P } from "@/lib/palette";

export const revalidate = 3600;

export default async function ArchivePage() {
  const editions = getArchiveList();

  return (
    <div style={{ minHeight: "100vh", background: P.pageBg, color: P.ink, fontFamily: P.fontBody, paddingBottom: 80 }}>

      {/* Masthead */}
      <div style={{ paddingTop: 20, paddingBottom: 20, paddingLeft: 24, paddingRight: 24, borderBottom: `1px solid ${P.tint}44` }}>
        <div style={{ maxWidth: 860, marginLeft: "auto", marginRight: "auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <a href="/" style={{ textDecoration: "none", color: P.ink, fontSize: 22, fontWeight: P.dark ? 400 : 900, fontFamily: P.fontHeading, letterSpacing: P.dark ? 3 : -0.5, textTransform: P.dark ? "uppercase" : "none" as const }}>The Daily Signal</a>
          <a href="/" style={{ fontSize: 12, color: P.accent, textDecoration: "none", fontFamily: P.fontBody }}>← Today&apos;s Edition</a>
        </div>
      </div>

      <div style={{ maxWidth: 860, marginLeft: "auto", marginRight: "auto", paddingTop: 40, paddingLeft: 24, paddingRight: 24 }}>

        <h1 style={{ fontFamily: P.fontHeading, fontSize: "clamp(28px, 5vw, 44px)", fontWeight: P.dark ? 400 : 900, color: P.ink, letterSpacing: P.dark ? 2 : -0.5, textTransform: P.dark ? "uppercase" : "none" as const, marginBottom: 8 }}>Archive</h1>
        <p style={{ fontSize: 13, color: P.inkLight, fontFamily: P.fontBody, marginBottom: 36 }}>Past editions of The Daily Signal</p>

        {editions.length === 0 ? (
          <div style={{ background: P.cardBg, borderRadius: 16, padding: 40, textAlign: "center" as const, boxShadow: P.shadow }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>👾</div>
            <div style={{ fontSize: 15, color: P.inkMid, fontFamily: P.fontBody }}>No archived editions yet. Check back after the next edition loads.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {editions.map((e) => {
              const dateStr = new Date(e.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
              const editionType = e.key.split("_").pop() ?? "";
              return (
                <a key={e.key} href={`/archive/${e.key}`} style={{ display: "flex", alignItems: "center", gap: 20, paddingTop: 20, paddingBottom: 20, borderBottom: `1px solid ${P.tint}44`, textDecoration: "none" }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: P.accent + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 20 }}>👾</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: P.accent, marginBottom: 4, fontFamily: P.fontBody }}>{editionType} · {dateStr}</div>
                    {e.theme && <div style={{ fontSize: 16, fontWeight: 700, color: P.ink, fontFamily: P.fontHeading, textTransform: P.dark ? "uppercase" as const : "none" as const }}>{e.theme}</div>}
                    <div style={{ fontSize: 11, color: P.inkLight, fontFamily: P.fontBody, marginTop: 3 }}>{e.label}</div>
                  </div>
                  <div style={{ fontSize: 18, color: P.accent, opacity: 0.5 }}>→</div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

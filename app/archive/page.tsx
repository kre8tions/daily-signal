import { getArchiveList } from "@/lib/stories";
import { P } from "@/lib/palette";

export const revalidate = 3600;

export default async function ArchivePage() {
  const editions = await getArchiveList();

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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {editions.map((e) => {
              const dateStr = new Date(e.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
              const editionType = e.key.split("_").pop() ?? "";
              return (
                <a key={e.key} href={`/archive/${e.key}`} style={{ textDecoration: "none", display: "flex", flexDirection: "column", borderRadius: 16, overflow: "hidden", background: P.cardBg, boxShadow: P.shadow }}>
                  <div style={{ position: "relative", height: 160, background: P.tint + "44", flexShrink: 0 }}>
                    {e.imageUrl
                      ? <img src={e.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${P.tint}, ${P.accent}44)` }} />
                    }
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)" }} />
                    <div style={{ position: "absolute", bottom: 10, left: 12, fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "rgba(255,255,255,0.7)", fontFamily: P.fontBody }}>{editionType} · {dateStr}</div>
                  </div>
                  <div style={{ padding: 16, flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    {e.theme && <div style={{ fontSize: 15, fontWeight: 700, color: P.ink, fontFamily: P.fontHeading, textTransform: P.dark ? "uppercase" as const : "none" as const, lineHeight: 1.2 }}>{e.theme}</div>}
                    <div style={{ fontSize: 11, color: P.inkLight, fontFamily: P.fontBody }}>{e.label}</div>
                    <div style={{ marginTop: "auto", paddingTop: 10, fontSize: 12, color: P.accent, fontFamily: P.fontBody, fontWeight: 700 }}>Read edition →</div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

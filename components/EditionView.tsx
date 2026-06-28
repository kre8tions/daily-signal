import { urlToSlug, actionSlug, getSynthWriterIndex, type Story, type Synthesis, type FeatureCreature } from "@/lib/stories";
import { P, QUOTE_FONT, SECTION_COLORS, ACTION_LABEL, ACTION_EMOJI, CURSIVE_FONT_FAMILY, CURSIVE_FONT_URL, TAGLINE } from "@/lib/palette";
import { EditionCountdown } from "@/app/EditionCountdown";
import { EmailCapture } from "@/app/EmailCapture";

// ── Helpers ───────────────────────────────────────────────────────────────────

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
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

// ── SVG / Visual components ───────────────────────────────────────────────────

function SpaceInvaderSVG({ color }: { color: string }) {
  const frame1 = [[2,0],[8,0],[3,1],[7,1],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2],[8,2],[1,3],[2,3],[4,3],[5,3],[6,3],[8,3],[9,3],[0,4],[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[7,4],[8,4],[9,4],[10,4],[0,5],[2,5],[3,5],[4,5],[5,5],[6,5],[7,5],[8,5],[10,5],[0,6],[2,6],[8,6],[10,6],[3,7],[4,7],[7,7],[8,7]];
  const frame2 = [[2,0],[8,0],[3,1],[7,1],[2,2],[3,2],[4,2],[5,2],[6,2],[7,2],[8,2],[1,3],[2,3],[4,3],[5,3],[6,3],[8,3],[9,3],[0,4],[1,4],[2,4],[3,4],[4,4],[5,4],[6,4],[7,4],[8,4],[9,4],[10,4],[0,5],[2,5],[3,5],[4,5],[5,5],[6,5],[7,5],[8,5],[10,5],[1,6],[2,6],[8,6],[9,6],[0,7],[1,7],[9,7],[10,7]];
  const S = 4;
  const mode = Math.floor(Date.now() / 14_400_000) % 3;
  if (mode === 0) return (
    <div style={{ width: 44, height: 32, position: "relative" }}>
      <style>{`@keyframes si-f1{0%,49%{opacity:1}50%,100%{opacity:0}}@keyframes si-f2{0%,49%{opacity:0}50%,100%{opacity:1}}`}</style>
      <svg width="44" height="32" viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", top: 0, left: 0, animation: "si-f1 0.8s steps(1) infinite" }}>{frame1.map(([x,y]) => <rect key={`${x}-${y}`} x={x*S} y={y*S} width="3.5" height="3.5" fill={color} />)}</svg>
      <svg width="44" height="32" viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", top: 0, left: 0, animation: "si-f2 0.8s steps(1) infinite" }}>{frame2.map(([x,y]) => <rect key={`${x}-${y}`} x={x*S} y={y*S} width="3.5" height="3.5" fill={color} />)}</svg>
    </div>
  );
  if (mode === 1) return (
    <div style={{ width: 44, height: 32 }}>
      <style>{`@keyframes si-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}`}</style>
      <svg width="44" height="32" viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg" style={{ animation: "si-float 1.6s ease-in-out infinite" }}>{frame1.map(([x,y]) => <rect key={`${x}-${y}`} x={x*S} y={y*S} width="3.5" height="3.5" fill={color} />)}</svg>
    </div>
  );
  return (
    <div style={{ width: 44, height: 32 }}>
      <style>{`@keyframes si-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}`}</style>
      <svg width="44" height="32" viewBox="0 0 44 32" xmlns="http://www.w3.org/2000/svg" style={{ animation: "si-pulse 1.4s ease-in-out infinite", transformOrigin: "center" }}>{frame1.map(([x,y]) => <rect key={`${x}-${y}`} x={x*S} y={y*S} width="3.5" height="3.5" fill={color} />)}</svg>
    </div>
  );
}

function RulerBorder({ color, seed = 0, squiggle = 1 }: { color: string; seed?: number; squiggle?: number }) {
  const W = 1000; const H = 600;
  const STEP = 6; const BASE = 5;
  // Vary phase offsets and spike threshold per edition seed
  const p1 = (seed * 0.37) % (Math.PI * 2);
  const p2 = (seed * 0.71) % (Math.PI * 2);
  const p3 = (seed * 1.13) % (Math.PI * 2);
  const spikeThresh = 0.45 + (seed % 7) * 0.04; // 0.45–0.69, varies per edition
  const noise = (i: number): number => {
    const t = i * 0.18;
    const tremor = Math.sin(t * 4.1 + p1) * 2.25 * squiggle + Math.sin(t * 9.7 + p2) * 1.08 * squiggle + Math.sin(t * 17.3 + p3) * 0.54;
    const spikeSeed = Math.sin(t * 2.3 + 0.9) * Math.sin(t * 3.7 + 2.1);
    const spike = spikeSeed > spikeThresh ? spikeSeed * 19.8 * squiggle : spikeSeed < -spikeThresh ? spikeSeed * 16.2 * squiggle : 0;
    return tremor + spike;
  };
  const pts: string[] = [];
  let i = 0;
  for (let x = 0; x <= W; x += STEP, i++) pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${(BASE + noise(i)).toFixed(1)}`);
  for (let y = STEP; y <= H; y += STEP, i++) pts.push(`L${(W - BASE - noise(i)).toFixed(1)},${y.toFixed(1)}`);
  for (let x = W - STEP; x >= 0; x -= STEP, i++) pts.push(`L${x.toFixed(1)},${(H - BASE - noise(i)).toFixed(1)}`);
  for (let y = H - STEP; y >= 0; y -= STEP, i++) pts.push(`L${(BASE + noise(i)).toFixed(1)},${y.toFixed(1)}`);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", zIndex: 10 }} xmlns="http://www.w3.org/2000/svg">
      <defs><filter id="seismic-ink" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="1.5" xChannelSelector="R" yChannelSelector="G" /></filter></defs>
      <path d={pts.join(" ") + " Z"} fill="none" stroke={color} strokeWidth={3.5} strokeOpacity={0.15} strokeLinejoin="round" strokeLinecap="round" transform="translate(1,1)" />
      <path d={pts.join(" ") + " Z"} fill="none" stroke={color} strokeWidth={2} strokeOpacity={0.85} strokeLinejoin="round" strokeLinecap="round" filter="url(#seismic-ink)" />
    </svg>
  );
}

function PixelEdge({ color, seed = 0, height = 56 }: { color: string; seed?: number; height?: number }) {
  const COLS = 240; const ROWS = 36;
  const noise = (r: number, c: number) => { const n = Math.sin(r * 127.1 + c * 311.7 + seed * 93.3) * 43758.5453; return n - Math.floor(n); };
  const rects: React.ReactNode[] = [];
  for (let r = 0; r < ROWS; r++) {
    const t = Math.pow((r + 1) / ROWS, 2.2);
    for (let c = 0; c < COLS; c++) {
      if (noise(r, c) < t) rects.push(<rect key={`${r}-${c}`} x={c} y={r} width={1.06} height={1.06} fill={color} />);
    }
  }
  return (
    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height, pointerEvents: "none" }}>
      <svg viewBox={`0 0 ${COLS} ${ROWS}`} width="100%" height="100%" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>{rects}</svg>
    </div>
  );
}

function PixelEdgeTop({ color, seed = 0, height = 32 }: { color: string; seed?: number; height?: number }) {
  const COLS = 240; const ROWS = 24;
  const noise = (r: number, c: number) => { const n = Math.sin(r * 127.1 + c * 311.7 + seed * 93.3) * 43758.5453; return n - Math.floor(n); };
  const rects: React.ReactNode[] = [];
  for (let r = 0; r < ROWS; r++) {
    const t = Math.pow(1 - r / ROWS, 2.5);
    for (let c = 0; c < COLS; c++) {
      if (noise(r, c) < t) rects.push(<rect key={`${r}-${c}`} x={c} y={r} width={1.06} height={1.06} fill={color} />);
    }
  }
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height, pointerEvents: "none", zIndex: 2 }}>
      <svg viewBox={`0 0 ${COLS} ${ROWS}`} width="100%" height="100%" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>{rects}</svg>
    </div>
  );
}

// ── Synthesis section ─────────────────────────────────────────────────────────

function SynthesisSection({ synthesis, stories, writerIndex }: { synthesis: Synthesis; stories: Story[]; writerIndex: number }) {
  return (
    <>
      <div style={{ maxWidth: 1200, marginTop: 0, marginBottom: 10, marginLeft: "auto", marginRight: "auto", position: "relative" }}>
        <div style={{ background: P.cardBg, borderRadius: 24, boxShadow: P.shadow, overflow: "hidden", position: "relative" }}>
          <div style={{ position: "absolute", top: 12, right: 16, fontSize: 10, fontWeight: 700, fontFamily: "monospace", color: P.accent, opacity: 0.45, letterSpacing: 1, userSelect: "none" as const }}>W{writerIndex}</div>
          <div style={{ background: "transparent", paddingTop: 18, paddingBottom: 18, paddingLeft: 28, paddingRight: 28, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 55, height: 55, borderRadius: "50%", background: P.cardBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><SpaceInvaderSVG color={P.accent} /></div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" as const, color: P.accent, marginBottom: 4, fontFamily: P.fontBody }}>The Signal</div>
              <div style={{ fontSize: 22, fontWeight: 400, color: P.ink, lineHeight: 1.1, fontFamily: P.fontHeading, textTransform: P.dark ? "uppercase" as const : "none" as const, letterSpacing: P.dark ? 2 : 0 }}>{synthesis.theme}</div>
            </div>
          </div>
          <div style={{ paddingLeft: 28, paddingRight: 28, marginBottom: 0 }}>
            <svg width="100%" height="12" style={{ display: "block", overflow: "visible" }} xmlns="http://www.w3.org/2000/svg">
              <defs><filter id="sketchy-line" x="-5%" y="-100%" width="110%" height="300%"><feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed="3" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" /></filter></defs>
              <line x1="0" y1="6" x2="100%" y2="6" stroke={P.accent} strokeWidth="2.5" filter="url(#sketchy-line)" />
            </svg>
          </div>
          {synthesis.observation && (
            <div style={{ paddingTop: 16, paddingBottom: 14, paddingLeft: 28, paddingRight: 28, borderBottom: `1px solid ${P.tint}44` }}>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, marginBottom: 8, fontFamily: P.fontBody }}>Observation</div>
              {synthesis.observation.split("\n\n").filter(Boolean).map((para, i) => (
                <p key={i} style={{ fontSize: 17, lineHeight: 1.75, color: P.inkMid, marginTop: 0, marginBottom: i < synthesis.observation.split("\n\n").length - 1 ? 14 : 0, maxWidth: 820, fontFamily: P.fontBody }}>{para}</p>
              ))}
            </div>
          )}
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
        <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", zIndex: 10, isolation: "isolate" } as React.CSSProperties} xmlns="http://www.w3.org/2000/svg">
          <defs><filter id="sketchy-border" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed="7" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" /></filter></defs>
          <rect x="3" y="3" width="99%" height="99%" rx="22" ry="22" fill="none" stroke={P.accent} strokeWidth="4" filter="url(#sketchy-border)" />
        </svg>
      </div>

      {synthesis.actions?.length > 0 && (
        <div style={{ maxWidth: 1200, marginTop: 16, marginBottom: 10, marginLeft: "auto", marginRight: "auto", position: "relative" }}>
          <div style={{ background: P.cardBg, borderRadius: 24, boxShadow: P.shadow, paddingTop: 28, paddingBottom: 32, paddingLeft: 32, paddingRight: 32 }}>
            <style>{`@keyframes action-pop{0%,100%{transform:scale(1) rotate(-3deg)}50%{transform:scale(1.3) rotate(5deg)}}.action-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}@media(max-width:700px){.action-grid{grid-template-columns:1fr}}`}</style>
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
                  <a key={i} href={href} style={{ textDecoration: "none", background: "transparent", border: `2px dashed ${P.accent}`, borderRadius: 14, paddingTop: 16, paddingBottom: 16, paddingLeft: 18, paddingRight: 18, display: "flex", flexDirection: "column", gap: 12, minHeight: 120 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ flexShrink: 0, width: 24, height: 24, borderRadius: "50%", background: P.accent, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: P.cardBg, fontFamily: P.fontBody }}>{i + 1}</div>
                      <div style={{ fontSize: 15, lineHeight: 1.6, color: P.ink, fontFamily: P.fontBody }}>{action}</div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "auto" }}>
                      <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: 1.5, color: P.accent, fontFamily: P.fontBody, textTransform: "uppercase" as const, background: "transparent", border: `1px solid ${P.accent}`, borderRadius: 50, paddingTop: 5, paddingBottom: 5, paddingLeft: 14, paddingRight: 14 }}>How?</span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
          <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", zIndex: 10, isolation: "isolate" } as React.CSSProperties} xmlns="http://www.w3.org/2000/svg">
            <defs><filter id="sketchy-border-action" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed="12" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" /></filter></defs>
            <rect x="3" y="3" width="99%" height="99%" rx="22" ry="22" fill="none" stroke={P.accent} strokeWidth="4" filter="url(#sketchy-border-action)" />
          </svg>
        </div>
      )}
    </>
  );
}

// ── Nav pill for prev/next ────────────────────────────────────────────────────

function NavPill({ href, label, sub, align }: { href: string; label: string; sub: string; align: "left" | "right" }) {
  return (
    <a href={href} style={{ display: "flex", flexDirection: "column", gap: 2, textDecoration: "none", alignItems: align === "right" ? "flex-end" : "flex-start", background: P.cardBg, borderRadius: 14, padding: "12px 20px", border: `1px solid ${P.tint}44`, flex: 1, maxWidth: 300 }}>
      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color: P.inkLight, fontFamily: P.fontBody }}>{align === "left" ? "← " : ""}{sub}{align === "right" ? " →" : ""}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: P.ink, fontFamily: P.fontHeading, lineHeight: 1.2 }}>{label}</span>
    </a>
  );
}

// ── Main EditionView ──────────────────────────────────────────────────────────

export type AdjacentEdition = { key: string; theme?: string; label: string };

export async function EditionView({
  stories: allStories,
  synthesis,
  featureCreature,
  editionKey,
  editionLabel,
  dateStr,
  isArchive = false,
  prevEdition,
  nextEdition,
}: {
  stories: Story[];
  synthesis: Synthesis;
  featureCreature?: FeatureCreature;
  editionKey: string;
  editionLabel: string;
  dateStr: string;
  isArchive?: boolean;
  prevEdition?: AdjacentEdition | null;
  nextEdition?: AdjacentEdition | null;
}) {
  const synthWriterIndex = getSynthWriterIndex(editionKey);
  const [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11] = allStories;

  const card: React.CSSProperties = { background: P.cardBg, borderRadius: 20, overflow: "hidden", boxShadow: P.shadow, position: "relative" };
  const imgCard: React.CSSProperties = { ...card, position: "relative", background: P.tint + "44" };
  const hStyle: React.CSSProperties = { fontFamily: P.fontHeading, fontSize: 22, fontWeight: 800, lineHeight: 1.15, color: P.ink, letterSpacing: P.dark ? 1 : -0.5, textTransform: P.dark ? "uppercase" as const : "none" as const, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 };
  const bodyStyle: React.CSSProperties = { fontSize: 15, lineHeight: 1.7, color: P.inkMid, fontFamily: P.fontBody };

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
          <div style={{ fontSize: 11, color: P.inkLight, fontFamily: P.fontBody }}>{dateStr}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 3 }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, fontFamily: P.fontBody }}>{editionLabel}</div>
            {!isArchive && <EditionCountdown fontBody={P.fontBody} accent={P.accent} inkLight={P.inkLight} />}
          </div>
        </div>
      </div>

      {/* Nav bar */}
      <div className="ds-nav-bar" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 1200, marginTop: 0, marginBottom: 14, marginLeft: "auto", marginRight: "auto", gap: 12, flexWrap: "wrap" as const }}>
        <div className="ds-nav-left" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
          {isArchive ? (
            // Archive edition nav: Home | ← Previous | Next → | Archive
            <>
              <a href="/" style={{ textDecoration: "none" }}>
                <span style={{ display: "inline-flex", alignItems: "center", height: 36, fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, fontFamily: P.fontBody, paddingLeft: 18, paddingRight: 18, borderRadius: 20, border: `1px solid ${P.tint}88`, background: "transparent", color: P.inkLight }}>Home</span>
              </a>
              {prevEdition && (
                <a href={`/archive/${prevEdition.key}`} style={{ textDecoration: "none" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", height: 36, fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, fontFamily: P.fontBody, paddingLeft: 18, paddingRight: 18, borderRadius: 20, border: `1px solid ${P.tint}88`, background: "transparent", color: P.inkLight }}>← Previous</span>
                </a>
              )}
              {nextEdition && (
                <a href={`/archive/${nextEdition.key}`} style={{ textDecoration: "none" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", height: 36, fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, fontFamily: P.fontBody, paddingLeft: 18, paddingRight: 18, borderRadius: 20, border: `1px solid ${P.accent}`, background: P.accent + "22", color: P.accent }}>Next →</span>
                </a>
              )}
              <a href="/archive" style={{ textDecoration: "none" }}>
                <span style={{ display: "inline-flex", alignItems: "center", height: 36, fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, fontFamily: P.fontBody, paddingLeft: 18, paddingRight: 18, borderRadius: 20, border: `1px solid ${P.tint}88`, background: "transparent", color: P.inkLight }}>Archive</span>
              </a>
            </>
          ) : (
            // Homepage nav: Today | Previous Edition | Archive
            <>
              <a href="/" style={{ textDecoration: "none" }}>
                <span style={{ display: "inline-flex", alignItems: "center", height: 36, fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, fontFamily: P.fontBody, paddingLeft: 18, paddingRight: 18, borderRadius: 20, border: `1px solid ${P.accent}`, background: P.accent + "22", color: P.accent }}>Today</span>
              </a>
              {prevEdition && (
                <a href={`/archive/${prevEdition.key}`} style={{ textDecoration: "none" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", height: 36, fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, fontFamily: P.fontBody, paddingLeft: 18, paddingRight: 18, borderRadius: 20, border: `1px solid ${P.tint}88`, background: "transparent", color: P.inkLight }}>Previous Edition</span>
                </a>
              )}
              <a href="/archive" style={{ textDecoration: "none" }}>
                <span style={{ display: "inline-flex", alignItems: "center", height: 36, fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, fontFamily: P.fontBody, paddingLeft: 18, paddingRight: 18, borderRadius: 20, border: `1px solid ${P.tint}88`, background: "transparent", color: P.inkLight }}>Archive</span>
              </a>
            </>
          )}
          <span style={{ fontSize: 22, fontWeight: 700, fontStyle: "normal", fontFamily: `'${CURSIVE_FONT_FAMILY}', cursive`, color: P.accent, marginLeft: 8 }}>{TAGLINE}</span>
        </div>
        {!isArchive && <EmailCapture accent={P.accent} ink={P.ink} cardBg={P.cardBg} fontBody={P.fontBody} pillHeight={36} />}
      </div>

      {/* Bento grid */}
      <div className="ds-bento" style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gridTemplateRows: "minmax(320px, auto) minmax(300px, auto) minmax(120px, auto)", gap: 10, maxWidth: 1200, marginTop: 0, marginBottom: 10, marginLeft: "auto", marginRight: "auto" }}>

        {s1 && (
          <a href={`/article/${urlToSlug(s1.link)}`} style={{ gridColumn: "1 / 6", gridRow: "1", textDecoration: "none", color: "inherit" }}>
            <div style={{ ...card, height: "100%", paddingTop: 28, paddingBottom: 32, paddingLeft: 28, paddingRight: 28, display: "flex", flexDirection: "column", gap: 16 }}>
              <Pill section={s1.section} />
              <h1 className="ds-card-h" style={hStyle}>{s1.ownedTitle || s1.title}</h1>
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
              <MorePill story={s1} />
            </div>
          </a>
        )}

        {s1 && (
          <a href={`/article/${urlToSlug(s1.link)}`} style={{ ...imgCard, gridColumn: "6 / 13", gridRow: "1", textDecoration: "none" }}>
            {s1.imageUrl ? <img src={s1.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%", display: "block" }} /> : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${P.gradFrom}, ${P.gradTo})` }} />}
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(to top, ${P.accent}44 0%, transparent 60%)` }} />
          </a>
        )}

        {featureCreature && (() => {
          const fc = featureCreature;
          const angleColors: Record<string, string> = { science: "#27AE8F", build: "#5B8DEF", culture: "#D4517A" };
          const angleEmoji: Record<string, string> = { science: "🔬", build: "🛠️", culture: "🌍" };
          const color = angleColors[fc.angleKey] ?? P.accent;
          const emoji = angleEmoji[fc.angleKey] ?? "🪄";
          const slug = fc.editionKey ?? editionKey;
          const borderSeed = editionKey.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 3), 0);
          const borderColor = seededRandom(borderSeed) > 0.5 ? P.accent2 : color;
          const squiggle = 0.6 + seededRandom(borderSeed + 1) * 1.2; // 0.6–1.8
          return (
            <div style={{ gridColumn: "1 / 7", gridRow: "2 / 4", position: "relative" }}>
              <RulerBorder color={borderColor} seed={borderSeed} squiggle={squiggle} />
              <a href={`/feature-creature/${slug}`} style={{ textDecoration: "none", color: "inherit", display: "flex", height: "100%" }}>
                <div style={{ background: P.cardBg, borderRadius: 20, overflow: "hidden", boxShadow: P.shadow, display: "flex", flexDirection: "column", flex: 1 }}>
                  {fc.imageUrl && (
                    <div style={{ position: "relative", flex: 1, minHeight: 200 }}>
                      <img src={fc.imageUrl} alt={fc.universe} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%", display: "block", position: "absolute", inset: 0 }} />
                      <PixelEdge color={P.cardBg} seed={0} height={52} />
                      <div style={{ position: "absolute", top: 12, left: 14, background: color + "ee", color: "#fff", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, fontFamily: P.fontBody, paddingTop: 4, paddingBottom: 4, paddingLeft: 10, paddingRight: 10, borderRadius: 20, display: "flex", alignItems: "center", gap: 6 }}><span>{emoji}</span> Feature Creature</div>
                      <div style={{ position: "absolute", top: 12, right: 14, fontSize: 10, color: "rgba(255,255,255,0.7)", fontFamily: P.fontBody }}>{fc.universe}</div>
                    </div>
                  )}
                  <div style={{ paddingTop: 14, paddingLeft: 22, paddingRight: 22, paddingBottom: 50, display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, position: "relative" }}>
                    {!fc.imageUrl && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ background: color + "22", color, fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, fontFamily: P.fontBody, paddingTop: 4, paddingBottom: 4, paddingLeft: 10, paddingRight: 10, borderRadius: 20 }}>{emoji} Feature Creature</span><span style={{ fontSize: 10, color: P.inkLight, fontFamily: P.fontBody }}>{fc.universe}</span></div>}
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color, fontFamily: P.fontBody }}>{fc.angleLabel}</div>
                    <div style={{ fontFamily: `'${CURSIVE_FONT_FAMILY}', cursive`, fontSize: 26, color: P.ink, lineHeight: 1.15, fontWeight: 700 }}>{fc.title}</div>
                    {fc.synopsis && <div style={{ fontSize: 15, lineHeight: 1.65, color: P.inkMid, fontFamily: P.fontBody }}>{fc.synopsis}</div>}
                    <a href={`/feature-creature/${slug}`} style={{ position: "absolute", bottom: 18, right: 18, textDecoration: "none" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: P.accent, background: P.accent + "18", border: `1px solid ${P.accent}55`, borderRadius: 50, paddingTop: 8, paddingBottom: 8, paddingLeft: 20, paddingRight: 20, fontFamily: P.fontBody, letterSpacing: 0.3, whiteSpace: "nowrap" as const }}>More</span>
                    </a>
                  </div>
                </div>
              </a>
            </div>
          );
        })()}

        {!featureCreature && (
          <div style={{ gridColumn: "1 / 7", gridRow: "2 / 4", position: "relative" }}>
            <RulerBorder color={P.inkLight} />
            <div style={{ background: P.cardBg, borderRadius: 20, overflow: "hidden", boxShadow: P.shadow, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "40px 32px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.inkLight, fontFamily: P.fontBody, opacity: 0.5 }}>Feature Creature</div>
              <div style={{ fontFamily: `'${CURSIVE_FONT_FAMILY}', cursive`, fontSize: 28, color: P.inkLight, lineHeight: 1.2, textAlign: "center" as const, opacity: 0.4 }}>Population: 0</div>
              <div style={{ fontSize: 13, color: P.inkLight, fontFamily: P.fontBody, opacity: 0.35, letterSpacing: 1 }}>Coming soon</div>
            </div>
          </div>
        )}

        {s2 && (
          <a href={`/article/${urlToSlug(s2.link)}`} className="ds-s2-img" style={{ ...imgCard, gridColumn: "7 / 13", gridRow: "2", textDecoration: "none" }}>
            {s2.imageUrl ? <img src={s2.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%", display: "block" }} /> : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${P.tint}, ${P.accent}66)` }} />}
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,0.90) 0%, rgba(0,0,0,0.05) 55%, transparent 100%)" }} />
            <div style={{ position: "absolute", bottom: 20, left: 20, right: 100 }}>
              <div style={{ marginBottom: 6 }}><Pill section={s2.section} /></div>
              <div className="ds-card-h" style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.15, fontFamily: P.fontHeading, textTransform: P.dark ? "uppercase" as const : "none" as const, letterSpacing: P.dark ? 1 : -0.5, marginBottom: 8 }}>
                <ArticleLink story={s2}>{s2.ownedTitle || s2.title}</ArticleLink>
              </div>
              {s2.summary && <div className="ds-card-body" style={{ fontSize: 15, lineHeight: 1.6, color: "rgba(255,255,255,0.80)", fontFamily: P.fontBody }}>{s2.summary}</div>}
            </div>
            <MorePill story={s2} />
          </a>
        )}

        {s2 && (
          <a href={`/article/${urlToSlug(s2.link)}`} style={{ ...card, gridColumn: "7 / 13", gridRow: "3", display: "flex", alignItems: "center", paddingTop: 0, paddingBottom: 0, paddingLeft: 28, paddingRight: 100, gap: 18, textDecoration: "none", color: "inherit" }}>
            <div style={{ fontSize: 52, color: P.accent, fontFamily: P.fontHeading, flexShrink: 0, lineHeight: 0.8, opacity: 0.35, marginTop: 6 }}>"</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontStyle: "italic", color: P.ink, lineHeight: 1.5, fontFamily: P.fontBody, fontWeight: 500 }}>{s2.pullquote || s2.summary || s2.title}</div>
            </div>
            <MorePill story={s2} />
          </a>
        )}
      </div>

      {/* Synthesis */}
      {synthesis?.theme && <SynthesisSection synthesis={synthesis} stories={allStories} writerIndex={synthWriterIndex} />}

      {/* Row 2: s3–s11 */}
      {[s3, s4, s5, s6, s7, s8, s9, s10, s11].filter(Boolean).length > 0 && (() => {
        const editionSeed = editionKey.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
        return (
          <div className="ds-row2" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, maxWidth: 1200, marginTop: 0, marginBottom: 0, marginLeft: "auto", marginRight: "auto", alignItems: "stretch" }}>
            {[s3, s4, s5, s6, s7, s8, s9, s10, s11].filter(s => s?.summary).map((s, i) => {
              const showPullquote = seededRandom(editionSeed + i * 37) < 0.25;
              const showBullets = !showPullquote && seededRandom(editionSeed + i * 59) < 0.25;
              const twoSentences = seededRandom(editionSeed + i * 71) < 0.5;
              const summaryText = twoSentences
                ? s.summary!
                : (s.summary!.match(/^[^.!?]+[.!?]/) ?? [s.summary!])[0].trim();
              return (
                <a key={i} href={`/article/${urlToSlug(s.link)}`} style={{ textDecoration: "none", color: "inherit", display: "flex" }}>
                  <div style={{ display: "flex", flexDirection: "column", borderRadius: 20, overflow: "hidden", background: P.cardBg, boxShadow: P.shadow, flex: 1 }}>
                    {s.imageUrl && (
                      <div style={{ position: "relative", height: 200, background: P.tint + "44", flexShrink: 0 }}>
                        <img src={s.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%", display: "block" }} />
                        <PixelEdge color={P.cardBg} seed={i + 2} height={52} />
                        <div style={{ position: "absolute", top: 12, left: 14 }}><Pill section={s.section} /></div>
                      </div>
                    )}
                    <div style={{ paddingTop: 14, paddingLeft: 22, paddingRight: 22, paddingBottom: 18, display: "flex", flexDirection: "column", gap: 10, flex: 1, position: "relative" }}>
                      {s.imageUrl && <PixelEdgeTop color={P.pageBg} seed={i + 2} height={28} />}
                      {!s.imageUrl && <Pill section={s.section} />}
                      <div className="ds-card-h" style={hStyle}>{s.ownedTitle || s.title}</div>
                      {summaryText && <div className="ds-card-body" style={bodyStyle}>{summaryText}</div>}
                      {showPullquote && s.pullquote ? (
                        <div style={{ borderLeft: `3px solid ${P.accent}`, paddingLeft: 14, marginTop: 2 }}>
                          <div style={{ fontSize: 15, fontStyle: "italic", color: P.inkMid, lineHeight: 1.6, fontFamily: P.fontBody }}>{s.pullquote}</div>
                        </div>
                      ) : showBullets && s.bullets?.length ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {s.bullets.slice(0, 3).map((b, bi) => (
                            <div key={bi} style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, lineHeight: 1.55, color: P.inkMid, fontFamily: P.fontBody }}>
                              <span style={{ color: P.accent, flexShrink: 0, fontWeight: 700 }}>*</span>{b}
                            </div>
                          ))}
                        </div>
                      ) : null}
                      <div style={{ marginTop: "auto", paddingTop: 12, display: "flex", justifyContent: "flex-end" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: P.accent, background: P.accent + "18", border: `1px solid ${P.accent}55`, borderRadius: 50, paddingTop: 6, paddingBottom: 6, paddingLeft: 16, paddingRight: 16, fontFamily: P.fontBody, letterSpacing: 0.3, whiteSpace: "nowrap" as const }}>More</span>
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        );
      })()}


      {/* Internal desk link (homepage only) */}
      {!isArchive && (
        <div style={{ maxWidth: 1200, marginLeft: "auto", marginRight: "auto", marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
          <a href="/signal-desk" title="Signal Desk" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", border: `1.5px solid ${P.accent}55`, color: P.inkLight, textDecoration: "none", fontSize: 13, opacity: 0.5 }}>◎</a>
        </div>
      )}
    </div>
  );
}

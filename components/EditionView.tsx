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

function FlightPathBorder({ color, seed = 0 }: { color: string; seed?: number }) {
  const W = 1000; const H = 600; const PAD = 8; const CR = 30; // corner radius in SVG units
  const sr = (n: number) => { const s = Math.sin(seed * 9301 + n * 49297 + 233995); return s - Math.floor(s); };
  const PI = Math.PI;

  // Build rounded-rect perimeter as dense sample points
  const pts: { x: number; y: number }[] = [];
  const addArc = (cx: number, cy: number, a0: number, a1: number) => {
    for (let i = 0; i <= 10; i++) {
      const a = a0 + (a1 - a0) * i / 10;
      pts.push({ x: cx + CR * Math.cos(a), y: cy + CR * Math.sin(a) });
    }
  };
  // top edge + corners
  pts.push({ x: PAD + CR, y: PAD });
  pts.push({ x: W - PAD - CR, y: PAD });
  addArc(W - PAD - CR, PAD + CR, -PI / 2, 0);
  pts.push({ x: W - PAD, y: PAD + CR });
  pts.push({ x: W - PAD, y: H - PAD - CR });
  addArc(W - PAD - CR, H - PAD - CR, 0, PI / 2);
  pts.push({ x: W - PAD - CR, y: H - PAD });
  pts.push({ x: PAD + CR, y: H - PAD });
  addArc(PAD + CR, H - PAD - CR, PI / 2, PI);
  pts.push({ x: PAD, y: H - PAD - CR });
  pts.push({ x: PAD, y: PAD + CR });
  addArc(PAD + CR, PAD + CR, PI, 3 * PI / 2);

  // Compute cumulative lengths
  const segLens: number[] = [];
  let totalLen = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const len = Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y);
    segLens.push(len); totalLen += len;
  }

  const ptAt = (dist: number) => {
    let d = ((dist % totalLen) + totalLen) % totalLen;
    for (let i = 0; i < pts.length; i++) {
      if (d <= segLens[i]) {
        const t = segLens[i] > 0 ? d / segLens[i] : 0;
        const j = (i + 1) % pts.length;
        const x = pts[i].x + t * (pts[j].x - pts[i].x);
        const y = pts[i].y + t * (pts[j].y - pts[i].y);
        const angle = Math.atan2(pts[j].y - pts[i].y, pts[j].x - pts[i].x) * 180 / PI + 90;
        return { x, y, angle };
      }
      d -= segLens[i];
    }
    return { x: pts[0].x, y: pts[0].y, angle: 0 };
  };

  const closure = 0.50 + sr(0) * 0.45;
  const startDist = sr(1) * totalLen;
  const endDist = startDist + closure * totalLen;

  const DOT_SPACING = 26;
  const dots: { x: number; y: number }[] = [];
  for (let d = startDist + DOT_SPACING; d < endDist - DOT_SPACING * 1.8; d += DOT_SPACING) {
    const p = ptAt(d); dots.push({ x: p.x, y: p.y });
  }

  const start = ptAt(startDist);
  const end = ptAt(endDist);

  // Convert to % for HTML icons (undistorted)
  const sPx = `${(start.x / W * 100).toFixed(2)}%`;
  const sPy = `${(start.y / H * 100).toFixed(2)}%`;
  const ePx = `${(end.x / W * 100).toFixed(2)}%`;
  const ePy = `${(end.y / H * 100).toFixed(2)}%`;
  const planeAngle = end.angle;

  return (
    <>
      {/* Dots as HTML so they stay perfectly circular */}
      {dots.map((d, i) => (
        <div key={i} style={{ position: "absolute", left: `${(d.x / W * 100).toFixed(2)}%`, top: `${(d.y / H * 100).toFixed(2)}%`, width: 5, height: 5, borderRadius: "50%", background: color, opacity: 0.75, transform: "translate(-50%,-50%)", pointerEvents: "none", zIndex: 10 }} />
      ))}
      {/* Pin — HTML so it's never distorted */}
      <div style={{ position: "absolute", left: sPx, top: sPy, transform: "translate(-50%, calc(-100% + 2.5px))", zIndex: 11, pointerEvents: "none" }}>
        <svg width="14" height="19" viewBox="0 0 20 28" xmlns="http://www.w3.org/2000/svg">
          <circle cx="10" cy="10" r="10" fill={color} opacity={0.9} />
          <circle cx="10" cy="10" r="4.5" fill="#fff" opacity={0.9} />
          <path d="M10,28 L4,14 Q10,2 16,14 Z" fill={color} opacity={0.9} />
        </svg>
      </div>
      {/* Airplane — HTML so it's never distorted */}
      <div style={{ position: "absolute", left: ePx, top: ePy, transform: `translate(-50%, -50%) rotate(${planeAngle}deg)`, marginTop: -2, zIndex: 11, pointerEvents: "none" }}>
        <svg width="42" height="42" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M21,16l-9-5V3.5C12,2.7,11.3,2,10.5,2S9,2.7,9,3.5V11L0,16v2l9-2.5V21l-2,1.5V24l3.5-1l3.5,1v-1.5L12,21v-5.5l9,2.5V16z" fill={color} opacity={0.95} />
        </svg>
      </div>
    </>
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

// ── S1 image flight paths overlay ────────────────────────────────────────────

function S1FlightPaths({ seed, color }: { seed: number; color: string }) {
  const W = 800, H = 500;
  const sr = (n: number) => { const x = Math.sin(seed * 9301 + n * 49297 + 233995) * 10000; return x - Math.floor(x); };

  // Generate 5-7 waypoints spread across the image, then use Catmull-Rom → cubic bezier
  // Catmull-Rom guarantees smooth passage through every point with no cusps
  const numWaypoints = 5 + Math.floor(sr(0) * 3);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < numWaypoints; i++) {
    pts.push({ x: sr(i * 2 + 1) * W * 0.85 + W * 0.07, y: sr(i * 2 + 2) * H * 0.75 + H * 0.12 });
  }

  // Convert Catmull-Rom to cubic bezier segments (tension = 0.5)
  const tension = 0.5;
  // Duplicate first and last for phantom endpoints
  const p = [pts[0], ...pts, pts[pts.length - 1]];
  let d = `M ${p[1].x.toFixed(1)} ${p[1].y.toFixed(1)}`;
  let lastCp2 = p[1];

  for (let i = 1; i < p.length - 2; i++) {
    const cp1 = { x: p[i].x + (p[i + 1].x - p[i - 1].x) * tension / 3, y: p[i].y + (p[i + 1].y - p[i - 1].y) * tension / 3 };
    const cp2 = { x: p[i + 1].x - (p[i + 2].x - p[i].x) * tension / 3, y: p[i + 1].y - (p[i + 2].y - p[i].y) * tension / 3 };
    d += ` C ${cp1.x.toFixed(1)} ${cp1.y.toFixed(1)}, ${cp2.x.toFixed(1)} ${cp2.y.toFixed(1)}, ${p[i + 1].x.toFixed(1)} ${p[i + 1].y.toFixed(1)}`;
    lastCp2 = cp2;
  }

  const start = pts[0];
  const end = pts[pts.length - 1];
  // Plane faces direction of travel at the end
  const planeAngle = Math.atan2(end.y - lastCp2.y, end.x - lastCp2.x) * 180 / Math.PI;

  const startPx = `${(start.x / W * 100).toFixed(2)}%`;
  const startPy = `${(start.y / H * 100).toFixed(2)}%`;
  const endPx   = `${(end.x   / W * 100).toFixed(2)}%`;
  const endPy   = `${(end.y   / H * 100).toFixed(2)}%`;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", inset: 0 }}>
        <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeDasharray="4 9" strokeLinecap="round" opacity="0.65" />
      </svg>
      {/* X mark at start */}
      <div style={{ position: "absolute", left: startPx, top: startPy, transform: "translate(-50%,-50%)", zIndex: 3, pointerEvents: "none", fontSize: 18, fontWeight: 900, color, opacity: 0.9, lineHeight: 1, fontFamily: "Arial Black, sans-serif", textShadow: "0 0 4px rgba(0,0,0,0.6)" }}>✕</div>
      {/* Plane at end facing direction of travel */}
      <div style={{ position: "absolute", left: endPx, top: endPy, transform: `translate(-50%,-50%) rotate(${planeAngle}deg)`, zIndex: 3, pointerEvents: "none", marginTop: -2 }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill={color} opacity={0.9} xmlns="http://www.w3.org/2000/svg">
          <path d="M21,16l-9-5V3.5C12,2.67,11.33,2,10.5,2S9,2.67,9,3.5V11L0,16v2l9-2.5V21l-2,1.5V24l3.5-1l3.5,1v-1.5L12,21v-5.5l9,2.5V16z" />
        </svg>
      </div>
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
            <div style={{ paddingTop: 16, paddingBottom: 14, paddingLeft: 28, paddingRight: 28, borderBottom: `1px solid ${P.tint}44`, display: "flex", alignItems: "flex-start", gap: 28 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, marginBottom: 8, fontFamily: P.fontBody }}>Observation</div>
                {synthesis.observation.split("\n\n").filter(Boolean).map((para, i) => (
                  <p key={i} style={{ fontSize: 17, lineHeight: 1.75, color: P.inkMid, marginTop: 0, marginBottom: i < synthesis.observation.split("\n\n").length - 1 ? 14 : 0, fontFamily: P.fontBody }}>{para}</p>
                ))}
              </div>
              {synthesis.imageUrl && (
                <div style={{ flexShrink: 0, width: 200, height: 200, borderRadius: "50%", overflow: "hidden", border: `3px solid ${P.accent}44`, boxShadow: `0 0 0 6px ${P.accent}18`, marginTop: 4 }}>
                  <img src={synthesis.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }} />
                </div>
              )}
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
            {s1.imageUrl ? <img src={s1.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} /> : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${P.gradFrom}, ${P.gradTo})` }} />}
            <S1FlightPaths seed={editionKey.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 7), 0)} color={P.accent} />
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
          const borderColor = color;
          return (
            <div style={{ gridColumn: "1 / 7", gridRow: "2 / 4", position: "relative" }}>
              <FlightPathBorder color={borderColor} seed={borderSeed} />
              <a href={`/feature-creature/${slug}`} style={{ textDecoration: "none", color: "inherit", display: "flex", height: "100%" }}>
                <div style={{ background: P.ink, borderRadius: 20, overflow: "hidden", boxShadow: P.shadow, display: "flex", flexDirection: "column", flex: 1 }}>
                  {fc.imageUrl && (
                    <div style={{ position: "relative", flex: 1, minHeight: 200 }}>
                      <img src={fc.imageUrl} alt={fc.universe} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block", position: "absolute", inset: 0 }} />
                      <PixelEdge color={P.ink} seed={0} height={52} />
                      <div style={{ position: "absolute", top: 12, left: 14, background: color + "ee", color: "#fff", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, fontFamily: P.fontBody, paddingTop: 4, paddingBottom: 4, paddingLeft: 10, paddingRight: 10, borderRadius: 20, display: "flex", alignItems: "center", gap: 6 }}><span>{emoji}</span> Feature Creature</div>
                      <div style={{ position: "absolute", top: 12, right: 14, fontSize: 10, color: "rgba(255,255,255,0.7)", fontFamily: P.fontBody }}>{fc.universe}</div>
                    </div>
                  )}
                  <div style={{ paddingTop: 14, paddingLeft: 22, paddingRight: 22, paddingBottom: 50, display: "flex", flexDirection: "column", gap: 8, flexShrink: 0, position: "relative" }}>
                    {!fc.imageUrl && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ background: color + "33", color, fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, fontFamily: P.fontBody, paddingTop: 4, paddingBottom: 4, paddingLeft: 10, paddingRight: 10, borderRadius: 20 }}>{emoji} Feature Creature</span><span style={{ fontSize: 10, color: P.pageBg, fontFamily: P.fontBody, opacity: 0.5 }}>{fc.universe}</span></div>}
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase" as const, color, fontFamily: P.fontBody }}>{fc.angleLabel}</div>
                    <div style={{ fontFamily: `'${CURSIVE_FONT_FAMILY}', cursive`, fontSize: 26, color: P.pageBg, lineHeight: 1.15, fontWeight: 700 }}>{fc.title}</div>
                    {fc.synopsis && <div style={{ fontSize: 15, lineHeight: 1.65, color: P.pageBg, fontFamily: P.fontBody, opacity: 0.75 }}>{fc.synopsis}</div>}
                    <a href={`/feature-creature/${slug}`} style={{ position: "absolute", bottom: 18, right: 18, textDecoration: "none" }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: P.pageBg, background: P.pageBg + "22", border: `1px solid ${P.pageBg}55`, borderRadius: 50, paddingTop: 8, paddingBottom: 8, paddingLeft: 20, paddingRight: 20, fontFamily: P.fontBody, letterSpacing: 0.3, whiteSpace: "nowrap" as const }}>More</span>
                    </a>
                  </div>
                </div>
              </a>
            </div>
          );
        })()}

        {!featureCreature && (
          <div style={{ gridColumn: "1 / 7", gridRow: "2 / 4", position: "relative" }}>
            <FlightPathBorder color={P.inkLight} seed={0} />
            <div style={{ background: P.cardBg, borderRadius: 20, overflow: "hidden", boxShadow: P.shadow, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "40px 32px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.inkLight, fontFamily: P.fontBody, opacity: 0.5 }}>Feature Creature</div>
              <div style={{ fontFamily: `'${CURSIVE_FONT_FAMILY}', cursive`, fontSize: 28, color: P.inkLight, lineHeight: 1.2, textAlign: "center" as const, opacity: 0.4 }}>Population: 0</div>
              <div style={{ fontSize: 13, color: P.inkLight, fontFamily: P.fontBody, opacity: 0.35, letterSpacing: 1 }}>Coming soon</div>
            </div>
          </div>
        )}

        {s2 && (
          <a href={`/article/${urlToSlug(s2.link)}`} style={{ gridColumn: "7 / 13", gridRow: "2", textDecoration: "none", color: "inherit", display: "flex" }}>
            <div style={{ display: "flex", flexDirection: "column", borderRadius: 20, overflow: "hidden", background: P.cardBg, boxShadow: P.shadow, flex: 1 }}>
              {s2.imageUrl && (
                <div style={{ position: "relative", height: 200, background: P.tint + "44", flexShrink: 0 }}>
                  <img src={s2.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} />
                  <PixelEdge color={P.cardBg} seed={1} height={52} />
                  <div style={{ position: "absolute", top: 12, left: 14 }}><Pill section={s2.section} /></div>
                </div>
              )}
              <div style={{ paddingTop: 14, paddingLeft: 22, paddingRight: 22, paddingBottom: 18, display: "flex", flexDirection: "column", gap: 10, flex: 1, position: "relative" }}>
                {s2.imageUrl && <PixelEdgeTop color={P.pageBg} seed={1} height={28} />}
                {!s2.imageUrl && <Pill section={s2.section} />}
                <div className="ds-card-h" style={hStyle}>{s2.ownedTitle || s2.title}</div>
                {s2.summary && <div className="ds-card-body" style={bodyStyle}>{s2.summary}</div>}
              </div>
            </div>
          </a>
        )}

        {s2 && (
          <a href={`/article/${urlToSlug(s2.link)}`} style={{ ...card, gridColumn: "7 / 13", gridRow: "3", display: "flex", alignItems: "center", paddingTop: 0, paddingBottom: 0, paddingLeft: 28, paddingRight: 28, gap: 18, textDecoration: "none", color: "inherit" }}>
            <div style={{ fontSize: 52, color: P.accent, fontFamily: P.fontHeading, flexShrink: 0, lineHeight: 0.8, opacity: 0.35, marginTop: 6 }}>"</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontStyle: "italic", color: P.ink, lineHeight: 1.5, fontFamily: P.fontBody, fontWeight: 500 }}>{s2.pullquote || s2.summary || s2.title}</div>
            </div>
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
                        <img src={s.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} />
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

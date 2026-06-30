import { urlToSlug, actionSlug, getSynthWriterIndex, type Story, type Synthesis, type FeatureCreature } from "@/lib/stories";
import { P, QUOTE_FONT, SECTION_COLORS, ACTION_LABEL, ACTION_EMOJI, CURSIVE_FONT_FAMILY, CURSIVE_FONT_URL, TAGLINE, contrastColor, setEditionPaletteKey } from "@/lib/palette";
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

function ArticleLink({ story, editionKey, children }: { story: Story; editionKey: string; children: React.ReactNode }) {
  const slug = urlToSlug(story.link);
  return (
    <a href={`/article/${slug}?e=${editionKey}`} style={{ color: "inherit", textDecoration: "none" }}>
      {children}
    </a>
  );
}

function MorePill({ story, editionKey }: { story: Story; editionKey: string }) {
  const slug = urlToSlug(story.link);
  return (
    <a href={`/article/${slug}?e=${editionKey}`} style={{ textDecoration: "none", position: "absolute", bottom: 18, right: 18 }}>
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

function S1FlightPaths({ seed, color, imageColor }: { seed: number; color: string; imageColor?: string }) {
  if (imageColor) color = contrastColor(imageColor);
  const W = 800, H = 500;
  const sr = (n: number) => { const x = Math.sin(seed * 9301 + n * 49297 + 233995) * 10000; return x - Math.floor(x); };

  // 45% one plane, 45% two planes, 10% three planes
  const r99 = sr(99);
  const numPlanes = r99 < 0.45 ? 1 : r99 < 0.90 ? 2 : 3;
  const TENSION = 0.9;
  // Icons (plane + X) must stay inside this margin so they're never clipped
  const ICON_M = 0.13;
  // Mid-path waypoints can use a looser margin
  const PT_M = 0.05;

  type Pt = { x: number; y: number };
  type PlaneData = { d: string; planeX: number; planeY: number; planeAngle: number; endX: number; endY: number };

  // Clamp to icon-safe zone (endpoints + icons)
  const clampIcon = (x: number, y: number): Pt => ({
    x: Math.max(W * ICON_M, Math.min(W * (1 - ICON_M), x)),
    y: Math.max(H * ICON_M, Math.min(H * (1 - ICON_M), y)),
  });

  // Band dividers: one between each pair of bands, randomly rotated -30°..+30°
  const MIN_RADIUS = 30; // minimum turn radius in SVG units
  const MIN_DIST = MIN_RADIUS * 2; // minimum spacing between waypoints to enforce it

  const bandDividers = Array.from({ length: numPlanes - 1 }, (_, di) => {
    const bandH = H / numPlanes;
    const divY = (di + 1) * bandH;
    const angleDeg = sr(di * 60 + 90) * 60 - 30; // -30 to +30
    return { cx: W / 2, cy: divY, angleDeg };
  });

  const planes: PlaneData[] = Array.from({ length: numPlanes }, (_, pi) => {
    // Each plane owns a horizontal band — guarantees no path crossing
    const bandH = H / numPlanes;
    // Band inner edges shrunk by ICON_M so endpoint icons never clip top/bottom
    const bandTop = pi * bandH + H * ICON_M;
    const bandBot = (pi + 1) * bandH - H * ICON_M;
    const clampBand = (x: number, y: number): Pt => ({
      x: Math.max(W * PT_M, Math.min(W * (1 - PT_M), x)),
      y: Math.max(bandTop, Math.min(bandBot, y)),
    });
    // Endpoint clamp: x also gets icon margin so plane/X are never cut off horizontally
    const clampEnd = (x: number, y: number): Pt => ({
      x: Math.max(W * ICON_M, Math.min(W * (1 - ICON_M), x)),
      y: Math.max(bandTop, Math.min(bandBot, y)),
    });

    // Start and end: x free, constrained to icon-safe zone so icons are never clipped
    const startPt = clampEnd(
      W * (ICON_M + sr(pi * 60) * (1 - 2 * ICON_M)),
      bandTop + sr(pi * 60 + 1) * (bandBot - bandTop),
    );
    const endPt = clampEnd(
      W * (ICON_M + sr(pi * 60 + 20) * (1 - 2 * ICON_M)),
      bandTop + sr(pi * 60 + 21) * (bandBot - bandTop),
    );

    const pts: Pt[] = [startPt];

    // 4–6 middle waypoints — x free across full width, y stays in band
    const numMid = 4 + Math.floor(sr(pi * 60 + 2) * 3);
    for (let i = 0; i < numMid; i++) {
      pts.push(clampBand(
        W * (PT_M + sr(pi * 60 + i * 7 + 3) * (1 - 2 * PT_M)),
        bandTop + sr(pi * 60 + i * 7 + 4) * (bandBot - bandTop),
      ));
    }
    pts.push(endPt);

    // 55% chance of a smooth loop mid-path (clamped to band)
    if (sr(pi * 60 + 30) < 0.55 && pts.length >= 3) {
      const li = 1 + Math.floor(sr(pi * 60 + 31) * (pts.length - 2));
      const lx = pts[li].x, ly = pts[li].y;
      const r = Math.max(MIN_RADIUS, 40 + sr(pi * 60 + 32) * 55);
      const dir = sr(pi * 60 + 33) < 0.5 ? 1 : -1;
      const loop: Pt[] = [
        { x: lx + r,        y: ly + dir * r * 0.45 },
        { x: lx + r * 0.25, y: ly + dir * r },
        { x: lx - r * 0.65, y: ly + dir * r * 0.55 },
        { x: lx - r * 0.2,  y: ly - dir * r * 0.25 },
      ].map(p => clampBand(p.x, p.y));
      pts.splice(li + 1, 0, ...loop);
    }

    // Enforce minimum spacing between waypoints so no turn is tighter than MIN_RADIUS
    const dist = (a: Pt, b: Pt) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2);
    const filtered: Pt[] = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
      if (dist(filtered[filtered.length - 1], pts[i]) >= MIN_DIST) filtered.push(pts[i]);
    }
    filtered.push(pts[pts.length - 1]);

    // Catmull-Rom → cubic bezier
    const p = [filtered[0], ...filtered, filtered[filtered.length - 1]];
    let d = `M ${p[1].x.toFixed(1)} ${p[1].y.toFixed(1)}`;
    for (let i = 1; i < p.length - 2; i++) {
      const cp1 = { x: p[i].x + (p[i+1].x - p[i-1].x) * TENSION / 3, y: p[i].y + (p[i+1].y - p[i-1].y) * TENSION / 3 };
      const cp2 = { x: p[i+1].x - (p[i+2].x - p[i].x) * TENSION / 3, y: p[i+1].y - (p[i+2].y - p[i].y) * TENSION / 3 };
      d += ` C ${cp1.x.toFixed(1)} ${cp1.y.toFixed(1)}, ${cp2.x.toFixed(1)} ${cp2.y.toFixed(1)}, ${p[i+1].x.toFixed(1)} ${p[i+1].y.toFixed(1)}`;
    }

    // Plane icon sits just behind the path start, angled along the first tangent
    const firstCp = { x: p[1].x + (p[2].x - p[0].x) * TENSION / 3, y: p[1].y + (p[2].y - p[0].y) * TENSION / 3 };
    const dAngle = Math.atan2(firstCp.y - startPt.y, firstCp.x - startPt.x);
    const OFFSET = 36;
    const rawPlane = clampIcon(
      startPt.x - Math.cos(dAngle) * OFFSET,
      startPt.y - Math.sin(dAngle) * OFFSET,
    );
    return {
      d,
      planeX: rawPlane.x, planeY: rawPlane.y,
      planeAngle: dAngle * 180 / Math.PI + 90,
      endX: endPt.x, endY: endPt.y,
    };
  });

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", inset: 0 }}>
        {bandDividers.map((dv, i) => (
          <line key={`div-${i}`} x1={-W * 0.5} y1={dv.cy} x2={W * 1.5} y2={dv.cy}
            stroke={color} strokeWidth="1.5" strokeDasharray="4 9" strokeLinecap="round" opacity="0.3"
            transform={`rotate(${dv.angleDeg.toFixed(1)} ${dv.cx} ${dv.cy})`} />
        ))}
        {planes.map((pl, i) => (
          <path key={i} d={pl.d} fill="none" stroke={color} strokeWidth="2.5" strokeDasharray="4 9" strokeLinecap="round" opacity="0.65" />
        ))}
      </svg>
      {planes.map((pl, i) => (
        <div key={`plane-${i}`} style={{ position: "absolute", left: `${(pl.planeX / W * 100).toFixed(2)}%`, top: `${(pl.planeY / H * 100).toFixed(2)}%`, transform: `translate(-50%,-50%) rotate(${pl.planeAngle}deg)`, zIndex: 3, pointerEvents: "none" }}>
          <svg width="42" height="42" viewBox="0 0 24 24" fill={color} opacity={0.9} xmlns="http://www.w3.org/2000/svg">
            <path d="M21,16l-9-5V3.5C12,2.67,11.33,2,10.5,2S9,2.67,9,3.5V11L0,16v2l9-2.5V21l-2,1.5V24l3.5-1l3.5,1v-1.5L12,21v-5.5l9,2.5V16z" />
          </svg>
        </div>
      ))}
      {planes.map((pl, i) => (
        <div key={`x-${i}`} style={{ position: "absolute", left: `${(pl.endX / W * 100).toFixed(2)}%`, top: `${(pl.endY / H * 100).toFixed(2)}%`, transform: "translate(-50%,-50%)", zIndex: 3, pointerEvents: "none" }}>
          <svg width="20" height="20" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
            <line x1="3" y1="3" x2="25" y2="25" stroke={color} strokeWidth="5.5" strokeLinecap="round" opacity="0.92" />
            <line x1="25" y1="3" x2="3" y2="25" stroke={color} strokeWidth="5.5" strokeLinecap="round" opacity="0.92" />
          </svg>
        </div>
      ))}
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
          {(synthesis.hook || synthesis.observation) && (
            <div className="ds-synthesis-obs" style={{ position: "relative", paddingTop: 20, paddingBottom: 14, paddingLeft: 28, paddingRight: synthesis.imageUrl ? 320 : 28, borderBottom: `1px solid ${P.tint}44` }}>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, marginBottom: 8, fontFamily: P.fontBody }}>Observation</div>
              {synthesis.hook && (
                <p style={{ fontSize: 19, lineHeight: 1.6, fontWeight: 600, color: P.ink, marginTop: 0, marginBottom: synthesis.observation ? 14 : 0, fontFamily: P.fontBody }}>{synthesis.hook}</p>
              )}
              {synthesis.observation && synthesis.observation.split("\n\n").filter(Boolean).map((para, i, arr) => (
                <p key={i} style={{ fontSize: 17, lineHeight: 1.75, color: P.inkMid, marginTop: 0, marginBottom: i < arr.length - 1 ? 14 : 0, fontFamily: P.fontBody }}>{para}</p>
              ))}
              {synthesis.imageUrl && (
                <div className="ds-synthesis-img" style={{ position: "absolute", top: 20, right: 80 }}>
                  <div style={{ position: "relative", width: 200, height: 200 }}>
                    <div style={{ width: 200, height: 200, borderRadius: "50%", overflow: "hidden" }}>
                      <img src={synthesis.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }} />
                    </div>
                    <svg style={{ position: "absolute", top: -5, left: -5, width: 210, height: 210, overflow: "visible", pointerEvents: "none" }} viewBox="0 0 210 210">
                      <defs><filter id="sketchy-circle" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed="5" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" /></filter></defs>
                      <circle cx="105" cy="105" r="101" fill="none" stroke={P.accent} strokeWidth="3.5" filter="url(#sketchy-circle)" />
                    </svg>
                  </div>
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
                const synthCtx = [
                  synthesis.theme ? `st=${encodeURIComponent(synthesis.theme)}` : "",
                  synthesis.hook ? `sh=${encodeURIComponent(synthesis.hook)}` : "",
                ].filter(Boolean).join("&");
                const href = `/how/${slug}?a=${encoded}&as=${relSlug}&at=${relTitle}${synthCtx ? "&" + synthCtx : ""}`;
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
  setEditionPaletteKey(editionKey);
  const synthWriterIndex = getSynthWriterIndex(editionKey);
  const [s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11] = allStories;
  // Flip row 1 (S1) and row 2 (FC) on morning + evening editions for layout variety
  const _slot = editionKey.split("_")[1];
  const synthFlip = seededRandom(editionKey.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 41), 0)) < 0.4;

  const card: React.CSSProperties = { background: P.cardBg, borderRadius: 20, overflow: "hidden", boxShadow: P.shadow, position: "relative" };
  const imgCard: React.CSSProperties = { ...card, position: "relative", background: P.tint + "44" };
  const hStyle: React.CSSProperties = { fontFamily: P.fontHeading, fontSize: 22, fontWeight: 800, lineHeight: 1.15, color: P.ink, letterSpacing: P.dark ? 1 : -0.5, textTransform: P.dark ? "uppercase" as const : "none" as const, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 };
  const bodyStyle: React.CSSProperties = { fontSize: 15, lineHeight: 1.7, color: P.inkMid, fontFamily: P.fontBody };

  return (
    <div className="ds-page" style={{ minHeight: "100vh", background: P.pageBg, fontFamily: P.fontBody, paddingTop: 24, paddingBottom: 60, paddingLeft: 20, paddingRight: 20, color: P.ink }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={CURSIVE_FONT_URL} />
      <style>{`
        @media (max-width: 700px) {
          .ds-bento-fc { grid-template-columns: 1fr !important; grid-template-rows: auto !important; }
          .ds-bento-fc > * { grid-column: 1 / -1 !important; grid-row: auto !important; }
        }
      `}</style>

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
            <>
              {prevEdition && (
                <a href={`/archive/${prevEdition.key}`} style={{ textDecoration: "none" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", fontSize: 15, fontWeight: 700, color: P.accent, background: P.accent + "18", border: `1px solid ${P.accent}55`, borderRadius: 50, paddingTop: 8, paddingBottom: 8, paddingLeft: 20, paddingRight: 20, fontFamily: P.fontBody, letterSpacing: 0.3, whiteSpace: "nowrap" as const }}>Previous Edition</span>
                </a>
              )}
              {nextEdition && (
                <a href={`/archive/${nextEdition.key}`} style={{ textDecoration: "none" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", fontSize: 15, fontWeight: 700, color: P.accent, background: P.accent + "18", border: `1px solid ${P.accent}55`, borderRadius: 50, paddingTop: 8, paddingBottom: 8, paddingLeft: 20, paddingRight: 20, fontFamily: P.fontBody, letterSpacing: 0.3, whiteSpace: "nowrap" as const }}>Next Edition</span>
                </a>
              )}
            </>
          ) : (
            <>
              {prevEdition && (
                <a href={`/archive/${prevEdition.key}`} style={{ textDecoration: "none" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", fontSize: 15, fontWeight: 700, color: P.accent, background: P.accent + "18", border: `1px solid ${P.accent}55`, borderRadius: 50, paddingTop: 8, paddingBottom: 8, paddingLeft: 20, paddingRight: 20, fontFamily: P.fontBody, letterSpacing: 0.3, whiteSpace: "nowrap" as const }}>Previous Edition</span>
                </a>
              )}
            </>
          )}
          <span style={{ fontSize: 22, fontWeight: 700, fontStyle: "normal", fontFamily: `'${CURSIVE_FONT_FAMILY}', cursive`, color: P.accent, marginLeft: 8 }}>{TAGLINE}</span>
        </div>
        {!isArchive && <EmailCapture accent={P.accent} ink={P.ink} cardBg={P.cardBg} fontBody={P.fontBody} pillHeight={36} />}
      </div>

      {/* Bento row 1: S1 hero */}
      <div className="ds-bento" style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gridTemplateRows: "minmax(320px, auto)", gap: 10, maxWidth: 1200, marginTop: 0, marginBottom: 10, marginLeft: "auto", marginRight: "auto" }}>

        {s1 && (
          <a href={`/article/${urlToSlug(s1.link)}?e=${editionKey}`} style={{ gridColumn: "1 / 6", gridRow: "1", textDecoration: "none", color: "inherit" }}>
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
              <MorePill story={s1} editionKey={editionKey} />
            </div>
          </a>
        )}

        {s1 && (
          <a href={`/article/${urlToSlug(s1.link)}?e=${editionKey}`} style={{ ...imgCard, gridColumn: "6 / 13", gridRow: "1", textDecoration: "none" }}>
            {s1.imageUrl ? <img src={s1.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} /> : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${P.gradFrom}, ${P.gradTo})` }} />}
            <S1FlightPaths seed={editionKey.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 7), 0)} color={P.accent} imageColor={s1.imageColor} />
          </a>
        )}
      </div>

      {/* Synthesis — flipped editions: appears between S1 hero and FC+S2 */}
      {synthFlip && synthesis?.theme && <SynthesisSection synthesis={synthesis} stories={allStories} writerIndex={synthWriterIndex} />}

      {/* Bento row 2: FC + S2 */}
      <div className="ds-bento-fc" style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gridTemplateRows: "minmax(300px, auto) minmax(120px, auto)", gap: 10, maxWidth: 1200, marginTop: 0, marginBottom: 10, marginLeft: "auto", marginRight: "auto" }}>

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
            <div style={{ gridColumn: "1 / 7", gridRow: "1 / 3", position: "relative" }}>
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
          <div style={{ gridColumn: "1 / 7", gridRow: "1 / 3", position: "relative" }}>
            <FlightPathBorder color={P.inkLight} seed={0} />
            <div style={{ background: P.cardBg, borderRadius: 20, overflow: "hidden", boxShadow: P.shadow, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "40px 32px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.inkLight, fontFamily: P.fontBody, opacity: 0.5 }}>Feature Creature</div>
              <div style={{ fontFamily: `'${CURSIVE_FONT_FAMILY}', cursive`, fontSize: 28, color: P.inkLight, lineHeight: 1.2, textAlign: "center" as const, opacity: 0.4 }}>Population: 0</div>
              <div style={{ fontSize: 13, color: P.inkLight, fontFamily: P.fontBody, opacity: 0.35, letterSpacing: 1 }}>Coming soon</div>
            </div>
          </div>
        )}

        {s2 && (
          <a href={`/article/${urlToSlug(s2.link)}?e=${editionKey}`} style={{ gridColumn: "7 / 13", gridRow: "1", textDecoration: "none", color: "inherit", display: "flex" }}>
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
          <a href={`/article/${urlToSlug(s2.link)}?e=${editionKey}`} style={{ ...card, gridColumn: "7 / 13", gridRow: "2", display: "flex", alignItems: "center", paddingTop: 0, paddingBottom: 0, paddingLeft: 28, paddingRight: 28, gap: 18, textDecoration: "none", color: "inherit" }}>
            <div style={{ fontSize: 52, color: P.accent, fontFamily: P.fontHeading, flexShrink: 0, lineHeight: 0.8, opacity: 0.35, marginTop: 6 }}>"</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontStyle: "italic", color: P.ink, lineHeight: 1.5, fontFamily: P.fontBody, fontWeight: 500 }}>{s2.pullquote || s2.summary || s2.title}</div>
            </div>
          </a>
        )}
      </div>

      {/* Synthesis — normal editions: appears after FC+S2 */}
      {!synthFlip && synthesis?.theme && <SynthesisSection synthesis={synthesis} stories={allStories} writerIndex={synthWriterIndex} />}

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
                <a key={i} href={`/article/${urlToSlug(s.link)}?e=${editionKey}`} style={{ textDecoration: "none", color: "inherit", display: "flex" }}>
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

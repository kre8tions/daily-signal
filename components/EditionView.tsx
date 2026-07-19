import { urlToSlug, actionSlug, getSynthWriterIndex, type Story, type Synthesis, type FeatureCreature, type WeeklySignal } from "@/lib/stories";
import { P, QUOTE_FONT, QUOTE_FONTS, SECTION_COLORS, CURSIVE_FONT_FAMILY, CURSIVE_FONT_URL, TAGLINE, contrastColor, setEditionPaletteKey } from "@/lib/palette";
import { EditionCountdown } from "@/app/EditionCountdown";
import { EmailCapture } from "@/app/EmailCapture";
import { ShareButton } from "@/app/ShareButton";

// ── Helpers ───────────────────────────────────────────────────────────────────

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed + i * 97) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
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

const VEHICLES: Array<{
  icon: (c: string) => React.ReactNode;
  marker: (c: string) => React.ReactNode;
  rotationOffset: number; // degrees to add to path angle (0 = SVG points up, -90 = SVG points right)
}> = [
  { rotationOffset: 0, // Airplane → cloud (points up)
    icon: (c) => <svg width="42" height="42" viewBox="0 0 24 24" fill={c} opacity={0.9} xmlns="http://www.w3.org/2000/svg"><path d="M21,16l-9-5V3.5C12,2.67,11.33,2,10.5,2S9,2.67,9,3.5V11L0,16v2l9-2.5V21l-2,1.5V24l3.5-1l3.5,1v-1.5L12,21v-5.5l9,2.5V16z"/></svg>,
    marker: (c) => <svg width="24" height="20" viewBox="0 0 32 26" xmlns="http://www.w3.org/2000/svg"><path d="M7,22C3,22 0,19 0,15C0,12 2,10 5,10C5,5 9,2 14,2C19,2 23,5 23,9L24,9C28,9 32,12 32,16C32,20 29,22 25,22Z" fill={c} opacity={0.88}/></svg>,
  },
  { rotationOffset: 0, // Bee → hive (points up)
    icon: (c) => (
      <svg width="42" height="42" viewBox="0 0 36 38" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} xmlns="http://www.w3.org/2000/svg">
        <circle cx="18" cy="8" r="5"/>
        <ellipse cx="18" cy="25" rx="6" ry="10"/>
        <line x1="12" y1="19" x2="24" y2="19"/>
        <line x1="12" y1="24" x2="24" y2="24"/>
        <line x1="12" y1="29" x2="24" y2="29"/>
        <ellipse cx="5" cy="18" rx="7" ry="4" transform="rotate(-12 5 18)"/>
        <ellipse cx="31" cy="18" rx="7" ry="4" transform="rotate(12 31 18)"/>
        <path d="M15,3 C13,0 10,-1 8,-2"/><circle cx="8" cy="-2" r="1.5" fill={c}/>
        <path d="M21,3 C23,0 26,-1 28,-2"/><circle cx="28" cy="-2" r="1.5" fill={c}/>
      </svg>
    ),
    marker: (c) => (
      <svg width="22" height="22" viewBox="0 0 28 28" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" xmlns="http://www.w3.org/2000/svg">
        <path d="M4,20 C3,4 25,4 24,20"/>
        <path d="M5,14 Q14,10 23,14"/>
        <path d="M5,8 Q14,4 23,8"/>
        <line x1="2" y1="20" x2="26" y2="20"/>
        <path d="M10,20 Q14,17 18,20"/>
      </svg>
    ),
  },
  { rotationOffset: -90, // Sailboat → anchor (points right)
    icon: (c) => (
      <svg width="53" height="53" viewBox="0 0 36 44" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} xmlns="http://www.w3.org/2000/svg">
        <line x1="18" y1="32" x2="18" y2="2"/>
        <path d="M18,2 C22,10 30,22 18,32"/>
        <path d="M18,10 C14,16 8,26 18,32"/>
        <path d="M6,32 Q18,36 30,32 L28,36 Q18,38 8,36 Z"/>
        <path d="M0,38 C4,36 8,40 14,38 C20,36 26,40 32,38"/>
      </svg>
    ),
    marker: (c) => (
      <svg width="28" height="28" viewBox="0 0 28 32" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" xmlns="http://www.w3.org/2000/svg">
        <circle cx="14" cy="4" r="3"/>
        <line x1="14" y1="7" x2="14" y2="28"/>
        <line x1="5" y1="12" x2="23" y2="12"/>
        <circle cx="5" cy="12" r="1.5" fill={c} stroke="none"/>
        <circle cx="23" cy="12" r="1.5" fill={c} stroke="none"/>
        <path d="M14,28 C8,28 4,24 4,20"/>
        <path d="M14,28 C20,28 24,24 24,20"/>
        <path d="M4,20 L2,22 L6,22"/>
        <path d="M24,20 L26,22 L22,22"/>
        <path d="M21,8 C26,10 28,18 24,22"/>
      </svg>
    ),
  },
  { rotationOffset: -90, // Bicycle → road sign (points right)
    icon: (c) => (
      <svg width="53" height="53" viewBox="0 0 52 36" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} xmlns="http://www.w3.org/2000/svg">
        <circle cx="11" cy="25" r="9"/>
        <circle cx="41" cy="25" r="9"/>
        <circle cx="26" cy="25" r="2.5"/>
        <line x1="26" y1="25" x2="22" y2="13"/>
        <line x1="22" y1="13" x2="11" y2="25"/>
        <line x1="22" y1="13" x2="32" y2="13"/>
        <line x1="32" y1="13" x2="26" y2="25"/>
        <line x1="32" y1="13" x2="41" y2="25"/>
        <line x1="18" y1="11" x2="26" y2="11"/>
        <line x1="22" y1="13" x2="22" y2="11"/>
        <path d="M32,13 C34,10 37,10 38,12 C39,14 38,15 37,14"/>
      </svg>
    ),
    marker: (c) => (
      <svg width="22" height="22" viewBox="0 0 28 28" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" xmlns="http://www.w3.org/2000/svg">
        <line x1="14" y1="14" x2="14" y2="26"/>
        <path d="M4,4 L18,4 L24,10 L18,16 L4,16 Z"/>
        <line x1="8" y1="8"  x2="16" y2="8"/>
        <line x1="8" y1="11" x2="14" y2="11"/>
      </svg>
    ),
  },
  { rotationOffset: 90, // Submarine → periscope (points left — bow on left)
    icon: (c) => (
      <svg width="53" height="53" viewBox="0 0 56 30" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} xmlns="http://www.w3.org/2000/svg">
        <path d="M4,15 C4,9 8,6 18,6 L36,6 C46,6 50,10 50,15 C50,20 46,24 36,24 L18,24 C8,24 4,21 4,15 Z"/>
        <rect x="16" y="1" width="14" height="7" rx="2"/>
        <path d="M22,1 L22,-2 L16,-2"/>
        <circle cx="15" cy="-2" r="2"/>
        <circle cx="18" cy="15" r="2.5"/>
        <circle cx="28" cy="15" r="2.5"/>
        <circle cx="38" cy="15" r="2.5"/>
        <path d="M50,15 C54,11 56,9 55,13"/>
        <path d="M50,15 C54,19 56,21 55,17"/>
        <path d="M50,24 Q53,27 51,28"/>
      </svg>
    ),
    marker: (c) => (
      <svg width="22" height="22" viewBox="0 0 28 28" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" xmlns="http://www.w3.org/2000/svg">
        <line x1="10" y1="24" x2="10" y2="10"/>
        <path d="M10,10 C10,4 18,4 18,10"/>
        <line x1="18" y1="10" x2="18" y2="2"/>
        <rect x="14" y="-1" width="8" height="5" rx="1"/>
        <path d="M4,24 Q14,21 24,24"/>
        <path d="M2,20 Q14,17 26,20" strokeOpacity="0.5"/>
      </svg>
    ),
  },
  { rotationOffset: 90, // Blimp → mountain (points left — nose on left)
    icon: (c) => (
      <svg width="53" height="53" viewBox="0 0 60 26" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} xmlns="http://www.w3.org/2000/svg">
        {/* Envelope — rounded nose left, tapered tail right */}
        <path d="M52,13 C52,6 42,1 28,1 C14,1 4,6 4,13 C4,20 14,25 28,25 C42,25 52,20 52,13 Z"/>
        {/* Vertical tail fin top-right */}
        <path d="M52,13 C54,8 58,4 55,9"/>
        {/* Horizontal stabilizer bottom-right */}
        <path d="M52,13 C55,17 58,21 55,18"/>
        {/* Propeller at tail */}
        <path d="M55,13 C58,10 61,8 59,12 M55,13 C58,16 61,18 59,14"/>
        {/* Gondola hanging below center */}
        <rect x="20" y="25" width="16" height="5" rx="1"/>
        <line x1="24" y1="25" x2="22" y2="26"/>
        <line x1="32" y1="25" x2="34" y2="26"/>
        {/* Nose mooring ring */}
        <circle cx="4" cy="13" r="1.5"/>
      </svg>
    ),
    marker: (c) => (
      <svg width="22" height="22" viewBox="0 0 28 28" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" xmlns="http://www.w3.org/2000/svg">
        <path d="M2,24 L14,4 L26,24 Z"/>
        <path d="M8,24 L18,10 L26,24"/>
        <path d="M10,10 C12,4 16,4 18,10 L14,8 Z"/>
        <line x1="0" y1="24" x2="28" y2="24"/>
      </svg>
    ),
  },
];

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

  const vehicle = VEHICLES[Math.floor(sr(99) * VEHICLES.length)];
  const closure = 0.50 + sr(0) * 0.45;
  let startDist = sr(1) * totalLen;
  let endDist = startDist + closure * totalLen;
  for (let attempt = 0; attempt < 8; attempt++) {
    const s = ptAt(startDist); const e = ptAt(endDist);
    if (Math.hypot(e.x - s.x, e.y - s.y) >= 150) break;
    startDist = (startDist + totalLen / 8) % totalLen;
    endDist = startDist + closure * totalLen;
  }

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
  const rawAngle = end.angle + vehicle.rotationOffset;
  const normAngle = ((rawAngle % 360) + 360) % 360;
  const displayAngle = (normAngle > 90 && normAngle < 270) ? rawAngle + 180 : rawAngle;

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
      {/* Vehicle — HTML so it's never distorted */}
      <div style={{ position: "absolute", left: ePx, top: ePy, transform: `translate(-50%, -50%) rotate(${displayAngle}deg)`, marginTop: -2, zIndex: 11, pointerEvents: "none" }}>
        {vehicle.icon(color)}
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

  const numPlanes = 1;
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
    let endPt = clampEnd(
      W * (ICON_M + sr(pi * 60 + 20) * (1 - 2 * ICON_M)),
      bandTop + sr(pi * 60 + 21) * (bandBot - bandTop),
    );
    // Ensure vehicle (near startPt) and marker (endPt) are at least 90px apart
    const epDx = endPt.x - startPt.x; const epDy = endPt.y - startPt.y;
    const epDist = Math.hypot(epDx, epDy);
    if (epDist < 90) {
      const scale = 90 / (epDist || 1);
      endPt = clampEnd(startPt.x + epDx * scale, startPt.y + epDy * scale);
    }

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

  const vehicle = VEHICLES[Math.floor(sr(99) * VEHICLES.length)];

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 2 }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", inset: 0 }}>
        {bandDividers.map((dv, i) => (
          <line key={`div-${i}`} x1={-W * 0.5} y1={dv.cy} x2={W * 1.5} y2={dv.cy}
            stroke={color} strokeWidth="1.5" strokeDasharray="4 9" strokeLinecap="round" opacity="0.3"
            transform={`rotate(${dv.angleDeg.toFixed(1)} ${dv.cx} ${dv.cy})`} />
        ))}
        {planes.map((pl, i) => (
          <path key={i} d={pl.d} fill="none" stroke={color} strokeWidth="2.5" strokeDasharray="4 9" strokeLinecap="round" opacity="0.65" />
        ))}
      </svg>
      {planes.map((pl, i) => {
        const raw = pl.planeAngle + vehicle.rotationOffset;
        const norm = ((raw % 360) + 360) % 360;
        const angle = (norm > 90 && norm < 270) ? raw + 180 : raw;
        return (
          <div key={`vehicle-${i}`} style={{ position: "absolute", left: `${(pl.planeX / W * 100).toFixed(2)}%`, top: `${(pl.planeY / H * 100).toFixed(2)}%`, transform: `translate(-50%,-50%) rotate(${angle}deg)`, zIndex: 3, pointerEvents: "none" }}>
            {vehicle.icon(color)}
          </div>
        );
      })}
      {planes.map((pl, i) => (
        <div key={`marker-${i}`} style={{ position: "absolute", left: `${(pl.endX / W * 100).toFixed(2)}%`, top: `${(pl.endY / H * 100).toFixed(2)}%`, transform: "translate(-50%,-50%)", zIndex: 3, pointerEvents: "none" }}>
          {vehicle.marker(color)}
        </div>
      ))}
    </div>
  );
}

// ── Synthesis section ─────────────────────────────────────────────────────────

function WeeklySignalSection({ weekly }: { weekly: WeeklySignal }) {
  return (
    <div style={{ maxWidth: 1200, marginTop: 0, marginBottom: 10, marginLeft: "auto", marginRight: "auto", position: "relative" }}>
      <div style={{ background: P.cardBg, borderRadius: 24, boxShadow: P.shadow, overflow: "hidden", position: "relative" }}>
        {/* Header */}
        <div style={{ background: "transparent", paddingTop: 18, paddingBottom: 18, paddingLeft: 28, paddingRight: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 55, height: 55, borderRadius: "50%", background: P.cardBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><SpaceInvaderSVG color={P.accent} /></div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" as const, color: P.accent, marginBottom: 4, fontFamily: P.fontBody }}>Weekly Signal & Noise</div>
              <div style={{ fontSize: 13, color: P.inkLight, fontFamily: P.fontBody }}>{weekly.weekOf}</div>
            </div>
          </div>
          <ShareButton title={`Weekly Signal & Noise — ${weekly.weekOf}`} url={typeof window !== "undefined" ? window.location.href : ""} color={P.accent} fontBody={P.fontBody} />
        </div>
        <div style={{ paddingLeft: 28, paddingRight: 28, marginBottom: 0 }}>
          <svg width="100%" height="12" style={{ display: "block", overflow: "visible" }} xmlns="http://www.w3.org/2000/svg">
            <defs><filter id="sketchy-line-w" x="-5%" y="-100%" width="110%" height="300%"><feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed="9" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" /></filter></defs>
            <line x1="0" y1="6" x2="100%" y2="6" stroke={P.accent} strokeWidth="2.5" filter="url(#sketchy-line-w)" />
          </svg>
        </div>
        {/* Hook + Signal — mirrors synthesis observation section */}
        <div className="ds-synthesis-obs" style={{ position: "relative", paddingTop: 20, paddingBottom: 14, paddingLeft: 28, paddingRight: weekly.imageUrl ? 320 : 28, borderBottom: `1px solid ${P.tint}44` }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, marginBottom: 8, fontFamily: P.fontBody }}>The Signal</div>
          <p style={{ fontSize: 19, lineHeight: 1.6, fontWeight: 600, color: P.ink, marginTop: 0, marginBottom: weekly.signal ? 14 : 0, fontFamily: P.fontBody }}>{weekly.hook}</p>
          {weekly.signal && <p style={{ fontSize: 17, lineHeight: 1.75, color: P.inkMid, marginTop: 0, marginBottom: 0, fontFamily: P.fontBody }}>{weekly.signal}</p>}
          {weekly.imageUrl && (
            <div className="ds-synthesis-img" style={{ position: "absolute", top: 20, right: 80 }}>
              <div style={{ position: "relative", width: 200, height: 200 }}>
                <div style={{ width: 200, height: 200, borderRadius: "50%", overflow: "hidden" }}>
                  <img src={weekly.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }} />
                </div>
                <svg style={{ position: "absolute", top: -5, left: -5, width: 210, height: 210, overflow: "visible", pointerEvents: "none" }} viewBox="0 0 210 210">
                  <defs><filter id="sketchy-circle-w" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed="8" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" /></filter></defs>
                  <circle cx="105" cy="105" r="101" fill="none" stroke={P.accent} strokeWidth="3.5" filter="url(#sketchy-circle-w)" />
                </svg>
              </div>
            </div>
          )}
        </div>
        {/* Noise + Looking Forward — mirrors synthesis key insights / bottom line layout */}
        <div className="ds-synthesis-body ds-weekly-cols" style={{ paddingTop: 18, paddingBottom: 24, paddingLeft: 28, paddingRight: 28, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 36, borderBottom: `1px solid ${P.tint}44` }}>
          {weekly.noise && (
            <div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, marginBottom: 14, fontFamily: P.fontBody }}>The Noise</div>
              <p style={{ fontSize: 17, lineHeight: 1.65, color: P.inkMid, margin: 0, fontFamily: P.fontBody }}>{weekly.noise}</p>
            </div>
          )}
          {weekly.lookingForward && (
            <div style={{ borderLeft: `1px solid ${P.tint}55`, paddingLeft: 28 }}>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, marginBottom: 14, fontFamily: P.fontBody }}>Looking Forward</div>
              <p style={{ fontSize: 17, lineHeight: 1.65, color: P.inkMid, margin: 0, fontFamily: P.fontBody }}>{weekly.lookingForward}</p>
            </div>
          )}
        </div>
        {/* One Move — mirrors synthesis bottom line */}
        <div style={{ paddingTop: 20, paddingBottom: 24, paddingLeft: 28, paddingRight: 28 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, marginBottom: 14, fontFamily: P.fontBody }}>One Move This Week</div>
          <div style={{ fontSize: 19, lineHeight: 1.6, fontWeight: 600, color: P.ink, fontFamily: P.fontBody }}>{weekly.oneMove}</div>
          {weekly.writerName && <div style={{ marginTop: 14, fontSize: 12, color: P.inkLight, fontFamily: P.fontBody }}>— {weekly.writerName}</div>}
        </div>
      </div>
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", zIndex: 10, isolation: "isolate" } as React.CSSProperties} xmlns="http://www.w3.org/2000/svg">
        <defs><filter id="sketchy-border-w" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed="11" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" /></filter></defs>
        <rect x="3" y="3" width="99%" height="99%" rx="22" ry="22" fill="none" stroke={P.accent} strokeWidth="4" filter="url(#sketchy-border-w)" />
      </svg>
    </div>
  );
}

function ObservationCard({ synthesis, writerIndex, editionKey }: { synthesis: Synthesis; writerIndex: number; editionKey: string }) {
  return (
    <div id="signal" style={{ maxWidth: 1200, marginTop: 0, marginBottom: 10, marginLeft: "auto", marginRight: "auto", position: "relative" }}>
      <div style={{ background: P.cardBg, borderRadius: 24, boxShadow: P.shadow, overflow: "hidden", position: "relative" }}>
        <div style={{ position: "absolute", top: 12, right: 16, fontSize: 10, fontWeight: 700, fontFamily: "monospace", color: P.accent, opacity: 0.45, letterSpacing: 1, userSelect: "none" as const }}>W{writerIndex}</div>
        <div className="ds-obs-header" style={{ background: "transparent", paddingTop: 18, paddingBottom: 18, paddingLeft: 28, paddingRight: 28, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ width: 55, height: 55, borderRadius: "50%", background: P.cardBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><SpaceInvaderSVG color={P.accent} /></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase" as const, color: P.accent, marginBottom: 4, fontFamily: P.fontBody }}>The Signal</div>
            <div style={{ fontSize: 22, fontWeight: 400, color: P.ink, lineHeight: 1.1, fontFamily: P.fontHeading, textTransform: P.dark ? "uppercase" as const : "none" as const, letterSpacing: P.dark ? 2 : 0 }}>{synthesis.theme}</div>
          </div>
          <div className="ds-obs-share"><ShareButton title={synthesis.theme} url={`/archive/${editionKey}#signal`} color={P.accent} fontBody={P.fontBody} /></div>
        </div>
        <div style={{ paddingLeft: 28, paddingRight: 28, marginBottom: 0 }}>
          <svg width="100%" height="12" style={{ display: "block", overflow: "visible" }} xmlns="http://www.w3.org/2000/svg">
            <defs><filter id="sketchy-line-obs" x="-5%" y="-100%" width="110%" height="300%"><feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed="3" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" /></filter></defs>
            <line x1="0" y1="6" x2="100%" y2="6" stroke={P.accent} strokeWidth="2.5" filter="url(#sketchy-line-obs)" />
          </svg>
        </div>
        {(synthesis.hook || synthesis.observation) && (
          <div className="ds-synthesis-obs" style={{ position: "relative", paddingTop: 20, paddingBottom: 28, paddingLeft: 28, paddingRight: synthesis.imageUrl ? 320 : 28 }}>
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
                    <defs><filter id="sketchy-circle-obs" x="-15%" y="-15%" width="130%" height="130%"><feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed="5" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" /></filter></defs>
                    <circle cx="105" cy="105" r="101" fill="none" stroke={P.accent} strokeWidth="3.5" filter="url(#sketchy-circle-obs)" />
                  </svg>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", zIndex: 10, isolation: "isolate" } as React.CSSProperties} xmlns="http://www.w3.org/2000/svg">
        <defs><filter id="sketchy-border-obs" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed="7" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" /></filter></defs>
        <rect x="3" y="3" width="99%" height="99%" rx="22" ry="22" fill="none" stroke={P.accent} strokeWidth="4" filter="url(#sketchy-border-obs)" />
      </svg>
    </div>
  );
}

function KeyInsightsCard({ synthesis }: { synthesis: Synthesis }) {
  if (!synthesis.takeaways?.length) return null;
  return (
    <div style={{ maxWidth: 1200, marginTop: 0, marginBottom: 10, marginLeft: "auto", marginRight: "auto", position: "relative" }}>
      <div style={{ background: P.cardBg, borderRadius: 24, boxShadow: P.shadow, paddingTop: 28, paddingBottom: 32, paddingLeft: 36, paddingRight: 36 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, marginBottom: 22, fontFamily: P.fontBody }}>Key Insights</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {synthesis.takeaways.map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
              <div style={{ flexShrink: 0, fontSize: 24, fontWeight: 900, color: P.accent, fontFamily: P.fontHeading, lineHeight: 1, minWidth: 26, paddingTop: 2 }}>{i + 1}</div>
              <div style={{ fontSize: 17, lineHeight: 1.65, color: P.inkMid, paddingTop: 3, fontFamily: P.fontBody }}>{t}</div>
            </div>
          ))}
        </div>
      </div>
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", zIndex: 10, isolation: "isolate" } as React.CSSProperties} xmlns="http://www.w3.org/2000/svg">
        <defs><filter id="sketchy-border-ki" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed="13" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" /></filter></defs>
        <rect x="3" y="3" width="99%" height="99%" rx="22" ry="22" fill="none" stroke={P.accent} strokeWidth="4" filter="url(#sketchy-border-ki)" />
      </svg>
    </div>
  );
}

function BottomLineCard({ synthesis, editionKey }: { synthesis: Synthesis; editionKey: string }) {
  if (!synthesis.conclusion) return null;
  const eSeed = editionKey.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
  const takeawayLabel = TAKEAWAY_LABELS[Math.floor(seededRandom(eSeed + 88) * TAKEAWAY_LABELS.length)];
  const qFont = QUOTE_FONTS[Math.floor(seededRandom(eSeed + 66) * QUOTE_FONTS.length)];
  return (
    <div style={{ maxWidth: 1200, marginTop: 0, marginBottom: 10, marginLeft: "auto", marginRight: "auto", position: "relative" }}>
      <div style={{ background: P.cardBg, borderRadius: 24, boxShadow: P.shadow, paddingTop: 32, paddingBottom: 36, paddingLeft: 44, paddingRight: 44 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, marginBottom: 16, fontFamily: P.fontBody }}>{takeawayLabel}</div>
        <div style={{ fontSize: 10, color: P.accent, opacity: 0.5, fontFamily: P.fontHeading, marginBottom: 4 }}>"</div>
        <div style={{ fontSize: 34, fontWeight: qFont.weight, lineHeight: 1.25, color: P.ink, fontStyle: qFont.style as "italic" | "normal", fontFamily: qFont.family, letterSpacing: -0.3, textAlign: "left" as const }}>{synthesis.conclusion}</div>
        <div style={{ fontSize: 10, color: P.accent, opacity: 0.5, fontFamily: P.fontHeading, marginTop: 4, textAlign: "left" as const }}>"</div>
      </div>
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", zIndex: 10, isolation: "isolate" } as React.CSSProperties} xmlns="http://www.w3.org/2000/svg">
        <defs><filter id="sketchy-border-bl" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed="14" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" /></filter></defs>
        <rect x="3" y="3" width="99%" height="99%" rx="22" ry="22" fill="none" stroke={P.accent} strokeWidth="4" filter="url(#sketchy-border-bl)" />
      </svg>
    </div>
  );
}

const ACTION_CARD_EMOJIS = ["🎯", "⚡", "🔥"];
const ACTION_CARD_SEEDS = [15, 16, 17];
const MOVE_LABELS = ["Your Next Move", "One Move", "Take Action", "Begin Here", "First Step", "Act On It"];
const TAKEAWAY_LABELS = ["Today's Takeaway", "The Bottom Line", "Core Insight", "What It Means", "Key Takeaway", "The Upshot"];

function StandaloneActionCard({ action, actionIndex, stories, synthesis, editionKey }: { action: string; actionIndex: number; stories: Story[]; synthesis: Synthesis; editionKey: string }) {
  const slug = actionSlug(action);
  const encoded = Buffer.from(action).toString("base64");
  const relStory = stories[actionIndex] ?? stories[0];
  const relSlug = relStory ? urlToSlug(relStory.link) : "";
  const relTitle = relStory ? encodeURIComponent(relStory.ownedTitle || relStory.title) : "";
  const synthCtx = [
    synthesis.theme ? `st=${encodeURIComponent(synthesis.theme)}` : "",
    synthesis.hook ? `sh=${encodeURIComponent(synthesis.hook)}` : "",
  ].filter(Boolean).join("&");
  const href = `/how/${slug}?a=${encoded}&as=${relSlug}&at=${relTitle}${synthCtx ? "&" + synthCtx : ""}`;
  const seed = ACTION_CARD_SEEDS[actionIndex % ACTION_CARD_SEEDS.length];
  const emoji = ACTION_CARD_EMOJIS[actionIndex % ACTION_CARD_EMOJIS.length];
  const animName = `sac-pop-${actionIndex}`;
  return (
    <div style={{ maxWidth: 1200, marginTop: 0, marginBottom: 10, marginLeft: "auto", marginRight: "auto", position: "relative" }}>
      <style>{`@keyframes ${animName}{0%,100%{transform:scale(1) rotate(-3deg)}50%{transform:scale(1.3) rotate(5deg)}}`}</style>
      <div style={{ background: P.cardBg, borderRadius: 24, boxShadow: P.shadow, paddingTop: 24, paddingBottom: 28, paddingLeft: 28, paddingRight: 28 }}>
        {/* Header: emoji + label on the same line */}
        {(() => {
          const eSeed = editionKey.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
          const moveLabel = MOVE_LABELS[Math.floor(seededRandom(eSeed + 77 + actionIndex * 11) * MOVE_LABELS.length)];
          const aFont = QUOTE_FONTS[Math.floor(seededRandom(eSeed + 44) * QUOTE_FONTS.length)];
          return (
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
              <span style={{ fontSize: 36, display: "inline-block", animation: `${animName} 1.2s ease-in-out infinite` }}>{emoji}</span>
              <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, fontFamily: P.fontBody }}>{moveLabel}</div>
            </div>
          );
        })()}
        {/* Dashed box: text + HOW? */}
        {(() => {
          const eSeed = editionKey.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
          const aFont = QUOTE_FONTS[Math.floor(seededRandom(eSeed + 44) * QUOTE_FONTS.length)];
          return (
            <a href={href} style={{ textDecoration: "none", display: "flex", flexDirection: "column", gap: 16, background: "transparent", border: `2px dashed ${P.accent}`, borderRadius: 14, paddingTop: 18, paddingBottom: 18, paddingLeft: 18, paddingRight: 18, minHeight: 120 }}>
              <div style={{ fontSize: 24, lineHeight: 1.4, color: P.ink, fontFamily: aFont.family, fontStyle: aFont.style as "italic" | "normal", fontWeight: aFont.weight }}>{action}</div>
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "auto" }}>
                <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: 1.5, color: P.accent, fontFamily: P.fontBody, textTransform: "uppercase" as const, background: "transparent", border: `1px solid ${P.accent}`, borderRadius: 50, paddingTop: 6, paddingBottom: 6, paddingLeft: 16, paddingRight: 16, display: "inline-block", whiteSpace: "nowrap" as const }}>How?</span>
              </div>
            </a>
          );
        })()}
      </div>
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", zIndex: 10, isolation: "isolate" } as React.CSSProperties} xmlns="http://www.w3.org/2000/svg">
        <defs><filter id={`sketchy-border-a${actionIndex}`} x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed={seed} result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" /></filter></defs>
        <rect x="3" y="3" width="99%" height="99%" rx="22" ry="22" fill="none" stroke={P.accent} strokeWidth="4" filter={`url(#sketchy-border-a${actionIndex})`} />
      </svg>
    </div>
  );
}

// ── Synth cards in grid-cell format (compact, fills grid column) ──────────────

function ActionGridCell({ action, actionIndex, stories, synthesis, editionKey }: { action: string; actionIndex: number; stories: Story[]; synthesis: Synthesis; editionKey: string }) {
  const slug = actionSlug(action);
  const encoded = Buffer.from(action).toString("base64");
  const relStory = stories[actionIndex] ?? stories[0];
  const relSlug = relStory ? urlToSlug(relStory.link) : "";
  const relTitle = relStory ? encodeURIComponent(relStory.ownedTitle || relStory.title) : "";
  const synthCtx = [
    synthesis.theme ? `st=${encodeURIComponent(synthesis.theme)}` : "",
    synthesis.hook ? `sh=${encodeURIComponent(synthesis.hook)}` : "",
  ].filter(Boolean).join("&");
  const href = `/how/${slug}?a=${encoded}&as=${relSlug}&at=${relTitle}${synthCtx ? "&" + synthCtx : ""}`;
  const seed = ACTION_CARD_SEEDS[actionIndex % ACTION_CARD_SEEDS.length];
  const emoji = ACTION_CARD_EMOJIS[actionIndex % ACTION_CARD_EMOJIS.length];
  const animName = `sac-g-pop-${actionIndex}`;
  const eSeed = editionKey.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
  const moveLabel = MOVE_LABELS[Math.floor(seededRandom(eSeed + 77 + actionIndex * 11) * MOVE_LABELS.length)];
  const aFont = QUOTE_FONTS[Math.floor(seededRandom(eSeed + 44) * QUOTE_FONTS.length)];
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", flex: 1 }}>
      <style>{`@keyframes ${animName}{0%,100%{transform:scale(1) rotate(-3deg)}50%{transform:scale(1.3) rotate(5deg)}}`}</style>
      <div style={{ background: P.cardBg, borderRadius: 20, boxShadow: P.shadow, paddingTop: 18, paddingBottom: 20, paddingLeft: 20, paddingRight: 20, display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 28, display: "inline-block", animation: `${animName} 1.2s ease-in-out infinite` }}>{emoji}</span>
          <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, fontFamily: P.fontBody }}>{moveLabel}</div>
        </div>
        <a href={href} style={{ textDecoration: "none", display: "flex", flexDirection: "column", gap: 14, background: "transparent", border: `2px dashed ${P.accent}`, borderRadius: 12, paddingTop: 14, paddingBottom: 14, paddingLeft: 14, paddingRight: 14, flex: 1 }}>
          <div style={{ fontSize: 21, lineHeight: 1.4, color: P.ink, fontFamily: aFont.family, fontStyle: aFont.style as "italic" | "normal", fontWeight: aFont.weight }}>{action}</div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "auto" }}>
            <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.5, color: P.accent, fontFamily: P.fontBody, textTransform: "uppercase" as const, border: `1px solid ${P.accent}`, borderRadius: 50, paddingTop: 5, paddingBottom: 5, paddingLeft: 14, paddingRight: 14, display: "inline-block", whiteSpace: "nowrap" as const }}>How?</span>
          </div>
        </a>
      </div>
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", zIndex: 10, isolation: "isolate" } as React.CSSProperties} xmlns="http://www.w3.org/2000/svg">
        <defs><filter id={`skg-a${actionIndex}`} x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed={seed} result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" /></filter></defs>
        <rect x="2" y="2" width="99%" height="99%" rx="18" ry="18" fill="none" stroke={P.accent} strokeWidth="3.5" filter={`url(#skg-a${actionIndex})`} />
      </svg>
    </div>
  );
}

function BottomLineGridCell({ synthesis, editionKey }: { synthesis: Synthesis; editionKey: string }) {
  if (!synthesis.conclusion) return null;
  const eSeed = editionKey.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
  const takeawayLabel = TAKEAWAY_LABELS[Math.floor(seededRandom(eSeed + 88) * TAKEAWAY_LABELS.length)];
  const qFont = QUOTE_FONTS[Math.floor(seededRandom(eSeed + 66) * QUOTE_FONTS.length)];
  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", flex: 1 }}>
      <div style={{ background: P.cardBg, borderRadius: 20, boxShadow: P.shadow, paddingTop: 22, paddingBottom: 26, paddingLeft: 26, paddingRight: 26, display: "flex", flexDirection: "column", flex: 1, justifyContent: "flex-start" }}>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, marginBottom: 12, fontFamily: P.fontBody }}>{takeawayLabel}</div>
        <div style={{ fontSize: 10, color: P.accent, opacity: 0.5, fontFamily: P.fontHeading, marginBottom: 2 }}>"</div>
        <div style={{ fontSize: 26, fontWeight: qFont.weight, lineHeight: 1.3, color: P.ink, fontStyle: qFont.style as "italic" | "normal", fontFamily: qFont.family, letterSpacing: -0.2, textAlign: "left" as const }}>{synthesis.conclusion}</div>
        <div style={{ fontSize: 10, color: P.accent, opacity: 0.5, fontFamily: P.fontHeading, marginTop: 2, textAlign: "left" as const }}>"</div>
      </div>
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", zIndex: 10, isolation: "isolate" } as React.CSSProperties} xmlns="http://www.w3.org/2000/svg">
        <defs><filter id="skg-bl" x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed="14" result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" /></filter></defs>
        <rect x="2" y="2" width="99%" height="99%" rx="18" ry="18" fill="none" stroke={P.accent} strokeWidth="3.5" filter="url(#skg-bl)" />
      </svg>
    </div>
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
  weeklySignal,
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
  weeklySignal?: WeeklySignal;
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
  const editionSeed = editionKey.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);

  const card: React.CSSProperties = { background: P.cardBg, borderRadius: 20, overflow: "hidden", boxShadow: P.shadow, position: "relative" };
  const imgCard: React.CSSProperties = { ...card, position: "relative", background: P.tint + "44" };
  const hStyle: React.CSSProperties = { fontFamily: P.fontHeading, fontSize: 22, fontWeight: 800, lineHeight: 1.15, color: P.ink, letterSpacing: P.dark ? 1 : -0.5, textTransform: P.dark ? "uppercase" as const : "none" as const, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 };
  const bodyStyle: React.CSSProperties = { fontSize: 15, lineHeight: 1.7, color: P.inkMid, fontFamily: P.fontBody };

  // ── Synthesis card pool: shuffle all 6 cards, optionally lift one before S1 ──
  type CardId = "obs" | "ki" | "bl" | "a0" | "a1" | "a2";
  const hasAnySynth = !!(synthesis?.theme || weeklySignal?.hook);
  const fullPool = hasAnySynth
    ? seededShuffle<CardId>(["obs", "ki", "bl", "a0", "a1", "a2"], editionSeed)
    : [] as CardId[];
  const hasPreS1 = hasAnySynth && seededRandom(editionSeed + 999) < 0.4;
  const preS1Card = hasPreS1 ? fullPool[0] : null;
  const remainingPool = hasPreS1 ? fullPool.slice(1) : fullPool;
  // Assign remaining cards to fixed slots; last slot absorbs overflow
  const synthSlots = {
    afterS1:   remainingPool[0] ?? null,
    afterFC:   remainingPool[1] ?? null,
    afterRow1: remainingPool[2] ?? null,
    afterRow2: remainingPool[3] ?? null,
    tail:      remainingPool.slice(4),   // 1 card (hasPreS1) or 2 cards (!hasPreS1)
  };

  const isCompactId = (id: CardId) => id === "bl" || id.startsWith("a");
  // At most one bento row gets a compact card per edition; seed decides which one wins
  const bothBentoCompact = !!(preS1Card && isCompactId(preS1Card) && synthSlots.afterS1 && isCompactId(synthSlots.afterS1));
  const s1BentoWins = !bothBentoCompact || seededRandom(editionSeed + 300) < 0.5;
  const hasS1Compact = !!(preS1Card && isCompactId(preS1Card) && s1BentoWins);
  const hasFCCompact = !!(synthSlots.afterS1 && isCompactId(synthSlots.afterS1) && (!bothBentoCompact || !s1BentoWins));
  // Seeded position: compact card goes first (col 1) or last (col 3) in its bento row
  const s1CompactFirst = seededRandom(editionSeed + 301) < 0.5;
  const fcCompactFirst = seededRandom(editionSeed + 302) < 0.5;

  function renderSynthCard(id: CardId) {
    if (id === "obs") {
      return weeklySignal?.hook
        ? <WeeklySignalSection key="obs" weekly={weeklySignal} />
        : synthesis?.theme ? <ObservationCard key="obs" synthesis={synthesis} writerIndex={synthWriterIndex} editionKey={editionKey} /> : null;
    }
    if (!synthesis?.theme) return null;
    if (id === "ki") return synthesis.takeaways?.length ? <KeyInsightsCard key="ki" synthesis={synthesis} /> : null;
    if (id === "bl") return synthesis.conclusion ? <BottomLineCard key="bl" synthesis={synthesis} editionKey={editionKey} /> : null;
    const ai = parseInt(id[1]);
    const action = synthesis.actions?.[ai];
    return action ? <StandaloneActionCard key={id} action={action} actionIndex={ai} stories={allStories} synthesis={synthesis} editionKey={editionKey} /> : null;
  }

  function renderSynthGridItem(id: CardId): React.ReactNode {
    if (!synthesis?.theme) return null;
    if (id === "bl") return synthesis.conclusion ? <BottomLineGridCell key="blg" synthesis={synthesis} editionKey={editionKey} /> : null;
    const ai = parseInt(id[1]);
    const action = synthesis.actions?.[ai];
    return action ? <ActionGridCell key={`ag${ai}`} action={action} actionIndex={ai} stories={allStories} synthesis={synthesis} editionKey={editionKey} /> : null;
  }

  return (
    <div className="ds-page" style={{ minHeight: "100vh", background: P.pageBg, fontFamily: P.fontBody, paddingTop: 24, paddingBottom: 60, paddingLeft: 20, paddingRight: 20, color: P.ink }}>
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={CURSIVE_FONT_URL} />
      <style>{`
        @media (max-width: 700px) {
          .ds-bento-fc { grid-template-columns: 1fr !important; grid-template-rows: auto !important; }
          .ds-bento-fc > * { grid-column: 1 / -1 !important; grid-row: auto !important; }
          .ds-weekly-cols { grid-template-columns: 1fr !important; }
          .ds-weekly-cols > * { border-right: none !important; border-bottom: 1px solid rgba(128,128,128,0.2); }
          .ds-story-row { grid-template-columns: 1fr !important; }
          .ds-obs-share { flex-basis: 100%; display: flex; justify-content: flex-end; margin-top: 6px; }
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

      {/* Pre-S1: full cards (obs/ki) only — compact cards go into S1 bento or flat grid */}
      {preS1Card && !isCompactId(preS1Card) && renderSynthCard(preS1Card)}

      {/* Bento row 1: S1 hero */}
      <div className="ds-bento" style={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gridTemplateRows: "minmax(320px, auto)", gap: 10, maxWidth: 1200, marginTop: 0, marginBottom: 10, marginLeft: "auto", marginRight: "auto" }}>

        {s1 && (
          <a href={`/article/${urlToSlug(s1.link)}?e=${editionKey}`} style={{ gridColumn: hasS1Compact ? (s1CompactFirst ? "5 / 9" : "1 / 5") : "1 / 6", gridRow: "1", textDecoration: "none", color: "inherit" }}>
            <div style={{ ...card, height: "100%", paddingTop: 28, paddingBottom: 32, paddingLeft: 28, paddingRight: 28, display: "flex", flexDirection: "column", gap: 16 }}>
              <Pill section={s1.section} />
              <h1 className="ds-card-h" style={hStyle}>{s1.ownedTitle || s1.title}</h1>
              {s1.summary && <p className="ds-card-body" style={{ ...bodyStyle, marginTop: 0, marginBottom: 0 }}>{(s1.summary.match(/^[^.!?]+[.!?]/) ?? [s1.summary])[0].trim()}</p>}
              <MorePill story={s1} editionKey={editionKey} />
            </div>
          </a>
        )}

        {s1 && (
          <a href={`/article/${urlToSlug(s1.link)}?e=${editionKey}`} style={{ ...imgCard, gridColumn: hasS1Compact ? (s1CompactFirst ? "9 / 13" : "5 / 9") : "6 / 13", gridRow: "1", textDecoration: "none" }}>
            {s1.imageUrl ? <img src={s1.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} /> : <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg, ${P.gradFrom}, ${P.gradTo})` }} />}
            <S1FlightPaths seed={editionKey.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 7), 0)} color={P.accent} imageColor={s1.imageColor} />
          </a>
        )}

        {hasS1Compact && preS1Card && (
          <div style={{ gridColumn: s1CompactFirst ? "1 / 5" : "9 / 13", gridRow: "1", display: "flex" }}>
            {renderSynthGridItem(preS1Card)}
          </div>
        )}
      </div>

      {/* Post-S1: full cards (obs/ki) only — compact cards go into FC bento or flat grid */}
      {synthSlots.afterS1 && !isCompactId(synthSlots.afterS1) && renderSynthCard(synthSlots.afterS1)}

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
            <div style={{ gridColumn: hasFCCompact ? (fcCompactFirst ? "5 / 9" : "1 / 5") : "1 / 7", gridRow: "1 / 3", position: "relative" }}>
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
          <div style={{ gridColumn: hasFCCompact ? (fcCompactFirst ? "5 / 9" : "1 / 5") : "1 / 7", gridRow: "1 / 3", position: "relative" }}>
            <FlightPathBorder color={P.inkLight} seed={0} />
            <div style={{ background: P.cardBg, borderRadius: 20, overflow: "hidden", boxShadow: P.shadow, height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: "40px 32px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase" as const, color: P.inkLight, fontFamily: P.fontBody, opacity: 0.5 }}>Feature Creature</div>
              <div style={{ fontFamily: `'${CURSIVE_FONT_FAMILY}', cursive`, fontSize: 28, color: P.inkLight, lineHeight: 1.2, textAlign: "center" as const, opacity: 0.4 }}>Population: 0</div>
              <div style={{ fontSize: 13, color: P.inkLight, fontFamily: P.fontBody, opacity: 0.35, letterSpacing: 1 }}>Coming soon</div>
            </div>
          </div>
        )}

        {s2 && (
          <a href={`/article/${urlToSlug(s2.link)}?e=${editionKey}`} style={{ gridColumn: hasFCCompact ? (fcCompactFirst ? "9 / 13" : "5 / 9") : "7 / 13", gridRow: "1", textDecoration: "none", color: "inherit", display: "flex" }}>
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
          <a href={`/article/${urlToSlug(s2.link)}?e=${editionKey}`} style={{ ...card, gridColumn: hasFCCompact ? (fcCompactFirst ? "9 / 13" : "5 / 9") : "7 / 13", gridRow: "2", display: "flex", alignItems: "center", paddingTop: 0, paddingBottom: 0, paddingLeft: 28, paddingRight: 28, gap: 18, textDecoration: "none", color: "inherit" }}>
            <div style={{ fontSize: 52, color: P.accent, fontFamily: P.fontHeading, flexShrink: 0, lineHeight: 0.8, opacity: 0.35, marginTop: 6 }}>"</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontStyle: "italic", color: P.ink, lineHeight: 1.5, fontFamily: P.fontBody, fontWeight: 500 }}>{s2.pullquote || s2.summary || s2.title}</div>
            </div>
          </a>
        )}

        {hasFCCompact && synthSlots.afterS1 && (
          <div style={{ gridColumn: fcCompactFirst ? "1 / 5" : "9 / 13", gridRow: "1 / 3", display: "flex" }}>
            {renderSynthGridItem(synthSlots.afterS1)}
          </div>
        )}
      </div>

      {/* After FC: only full cards (obs/ki) stay standalone here; compact cards go into the story grid */}
      {synthSlots.afterFC && !isCompactId(synthSlots.afterFC) && renderSynthCard(synthSlots.afterFC)}

      {/* Story rows interleaved with remaining cards — all cards appear before S9-S11 */}
      {(() => {
        const stories9 = [s3, s4, s5, s6, s7, s8, s9, s10, s11].filter(s => s?.summary) as Story[];
        // Compact cards that didn't win a bento slot join the flat grid
        const rowSlots = [
          ...(preS1Card && isCompactId(preS1Card) && !hasS1Compact ? [preS1Card] : []),
          ...(synthSlots.afterS1 && isCompactId(synthSlots.afterS1) && !hasFCCompact ? [synthSlots.afterS1] : []),
          ...(synthSlots.afterFC && isCompactId(synthSlots.afterFC) ? [synthSlots.afterFC] : []),
          synthSlots.afterRow1, synthSlots.afterRow2, ...synthSlots.tail,
        ].filter(Boolean) as CardId[];
        const compactSlots = rowSlots.filter(isCompactId);
        const standaloneSlots = rowSlots.filter(id => !isCompactId(id));

        // Weave compact synth cards into the 3-col story grid.
        // Per synth card, pick a random column (0/1/2) using edition seed so position varies per edition.
        type FlatItem = { kind: "synth"; id: CardId } | { kind: "story"; s: Story; si: number };
        const flat: FlatItem[] = [];
        let si = 0, ci = 0;
        while (si < stories9.length || ci < compactSlots.length) {
          if (ci < compactSlots.length) {
            // How many stories can fill this row alongside the synth?
            const storiesLeft = stories9.length - si;
            const storySlots = Math.min(storiesLeft, 2); // 0, 1, or 2
            const totalSlots = storySlots + 1;
            // Pick synth position 0..totalSlots-1, seeded per synth index
            const synthPos = Math.floor(seededRandom(editionSeed + 200 + ci) * totalSlots);
            for (let pos = 0; pos < totalSlots; pos++) {
              if (pos === synthPos) flat.push({ kind: "synth", id: compactSlots[ci++] });
              else flat.push({ kind: "story", s: stories9[si], si: si++ });
            }
          } else {
            // No more synth cards — pure story rows
            for (let k = 0; k < 3 && si < stories9.length; k++) flat.push({ kind: "story", s: stories9[si], si: si++ });
          }
        }

        const hStyle: React.CSSProperties = { fontFamily: P.fontHeading, fontSize: 22, fontWeight: 800, lineHeight: 1.15, color: P.ink, letterSpacing: P.dark ? 1 : -0.5, textTransform: P.dark ? "uppercase" as const : "none" as const, marginTop: 0, marginBottom: 0 };
        const bodyStyle: React.CSSProperties = { fontSize: 15, lineHeight: 1.7, color: P.inkMid, fontFamily: P.fontBody };

        return (
          <>
            {standaloneSlots.map((id, i) => <div key={`ss-${i}`}>{renderSynthCard(id)}</div>)}
            <div className="ds-story-row" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, maxWidth: 1200, marginTop: 0, marginBottom: 10, marginLeft: "auto", marginRight: "auto", alignItems: "stretch" }}>
              {flat.map((item, idx) => {
                if (item.kind === "synth") {
                  return <div key={`sg-${idx}`} style={{ display: "flex" }}>{renderSynthGridItem(item.id)}</div>;
                }
                const { s, si: seedIdx } = item;
                const summaryText = (s.summary!.match(/^[^.!?]+[.!?]/) ?? [s.summary!])[0].trim();
                return (
                  <a key={`sc-${seedIdx}`} href={`/article/${urlToSlug(s.link)}?e=${editionKey}`} style={{ textDecoration: "none", color: "inherit", display: "flex" }}>
                    <div style={{ display: "flex", flexDirection: "column", borderRadius: 20, overflow: "hidden", background: P.cardBg, boxShadow: P.shadow, flex: 1 }}>
                      {s.imageUrl && (
                        <div style={{ position: "relative", height: 200, background: P.tint + "44", flexShrink: 0 }}>
                          <img src={s.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", display: "block" }} />
                          <PixelEdge color={P.cardBg} seed={seedIdx + 2} height={52} />
                          <div style={{ position: "absolute", top: 12, left: 14 }}><Pill section={s.section} /></div>
                        </div>
                      )}
                      <div style={{ paddingTop: 14, paddingLeft: 22, paddingRight: 22, paddingBottom: 18, display: "flex", flexDirection: "column", gap: 10, flex: 1, position: "relative" }}>
                        {s.imageUrl && <PixelEdgeTop color={P.pageBg} seed={seedIdx + 2} height={28} />}
                        {!s.imageUrl && <Pill section={s.section} />}
                        <div className="ds-card-h" style={hStyle}>{s.ownedTitle || s.title}</div>
                        {summaryText && <div className="ds-card-body" style={bodyStyle}>{summaryText}</div>}
                        <div style={{ marginTop: "auto", paddingTop: 12, display: "flex", justifyContent: "flex-end" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: P.accent, background: P.accent + "18", border: `1px solid ${P.accent}55`, borderRadius: 50, paddingTop: 6, paddingBottom: 6, paddingLeft: 16, paddingRight: 16, fontFamily: P.fontBody, letterSpacing: 0.3, whiteSpace: "nowrap" as const }}>More</span>
                        </div>
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          </>
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

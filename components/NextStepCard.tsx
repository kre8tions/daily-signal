import { P, QUOTE_FONTS } from "@/lib/palette";
import { seededRandom, editionSeed, ACTION_CARD_EMOJIS, ACTION_CARD_SEEDS, MOVE_LABELS } from "@/lib/cards";

/**
 * The action card used across editions, reusable outside EditionView.
 *
 * Visual contract (must stay in step with ActionGridCell / WkActionGridCell):
 * accent wash background, hand-drawn SVG border, animated emoji + move label,
 * dashed inner panel holding the action text, "How?" pill bottom-right.
 *
 * `href` should point at /how/{actionSlug(action)} with the action base64'd in `a`.
 * The how-to itself is generated at warm time — this card only links to it, and the
 * /how page 404s on a cache miss rather than generating on demand.
 */
export function NextStepCard({
  action, href, label, seedIndex = 0, editionKey, idPrefix = "ns",
}: {
  action: string;
  /** Omit when no how-to blob exists — the card then renders without the pill rather
   *  than linking to a page that would 404. Editions warmed before the how-to was
   *  generated alongside the insight fall into this case. */
  href?: string | null;
  label?: string;
  seedIndex?: number;
  editionKey: string;
  idPrefix?: string;
}) {
  const seed = ACTION_CARD_SEEDS[seedIndex % ACTION_CARD_SEEDS.length];
  const emoji = ACTION_CARD_EMOJIS[seedIndex % ACTION_CARD_EMOJIS.length];
  const eSeed = editionSeed(editionKey);
  const moveLabel = label ?? MOVE_LABELS[Math.floor(seededRandom(eSeed + 77 + seedIndex * 11) * MOVE_LABELS.length)];
  const aFont = QUOTE_FONTS[Math.floor(seededRandom(eSeed + 44) * QUOTE_FONTS.length)];
  const animName = `${idPrefix}-pop-${seedIndex}`;
  const filterId = `${idPrefix}-border-${seedIndex}`;

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", marginBottom: 28 }}>
      <style>{`@keyframes ${animName}{0%,100%{transform:scale(1) rotate(-3deg)}50%{transform:scale(1.3) rotate(5deg)}}`}</style>
      <div style={{ background: P.accent + "40", borderRadius: 20, boxShadow: P.shadow, paddingTop: 18, paddingBottom: 20, paddingLeft: 20, paddingRight: 20, display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <span style={{ fontSize: 28, display: "inline-block", animation: `${animName} 1.2s ease-in-out infinite` }}>{emoji}</span>
          <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: 2, textTransform: "uppercase" as const, color: P.accent, fontFamily: P.fontBody }}>{moveLabel}</div>
        </div>
        {(() => {
          const inner = (
            <>
              <div style={{ fontSize: 21, lineHeight: 1.4, color: P.ink, fontFamily: aFont.family, fontStyle: aFont.style as "italic" | "normal", fontWeight: aFont.weight }}>{action}</div>
              {href && (
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "auto" }}>
                  <span style={{ fontSize: 12, fontWeight: 900, letterSpacing: 1.5, color: P.accent, fontFamily: P.fontBody, textTransform: "uppercase" as const, border: `1px solid ${P.accent}`, borderRadius: 50, paddingTop: 5, paddingBottom: 5, paddingLeft: 14, paddingRight: 14, display: "inline-block", whiteSpace: "nowrap" as const }}>How?</span>
                </div>
              )}
            </>
          );
          const panel: React.CSSProperties = { textDecoration: "none", display: "flex", flexDirection: "column", gap: 14, background: "transparent", border: `2px dashed ${P.accent}`, borderRadius: 12, paddingTop: 14, paddingBottom: 14, paddingLeft: 14, paddingRight: 14, flex: 1 };
          return href ? <a href={href} style={panel}>{inner}</a> : <div style={panel}>{inner}</div>;
        })()}
      </div>
      <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible", zIndex: 10, isolation: "isolate" } as React.CSSProperties} xmlns="http://www.w3.org/2000/svg">
        <defs><filter id={filterId} x="-8%" y="-8%" width="116%" height="116%"><feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="4" seed={seed} result="noise" /><feDisplacementMap in="SourceGraphic" in2="noise" scale="7" xChannelSelector="R" yChannelSelector="G" /></filter></defs>
        <rect x="2" y="2" width="99%" height="99%" rx="18" ry="18" fill="none" stroke={P.accent} strokeWidth="3.5" filter={`url(#${filterId})`} />
      </svg>
    </div>
  );
}

import { P, CURSIVE_FONT_FAMILY, CURSIVE_CAP_SCALE } from "@/lib/palette";

/**
 * Feature Creature headline, with the name of the work it is about set in caps sans while the
 * rest stays in the edition's script face.
 *
 * The whole title in script makes the subject hard to pick out at a glance — "Less Than Zero
 * Made Emptiness Fashionable Before We Knew It" reads as one undifferentiated ribbon. Setting
 * the work in uppercase Raleway/Inter gives the eye somewhere to land and tells the reader what
 * the piece is about before they parse the sentence.
 *
 * Falls back to the plain script title when the universe name does not appear in the headline,
 * which happens whenever the model writes around it rather than naming it.
 */
export function FcTitle({
  title, work, fontSize, color, lineHeight = 1.15,
}: {
  title: string;
  work?: string;
  /** number of px, or any CSS length — the article page passes a clamp() */
  fontSize: number | string;
  color: string;
  lineHeight?: number;
}) {
  const base: React.CSSProperties = {
    fontFamily: `'${CURSIVE_FONT_FAMILY}', cursive`,
    fontSize, color, lineHeight, fontWeight: 700,
  };

  const idx = work && work.trim() ? title.toLowerCase().indexOf(work.trim().toLowerCase()) : -1;
  if (idx < 0 || !work) return <div style={base}>{title}</div>;

  const len = work.trim().length;
  return (
    <div style={base}>
      {title.slice(0, idx)}
      <span style={{
        fontFamily: P.fontBody,
        // Per-script scale, measured rather than guessed — see CURSIVE_FONTS in palette.ts.
        // em rather than px so this tracks the article page's clamp() too.
        fontSize: `${CURSIVE_CAP_SCALE}em`,
        fontWeight: 800,
        textTransform: "uppercase" as const,
        letterSpacing: 1.2,
      }}>{title.slice(idx, idx + len)}</span>
      {title.slice(idx + len)}
    </div>
  );
}

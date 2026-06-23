export type Palette = {
  pageBg: string; cardBg: string; tint: string; accent: string;
  ink: string; inkMid: string; inkLight: string; shadow: string;
  gradFrom: string; gradTo: string; fontHeading: string; fontBody: string; dark: boolean;
};

export const PALETTES: Palette[] = [
  { pageBg: "#150D26", cardBg: "#2A1B3D", tint: "#44318D", accent: "#D83F87",
    ink: "#F5F0FF", inkMid: "#C8B8E8", inkLight: "#7060A0",
    shadow: "0 2px 8px rgba(0,0,0,0.4), 0 8px 24px rgba(216,63,135,0.15)",
    gradFrom: "#44318D", gradTo: "#D83F87",
    fontHeading: "'Bebas Neue', Impact, 'Arial Black', sans-serif",
    fontBody: "'Raleway', 'Helvetica Neue', Arial, sans-serif", dark: true },
  { pageBg: "#88BDBC", cardBg: "#DCEEED", tint: "#9FCFCE", accent: "#254E58",
    ink: "#112D32", inkMid: "#254E58", inkLight: "#4F6870",
    shadow: "0 1px 4px rgba(17,45,50,0.08), 0 4px 20px rgba(17,45,50,0.10)",
    gradFrom: "#254E58", gradTo: "#112D32",
    fontHeading: "'Raleway', 'Helvetica Neue', Arial, sans-serif",
    fontBody: "'Raleway', 'Helvetica Neue', Arial, sans-serif", dark: false },
  { pageBg: "#222629", cardBg: "#2E3236", tint: "#474B4F", accent: "#86C232",
    ink: "#F0F4F0", inkMid: "#A8B8A0", inkLight: "#6B6E70",
    shadow: "0 2px 8px rgba(0,0,0,0.5), 0 8px 24px rgba(134,194,50,0.12)",
    gradFrom: "#61892F", gradTo: "#86C232",
    fontHeading: "'Barlow Condensed', Impact, 'Arial Narrow', sans-serif",
    fontBody: "'Barlow Condensed', 'Helvetica Neue', Arial, sans-serif", dark: true },
  { pageBg: "#EDEAE5", cardBg: "#FEFDF8", tint: "#9FEDD7", accent: "#026670",
    ink: "#0A1A1A", inkMid: "#2A5050", inkLight: "#7A9898",
    shadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(2,102,112,0.08)",
    gradFrom: "#9FEDD7", gradTo: "#026670",
    fontHeading: "'Playfair Display', Georgia, serif",
    fontBody: "'Raleway', 'Helvetica Neue', Arial, sans-serif", dark: false },
  { pageBg: "#46344E", cardBg: "#382840", tint: "#5A5560", accent: "#FAED26",
    ink: "#FFFFFF", inkMid: "#C8C0D0", inkLight: "#807888",
    shadow: "0 2px 8px rgba(0,0,0,0.5), 0 8px 24px rgba(250,237,38,0.10)",
    gradFrom: "#5A5560", gradTo: "#FAED26",
    fontHeading: "'Oswald', 'Barlow Condensed', Impact, sans-serif",
    fontBody: "'Oswald', 'Helvetica Neue', Arial, sans-serif", dark: true },
];

export const SECTION_COLORS: Record<string, string> = {
  Technology: "#5B8DEF", Entertainment: "#D4517A", Culture: "#9B6DDE",
  Science: "#27AE8F", Arts: "#E07B3C", World: "#E05252", Music: "#C87AC0",
};

export const P = PALETTES[Math.floor(Date.now() / 86_400_000) % PALETTES.length];

// Daily-rotating quote fonts for The Bottom Line — expressive, editorial, distinct
const QUOTE_FONTS = [
  { family: "'Abril Fatface', cursive",                    style: "normal", weight: 400 },
  { family: "'Cormorant Garamond', serif",                 style: "italic", weight: 600 },
  { family: "'DM Serif Display', serif",                   style: "italic", weight: 400 },
  { family: "'Cinzel', serif",                             style: "normal", weight: 900 },
  { family: "'Fraunces', serif",                           style: "italic", weight: 900 },
  { family: "'Libre Baskerville', serif",                  style: "italic", weight: 700 },
  { family: "'Bodoni Moda', serif",                        style: "italic", weight: 800 },
  { family: "'Spectral', serif",                           style: "italic", weight: 800 },
  { family: "'Playfair Display', serif",                   style: "italic", weight: 700 },
  { family: "'Bebas Neue', sans-serif",                    style: "normal", weight: 400 },
];

export const QUOTE_FONT = QUOTE_FONTS[Math.floor(Date.now() / 86_400_000) % QUOTE_FONTS.length];

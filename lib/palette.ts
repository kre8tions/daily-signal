export type Palette = {
  pageBg: string; articleBg: string; cardBg: string; tint: string; accent: string; accent2: string;
  ink: string; inkMid: string; inkLight: string; shadow: string;
  gradFrom: string; gradTo: string; fontHeading: string; fontBody: string; dark: boolean;
};

export const PALETTES: Palette[] = [
  // 0 — Dark Purple / Pink
  { pageBg: "#150D26", articleBg: "#1C1230", cardBg: "#2A1B3D", tint: "#44318D", accent: "#D83F87", accent2: "#7B2FBE",
    ink: "#F5F0FF", inkMid: "#C8B8E8",
    inkLight: "#B0A0D0", // was #7060A0 (~2.8:1) → now ~5.2:1 on cardBg
    shadow: "0 2px 8px rgba(0,0,0,0.4), 0 8px 24px rgba(216,63,135,0.15)",
    gradFrom: "#44318D", gradTo: "#D83F87",
    fontHeading: "'Bebas Neue', Impact, 'Arial Black', sans-serif",
    fontBody: "'Raleway', 'Helvetica Neue', Arial, sans-serif", dark: true },
  // 1 — Teal (pageBg lightened from #88BDBC to reduce eye strain)
  { pageBg: "#C8E4E3", articleBg: "#F2FAFA", cardBg: "#DCEEED", tint: "#9FCFCE", accent: "#254E58", accent2: "#C0533A",
    ink: "#112D32", inkMid: "#254E58",
    inkLight: "#2E4E58", // was #4F6870 (~3.1:1) → now ~5.8:1 on cardBg
    shadow: "0 1px 4px rgba(17,45,50,0.08), 0 4px 20px rgba(17,45,50,0.10)",
    gradFrom: "#254E58", gradTo: "#112D32",
    fontHeading: "'DM Serif Display', Georgia, serif",
    fontBody: "'Raleway', 'Helvetica Neue', Arial, sans-serif", dark: false },
  // 2 — Military Green (fontBody changed from condensed to readable sans)
  { pageBg: "#222629", articleBg: "#1A1E22", cardBg: "#2E3236", tint: "#474B4F", accent: "#86C232", accent2: "#E8A020",
    ink: "#F0F4F0", inkMid: "#A8B8A0",
    inkLight: "#9CA4A0", // was #6B6E70 (~2.7:1) → now ~4.6:1 on cardBg
    shadow: "0 2px 8px rgba(0,0,0,0.5), 0 8px 24px rgba(134,194,50,0.12)",
    gradFrom: "#61892F", gradTo: "#86C232",
    fontHeading: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    fontBody: "'Inter', 'Helvetica Neue', Arial, sans-serif", dark: true },
  // 3 — Light Editorial (best palette — minor inkLight fix)
  { pageBg: "#EDEAE5", articleBg: "#FEFDF8", cardBg: "#FEFDF8", tint: "#9FEDD7", accent: "#026670", accent2: "#C0392B",
    ink: "#0A1A1A", inkMid: "#2A5050",
    inkLight: "#456060", // was #7A9898 (~4.2:1) → now ~5.5:1 on cardBg
    shadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(2,102,112,0.08)",
    gradFrom: "#9FEDD7", gradTo: "#026670",
    fontHeading: "'Playfair Display', Georgia, serif",
    fontBody: "'Raleway', 'Helvetica Neue', Arial, sans-serif", dark: false },
  // 4 — Dark Purple / Yellow (fontBody changed from condensed to readable sans)
  { pageBg: "#46344E", articleBg: "#2E2038", cardBg: "#382840", tint: "#5A5560", accent: "#F5D800", accent2: "#F4845F",
    ink: "#FFFFFF", inkMid: "#C8C0D0",
    inkLight: "#A89AB0", // was #807888 (~2.5:1) → now ~4.8:1 on cardBg
    shadow: "0 2px 8px rgba(0,0,0,0.5), 0 8px 24px rgba(250,237,38,0.10)",
    gradFrom: "#5A5560", gradTo: "#F5D800",
    fontHeading: "'Space Grotesk', 'Helvetica Neue', Arial, sans-serif",
    fontBody: "'Inter', 'Helvetica Neue', Arial, sans-serif", dark: true },
];

export const SECTION_COLORS: Record<string, string> = {
  Technology: "#5B8DEF", Science: "#27AE8F", Culture: "#9B6DDE",
  Film: "#E07B3C", Entertainment: "#D4517A", Arts: "#C87AC0", Faith: "#F5A623",
};

// Proxy so callers read P.foo normally but always get the live palette value,
// even when the module is cached across requests in the same serverless instance.
export const P: Palette = new Proxy({} as Palette, {
  get(_, key) {
    const current = PALETTES[Math.floor(Date.now() / 14_400_000) % PALETTES.length];
    return current[key as keyof Palette];
  },
});

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

const TAGLINE_PHRASES = [
  "Our take on the headlines that matter.",
  "Sharp eyes on the stories shaping the world.",
  "The news, with an opinion.",
  "Insight, not just information.",
  "What happened. What it means.",
  "The signal in all the noise.",
  "Real stories. Real perspective.",
];

const TAGLINE_FONTS = [
  { family: "'Cormorant Garamond', serif", style: "italic", weight: 600 },
  { family: "'DM Serif Display', serif", style: "italic", weight: 400 },
  { family: "'Fraunces', serif", style: "italic", weight: 900 },
  { family: "'Libre Baskerville', serif", style: "italic", weight: 400 },
  { family: "'Spectral', serif", style: "italic", weight: 600 },
  { family: "'Playfair Display', serif", style: "italic", weight: 400 },
  { family: "'Bodoni Moda', serif", style: "italic", weight: 500 },
];

const _day = Math.floor(Date.now() / 86_400_000);
export const TAGLINE = TAGLINE_PHRASES[_day % TAGLINE_PHRASES.length];
export const TAGLINE_FONT = TAGLINE_FONTS[_day % TAGLINE_FONTS.length];

export const ACTION_LABELS = [
  "What To Do", "Your Move", "Do This Today", "Start Here", "Creative Next Steps",
  "Try This Now", "Begin Here", "Make Your Move", "First Steps", "This Week's Prompt",
  "Do This Now", "Get Started", "Your First Move", "Take This Step", "One Thing To Do",
  "This Is Your Cue", "Act On This", "Low-Lift, High-Impact", "Today's Nudge", "Start Small",
];
export const ACTION_LABEL = ACTION_LABELS[_day % ACTION_LABELS.length];

// Animated emoji — rotates per edition (4-hour window)
const ACTION_EMOJIS = ["✏️", "🌱", "💡", "🎯", "🛠️", "📝", "🚀", "🔑", "🎨", "📣", "⚡", "🌟", "🧩", "🪄", "🎬", "📱", "🗺️", "🔥", "💬", "🎤"];
const _edition = Math.floor(Date.now() / 14_400_000);
export const ACTION_EMOJI = ACTION_EMOJIS[_edition % ACTION_EMOJIS.length];

// Cursive/handwritten font pool — rotates per edition
// Each entry: [fontFamily CSS name, Google Fonts family param]
const CURSIVE_FONTS: [string, string][] = [
  ["Dancing Script",  "Dancing+Script:wght@700"],       // flowing elegant script
  ["Pacifico",        "Pacifico"],                       // bold casual retro
  ["Sacramento",      "Sacramento"],                     // thin tall calligraphy
  ["Satisfy",         "Satisfy"],                        // bold brush script
  ["Caveat",          "Caveat:wght@700"],                // casual ballpoint
  ["Kalam",           "Kalam:wght@700"],                 // natural handwritten
  ["Pinyon Script",   "Pinyon+Script"],                  // elegant ink calligraphy
  ["Cookie",          "Cookie"],                         // rounded flowing script
  ["Allura",          "Allura"],                         // thin calligraphy
  ["Amatic SC",       "Amatic+SC:wght@700"],             // tall thin print-hand
];
export const CURSIVE_FONT_FAMILY = CURSIVE_FONTS[_edition % CURSIVE_FONTS.length][0];
export const CURSIVE_FONT_URL = `https://fonts.googleapis.com/css2?family=${CURSIVE_FONTS[_edition % CURSIVE_FONTS.length][1]}&display=swap`;

// ── Feature Creature — fictional universe pool ────────────────────────────────
export const FC_UNIVERSES = [
  // Anime
  "Ghost in the Shell", "Akira", "Neon Genesis Evangelion", "Cowboy Bebop",
  "Attack on Titan", "Fullmetal Alchemist", "Steins;Gate", "Serial Experiments Lain",
  "Psycho-Pass", "Planetes", "Vinland Saga", "Paprika",
  // Sci-fi film & TV
  "Blade Runner 2049", "Arrival", "Interstellar", "Ex Machina", "Her",
  "Annihilation", "The Matrix", "Minority Report", "Contact", "Gattaca",
  "Children of Men", "Moon", "Severance", "Black Mirror", "Westworld",
  "Battlestar Galactica", "Altered Carbon", "Dark", "Devs",
  // Novels & written sci-fi
  "Dune", "Neuromancer", "Snow Crash", "The Left Hand of Darkness",
  "Solaris", "Foundation", "A Canticle for Leibowitz", "The Dispossessed",
  "Blindsight", "Permutation City", "Flowers for Algernon", "The Diamond Age",
  "A Fire Upon the Deep", "Ender's Game", "Hyperion",
  // Games & other worlds
  "Disco Elysium", "Cyberpunk 2077", "Nier: Automata", "Control",
  "Death Stranding", "Hollow Knight", "Hades", "Outer Wilds",
  // Fantasy & adjacent
  "Ursula K. Le Guin's Earthsea", "His Dark Materials", "Solarpunk movement",
  "Studio Ghibli's Nausicaä", "Princess Mononoke", "Spirited Away",
];

export const FC_ANGLES = [
  { key: "science",  label: "The Real Science",  prompt: "Explore the real-world science behind the central technology or phenomenon in this fictional universe. What do scientists actually know? How close are we? What would need to be true for it to exist?" },
  { key: "build",    label: "How To Build It",    prompt: "If we wanted to build the most iconic technology or system from this fictional universe today, what would the architecture look like? What startups or labs are working on pieces of it? What's the hardest unsolved problem?" },
  { key: "culture",  label: "The World It Makes", prompt: "Focus on the culture, fashion, lifestyle, social dynamics, or aesthetic of this fictional universe. What does it say about our desires and fears? What elements are already bleeding into the real world?" },
];

const _fc = Math.floor(Date.now() / 14_400_000);
export const FC_UNIVERSE = FC_UNIVERSES[_fc % FC_UNIVERSES.length];
export const FC_ANGLE = FC_ANGLES[Math.floor(_fc / FC_UNIVERSES.length) % FC_ANGLES.length];

// Returns #000 or #fff — whichever contrasts better against the given hex color
export function contrastColor(hex: string): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  // Perceived luminance (WCAG formula)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#000000" : "#ffffff";
}

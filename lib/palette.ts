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
  Insight: "#A855F7",
};

// Per-request override: set from edition key so each edition has a stable palette
// regardless of when the page is rendered. Falls back to time-based index if unset.
let _editionKeyHash = 0;
export function setEditionPaletteKey(editionKey: string) {
  _editionKeyHash = editionKey.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
}

export const P: Palette = new Proxy({} as Palette, {
  get(_, key) {
    const seed = _editionKeyHash > 0 ? _editionKeyHash : Math.floor(Date.now() / 14_400_000);
    const current = PALETTES[seed % PALETTES.length];
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

export { QUOTE_FONTS };
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

// ── Writer lenses — applied on top of base voice for Psychology/HumanPotential articles ──
export type WriterLens = { name: string; prompt: string };
export const LENSES: WriterLens[] = [
  {
    name: "The Elder",
    prompt: `TODAY'S LENS — The Elder: You have watched many people succeed and fail. You do not moralize or cheerlead. You speak from pattern recognition built over decades — not theory, not research summaries. The sentence lands like someone who was there. Trust the reader to draw their own conclusion. The lesson is in what you noticed, not what you declare.`,
  },
  {
    name: "The Anthropologist",
    prompt: `TODAY'S LENS — The Anthropologist: You study exceptional people the way a field researcher studies a culture — curious, precise, non-judgmental. You are interested in what they actually do versus what they say they do. The gap between those two things is always where the real story lives. Report behavior, not inspiration. Let the pattern speak.`,
  },
];
const UPLIFT_SECTIONS = new Set(["Psychology", "HumanPotential"]);
export function getLens(section: string | undefined, seed: number): WriterLens | null {
  if (!section || !UPLIFT_SECTIONS.has(section)) return null;
  return LENSES[seed % LENSES.length];
}

// ── Feature Creature — fictional universe pool ────────────────────────────────
type FCMedium = "anime" | "film" | "tv" | "novel" | "game" | "fantasy";
export type FCUniverse = { name: string; medium: FCMedium };

const u = (name: string, medium: FCMedium): FCUniverse => ({ name, medium });

export const FC_UNIVERSES: FCUniverse[] = [
  // ── Anime — classic ──────────────────────────────────────────────────────────
  u("Ghost in the Shell", "anime"), u("Akira", "anime"), u("Neon Genesis Evangelion", "anime"),
  u("Cowboy Bebop", "anime"), u("Fullmetal Alchemist: Brotherhood", "anime"),
  u("Steins;Gate", "anime"), u("Serial Experiments Lain", "anime"), u("Psycho-Pass", "anime"),
  u("Planetes", "anime"), u("Vinland Saga", "anime"), u("Paprika", "anime"),
  u("Nausicaä of the Valley of the Wind", "anime"), u("Princess Mononoke", "anime"),
  u("Spirited Away", "anime"), u("My Neighbor Totoro", "anime"), u("Grave of the Fireflies", "anime"),
  u("Perfect Blue", "anime"), u("Millennium Actress", "anime"), u("Jin-Roh: The Wolf Brigade", "anime"),
  u("Mobile Suit Gundam", "anime"), u("Macross", "anime"), u("Legend of the Galactic Heroes", "anime"),
  u("Rose of Versailles", "anime"), u("Aim for the Ace", "anime"), u("Ashita no Joe", "anime"),
  // ── Anime — modern ───────────────────────────────────────────────────────────
  u("Attack on Titan", "anime"), u("Demon Slayer", "anime"), u("Jujutsu Kaisen", "anime"),
  u("My Hero Academia", "anime"), u("Chainsaw Man", "anime"), u("Spy x Family", "anime"),
  u("Mob Psycho 100", "anime"), u("One Punch Man", "anime"), u("Hunter x Hunter", "anime"),
  u("Fullmetal Alchemist", "anime"), u("Death Note", "anime"), u("Code Geass", "anime"),
  u("Gurren Lagann", "anime"), u("Sword Art Online", "anime"), u("Re:Zero", "anime"),
  u("Made in Abyss", "anime"), u("Frieren: Beyond Journey's End", "anime"),
  u("Trigun", "anime"), u("Berserk", "anime"), u("Claymore", "anime"),
  u("Monster", "anime"), u("Parasyte", "anime"), u("Tokyo Ghoul", "anime"),
  u("Your Lie in April", "anime"), u("A Silent Voice", "anime"), u("Weathering with You", "anime"),
  u("Violet Evergarden", "anime"), u("The Promised Neverland", "anime"),
  u("Mushishi", "anime"), u("Haibane Renmei", "anime"), u("Ergo Proxy", "anime"),
  u("Texhnolyze", "anime"), u("Kaiba", "anime"), u("Ping Pong the Animation", "anime"),
  u("Kids on the Slope", "anime"), u("March Comes in Like a Lion", "anime"),
  u("Nana", "anime"), u("Banana Fish", "anime"), u("Odd Taxi", "anime"),
  u("Sk8 the Infinity", "anime"), u("Blue Period", "anime"), u("Keep Your Hands Off Eizouken!", "anime"),
  u("Shirobako", "anime"), u("Barakamon", "anime"), u("Gekkan Shoujo Nozaki-kun", "anime"),
  u("Laid-Back Camp", "anime"), u("Non Non Biyori", "anime"),
  // ── Sci-fi film ──────────────────────────────────────────────────────────────
  u("Blade Runner 2049", "film"), u("Blade Runner", "film"), u("Arrival", "film"),
  u("Interstellar", "film"), u("Ex Machina", "film"), u("Her", "film"),
  u("Annihilation", "film"), u("The Matrix", "film"), u("Minority Report", "film"),
  u("Contact", "film"), u("Gattaca", "film"), u("Children of Men", "film"),
  u("Moon", "film"), u("2001: A Space Odyssey", "film"), u("Solaris (1972)", "film"),
  u("Stalker", "film"), u("Metropolis", "film"), u("Brazil", "film"),
  u("12 Monkeys", "film"), u("Eternal Sunshine of the Spotless Mind", "film"),
  u("Inception", "film"), u("Coherence", "film"), u("Primer", "film"),
  u("Upstream Color", "film"), u("Possessor", "film"), u("Under the Skin", "film"),
  u("A.I. Artificial Intelligence", "film"), u("I, Robot", "film"),
  u("The Truman Show", "film"), u("Cube", "film"), u("Dark City", "film"),
  u("eXistenZ", "film"), u("Strange Days", "film"), u("Total Recall", "film"),
  u("RoboCop", "film"), u("District 9", "film"), u("Avatar", "film"),
  u("Elysium", "film"), u("Snowpiercer", "film"), u("Okja", "film"),
  u("The Host", "film"), u("Parasite", "film"), u("Burning", "film"),
  // ── Prestige & arthouse film ──────────────────────────────────────────────────
  u("Everything Everywhere All at Once", "film"), u("Get Out", "film"),
  u("Us", "film"), u("Sorry to Bother You", "film"), u("Whiplash", "film"),
  u("Tár", "film"), u("The Favourite", "film"), u("Portrait of a Lady on Fire", "film"),
  u("Roma", "film"), u("The Power of the Dog", "film"), u("Midsommar", "film"),
  u("Hereditary", "film"), u("The Lighthouse", "film"), u("The Witch", "film"),
  u("A Ghost Story", "film"), u("First Reformed", "film"), u("Marriage Story", "film"),
  u("Aftersun", "film"), u("Past Lives", "film"), u("The Zone of Interest", "film"),
  u("Oppenheimer", "film"), u("Dunkirk", "film"), u("Mad Max: Fury Road", "film"),
  u("Dune (2021)", "film"), u("Dune: Part Two", "film"),
  u("Joker", "film"), u("The Social Network", "film"), u("Nightcrawler", "film"),
  u("Drive", "film"), u("Prisoners", "film"), u("Sicario", "film"),
  u("No Country for Old Men", "film"), u("There Will Be Blood", "film"),
  u("Mulholland Drive", "film"), u("Lost Highway", "film"), u("Blue Velvet", "film"),
  u("Memento", "film"), u("Requiem for a Dream", "film"), u("pi (1998)", "film"),
  u("Black Swan", "film"), u("mother!", "film"), u("The Wrestler", "film"),
  // ── Sci-fi & prestige TV ─────────────────────────────────────────────────────
  u("Severance", "tv"), u("Black Mirror", "tv"), u("Westworld", "tv"),
  u("Battlestar Galactica", "tv"), u("Altered Carbon", "tv"), u("Dark", "tv"),
  u("Devs", "tv"), u("Andor", "tv"), u("Fallout", "tv"), u("The Boys", "tv"),
  u("Squid Game", "tv"), u("Squid Game Season 2", "tv"),
  u("For All Mankind", "tv"), u("Halt and Catch Fire", "tv"),
  u("Mr. Robot", "tv"), u("Humans", "tv"), u("Travelers", "tv"),
  u("Maniac", "tv"), u("Undone", "tv"), u("Russian Doll", "tv"),
  u("Sense8", "tv"), u("Orphan Black", "tv"), u("Fringe", "tv"),
  u("Person of Interest", "tv"), u("Continuum", "tv"), u("Dollhouse", "tv"),
  u("Firefly", "tv"), u("Farscape", "tv"), u("Babylon 5", "tv"),
  u("Star Trek: The Next Generation", "tv"), u("Star Trek: Deep Space Nine", "tv"),
  u("Star Trek: Strange New Worlds", "tv"), u("The Expanse", "tv"),
  u("Foundation", "tv"), u("The Peripheral", "tv"), u("Pantheon", "tv"),
  u("Shogun", "tv"), u("The Terror", "tv"), u("Station Eleven", "tv"),
  u("The Leftovers", "tv"), u("Twin Peaks: The Return", "tv"),
  u("The Sopranos", "tv"), u("The Wire", "tv"), u("Breaking Bad", "tv"),
  u("Better Call Saul", "tv"), u("Succession", "tv"), u("The Bear", "tv"),
  u("Fleabag", "tv"), u("Fleabag Season 2", "tv"), u("Fleabag Season 1", "tv"),
  u("Bojack Horseman", "tv"), u("Atlanta", "tv"), u("Barry", "tv"),
  u("True Detective Season 1", "tv"), u("True Detective: Night Country", "tv"),
  u("The Handmaid's Tale", "tv"), u("Years and Years", "tv"),
  u("Utopia (UK)", "tv"), u("The Prisoner (1967)", "tv"),
  u("Chernobyl", "tv"), u("Band of Brothers", "tv"),
  u("The White Lotus", "tv"), u("Sharp Objects", "tv"), u("Mare of Easttown", "tv"),
  u("Mindhunter", "tv"), u("Ozark", "tv"), u("Narcos", "tv"),
  // ── Classic & literary novels ─────────────────────────────────────────────────
  u("Dune", "novel"), u("Neuromancer", "novel"), u("Snow Crash", "novel"),
  u("The Left Hand of Darkness", "novel"), u("Solaris", "novel"), u("Foundation", "novel"),
  u("A Canticle for Leibowitz", "novel"), u("The Dispossessed", "novel"),
  u("Blindsight", "novel"), u("Permutation City", "novel"), u("Flowers for Algernon", "novel"),
  u("The Diamond Age", "novel"), u("A Fire Upon the Deep", "novel"),
  u("Ender's Game", "novel"), u("Hyperion", "novel"),
  u("Never Let Me Go", "novel"), u("The Road", "novel"), u("Station Eleven", "novel"),
  u("American Gods", "novel"), u("Cloud Atlas", "novel"),
  u("The Remains of the Day", "novel"), u("Oryx and Crake", "novel"),
  u("The Handmaid's Tale", "novel"), u("1984", "novel"), u("Brave New World", "novel"),
  u("Fahrenheit 451", "novel"), u("We (Zamyatin)", "novel"), u("It Can't Happen Here", "novel"),
  u("The Stranger", "novel"), u("Nausea", "novel"), u("The Trial", "novel"),
  u("The Castle", "novel"), u("The Master and Margarita", "novel"),
  u("One Hundred Years of Solitude", "novel"), u("Ficciones", "novel"),
  u("The Name of the Rose", "novel"), u("If on a winter's night a traveler", "novel"),
  u("Invisible Man", "novel"), u("Beloved", "novel"), u("Song of Solomon", "novel"),
  u("Blood Meridian", "novel"), u("Suttree", "novel"), u("The Road", "novel"),
  u("White Noise", "novel"), u("Infinite Jest", "novel"), u("The Corrections", "novel"),
  u("Freedom", "novel"), u("A Visit from the Goon Squad", "novel"),
  u("The Brief Wondrous Life of Oscar Wao", "novel"), u("Everything Is Illuminated", "novel"),
  u("The Virgin Suicides", "novel"), u("American Psycho", "novel"),
  u("Fight Club", "novel"), u("Less Than Zero", "novel"),
  u("On the Road", "novel"), u("The Bell Jar", "novel"), u("Franny and Zooey", "novel"),
  u("The Catcher in the Rye", "novel"), u("To Kill a Mockingbird", "novel"),
  u("Their Eyes Were Watching God", "novel"), u("Invisible Cities", "novel"),
  u("If This Is a Man", "novel"), u("Night (Wiesel)", "novel"),
  // ── Genre novels — sci-fi, thriller, fantasy ──────────────────────────────────
  u("The Three-Body Problem", "novel"), u("The Dark Forest", "novel"),
  u("Project Hail Mary", "novel"), u("The Martian", "novel"),
  u("Red Rising", "novel"), u("Wool", "novel"), u("Recursion", "novel"),
  u("Dark Matter", "novel"), u("Klara and the Sun", "novel"),
  u("The Power", "novel"), u("Piranesi", "novel"), u("The Memory Police", "novel"),
  u("Annihilation", "novel"), u("The First Fifteen Lives of Harry August", "novel"),
  u("All Systems Red (Murderbot Diaries)", "novel"), u("A Long Way to a Small Angry Planet", "novel"),
  u("The Calculating Stars", "novel"), u("Children of Time", "novel"),
  u("A Memory Called Empire", "novel"), u("The Galaxy and the Ground Within", "novel"),
  u("Leviathan Wakes", "novel"), u("Revelation Space", "novel"),
  u("Old Man's War", "novel"), u("The Forever War", "novel"),
  u("Starship Troopers", "novel"), u("The Moon is a Harsh Mistress", "novel"),
  u("Stranger in a Strange Land", "novel"), u("Do Androids Dream of Electric Sheep?", "novel"),
  u("Ubik", "novel"), u("VALIS", "novel"), u("A Scanner Darkly", "novel"),
  u("The Man in the High Castle", "novel"), u("The Lathe of Heaven", "novel"),
  u("The Word for World is Forest", "novel"), u("Parable of the Sower", "novel"),
  u("Kindred", "novel"), u("Wild Seed", "novel"), u("Dawn", "novel"),
  u("American War", "novel"), u("The Windup Girl", "novel"),
  u("Rainbows End", "novel"), u("Accelerando", "novel"), u("Glasshouse", "novel"),
  u("Spin", "novel"), u("Blindsight", "novel"), u("Echopraxia", "novel"),
  u("The Gone-Away World", "novel"), u("Angelmaker", "novel"),
  // ── Fantasy novels & series ───────────────────────────────────────────────────
  u("His Dark Materials", "fantasy"), u("The Name of the Wind", "fantasy"),
  u("The Wise Man's Fear", "fantasy"), u("The Way of Kings", "fantasy"),
  u("Words of Radiance", "fantasy"), u("The Final Empire (Mistborn)", "fantasy"),
  u("The Lord of the Rings", "fantasy"), u("The Hobbit", "fantasy"),
  u("A Wizard of Earthsea", "fantasy"), u("The Tombs of Atuan", "fantasy"),
  u("American Gods", "fantasy"), u("Good Omens", "fantasy"),
  u("The Night Circus", "fantasy"), u("Jonathan Strange & Mr Norrell", "fantasy"),
  u("Among Others", "fantasy"), u("The Just City", "fantasy"),
  u("The Fifth Season", "fantasy"), u("The Obelisk Gate", "fantasy"),
  u("Spinning Silver", "fantasy"), u("Uprooted", "fantasy"),
  u("The Bear and the Nightingale", "fantasy"), u("The Starless Sea", "fantasy"),
  u("Circe", "fantasy"), u("The Song of Achilles", "fantasy"),
  u("Piranesi", "fantasy"), u("The House in the Cerulean Sea", "fantasy"),
  u("Mexican Gothic", "fantasy"), u("Plain Bad Heroines", "fantasy"),
  u("A Court of Thorns and Roses", "fantasy"), u("Six of Crows", "fantasy"),
  u("The Poppy War", "fantasy"), u("Babel", "fantasy"),
  // ── Games ─────────────────────────────────────────────────────────────────────
  u("Disco Elysium", "game"), u("Cyberpunk 2077", "game"), u("Nier: Automata", "game"),
  u("Control", "game"), u("Death Stranding", "game"), u("Hollow Knight", "game"),
  u("Hades", "game"), u("Outer Wilds", "game"), u("Portal", "game"),
  u("Portal 2", "game"), u("The Last of Us", "game"), u("The Last of Us Part II", "game"),
  u("BioShock", "game"), u("BioShock Infinite", "game"), u("Celeste", "game"),
  u("Undertale", "game"), u("Disco Elysium: The Final Cut", "game"),
  u("Baldur's Gate 3", "game"), u("Elden Ring", "game"), u("Dark Souls", "game"),
  u("Bloodborne", "game"), u("Sekiro", "game"), u("Metal Gear Solid", "game"),
  u("Metal Gear Solid 2", "game"), u("Silent Hill 2", "game"), u("Resident Evil 4", "game"),
  u("Half-Life 2", "game"), u("Deus Ex", "game"), u("System Shock 2", "game"),
  u("Planescape: Torment", "game"), u("Fallout: New Vegas", "game"),
  u("Red Dead Redemption 2", "game"), u("The Witcher 3", "game"),
  u("Kentucky Route Zero", "game"), u("What Remains of Edith Finch", "game"),
  u("Gone Home", "game"), u("Firewatch", "game"), u("Oxenfree", "game"),
  u("Spiritfarer", "game"), u("Hades II", "game"), u("Vampire Survivors", "game"),
  u("Stardew Valley", "game"), u("Dwarf Fortress", "game"), u("Minecraft", "game"),
  u("Braid", "game"), u("Limbo", "game"), u("Inside", "game"),
  u("Journey", "game"), u("Shadow of the Colossus", "game"), u("ICO", "game"),
  u("Ico & Shadow of the Colossus Collection", "game"),
  u("Gris", "game"), u("Ori and the Blind Forest", "game"),
];

export const FC_ANGLES = [
  { key: "science",  label: "The Real Science",  prompt: "Explore the real-world science behind the central technology or phenomenon in this fictional universe. What do scientists actually know? How close are we? What would need to be true for it to exist?" },
  { key: "build",    label: "How To Build It",    prompt: "If we wanted to build the most iconic technology or system from this fictional universe today, what would the architecture look like? What startups or labs are working on pieces of it? What's the hardest unsolved problem?" },
  { key: "culture",  label: "The World It Makes", prompt: "Focus on the culture, fashion, lifestyle, social dynamics, or aesthetic of this fictional universe. What does it say about our desires and fears? What elements are already bleeding into the real world?" },
];

export const FC_UNIVERSE: FCUniverse = new Proxy({} as FCUniverse, {
  get(_, key) {
    const seed = _editionKeyHash > 0 ? _editionKeyHash : Math.floor(Date.now() / 14_400_000);
    const current = FC_UNIVERSES[seed % FC_UNIVERSES.length];
    return current[key as keyof FCUniverse];
  },
});
export const FC_ANGLE = new Proxy({} as typeof FC_ANGLES[number], {
  get(_, key) {
    const seed = _editionKeyHash > 0 ? _editionKeyHash : Math.floor(Date.now() / 14_400_000);
    const angle = FC_ANGLES[Math.floor(seed / FC_UNIVERSES.length) % FC_ANGLES.length];
    return angle[key as keyof typeof FC_ANGLES[number]];
  },
});

// ── S1 Insight — personal-development lens pool ───────────────────────────────
export type InsightDomain = "habits" | "learning" | "finance" | "career" | "relationships" | "health" | "reasoning" | "creativity";
export interface InsightLens {
  domain: InsightDomain;
  concept: string;
  source: string;
  angle: string;
}

const il = (domain: InsightDomain, concept: string, source: string, angle: string): InsightLens => ({ domain, concept, source, angle });

export const INSIGHT_LENSES: InsightLens[] = [
  // Habits
  il("habits", "Context shapes behavior more than willpower", "Wendy Wood / Good Habits Bad Habits", "Your environment is running most of your decisions without you noticing"),
  il("habits", "Reducing friction beats adding motivation", "BJ Fogg / Tiny Habits", "Make the right behavior the path of least resistance"),
  il("habits", "Cues trigger habits before the conscious mind notices", "Wendy Wood / Good Habits Bad Habits", "You're not choosing — you're responding to signals you designed"),
  il("habits", "Implementation intentions triple follow-through", "habit science", "'When X, I will do Y' is not a slogan — it's a neurological mechanism"),
  il("habits", "Immediate rewards wire habits; delayed rewards don't", "Wendy Wood / neuroscience", "The brain doesn't optimize for your long-term goals — it optimizes for right now"),
  il("habits", "Habit stacking: attach new behavior to an existing trigger", "BJ Fogg / Tiny Habits", "Leverage what already runs on autopilot"),
  il("habits", "Social context is the most powerful environmental cue", "Wendy Wood / Good Habits Bad Habits", "The people around you shape your behavior more than your values do"),
  il("habits", "Procrastination is a solvable equation, not a character flaw", "Piers Steel / The Procrastination Equation", "Expectancy × value ÷ impulsiveness × delay — adjust any variable"),
  // Learning
  il("learning", "Retrieval practice beats re-reading by a wide margin", "Brown, Roediger / Make It Stick", "Testing yourself is not assessment — it is the actual learning"),
  il("learning", "Spaced repetition: spacing beats cramming for long-term retention", "Brown, Roediger / Make It Stick", "The forgetting curve is a feature you can exploit"),
  il("learning", "Interleaving: mixing problem types builds real transfer", "Brown, Roediger / Make It Stick", "Blocked practice feels better and works worse — you're measuring fluency, not learning"),
  il("learning", "Desirable difficulty: struggling during learning makes it stick", "Brown, Roediger / Make It Stick", "Fluency is a false signal of mastery"),
  il("learning", "Deliberate practice requires focused work on weaknesses with feedback", "Anders Ericsson / Peak", "The hours only count if they're aimed at your current edge"),
  il("learning", "Mental representations: experts literally perceive the domain differently", "Anders Ericsson / Peak", "The goal of practice is to change how you see the problem"),
  il("learning", "Direct practice: train in the exact form you'll use the skill", "Scott Young / Ultralearning", "Transfer is weak — practice the real thing, not an approximation"),
  // Finance
  il("finance", "Behavior matters more than math in investing", "Morgan Housel / The Psychology of Money", "A lower return you can hold beats a higher one you panic-sell"),
  il("finance", "Reasonable beats rational: you need to sleep at night", "Morgan Housel / The Psychology of Money", "The theoretically optimal portfolio is useless if it causes you to bail at the bottom"),
  il("finance", "Time horizon determines almost everything", "Morgan Housel / Bogle", "Someone investing for 30 years and someone investing for 3 are playing entirely different games"),
  il("finance", "Compounding requires staying in the game", "John Bogle / The Little Book of Common Sense Investing", "The enemy of compounding is interruption — not bad picks"),
  il("finance", "Tail events dominate — a few decisions drive most outcomes", "Morgan Housel / The Psychology of Money", "You can be wrong most of the time and still win by a lot"),
  il("finance", "Define 'enough' in advance or the goalpost keeps moving", "Morgan Housel / The Psychology of Money", "Wealth without a finish line is a treadmill, not a destination"),
  il("finance", "Volatility is the price of admission, not a fine", "Morgan Housel / The Psychology of Money", "Treating it as a fine causes you to sell at exactly the wrong moment"),
  // Career
  il("career", "Career capital: build rare, valuable skills before seeking autonomy", "Cal Newport / So Good They Can't Ignore You", "'Follow your passion' gets the causality exactly backwards"),
  il("career", "Control requires career capital first — in that order", "Cal Newport / So Good They Can't Ignore You", "Autonomy without leverage leads to failure, not freedom"),
  il("career", "Mission emerges at the frontier of your field — not before you get there", "Cal Newport / So Good They Can't Ignore You", "You can't see the calling from the beginning"),
  il("career", "Working identity: try possible selves through actual projects", "Herminia Ibarra / Working Identity", "You don't think your way to a new career — you act your way there"),
  il("career", "Range: broad sampling early produces better long-term outcomes in most fields", "David Epstein / Range", "Early specialization is overrated outside of a narrow set of domains"),
  il("career", "Career experiments beat career plans", "Burnett & Evans / Designing Your Life", "Prototype a few futures before committing to one"),
  il("career", "Psychological capital — hope, efficacy, resilience, optimism — is trainable", "APA / career psychology research", "These are not personality traits you either have or don't"),
  // Relationships
  il("relationships", "The 5:1 ratio: positive-to-negative interactions predicts relationship stability", "John Gottman / The Seven Principles for Making Marriage Work", "It's not the presence of conflict that matters — it's the ratio around it"),
  il("relationships", "Repair is more important than not fighting", "John Gottman / The Seven Principles for Making Marriage Work", "Masters of relationships fight — they just recover faster"),
  il("relationships", "Turning toward bids for connection", "John Gottman / The Seven Principles for Making Marriage Work", "The small moments — not the grand gestures — determine the relationship"),
  il("relationships", "Relationship quality requires active investment, not passive compatibility", "Robert Waldinger / The Good Life", "The longest happiness study found relationships decay without deliberate attention"),
  il("relationships", "Responsive listening changes the speaker's nervous system", "Sue Johnson / Hold Me Tight", "Being heard is not just pleasant — it is physiologically regulating"),
  il("relationships", "Friendship requires intentional pursuit, not circumstance", "Marisa Franco / Platonic", "Adult friendship doesn't maintain itself the way childhood friendship did"),
  il("relationships", "Constructive conflict: express needs without contempt", "Gottman / Difficult Conversations", "Contempt is the single best predictor of relationship dissolution — not anger"),
  // Health
  il("health", "Movement is the single best available cognitive enhancer", "Daniel Lieberman / Exercised", "Exercise benefits the brain as much as the body — and the science is unambiguous"),
  il("health", "Sleep is the foundation everything else rests on", "W. Chris Winter / The Sleep Solution", "You cannot outwork or supplement your way past sleep deprivation"),
  il("health", "Stress appraisal: seeing stress as a challenge vs. a threat changes your physiology", "Kelly McGonigal / The Upside of Stress", "The story you tell about your stress affects your biology — measurably"),
  il("health", "Values-based action over mood-based action", "Russ Harris / The Happiness Trap", "Waiting to feel motivated before acting reverses the actual sequence"),
  il("health", "Self-compassion outperforms self-criticism for sustained performance", "Kristin Neff / Self-Compassion", "Harsh self-judgment is not a motivator — it's a brake disguised as a spur"),
  il("health", "Social connection is a direct predictor of physical health and longevity", "Robert Waldinger / The Good Life", "Loneliness is a health risk comparable to smoking — not a mood"),
  // Reasoning
  il("reasoning", "Scout mindset: the goal is to see clearly, not to be right", "Julia Galef / The Scout Mindset", "Motivated reasoning feels exactly like thinking — that's what makes it dangerous"),
  il("reasoning", "Separating your identity from your conclusions", "Julia Galef / The Scout Mindset", "When beliefs become identity, updating them feels like self-destruction"),
  il("reasoning", "All decisions are made under uncertainty — the question is how you manage it", "Annie Duke / Thinking in Bets", "The quality of a decision cannot be judged by its outcome"),
  il("reasoning", "Base rates: the population matters more than the vivid story", "David Spiegelhalter / The Art of Statistics", "A compelling anecdote bypasses your statistical judgment every time"),
  il("reasoning", "Correlation vs. causation — and why narrative feels more real than data", "David Spiegelhalter / The Art of Statistics", "The brain runs on stories; stories systematically mislead about cause"),
  il("reasoning", "Cognitive bias is an error in the heuristic, not a character flaw", "Kahneman / Thaler / behavioral economics", "Understanding the mechanism lets you build systems around it"),
  // Creativity
  il("creativity", "Attention is the raw material of creative work", "Rick Rubin / The Creative Act", "You can't create what you haven't first noticed"),
  il("creativity", "Quantity before quality: generate many before selecting", "creativity research / Originals", "Judgment too early kills the best ideas before they have a chance to form"),
  il("creativity", "Incubation: alternating focused work and rest produces insight", "creativity research", "The shower insight is real — it's what happens after sustained hard effort"),
  il("creativity", "Domain depth is the prerequisite for creative leaps", "creativity research / Annual Reviews", "Novelty in a field requires knowing the field deeply first"),
  il("creativity", "Psychological safety is the organizational prerequisite for creative risk", "Ed Catmull / Creativity Inc.", "Ideas are fragile; the team has to be safe enough to surface them"),
  il("creativity", "Intrinsic motivation protects creative quality", "creativity research / Csikszentmihalyi", "External rewards narrow the search space — usually in the least interesting direction"),
];

export const INSIGHT_LENS: InsightLens = new Proxy({} as InsightLens, {
  get(_, key) {
    const seed = _editionKeyHash > 0 ? _editionKeyHash : Math.floor(Date.now() / 14_400_000);
    const lens = INSIGHT_LENSES[(seed * 7 + 13) % INSIGHT_LENSES.length];
    return lens[key as keyof InsightLens];
  },
});

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

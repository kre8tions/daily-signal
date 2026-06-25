import Anthropic from "@anthropic-ai/sdk";
import Parser from "rss-parser";
import { unstable_cache } from "next/cache";
import { cacheGet, cacheSet } from "@/lib/cache";

const parser = new Parser({
  customFields: { item: ["media:content", "media:thumbnail", "enclosure"] },
});

// ── Types ─────────────────────────────────────────────────────────────────────
export interface RawItem {
  title: string; content: string; source: string;
  section: string; link: string; pubDate: string;
  rssImageUrl?: string;
}

export interface Story {
  title: string; source: string; section: string; link: string; pubDate: string;
  imageUrl?: string; summary?: string; bullets?: string[];
  pullquote?: string; insight?: string; cardStyle: "full" | "pullquote" | "brief";
}

export interface Synthesis {
  theme: string; observation: string; takeaways: string[]; conclusion: string; actions: string[];
}

export interface PageData {
  stories: Story[]; synthesis: Synthesis; editionLabel: string;
}

// ── Slug helpers ──────────────────────────────────────────────────────────────
export function urlToSlug(url: string): string {
  return Buffer.from(url).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function slugToUrl(slug: string): string {
  const padded = slug.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  const b64 = pad ? padded + "=".repeat(4 - pad) : padded;
  return Buffer.from(b64, "base64").toString("utf8");
}

// ── HTML entity decode ────────────────────────────────────────────────────────
function decodeEntities(str: string): string {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&nbsp;/g, " ");
}

// ── Topic deduplication ───────────────────────────────────────────────────────
const STOP = new Set(["the","and","for","that","with","this","from","are","its","was","have","been","will","about","into","than","more","after","over","when","they","their","which","what","how","new","says","said","has","but","can","not","you","all","one","our","out","get","day","now"]);

function keywords(title: string): string[] {
  return title.toLowerCase().replace(/[^a-z ]/g, " ").split(/\s+/).filter(w => w.length > 3 && !STOP.has(w));
}

const DEAL_RE = /\b(prime\s*day|amazon\s*deal|amazon\s*prime|best\s*deal|prime\s*sale|deals?\s+you\s+can|deals?\s+we\s+found|guide\s+to\s+(amazon|prime)|prime\s+day\s+(deal|sale|pick|find|gear|offer))\b/i;

function dedupeByTopic(items: RawItem[]): RawItem[] {
  const seen: string[][] = [];
  // Hard cap: max 1 deal article per edition
  let dealCount = 0;
  return items.filter(item => {
    if (DEAL_RE.test(item.title) || DEAL_RE.test(item.content)) {
      dealCount++;
      if (dealCount > 1) return false;
    }
    const words = keywords(item.title);
    const isDupe = seen.some(prev => words.filter(w => prev.includes(w)).length >= 2);
    if (!isDupe) seen.push(words);
    return !isDupe;
  });
}

// ── Feeds (expanded) ──────────────────────────────────────────────────────────
export const FEEDS = [
  { url: "https://www.theverge.com/rss/index.xml",                      source: "The Verge",       section: "Technology"    },
  { url: "https://feeds.arstechnica.com/arstechnica/index",             source: "Ars Technica",    section: "Technology"    },
  { url: "https://www.wired.com/feed/rss",                              source: "Wired",           section: "Technology"    },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml", source: "NY Times",        section: "Technology"    },
  { url: "https://www.technologyreview.com/feed/",                      source: "MIT Tech Review", section: "Technology"    },
  { url: "https://deadline.com/feed/",                                  source: "Deadline",        section: "Entertainment" },
  { url: "https://variety.com/feed/",                                   source: "Variety",         section: "Entertainment" },
  { url: "https://vulture.com/rss/all.xml",                             source: "Vulture",         section: "Entertainment" },
  { url: "https://www.theguardian.com/culture/rss",                     source: "Guardian",        section: "Culture"       },
  { url: "https://www.theatlantic.com/feed/all/",                       source: "The Atlantic",    section: "Culture"       },
  { url: "https://www.theguardian.com/music/rss",                       source: "Guardian",        section: "Music"         },
  { url: "https://pitchfork.com/rss/news/feed.xml",                     source: "Pitchfork",       section: "Music"         },
  { url: "https://hyperallergic.com/feed/",                             source: "Hyperallergic",   section: "Arts"          },
  { url: "https://www.theguardian.com/science/rss",                     source: "Guardian",        section: "Science"       },
  { url: "https://feeds.npr.org/1001/rss.xml",                          source: "NPR",             section: "World"         },
];

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
const ONE_HOUR   =      60 * 60 * 1000;

// ── Edition windows (5 per day, ~4 hrs each) ─────────────────────────────────
export function getEdition(): { label: string; key: string } {
  const h = new Date().getHours();
  const date = new Date().toISOString().slice(0, 10);
  if (h >= 5  && h < 9)  return { label: "Early Morning Edition", key: `${date}_early`    };
  if (h >= 9  && h < 13) return { label: "Morning Edition",       key: `${date}_morning`  };
  if (h >= 13 && h < 17) return { label: "Afternoon Edition",     key: `${date}_afternoon`};
  if (h >= 17 && h < 21) return { label: "Evening Edition",       key: `${date}_evening`  };
  return                         { label: "Night Edition",         key: `${date}_night`    };
}

// ── RSS media extraction ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractRssImage(item: any): string | undefined {
  const mc = item["media:content"];
  if (mc) {
    if (typeof mc === "string" && mc.startsWith("http")) return mc;
    if (mc?.$ && mc.$.url) return mc.$.url as string;
    if (Array.isArray(mc) && mc[0]?.$.url) return mc[0].$.url as string;
  }
  const mt = item["media:thumbnail"];
  if (mt) {
    if (typeof mt === "string" && mt.startsWith("http")) return mt;
    if (mt?.$ && mt.$.url) return mt.$.url as string;
  }
  const enc = item.enclosure;
  if (enc?.url && /\.(jpg|jpeg|png|webp)/i.test(enc.url)) return enc.url as string;
  return undefined;
}

// ── OG scrape (3s timeout) ────────────────────────────────────────────────────
async function scrapeOgImage(url: string): Promise<string | undefined> {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; DailySignalBot/1.0)" },
    });
    clearTimeout(tid);
    if (!res.ok) return undefined;
    const html = await res.text();
    const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
           ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const imgUrl = m?.[1];
    if (!imgUrl) return undefined;
    if (/bbci\.co\.uk|placeholder|logo|icon|favicon/i.test(imgUrl)) return undefined;
    return imgUrl;
  } catch { return undefined; }
}

// ── Unsplash fallback ─────────────────────────────────────────────────────────
export async function fetchUnsplash(headline: string): Promise<string | undefined> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return undefined;
  const words = headline.replace(/[^a-zA-Z ]/g, "").split(" ").filter((w) => w.length > 3);
  for (const q of [words.slice(0, 2).join(" "), words[0], "news culture technology"]) {
    if (!q) continue;
    try {
      // Use search (not random) so the same query always returns the same top result
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&orientation=landscape&per_page=1&client_id=${key}`,
        { cache: "no-store" }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const url = data?.results?.[0]?.urls?.regular;
      if (url) return url as string;
    } catch { continue; }
  }
  return undefined;
}

function imgCacheKey(link: string) {
  return `artimg_${Buffer.from(link).toString("base64").slice(0, 24).replace(/[^a-z0-9]/gi, "_")}`;
}

async function getArticleImage(article: { link: string; title: string; rssImageUrl?: string }): Promise<string | undefined> {
  const cKey = imgCacheKey(article.link);
  const hit = cacheGet<string>(cKey);
  if (hit) return hit === "__none__" ? undefined : hit;

  if (article.rssImageUrl && !/placeholder|logo|icon|watermark|bbci\.co\.uk/i.test(article.rssImageUrl)) {
    cacheSet(cKey, article.rssImageUrl, THREE_DAYS);
    return article.rssImageUrl;
  }
  const og = await scrapeOgImage(article.link);
  if (og) { cacheSet(cKey, og, THREE_DAYS); return og; }
  const unsplash = await fetchUnsplash(article.title);
  if (unsplash) { cacheSet(cKey, unsplash, THREE_DAYS); return unsplash; }
  cacheSet(cKey, "__none__", ONE_HOUR);
  return undefined;
}

export async function getUniqueImages(articles: RawItem[]): Promise<(string | undefined)[]> {
  const raw = await Promise.all(articles.map((a) => getArticleImage(a)));
  const seen = new Set<string>();
  const result: (string | undefined)[] = [];
  for (let i = 0; i < raw.length; i++) {
    const url = raw[i];
    if (!url || !seen.has(url)) {
      if (url) seen.add(url);
      result.push(url);
    } else {
      const cKey = imgCacheKey(articles[i].link);
      cacheSet(cKey, "__none__", 1);
      const fresh = await fetchUnsplash(articles[i].title + " " + articles[i].section);
      if (fresh && !seen.has(fresh)) {
        seen.add(fresh);
        cacheSet(cKey, fresh, THREE_DAYS);
        result.push(fresh);
      } else {
        result.push(undefined);
      }
    }
  }
  return result;
}

// ── RSS fetch with section quotas ─────────────────────────────────────────────
export async function fetchTopStories(editionKey: string): Promise<RawItem[]> {
  const key = `raw_${editionKey}`;
  const hit = cacheGet<RawItem[]>(key);
  if (hit) return hit;

  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const timeout = new Promise<never>((_, r) => setTimeout(() => r(new Error("t")), 8000));
      const parsed = await Promise.race([parser.parseURL(feed.url), timeout]);
      return parsed.items.slice(0, 3).map((item) => ({
        title: decodeEntities(item.title ?? ""), content: decodeEntities(item.contentSnippet ?? ""),
        source: feed.source, section: feed.section,
        link: item.link ?? "", pubDate: item.pubDate ?? new Date().toISOString(),
        rssImageUrl: extractRssImage(item),
      }));
    })
  );

  const all = dedupeByTopic(results.flatMap((r) => r.status === "fulfilled" ? r.value : []));
  const ARTS = ["Entertainment", "Arts", "Culture", "Music"];
  const tech: RawItem[] = [], arts: RawItem[] = [], other: RawItem[] = [];
  for (const item of all) {
    if (item.section === "Technology") tech.push(item);
    else if (ARTS.includes(item.section)) arts.push(item);
    else other.push(item);
  }
  const pool = [...tech.slice(0, 3), ...arts.slice(0, 4), ...other.slice(0, 2)].slice(0, 9);
  // Deal articles must never be S1–S6; push them to the end (S7–S9)
  const deals = pool.filter(s => DEAL_RE.test(s.title) || DEAL_RE.test(s.content));
  const nonDeals = pool.filter(s => !DEAL_RE.test(s.title) && !DEAL_RE.test(s.content));
  const selected = [...nonDeals, ...deals];
  cacheSet(key, selected, 8 * ONE_HOUR);
  return selected;
}

// ── Claude analysis + synthesis ───────────────────────────────────────────────
type RawAnalysis = { style?: string; summary?: string; bullets?: string[]; pullquote?: string; insight?: string };
type AnalyzeResult = { stories: RawAnalysis[]; synthesis: Synthesis };

export async function analyzeAll(items: RawItem[], editionKey: string): Promise<AnalyzeResult> {
  const key = `analysis_${editionKey}`;
  const hit = cacheGet<AnalyzeResult>(key);
  if (hit) return hit;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const styles = ["full", "pullquote", "brief", "brief", "brief", "brief", "brief", "brief", "brief"];
  const list = items.map((a, i) =>
    `[${i}] ${a.section.toUpperCase()} — ${a.source}: ${a.title}\n${a.content.slice(0, 400)}`
  ).join("\n\n");

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 5000,
    messages: [{
      role: "user",
      content: `You are a sharp, opinionated editor covering tech, arts, music, and culture. Your perspective is centrist and intellectually honest — you challenge assumptions from all sides, give credit where it's due regardless of political tribe, and never moralize or signal virtue. You are equally skeptical of corporate power, government overreach, activist excess, and reactionary nostalgia.

RULES:
- Never restate the headline. Be specific, find non-obvious angles.
- NEVER open with "Today's", "This collection", "These stories". Jump straight into the insight.
- Write in first-person editorial voice — opinions, interpretations, predictions.
- Do not frame stories through an ideological lens. Avoid language that signals left or right allegiance.
- When covering tech or culture, prioritize practical impact over social commentary.

${list}

Return JSON with two keys:

"stories": ${items.length} objects. Styles: ${styles.map((s, i) => `[${i}]="${s}"`).join(", ")}
- "full"      → { "style":"full", "summary":"2 punchy sentences", "bullets":["3 specific facts ≤15 words"] }
- "pullquote" → { "style":"pullquote", "summary":"2 direct sentences", "pullquote":"one striking sentence" }
- "brief"     → { "style":"brief", "summary":"2-3 sentences with real context and stakes", "insight":"why this matters — non-obvious, one sentence" }

"synthesis": {
  "theme": "One evocative noun phrase naming the underlying force or tension",
  "observation": "2-3 sentences of direct editorial interpretation. Name the pattern, irony, or contradiction. Be opinionated. Never count or reference how many articles or stories are covered.",
  "takeaways": [
    "Non-obvious connection between at least two stories — name the mechanism (1-2 sentences)",
    "The deeper structural tension or irony (1-2 sentences)",
    "Concrete prediction or implication — where this leads, who benefits, what breaks (1-2 sentences)"
  ],
  "conclusion": "One sharp opinionated sentence. Do not start with 'Today'.",
  "actions": [
    "A specific, concrete action a creative professional (writer, designer, filmmaker, entrepreneur) can take TODAY based on what these stories reveal — make it tactical, not vague",
    "A second distinct action — different domain or angle from the first",
    "A third bold move — the contrarian or unexpected play that most people won't make"
  ]
}

Return only valid JSON, no markdown.`,
    }],
  });

  const raw = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const parsed: AnalyzeResult = JSON.parse(text);
    cacheSet(key, parsed, 8 * ONE_HOUR);
    return parsed;
  } catch {
    return {
      stories: items.map((_, i) => ({ style: styles[i] })),
      synthesis: { theme: "", observation: "", takeaways: [], conclusion: "" },
    };
  }
}

// ── Assemble page data (cached per edition via Next.js data cache) ────────────
async function buildPageData(editionKey: string, editionLabel: string): Promise<PageData> {
  const raw = await fetchTopStories(editionKey);
  const [result, images] = await Promise.all([
    analyzeAll(raw, editionKey),
    getUniqueImages(raw),
  ]);
  const { stories: analyses, synthesis } = result;
  const stories: Story[] = raw.map((r, i) => ({
    ...r, imageUrl: images[i],
    cardStyle: ((analyses[i]?.style ?? "brief") as Story["cardStyle"]),
    summary: analyses[i]?.summary, bullets: analyses[i]?.bullets,
    pullquote: analyses[i]?.pullquote, insight: analyses[i]?.insight,
  }));
  const pageData: PageData = { stories, synthesis, editionLabel };
  // Also save to file-based archive for /archive page
  cacheSet(`edition_${editionKey}`, pageData, SEVEN_DAYS);
  saveToArchive({ key: editionKey, label: editionLabel, date: editionKey.split("_")[0], theme: synthesis.theme, imageUrl: stories[0]?.imageUrl });
  return pageData;
}

export async function getPageData(): Promise<PageData> {
  const { label: editionLabel, key: editionKey } = getEdition();
  // unstable_cache keys by [editionKey] — same edition window always returns the same data
  // and Next.js persists this in .next/cache across serverless invocations
  return unstable_cache(
    () => buildPageData(editionKey, editionLabel),
    [editionKey],
    { revalidate: 28800, tags: [`edition-${editionKey}`] }
  )();
}

// ── Single story for article detail page ─────────────────────────────────────
export async function getStoryBySlug(slug: string): Promise<Story | null> {
  const url = slugToUrl(slug);
  const { stories } = await getPageData();
  return stories.find((s) => s.link === url) ?? null;
}

// ── Full editorial rewrite for article detail ─────────────────────────────────
export async function getFullArticle(story: Story, relatedStories: Story[]): Promise<string> {
  const cKey = `full_${Buffer.from(story.link).toString("base64").slice(0, 28).replace(/[^a-z0-9]/gi, "_")}`;
  const hit = cacheGet<string>(cKey);
  if (hit) return hit;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const related = relatedStories.filter((s) => s.link !== story.link).slice(0, 5);
  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [{
      role: "user",
      content: `You are a deeply curious editor-at-large with a centrist, intellectually honest perspective. A story lands on your desk. Your job: write 200-350 words of sharp, conversational commentary — not a summary, not a rewrite. Think out loud about what it actually means. Challenge assumptions from all sides. Avoid ideological framing, virtue signaling, or moralizing. Be equally skeptical of institutional power, activist narratives, and reactionary takes. Focus on what's real, what's at stake, and who actually benefits or loses.

Use EXACTLY ONE reference from the list of domains below. Pick the one that creates the most genuine, surprising insight. Name it specifically. One sentence of connection, then move on — don't dwell or lecture. If nothing fits naturally, skip it entirely rather than force it.

REFERENCE POOL — draw from anywhere in this space, the more unexpected the better:
- Philosophy & ethics: Aristotle to Žižek, Stoics, existentialists, Frankfurt School, Wittgenstein's language games, Rawls' veil of ignorance, Parfit on identity, Nagel's "What Is It Like to Be a Bat?", Simone Weil, Fanon, Iris Murdoch, Derek Parfit, Peter Singer, Judith Butler
- Science & math: chaos theory, Gödel's incompleteness, Turing's halting problem, entropy, emergence, punctuated equilibrium, evolutionary game theory, Dunbar's number, the Copernican principle, Fermi estimation, Bayes theorem, Nash equilibria, Mandelbrot sets, Heisenberg uncertainty, epigenetics, the overview effect, Planck length, the fine-tuning problem
- Psychology & behavior: Kahneman's System 1/2, Milgram obedience, Stanford Prison Experiment, cognitive dissonance, terror management theory, Maslow's hierarchy, the Dunning-Kruger effect, availability heuristic, sunk cost fallacy, learned helplessness, identity-protective cognition, Csikszentmihalyi's flow, attachment theory, moral licensing
- Media & technology theory: McLuhan's hot/cool media, Baudrillard's simulacra, Postman's Technopoly, Ellul on technique, Winner's "Do Artifacts Have Politics?", filter bubbles, Goodhart's Law, Metcalfe's Law, Jevons paradox, Conway's Law, the Lindy effect, Streisand effect, perverse incentives
- History & sociology: Toynbee's challenge-response, the Overton window, Schumpeter's creative destruction, Tocqueville on soft despotism, Gramsci's cultural hegemony, Bourdieu's cultural capital, the Shirky principle, moral panics (Stanley Cohen), civilizational cycles, the Great Man theory and its critics
- Art, literature & culture: Chekhov's gun, the uncanny valley, the sublime (Burke/Kant), kitsch (Clement Greenberg), Benjamin's aura, the Hero's Journey (Campbell), Northrop Frye's archetypes, Roland Barthes on myth, Susan Sontag on photography, Umberto Eco on semiotics, Italo Calvino, DFW on irony, specific album/film/novel moments
- Pop culture & internet: specific memes with cultural weight, Black Mirror episodes as shorthand, The Truman Show effect, Jurassic Park's "life finds a way", specific Simpsons moments, the Ship of Theseus thought experiment via pop culture, Goodfellas tracking shot as metaphor, the Overton window in practice
- Economics & systems: rent-seeking, principal-agent problems, Coase theorem, Veblen goods, the knowledge problem (Hayek), Mancur Olson on collective action, broken windows theory, the cobra effect, Gresham's Law, regulatory capture, network effects, path dependency
- Notable studies & findings: the Framingham Heart Study's social contagion findings, Harlow's attachment monkeys, Rosenhan's psychiatric ward experiment, the Asch conformity experiments, the Flynn effect, the replication crisis itself as a data point, specific CRISPR breakthroughs, the Pale Blue Dot photo

Speak directly. One or two paragraphs max. End with a sharp question or a provocation if it lands naturally.

STORY: ${story.title}
SOURCE: ${story.source}
SECTION: ${story.section}
SUMMARY: ${story.summary ?? ""}
KEY FACTS: ${story.bullets?.join(". ") ?? ""}
INSIGHT: ${story.insight ?? ""}

TODAY'S OTHER STORIES (mention one only if the parallel is genuinely striking):
${related.map((s) => `- ${s.title} (${s.section})`).join("\n")}

Return only the commentary. No title, no byline, no headers. 200-350 words, flowing paragraphs.`,
    }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
  cacheSet(cKey, text, 8 * ONE_HOUR);
  return text;
}

// ── Archive ───────────────────────────────────────────────────────────────────
export interface ArchiveEntry { key: string; label: string; date: string; theme: string; imageUrl?: string }
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

export function saveToArchive(entry: ArchiveEntry) {
  const list = cacheGet<ArchiveEntry[]>("archive_index") ?? [];
  if (!list.find((e) => e.key === entry.key)) {
    list.unshift(entry);
    if (list.length > 42) list.pop();
    cacheSet("archive_index", list, SEVEN_DAYS);
  }
}

export function getArchiveList(): ArchiveEntry[] {
  return cacheGet<ArchiveEntry[]>("archive_index") ?? [];
}

export async function getArchivedPageData(key: string): Promise<PageData | null> {
  return cacheGet<PageData>(`edition_${key}`) ?? null;
}

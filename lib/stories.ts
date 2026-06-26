import Anthropic from "@anthropic-ai/sdk";
import Parser from "rss-parser";
import { unstable_cache } from "next/cache";
import { cacheGet, cacheSet } from "@/lib/cache";
import { put, head, list } from "@vercel/blob";
import { createHash } from "crypto";

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
  featureCreature?: FeatureCreature;
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
const NEGATIVE_RE = /\b(dead|dies|died|has died|passed away|obituary|killed|murder|shooting|stabbing|suicide|overdose|crash|disaster|flood|hurricane|wildfire|war|invasion|bombing|terror|massacre|genocide|hostage|famine|pandemic|outbreak|epidemic|recession|collapse|bankruptcy|scandal|indicted|arrested|convicted|sentenced)\b/i;
const POLITICS_RE = /\b(trump|biden|congress|senate|democrat|republican|gop|election|ballot|white\s*house|oval\s*office|legislation|filibuster|partisan|maga|progressive\s+primary|political\s+party|campaign\s+trail|tariff|fcc\s+(chair|commission)|federal\s+reserve\s+chair)\b/i;

function isSundayEarlyMorning(): boolean {
  const now = new Date();
  return now.getDay() === 0 && now.getHours() >= 5 && now.getHours() < 9;
}
function isWednesdayMorning(): boolean {
  const now = new Date();
  return now.getDay() === 3 && now.getHours() >= 9 && now.getHours() < 13;
}

function dedupeByTopic(items: RawItem[]): RawItem[] {
  const seen: string[][] = [];
  const allowDeals = isWednesdayMorning();
  const allowPolitics = isSundayEarlyMorning();
  // Hard cap: max 1 deal article, only on Wednesday morning
  let dealCount = 0;
  // Hard cap: max 1 politics article, only on Sunday early morning
  let politicsCount = 0;
  return items.filter(item => {
    if (DEAL_RE.test(item.title) || DEAL_RE.test(item.content)) {
      if (!allowDeals) return false;
      dealCount++;
      if (dealCount > 1) return false;
    }
    if (POLITICS_RE.test(item.title) || POLITICS_RE.test(item.content)) {
      if (!allowPolitics) return false;
      politicsCount++;
      if (politicsCount > 1) return false;
    }
    const words = keywords(item.title);
    const isDupe = seen.some(prev => words.filter(w => prev.includes(w)).length >= 1);
    if (!isDupe) seen.push(words);
    return !isDupe;
  });
}

// ── Feeds (expanded) ──────────────────────────────────────────────────────────
export const FEEDS = [
  // Technology — emerging tech, innovation, futurism (no policy)
  { url: "https://www.theverge.com/rss/index.xml",                          source: "The Verge",           section: "Technology"    },
  { url: "https://feeds.arstechnica.com/arstechnica/index",                 source: "Ars Technica",        section: "Technology"    },
  { url: "https://www.wired.com/feed/rss",                                  source: "Wired",               section: "Technology"    },
  { url: "https://techcrunch.com/feed/",                                    source: "TechCrunch",          section: "Technology"    },
  { url: "https://www.technologyreview.com/feed/",                          source: "MIT Tech Review",     section: "Technology"    },
  { url: "https://singularityhub.com/feed/",                                source: "Singularity Hub",     section: "Technology"    },
  { url: "https://www.fastcompany.com/technology/rss",                      source: "Fast Company",        section: "Technology"    },
  // Science — pop science, discovery, wonder
  { url: "https://nautil.us/feed/",                                         source: "Nautilus",            section: "Science"       },
  { url: "https://www.quantamagazine.org/feed/",                            source: "Quanta Magazine",     section: "Science"       },
  { url: "https://www.popsci.com/feed/",                                    source: "Popular Science",     section: "Science"       },
  { url: "https://www.wired.com/feed/category/science/latest/rss",          source: "Wired Science",       section: "Science"       },
  { url: "https://feeds.npr.org/1019/rss.xml",                              source: "NPR Science",         section: "Science"       },
  // Culture — ideas, society, creative thinking
  { url: "https://www.theguardian.com/culture/rss",                         source: "Guardian",            section: "Culture"       },
  { url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",    source: "BBC",                 section: "Culture"       },
  // Film — cinema, storytelling, directors
  { url: "https://www.indiewire.com/feed/",                                 source: "IndieWire",           section: "Film"          },
  { url: "https://www.theguardian.com/film/rss",                            source: "Guardian Film",       section: "Film"          },
  { url: "https://www.rogerebert.com/feed",                                 source: "RogerEbert.com",      section: "Film"          },
  // Entertainment — music, TV, pop culture
  { url: "https://variety.com/feed/",                                       source: "Variety",             section: "Entertainment" },
  { url: "https://deadline.com/feed/",                                      source: "Deadline",            section: "Entertainment" },
  { url: "https://www.avclub.com/rss",                                      source: "A.V. Club",           section: "Entertainment" },
  { url: "https://pitchfork.com/rss/news/",                                 source: "Pitchfork",           section: "Entertainment" },
  // Arts — visual art, design, creativity
  { url: "https://www.theguardian.com/artanddesign/rss",                    source: "Guardian Arts",       section: "Arts"          },
  { url: "https://hyperallergic.com/feed/",                                 source: "Hyperallergic",       section: "Arts"          },
  { url: "https://www.dezeen.com/feed/",                                    source: "Dezeen",              section: "Arts"          },
  { url: "https://www.thisiscolossal.com/feed/",                            source: "Colossal",            section: "Arts"          },
  { url: "https://news.artnet.com/feed/",                                   source: "Artnet News",         section: "Arts"          },
  // Faith — Sunday early morning only (filtered below)
  { url: "https://feeds.feedburner.com/AeonIdeas",                          source: "Aeon",                section: "Faith"         },
  { url: "https://www.patheos.com/blogs/religionprof/feed",                 source: "Patheos",             section: "Faith"         },
];

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
const ONE_HOUR   =      60 * 60 * 1000;
const SEVEN_DAYS = 7 * 24 * ONE_HOUR;

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
// Common first names that alone produce irrelevant image searches
const NAME_RE = /^(coco|gauff|lebron|elon|trump|biden|taylor|swift|bezos|musk|zuck|serena|oprah|drake|kanye|adele|rihanna|beyonce|kendall|kim|kylie|jeff|tim|mark|lisa|john|james|mike|david|sarah|emma|anna|maria|carlos|alex|chris|ryan|kate|amy|paul|peter|joe|bob|dan|tom|brad|leo|will|sam|max|ben|jack|eric|scott|adam|nick|jake|noah|matt|luke|owen|ethan|liam|tyler|jason|aaron|brian|kevin|sean|gary|frank|tony|henry)$/i;
// Words that produce morbid/wrong images when used as search queries
const MORBID_RE = /^(dead|dies|died|death|killed|kill|murder|murdered|shooting|stabbed|crash|crashes|fatal|fatally|suicide|overdose|cancer|disease|illness|sick|hospital|obituary|obit|funeral|buried|burial|skeleton|corpse|victim|victims|massacre|genocide|tragedy|tragic|devastat)$/i;
// Detect obituary headlines
const OBIT_RE = /\b(dead|dies|died|has died|passed away|obituary|obit|in memoriam)\b/i;

export async function fetchUnsplash(headline: string, section?: string, page = 1): Promise<string | undefined> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return undefined;

  const isObit = OBIT_RE.test(headline);

  // Extract meaningful content words — skip short words, known names, and morbid terms
  const words = headline.replace(/[^a-zA-Z ]/g, " ").split(/\s+/)
    .filter((w) => w.length > 3 && !NAME_RE.test(w) && !MORBID_RE.test(w));

  // For obituaries, try to extract the person's full name (words before "dead"/"dies")
  // e.g. "Ann Blyth Dead" → "Ann Blyth"
  let personQuery: string | undefined;
  if (isObit) {
    const nameMatch = headline.match(/^([A-Z][a-z]+(?: [A-Z][a-z']+)+)/);
    if (nameMatch) personQuery = nameMatch[1];
  }

  // Section-based safe fallback queries that always produce relevant images
  const sectionFallback: Record<string, string> = {
    Technology: "futuristic technology innovation",
    Science: "science discovery universe",
    Culture: "culture creative ideas",
    Film: "cinema film director",
    Entertainment: "music concert stage performance",
    Arts: "art design studio gallery",
    Faith: "light candle meditation spiritual",
  };
  const fallback = isObit
    ? "portrait tribute memorial flowers"
    : (section && sectionFallback[section]) ?? "news media editorial";

  const queries = [
    ...(personQuery ? [personQuery, `${personQuery} portrait`] : []),
    words.slice(0, 3).join(" "),
    words.slice(0, 2).join(" "),
    fallback,
  ].filter(Boolean);

  for (const q of queries) {
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&orientation=landscape&per_page=${page}&page=1&client_id=${key}`,
        { cache: "no-store" }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const results = data?.results ?? [];
      const url = (results[results.length - 1] ?? results[0])?.urls?.regular;
      if (url) return url as string;
    } catch { continue; }
  }
  return undefined;
}

function imgCacheKey(link: string) {
  return `artimg_v3_${Buffer.from(link).toString("base64").slice(0, 24).replace(/[^a-z0-9]/gi, "_")}`;
}

async function getArticleImage(article: { link: string; title: string; section?: string; rssImageUrl?: string }): Promise<string | undefined> {
  const cKey = imgCacheKey(article.link);
  const hit = cacheGet<string>(cKey);
  if (hit) return hit === "__none__" ? undefined : hit;

  if (article.rssImageUrl && !/placeholder|logo|icon|watermark|bbci\.co\.uk/i.test(article.rssImageUrl)) {
    cacheSet(cKey, article.rssImageUrl, THREE_DAYS);
    return article.rssImageUrl;
  }
  const og = await scrapeOgImage(article.link);
  if (og) { cacheSet(cKey, og, THREE_DAYS); return og; }
  const unsplash = await fetchUnsplash(article.title, article.section);
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
  const key = `raw2_${editionKey}`;
  const hit = cacheGet<RawItem[]>(key);
  if (hit) return hit;

  const activeFeeds = FEEDS.filter(f => f.section !== "Faith" || isSundayEarlyMorning());
  const results = await Promise.allSettled(
    activeFeeds.map(async (feed) => {
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
  const CREATIVE = ["Entertainment", "Arts", "Culture", "Film", "Faith"];
  const tech: RawItem[] = [], creative: RawItem[] = [], science: RawItem[] = [];
  for (const item of all) {
    if (item.section === "Technology") tech.push(item);
    else if (item.section === "Science") science.push(item);
    else if (CREATIVE.includes(item.section)) creative.push(item);
  }
  // Interleave science and creative so s1/s2 are never the same section; tech fills the tail
  const sci = science.slice(0, 3), cre = creative.slice(0, 5), tec = tech.slice(0, 3);
  const pool = [sci[0], cre[0], sci[1], cre[1], cre[2], sci[2], cre[3], cre[4], tec[0], tec[1], tec[2]].filter(Boolean);
  // Deals and negative/dark stories must never appear in S1–S3; push them toward the end
  const isNeg = (s: RawItem) => NEGATIVE_RE.test(s.title) || DEAL_RE.test(s.title) || DEAL_RE.test(s.content);
  const negative = pool.filter(isNeg);
  const positive = pool.filter(s => !isNeg(s));
  const selected = [...positive, ...negative];
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
  const styles = ["full", "pullquote", "brief", "brief", "brief", "brief", "brief", "brief", "brief", "brief", "brief"];
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
  "observation": "STRUCTURE REQUIRED: Write the first sentence as a standalone hook. Then insert \\n\\n. Then write 1-2 follow-up sentences that deepen it. Example format: 'Capital is fleeing hardware.\\n\\nThe pattern is clear: wherever supply chains constrain growth, money moves to narrative and IP instead.' Never count or reference how many articles or stories are covered.",
  "takeaways": [
    "Non-obvious connection between at least two stories — name the mechanism. 1 sentence, 2 max.",
    "The deeper structural tension or irony. 1 sentence, 2 max.",
    "Concrete prediction or implication — where this leads, who benefits, what breaks. 1 sentence, 2 max."
  ],
  "conclusion": "One sharp opinionated sentence. Do not start with 'Today'.",
  "actions": [
    "One sharp sentence. A beginner-friendly action a first-time creator or early achiever can do today — specific, doable, no experience needed. Max 20 words.",
    "One sharp sentence. A different angle — something small and low-risk a newcomer can try this week. Max 20 words.",
    "One sharp sentence. The simplest possible first step someone just starting out would actually take. Max 20 words."
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
      synthesis: { theme: "", observation: "", takeaways: [], conclusion: "", actions: [] },
    };
  }
}

// ── Assemble page data (cached per edition via Next.js data cache) ────────────
async function buildPageData(editionKey: string, editionLabel: string): Promise<PageData> {
  const raw = await fetchTopStories(editionKey);
  const [result, images, featureCreature] = await Promise.all([
    analyzeAll(raw, editionKey),
    getUniqueImages(raw),
    getFeatureCreature(editionKey),
  ]);
  const { stories: analyses, synthesis } = result;
  const stories: Story[] = raw.map((r, i) => ({
    ...r, imageUrl: images[i],
    cardStyle: ((analyses[i]?.style ?? "brief") as Story["cardStyle"]),
    summary: analyses[i]?.summary, bullets: analyses[i]?.bullets,
    pullquote: analyses[i]?.pullquote, insight: analyses[i]?.insight,
  }));
  const pageData: PageData = { stories, synthesis, editionLabel, featureCreature: featureCreature ?? undefined };
  cacheSet(`edition_${editionKey}`, pageData, SEVEN_DAYS);
  // Save edition data to Blob for persistent archive
  put(`archive/editions/${editionKey}.json`, JSON.stringify(pageData), {
    access: "public", contentType: "application/json", addRandomSuffix: false,
  }).catch(() => {});
  saveToArchive({ key: editionKey, label: editionLabel, date: editionKey.split("_")[0], theme: synthesis.theme, imageUrl: stories[0]?.imageUrl }).catch(() => {});
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

// ── How-to article generation ─────────────────────────────────────────────────
export interface HowTo {
  title: string;
  steps: { heading: string; instruction: string }[];
  why: string;
}

export function actionSlug(action: string): string {
  return createHash("md5").update(action).digest("hex").slice(0, 16);
}

export async function getHowTo(action: string, slug: string): Promise<HowTo | null> {
  const blobKey = `howto/${slug}.json`;

  try {
    const existing = await head(blobKey);
    if (existing) {
      const res = await fetch(existing.url);
      if (res.ok) return await res.json() as HowTo;
    }
  } catch { /* generate fresh */ }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `You are a practical, encouraging coach for beginners and early creators. Someone just read this action step and wants to know how to actually do it:

ACTION: "${action}"

Return JSON with this exact shape:
{
  "title": "The action step, rewritten as a clear imperative title (max 10 words)",
  "steps": [
    { "heading": "Step 1 label (3-5 words)", "instruction": "One concrete sentence telling them exactly what to do. Simple, specific, no jargon." },
    { "heading": "Step 2 label (3-5 words)", "instruction": "One concrete sentence. The next logical move." },
    { "heading": "Step 3 label (3-5 words)", "instruction": "One concrete sentence. How to finish or follow through." }
  ],
  "why": "One sentence explaining why this action matters — the real payoff. Motivating, not preachy."
}

Return only valid JSON.`,
      }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
    const json = JSON.parse(text.replace(/^```json\n?/, "").replace(/\n?```$/, "")) as HowTo;
    await put(blobKey, JSON.stringify(json), { access: "public", contentType: "application/json", addRandomSuffix: false });
    return json;
  } catch { return null; }
}

// ── Full editorial rewrite for article detail ─────────────────────────────────
export async function getFullArticle(story: Story, relatedStories: Story[], editionKey: string): Promise<string> {
  const PROMPT_V = "v4"; // bump when prompt changes to invalidate old cached articles
  const slug = createHash("md5").update(story.link).digest("hex").slice(0, 16);
  const blobKey = `articles/${PROMPT_V}/${editionKey}/${slug}.txt`;

  // Check Blob cache first
  try {
    const existing = await head(blobKey);
    if (existing) {
      const res = await fetch(existing.url);
      if (res.ok) return await res.text();
    }
  } catch { /* not found — generate fresh */ }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const related = relatedStories.filter((s) => s.link !== story.link).slice(0, 5);
  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 450,
    messages: [{
      role: "user",
      content: `You are a deeply curious editor-at-large with a centrist, intellectually honest perspective. A story lands on your desk. Your job: write 200-350 words of sharp, conversational commentary — not a summary, not a rewrite. Think out loud about what it actually means. Challenge assumptions from all sides. Avoid ideological framing, virtue signaling, or moralizing. Be equally skeptical of institutional power, activist narratives, and reactionary takes. Focus on what's real, what's at stake, and who actually benefits or loses.

Use EXACTLY ONE reference that creates a genuine, surprising insight. Name it specifically. One sentence of connection, then move on. If nothing fits naturally, skip it entirely.

BANNED — these are overused and signal lazy thinking. NEVER use them:
Goodhart's Law, Dunning-Kruger Effect, Streisand Effect, Overton Window, Occam's Razor, Hanlon's Razor, the Butterfly Effect, Maslow's Hierarchy, the Trolley Problem, the Black Swan.

REFERENCE POOL — thousands of options, pick something unexpected:

PHILOSOPHY: Thales on arche, Heraclitus on flux, Parmenides on being, Zeno's paradoxes, Socratic elenchus, Plato's allegory of the cave, Aristotle's four causes, Epicurus on ataraxia, Epictetus on the dichotomy of control, Marcus Aurelius on impermanence, Plotinus on emanation, Augustine on time, Aquinas on natural law, Ockham on universals, Machiavelli on virtù, Montaigne's essays, Spinoza's substance monism, Leibniz's monads, Hobbes on the state of nature, Locke on tabula rasa, Hume on causation, Berkeley on esse est percipi, Kant's categorical imperative, Kant's sublime, Hegel's dialectic, Schopenhauer's will, Kierkegaard's leap of faith, Nietzsche's eternal recurrence, Nietzsche's will to power, Nietzsche on ressentiment, Husserl's phenomenology, Heidegger's thrownness, Heidegger's das Man, Sartre's bad faith, Sartre's gaze, Camus's absurd, Merleau-Ponty on embodied cognition, Simone de Beauvoir on the Other, Hannah Arendt on the banality of evil, Arendt on natality, Wittgenstein's language games, Wittgenstein's private language argument, Popper's falsifiability, Kuhn's paradigm shifts, Lakatos on research programs, Feyerabend on methodological anarchism, Rawls' veil of ignorance, Rawls' difference principle, Nozick's minimal state, Parfit on personal identity, Parfit on reasons and persons, Nagel's "What Is It Like to Be a Bat?", Frankfurt on bullshit, Singer's drowning child, Judith Jarvis Thomson's violinist, Bernard Williams on integrity, Philippa Foot's trolley variants, Derek Parfit on future generations, Levinas on the face of the Other, Derrida's différance, Derrida on the supplement, Foucault on biopower, Foucault on heterotopias, Baudrillard's hyperreality, Deleuze's rhizome, Deleuze on difference and repetition, Žižek on ideology, Agamben on bare life, Rancière on the distribution of the sensible, Iris Murdoch on moral vision, Simone Weil on attention, Fanon on colonial psychology, bell hooks on the margin as radical space, Cornel West on prophetic pragmatism, Martha Nussbaum on capabilities, Amartya Sen on development as freedom, Bruno Latour's actor-network theory, Peter Sloterdijk on spheres, Paul Virilio on speed and politics

SCIENCE & MATH: Bell's theorem, Maxwell's demon, the double-slit experiment, quantum decoherence, the many-worlds interpretation, Schrödinger's cat as institutional metaphor, quantum entanglement, the measurement problem, Planck's constant, the photoelectric effect, special relativity's simultaneity, general relativity's frame-dragging, the equivalence principle, Hawking radiation, the information paradox, the anthropic principle, the fine-tuning problem, Boltzmann brains, entropy and the arrow of time, Maxwell's equations, the Higgs mechanism, supersymmetry's failures, the hierarchy problem, dark matter as placeholder, dark energy's acceleration, the Hubble tension, Olbers' paradox, the Fermi paradox (specifically the Great Filter), the Drake equation's uncertainties, panspermia, the RNA world hypothesis, the Cambrian explosion, punctuated equilibrium, kin selection, group selection controversy, multilevel selection, sexual selection's runaway dynamics, the handicap principle, Zahavian signaling, niche construction, epigenetics' transgenerational effects, horizontal gene transfer, the holobiont concept, the endosymbiont hypothesis, symbiogenesis, convergent evolution, evolutionary arms races, Malthusian traps, Gödel's first incompleteness theorem, Gödel's second incompleteness theorem, Russell's paradox, the halting problem, Rice's theorem, the P vs NP problem, the traveling salesman problem's intractability, Banach-Tarski paradox, the Cantor diagonal argument, Hilbert's hotel, the birthday paradox, Simpson's paradox, Braess's paradox, the Monty Hall problem, Benford's Law, the law of large numbers vs small samples, Bayes' theorem misapplication, the base rate fallacy, regression to the mean, the central limit theorem, chaos theory's sensitive dependence, the Lorenz attractor, the logistic map, fractals and self-similarity, power laws and fat tails, Zipf's law, preferential attachment, percolation theory, phase transitions, emergence and downward causation, the second law's exceptions, Maxwell's demon's resolution, Shannon entropy and information, Kolmogorov complexity, algorithmic information theory, the no-free-lunch theorem, Ramsey theory, the four-color theorem, topology's coffee cup and donut, knot theory, game theory beyond Nash: Shapley values, mechanism design, revelation principle, the folk theorem, repeated games, evolutionary stable strategies, the Price equation

PSYCHOLOGY & BEHAVIOR: Pavlovian conditioning's second-order effects, operant conditioning's schedules of reinforcement, learned helplessness's learned optimism inverse, the Rosenthal effect (Pygmalion), the nocebo effect, the placebo's dose-response curve, reactance theory, self-determination theory's three needs, construal level theory, temporal discounting, hyperbolic discounting, scope insensitivity, the affect heuristic, the peak-end rule, duration neglect, the focusing illusion, attribute substitution, the conjunction fallacy, the representativeness heuristic, the anchoring effect's persistence, the framing effect's reversals, loss aversion's 2:1 ratio, the endowment effect, mental accounting, the sunk cost fallacy's limits, the hot hand fallacy (and its rehabilitation), the gambler's fallacy, the clustering illusion, apophenia, pareidolia as pattern-detection gone wrong, motivated reasoning, identity-protective cognition, belief perseverance, the backfire effect (and its failures to replicate), cognitive load theory, working memory's 4±1 chunks, the spacing effect, the generation effect, the testing effect, transfer-appropriate processing, the fluency illusion, the illusion of explanatory depth, the curse of knowledge, the false consensus effect, the spotlight effect, the transparency illusion, self-serving bias, the fundamental attribution error's cultural variation, actor-observer asymmetry, the just-world hypothesis, system justification theory, social dominance orientation, right-wing authoritarianism's measurement, implicit association test controversies, stereotype threat's replication issues, stereotype boost, the contact hypothesis's conditions, mere exposure effect, the pratfall effect, social proof's limits in uncertainty, authority bias, the halo effect, the horn effect, physical attractiveness bias, the name-letter effect, the IKEA effect, the effort heuristic, the pain of paying, mental budgeting, the status quo bias, omission bias, the default effect, choice architecture, libertarian paternalism's tensions, self-control as muscle metaphor (now disputed), implementation intentions, temptation bundling, precommitment devices, the Ulysses contract, cognitive behavioral therapy's mechanisms, acceptance and commitment therapy, Terror Management Theory's mortality salience, the worm at the core, Csikszentmihalyi's flow conditions, self-concordance theory, broaden-and-build theory, the undoing effect, Fredrickson's 3:1 ratio (disputed), post-traumatic growth, benefit finding, the paradox of hedonism, adaptation-level theory, the hedonic treadmill, relative deprivation theory, social comparison theory's directions, the BIRGing and CORFing phenomena

HISTORY & SOCIOLOGY: the Axial Age's simultaneous emergence, the Bronze Age Collapse's systems failure, the Sea Peoples mystery, the fall of Rome's multiple causations, the Black Death's social restructuring, the printing press's 150-year lag, the Scientific Revolution's social conditions, the Dutch Golden Age's institutional innovations, the South Sea Bubble's anatomy, Tulip mania (and its revisionist history), the Mississippi Bubble, the Corn Laws debate, the first enclosure movement, the second enclosure movement, the Irish Famine's political economy, the First Industrial Revolution's Luddites, the Second Industrial Revolution's dynamo paradox, the Great Stagnation (pre-1970), Kondratiev waves, the Long Depression of 1873, the Panic of 1907, the Weimar hyperinflation's social effects, the New Deal's contested legacy, Bretton Woods and its collapse, the Nixon shock, stagflation's theory-breaking, the Washington Consensus's failures, the Asian Financial Crisis's contagion, the Long-Term Capital Management collapse, the dot-com bubble's belief system, the 2008 crisis's regulatory capture, austerity's empirical record, Piketty's r>g (and criticisms), the Great Divergence, the Great Convergence, colonial accounting (Utsa Patnaik), the resource curse, Dutch disease, the middle-income trap, institutional economics (North), the varieties of capitalism framework, Hall and Soskice on coordinated vs liberal, Esping-Andersen's three worlds, Putnam on social capital's decline, Bowling Alone's thesis, Tocqueville on associations, de Soto on dead capital, Scott's seeing like a state, James C. Scott on metis vs techne, Foucault's disciplinary society, Goffman's total institutions, Goffman on stigma, Goffman's interaction ritual, Collins's interaction ritual chains, Bourdieu's field theory, Bourdieu on symbolic violence, Elias's civilizing process, Elias on established and outsiders, Tilly on coercion and capital, Mann on the sources of social power, Wallerstein's world-systems theory, dependency theory, comparative advantage's empirical limits, the product space (Hausmann), economic complexity theory, Schumpeter's entrepreneur vs innovation bureaucracy, Hirschman's exit voice loyalty, Hirschman on the passions and the interests, Albert Hirschman on development, Olson on the logic of collective action, Ostrom on the commons, Habermas on the public sphere, the colonization of the lifeworld, Luhmann's systems theory, Beck's risk society, Ulrich Beck on reflexive modernization, Anthony Giddens on structuration, the Thomas theorem, Merton's self-fulfilling prophecy, Merton on unintended consequences, the iron law of oligarchy (Michels), elite theory (Pareto, Mosca), the circulation of elites, Mannheim on the sociology of knowledge, the sociology of scientific knowledge, Kuhn's incommensurability, Latour on trials of strength, the Matthew effect in science, Merton's CUDOS norms, the priority dispute, the multiple independent discovery phenomenon

ART, LITERATURE & CULTURE: the Homeric question, Aristotle's katharsis, Longinus on the sublime, Horace's ut pictura poesis, the querelle des anciens et des modernes, Winckelmann's noble simplicity, Burke on the sublime vs beautiful, Kant's purposiveness without purpose, Schiller on naive and sentimental poetry, Schlegel on romantic irony, Hegel on the end of art, Schopenhauer on music as will, Nietzsche's Apollo vs Dionysus, Ruskin on the pathetic fallacy, Arnold on culture as the best that has been thought, Pater on burning with a hard gem-like flame, Wilde's aestheticism, Tolstoy's infection theory, Croce on expression, Clive Bell's significant form, Roger Fry's formalism, Clement Greenberg on flatness, Harold Rosenberg on action painting, Clement Greenberg vs Kitsch, T.S. Eliot's objective correlative, Eliot on tradition and the individual talent, Pound's make it new, Benjamin's aura and mechanical reproduction, Benjamin on the flaneur, Benjamin's Arcades Project, Adorno and Horkheimer on the culture industry, Adorno on autonomous art, Adorno's negative dialectics, Brecht's Verfremdungseffekt, Lukács on reification, Lukács on the historical novel, Northrop Frye's modes and myths, Roland Barthes on the death of the author, Barthes on mythology, Barthes's punctum and studium, Susan Sontag on interpretation, Sontag on camp, Sontag on photography's reality effects, Umberto Eco on open works, Eco on hyperreality, Eco on the semiotic guerrilla, Derrida on the supplement in literature, Paul de Man on allegory, Fredric Jameson on postmodernism as cultural logic, Jameson's political unconscious, Said's orientalism, Spivak's subaltern, Homi Bhabha's hybridity, Henry Louis Gates on signifying, Houston Baker on vernacular theory, bell hooks on the oppositional gaze, Laura Mulvey's male gaze, John Berger's ways of seeing, Svetlana Alpers on the art of describing, Michael Fried on absorption and theatricality, Rosalind Krauss on the expanded field, Arthur Danto on the artworld, George Dickie's institutional theory, Nelson Goodman's languages of art, W.J.T. Mitchell on imagetext, Lev Manovich on the language of new media, Mark Fisher on hauntology, Fisher on capitalist realism, Simon Reynolds on retromania, Kodwo Eshun on further considerations of Afrofuturism, specific Borges stories as thought experiments, Calvino's If on a winter's night, DFW on irony and sincerity, Nabokov on poshlost, Pynchon's entropy stories, Philip K. Dick on simulated reality, Le Guin's thought experiments, specific Kubrick shots as metaphors, Tarkovsky on sculpting in time, Godard on cinema as truth, Werner Herzog on ecstatic truth, Lynch on ideas catching, specific Beatles recording decisions, Miles Davis's Kind of Blue as process, Glenn Gould's anti-performance, John Cage's 4'33" on silence and context, Eno's oblique strategies, the KLF's music industry sabotage, specific Radiohead album transitions, Kendrick Lamar's DAMN. structure, Beyoncé's Lemonade as visual album form

ECONOMICS & SYSTEMS: Ricardo's comparative advantage vs absolute, the Ricardian vice (over-abstraction), Mill on stationary state, Marshall's partial equilibrium, Walras's general equilibrium and its stability problems, Pigou on externalities, Coase on transaction costs and the Coase theorem's limits, Arrow's impossibility theorem, Arrow-Debreu's unrealistic assumptions, the socialist calculation debate (Mises-Hayek vs Lange), Hayek's knowledge problem vs Ostrom's managed commons, Hayek on spontaneous order, Keynes on animal spirits, Keynes's beauty contest metaphor, Keynes on the long run, Kalecki on the political business cycle, the paradox of thrift, Minsky's financial instability hypothesis, Minsky moments, Fisher's debt deflation theory, the permanent income hypothesis's failures, behavioral life-cycle theory, Modigliani-Miller and its violations, the efficient market hypothesis's three forms, the joint hypothesis problem, behavioral finance's limits to arbitrage, Shiller on irrational exuberance, Thaler's mental accounting, the equity premium puzzle, the risk-free rate puzzle, the volatility puzzle, the disposition effect, the January effect, momentum and its decay, factor investing's crowding, the Grossman-Stiglitz paradox, the winner's curse, the market for lemons (Akerlof), adverse selection vs moral hazard, the principal-agent problem's solutions, mechanism design's revelation principle, Vickrey auctions, spectrum auction design, matching theory (Gale-Shapley), the Shapley value, cooperative game theory, the folk theorem in repeated games, the ratchet effect in planning, Kornai's soft budget constraint, the Dutch disease's resource curse mechanism, the Prebisch-Singer thesis, the terms of trade debate, Bhagwati on immiserizing growth, the Washington Consensus's ten points vs reality, the Beijing Consensus, varieties of capitalism's production regimes, the knowledge economy's measurement problems, Solow's computer paradox (and its resolution), the Baumol cost disease, the Baumol effect on services, Easterlin paradox on happiness and GDP, Layard on happiness economics, Kahneman on experienced vs remembered utility, the QALY's ethical problems, cost-benefit analysis's distributional blindness, the discount rate's intergenerational ethics, Stern vs Nordhaus on climate, the social cost of carbon's uncertainty, fat-tailed catastrophe risk, Nassim Taleb on fragility vs antifragility, Taleb on skin in the game, the precautionary principle's paralysis, the innovation systems approach, the product complexity index, Hausmann on economic complexity, the capabilities approach to development, Banerjee-Duflo on randomized development, the Lucas critique, the identification problem in econometrics, Angrist-Pischke on credibility revolution, natural experiments' external validity limits, the replication crisis in economics

POP CULTURE & SPECIFIC MOMENTS: HAL 9000's "I'm sorry Dave" as machine alignment parable, 2001's bone-to-spaceship cut, the shower scene's editing in Psycho, Citizen Kane's deep focus as power metaphor, Rashomon's epistemology, Kurosawa's rain, the Battleship Potemkin's Odessa steps, Chaplin's Modern Times gear scene, the opening of Apocalypse Now, the baptism montage in The Godfather, the Sicilian message scene, Heat's coffee scene on professionalism, the diner scene in No Country for Old Men, There Will Be Blood's "I drink your milkshake", Chinatown's "Forget it Jake, it's Chinatown", the final shot of The Graduate, the freeze frame ending of The 400 Blows, the ending of Brazil (Gilliam), specific Philip K. Dick stories beyond Blade Runner, the Matrix's red pill as Baudrillard misreading, Black Mirror "The Entire History of You" on memory, "Nosedive" on social credit, "White Bear" on punishment spectacle, "Fifteen Million Merits" on attention economy, Severance's work-life separation made literal, Station Eleven on cultural memory after collapse, Succession's "we don't get to keep them" finale, The Wire's "the game is the game" on systems, The Wire's Hamsterdam experiment, Mad Men's Carousel pitch, Breaking Bad's "I am the danger", Atlanta's absurdist social realism, I May Destroy You's nonlinear trauma, Nathan Barley as pre-social-media influencer satire, Charlie Brooker on screen-life, specific Simpsons episodes with sociological weight (the monorail episode on civic boosterism, the Springfield files, the 138th episode spectacular's meta-commentary), South Park's "they took our jobs" as automation anxiety, Idiocracy as Gresham's Law applied to culture, Idiocracy's Brawndo, Don't Look Up as scientific communication failure, specific episodes of Seinfeld as pure social norm exploration, Curb Your Enthusiasm on social contract violations, Nathan Fielder's rehearsals and social scripts, specific internet moments: Harambe as collective grief displacement, the dress as perceptual relativity, the Harlem Shake as memetic mutation, TikTok's For You page as Skinner box, specific YouTube rabbit holes as filter bubble anatomy, the Fyre Festival as Veblen consumption meets logistics reality, Elizabeth Holmes's vocal fry as performed authority, WeWork's we-washing, the NFT bubble's tulip parallels, specific crypto collapses (Terra/Luna's algorithmic stablecoin hubris), the GameStop short squeeze as Minsky meets Reddit, the long-tail theory's empirical problems, the 1000 true fans as power law exception, the creator economy's middle-class squeeze

SPECIFIC STUDIES & EXPERIMENTS: the Terman longitudinal study on giftedness, the Grant Study (Harvard longitudinal on adult development), the Framingham Heart Study on social contagion of obesity and happiness, the Nurses' Health Study, Harlow's cloth vs wire mother monkeys, Bowlby's attachment observations, Ainsworth's strange situation, Spitz on hospitalism, the Perry Preschool Project, the Abecedarian Project, the Moving to Opportunity experiment, the Oregon Medicaid lottery, the RAND Health Insurance Experiment, the Negative Income Tax experiments (Mincome), the Tennessee STAR class size study, Project STAR vs HeadStart divergence, the Robbers Cave experiment, Muzafer Sherif's realistic conflict theory, the Jigsaw classroom, the Pygmalion study's replication issues, the blue-eyes/brown-eyes experiment, Zimbardo's Stanford Prison Experiment's theatrical staging (Le Texier's exposé), Milgram's obedience study's ecological validity, the Bystander Effect studies' replication (and the 2019 revision), Latané and Darley's diffusion of responsibility, the Good Samaritan experiment (Darley and Batson), Festinger's cognitive dissonance original study, Festinger's "When Prophecy Fails", Leon Festinger on social comparison, the Iowa Gambling Task, the Ultimatum Game's cross-cultural variations, the Dictator Game's experimenter effects, the Prisoner's Dilemma in repeated play, Axelrod's tit-for-tat tournament, the Public Goods Game's punishment dynamics, the Trust Game's oxytocin controversy, Paul Zak's oxytocin-trust claims (and failures), the marshmallow test's socioeconomic confounds, ego depletion's failed replication, the Power Pose controversy (Cuddy vs Simmons), priming studies' collapse, the money priming effect, the Florida effect, the facial feedback hypothesis (pen in mouth), the pen-in-mouth replication, embodied cognition's checkered replication record, growth mindset's implementation failures, grit's limited predictive validity beyond IQ, stereotype threat's boundary conditions, implicit bias training's null effects, the contact hypothesis's conditions (Pettigrew), the Robbers Cave follow-up (failed reconciliation attempts), the Realistic Conflict Theory's limits, social identity theory's minimal group paradigm, Tajfel's original studies, Terror Management Theory's mortality salience (and Covid-era tests), the Kitty Genovese story's factual errors, the broken windows policing evidence (mixed), the Scared Straight program's backfire, the D.A.R.E. program's null effects, the Cambridge-Somerville Youth Study's harm, Scared Straight's criminogenic effects, sex offender registries' counterproductive effects

FORMAT — NON-NEGOTIABLE. Separate every paragraph with a blank line:
- Paragraph 1: EXACTLY 1 sentence. The hook. No exceptions.
- Paragraph 2: EXACTLY 1 sentence. Deepen or reframe.
- Middle paragraphs: 1-2 sentences each. Vary rhythm.
- Final paragraph: 1-3 sentences. Sharp landing — question, provocation, or implication.
- Total: 150-260 words. Every sentence must earn its place.

STORY: ${story.title}
SOURCE: ${story.source}
SECTION: ${story.section}
SUMMARY: ${story.summary ?? ""}
KEY FACTS: ${story.bullets?.join(". ") ?? ""}
INSIGHT: ${story.insight ?? ""}

TODAY'S OTHER STORIES (mention one only if the parallel is genuinely striking):
${related.map((s) => `- ${s.title} (${s.section})`).join("\n")}

Return only the commentary. No title, no byline, no headers. Short paragraphs separated by blank lines.`,
    }],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";

  // Save to Blob for this edition
  try {
    await put(blobKey, text, { access: "public", contentType: "text/plain", addRandomSuffix: false });
  } catch { /* non-fatal */ }

  return text;
}

// ── Feature Creature ─────────────────────────────────────────────────────────
export interface FeatureCreature {
  universe: string;
  angleLabel: string;
  angleKey: string;
  ctaHeader?: string;
  title: string;
  synopsis: string;
  body: string;          // 3 paragraphs separated by \n\n
  headers: [string, string];
  digDeeper: string;
  callToAction: string;  // strong closing CTA — 1 imperative sentence
  pullQuote?: string;    // mid-article pull-quote fallback (shown when imageUrl2 absent)
  imageUrl?: string;     // hero image
  imageUrl2?: string;    // mid-article image (different query)
  editionKey?: string;
}

export async function getFeatureCreature(editionKey: string): Promise<FeatureCreature | null> {
  const { FC_UNIVERSE, FC_ANGLE } = await import("./palette");
  const blobKey = `feature-creature/v10/${editionKey}.json`;

  try {
    const existing = await head(blobKey);
    if (existing) {
      const res = await fetch(existing.url, { cache: "no-store" });
      if (res.ok) return await res.json() as FeatureCreature;
    }
  } catch { /* generate fresh */ }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  try {
    const [msg, imageUrl] = await Promise.all([
      client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        messages: [{
          role: "user",
          content: `You are the "Feature Creature" — a wildly curious editorial voice for a publication aimed at energetic, intelligent, culturally-aware readers (creators, entrepreneurs, curious minds).

Universe: ${FC_UNIVERSE}
Angle: ${FC_ANGLE.label}
Task: ${FC_ANGLE.prompt}

Write a punchy, fascinating Feature Creature editorial. NO markdown — no asterisks, no bold, no italics syntax. Plain prose only.

Rules:
- Synopsis: 1-2 electrifying sentences that make someone HAVE to click — the essential hook
- Title: 6-10 words, electrifying, no clickbait clichés
- Header 1: 1-2 evocative words, placed before paragraph 1 (sets the scene/theme)
- Header 2: 1-2 evocative words, placed before paragraph 3 (marks a turn or escalation)
- CTA header: 2-4 words — a sharp, active phrase (e.g. "Make Your Move", "Start Tonight", "Build This Now")
- Body — THREE paragraphs, each separated by a blank line (\\n\\n). COUNT PERIODS TO VERIFY:
  - Paragraph 1: EXACTLY 1 sentence = 1 period. Stop. New paragraph.
  - Paragraph 2: 1-2 sentences = maximum 2 periods. Stop. New paragraph.
  - Paragraph 3: 1-3 sentences = maximum 3 periods. Stop.
  - Total body: 160-200 words. Do NOT write more than 3 paragraphs.
- Call to action: 1 imperative sentence. What to DO/MAKE/WATCH/BUILD today. Specific, not generic.
- Dig Deeper: 1 sentence — a specific book, film, essay, or rabbit hole
- Pull quote: the single most electrifying sentence from the body — standalone, no context needed, makes a reader stop scrolling
- Image query: 4-6 words optimised for Unsplash stock photo search. Use concrete visual nouns + atmosphere words that will find a REAL photo. Think: "neon rain cyberpunk street night" not "aesthetic collapse permission". Must be visually distinct from the hero (which already covers the universe directly).

CORRECT body example (1 period / 2 periods / 3 periods):
"Akira didn't predict the future — it designed it.\\n\\nOtomo understood that collapsed societies don't look grey and broken; they look neon and kinetic. The film is less a warning than a mood board.\\n\\nEvery streetwear brand, every dystopian ad campaign, every TikTok filter owes a debt to Neo-Tokyo. We've internalized the idea that apocalypse looks good. The question is whether we're fans of the aesthetic or participants in the collapse."

Return JSON only — no markdown fences:
{
  "title": "...",
  "synopsis": "...",
  "headers": ["word or two", "word or two"],
  "ctaHeader": "2-4 word phrase",
  "body": "one sentence.\\n\\none or two sentences.\\n\\none to three sentences.",
  "pullQuote": "the best sentence from the body verbatim",
  "imageQuery": "4-6 concrete visual words for Unsplash",
  "callToAction": "...",
  "digDeeper": "..."
}`
        }],
      }),
      fetchUnsplash(`${FC_UNIVERSE} ${FC_ANGLE.key}`, "Culture"),
    ]);
    const raw = msg.content[0].type === "text" ? msg.content[0].text : "{}";
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(text);

    // Mid-article image: use Claude-generated imageQuery, then vision-review the result
    const imageQuery = parsed.imageQuery as string | undefined;
    let imageUrl2: string | undefined;
    if (imageQuery) {
      const candidate = await fetchUnsplash(imageQuery, "Arts", 2);
      if (candidate && candidate !== imageUrl) {
        // Vision review: score relevance 1-10; accept if >= 6
        try {
          const review = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 10,
            messages: [{
              role: "user",
              content: [
                { type: "image", source: { type: "url", url: candidate } },
                { type: "text", text: `Article title: "${parsed.title}". Synopsis: "${parsed.synopsis}". Does this photo fit as a mid-article illustration? Reply with a single integer 1-10 (10 = perfect fit, 1 = totally unrelated).` },
              ],
            }],
          });
          const score = parseInt((review.content[0] as { type: string; text: string }).text.trim(), 10);
          if (!isNaN(score) && score >= 6) imageUrl2 = candidate;
        } catch { /* vision review failed — skip image2, use pull-quote */ }
      }
    }
    const result: FeatureCreature = {
      universe: FC_UNIVERSE,
      angleLabel: FC_ANGLE.label,
      angleKey: FC_ANGLE.key,
      title: parsed.title ?? `${FC_UNIVERSE}: ${FC_ANGLE.label}`,
      synopsis: parsed.synopsis ?? "",
      headers: [parsed.headers?.[0] ?? "", parsed.headers?.[1] ?? ""],
      ctaHeader: parsed.ctaHeader ?? undefined,
      body: parsed.body ?? "",
      pullQuote: parsed.pullQuote ?? undefined,
      callToAction: parsed.callToAction ?? "",
      digDeeper: parsed.digDeeper ?? "",
      imageUrl,
      imageUrl2,
      editionKey,
    };
    await put(blobKey, JSON.stringify(result), { access: "public", contentType: "application/json", addRandomSuffix: false });
    return result;
  } catch { return null; }
}

// ── Archive ───────────────────────────────────────────────────────────────────
export interface ArchiveEntry { key: string; label: string; date: string; theme: string; imageUrl?: string }

export async function saveToArchive(entry: ArchiveEntry) {
  try {
    // Fetch and persist the hero image to Blob
    let blobImageUrl = entry.imageUrl;
    if (entry.imageUrl && !entry.imageUrl.includes("blob.vercel-storage.com")) {
      try {
        const imgRes = await fetch(entry.imageUrl);
        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer();
          const imgBlob = await put(`archive/photos/${entry.key}.jpg`, imgBuffer, {
            access: "public", contentType: "image/jpeg", addRandomSuffix: false,
          });
          blobImageUrl = imgBlob.url;
        }
      } catch { /* use original URL as fallback */ }
    }

    // Load existing index, add entry, save back
    let list: ArchiveEntry[] = [];
    try {
      const existing = await head("archive/index.json");
      if (existing) {
        const res = await fetch(existing.url);
        if (res.ok) list = await res.json();
      }
    } catch { /* fresh start */ }

    if (!list.find((e) => e.key === entry.key)) {
      list.unshift({ ...entry, imageUrl: blobImageUrl });
      if (list.length > 90) list.pop();
      await put("archive/index.json", JSON.stringify(list), {
        access: "public", contentType: "application/json", addRandomSuffix: false,
      });
    }
  } catch { /* non-fatal */ }
}

export async function getArchiveList(): Promise<ArchiveEntry[]> {
  try {
    const existing = await head("archive/index.json");
    if (!existing) return [];
    const res = await fetch(existing.url + "?t=" + Date.now()); // bypass CDN cache
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export async function getArchivedPageData(key: string): Promise<PageData | null> {
  // Check file cache first (fast, same instance)
  const cached = cacheGet<PageData>(`edition_${key}`);
  if (cached) return cached;
  // Fall back to Blob (persistent across instances)
  try {
    const existing = await head(`archive/editions/${key}.json`);
    if (!existing) return null;
    const res = await fetch(existing.url + "?t=" + Date.now());
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

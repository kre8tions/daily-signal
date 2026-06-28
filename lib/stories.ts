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
  title: string; ownedTitle?: string; source: string; section: string; link: string; pubDate: string;
  imageUrl?: string; summary?: string; bullets?: string[];
  pullquote?: string; insight?: string; cardStyle: "full" | "pullquote" | "brief";
  imageQuery?: string; content?: string;
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

export function getNextEdition(): { label: string; key: string } {
  const future = new Date(Date.now() + 16 * 60 * 1000);
  const h = future.getHours();
  const date = future.toISOString().slice(0, 10);
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
    // Reject known-bad image patterns: logos, placeholders, and site-wide default social images
    if (/bbci\.co\.uk|placeholder|logo|icon|favicon|\/og\.|\/og-|og_image|og-image|social[-_]share|share[-_]image|default[-_]image|fallback|\/share\.|\/social\./i.test(imgUrl)) return undefined;
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

export async function fetchUnsplash(headline: string, section?: string, page = 1, imageQuery?: string): Promise<string | undefined> {
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
    ...(imageQuery ? [imageQuery] : []),
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

async function getArticleImage(article: { link: string; title: string; section?: string; rssImageUrl?: string; imageQuery?: string }): Promise<string | undefined> {
  const cKey = imgCacheKey(article.link);
  const hit = cacheGet<string>(cKey);
  if (hit) return hit === "__none__" ? undefined : hit;

  if (article.rssImageUrl && !/placeholder|logo|icon|watermark|bbci\.co\.uk/i.test(article.rssImageUrl)) {
    cacheSet(cKey, article.rssImageUrl, THREE_DAYS);
    return article.rssImageUrl;
  }
  const og = await scrapeOgImage(article.link);
  if (og) { cacheSet(cKey, og, THREE_DAYS); return og; }
  const unsplash = await fetchUnsplash(article.title, article.section, 1, article.imageQuery);
  if (unsplash) { cacheSet(cKey, unsplash, THREE_DAYS); return unsplash; }
  cacheSet(cKey, "__none__", ONE_HOUR);
  return undefined;
}

export async function getUniqueImages(articles: (RawItem & { imageQuery?: string })[]): Promise<(string | undefined)[]> {
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
      const fresh = await fetchUnsplash(articles[i].title + " " + articles[i].section, undefined, 1, articles[i].imageQuery);
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
  const FRESH_MS = 10 * ONE_HOUR; // prefer articles published within last 10 hours
  const now = Date.now();

  const results = await Promise.allSettled(
    activeFeeds.map(async (feed) => {
      const timeout = new Promise<never>((_, r) => setTimeout(() => r(new Error("t")), 8000));
      const parsed = await Promise.race([parser.parseURL(feed.url), timeout]);
      const mapped = parsed.items.slice(0, 8).map((item) => ({
        title: decodeEntities(item.title ?? ""), content: decodeEntities(item.contentSnippet ?? ""),
        source: feed.source, section: feed.section,
        link: item.link ?? "", pubDate: item.pubDate ?? new Date().toISOString(),
        rssImageUrl: extractRssImage(item),
      }));
      // Prefer fresh articles; fall back to most recent if none are fresh
      const fresh = mapped.filter(i => now - new Date(i.pubDate).getTime() < FRESH_MS);
      return (fresh.length > 0 ? fresh : mapped).slice(0, 3);
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

// ── Cross-story synthesis (blob-cached per edition) ───────────────────────────
export async function getSynthesis(items: RawItem[], editionKey: string): Promise<Synthesis> {
  const blobKey = `synthesis/v1/${editionKey}.json`;
  try {
    const existing = await head(blobKey);
    if (existing) {
      const res = await fetch(existing.url, { cache: "no-store" });
      if (res.ok) return await res.json() as Synthesis;
    }
  } catch { /* generate fresh */ }

  const synthSeed = editionKey.split("").reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 13), 0);
  const synthWriter = WRITERS[synthSeed % WRITERS.length];
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const storyList = items.map((a, i) =>
    `[${i}] ${a.section.toUpperCase()} — ${a.source}: ${a.title}\n${a.content.slice(0, 300)}`
  ).join("\n\n");

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1500,
    messages: [{
      role: "user",
      content: `${synthWriter.style}

You are writing the cross-story synthesis for a news digest. Find the hidden connective tissue between these stories.

RULES:
- Never restate the headline. Be specific, find non-obvious angles.
- NEVER open with "Today's", "This collection", "These stories". Jump straight into the insight.
- Write in first-person editorial voice — opinions, interpretations, predictions.
- Do not frame stories through an ideological lens.

${storyList}

Return JSON only, no markdown:
{
  "theme": "One evocative noun phrase naming the underlying force or tension",
  "observation": "STRUCTURE REQUIRED: Write the first sentence as a standalone hook. Then insert \\n\\n. Then 1-2 follow-up sentences that deepen it. Never count or reference how many stories are covered.",
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
}`,
    }],
  });

  const rawText = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as Synthesis;
    put(blobKey, JSON.stringify(parsed), { access: "public", contentType: "application/json", addRandomSuffix: false }).catch(() => {});
    return parsed;
  } catch {
    return { theme: "", observation: "", takeaways: [], conclusion: "", actions: [] };
  }
}

// ── Assemble page data (cached per edition via Next.js data cache) ────────────
const CARD_STYLES: Story["cardStyle"][] = ["full", "pullquote", "brief", "brief", "brief", "brief", "brief", "brief", "brief", "brief", "brief"];

export async function buildPageData(editionKey: string, editionLabel: string): Promise<PageData> {
  const raw = await fetchTopStories(editionKey);
  const writerSlots = getWriterAssignments(editionKey);

  const [articleResults, synthesis, featureCreature] = await Promise.all([
    Promise.allSettled(
      raw.map((item, i) => {
        const storyShell: Story = { ...item, cardStyle: CARD_STYLES[i] ?? "brief" };
        const relatedShells = raw.filter((_, j) => j !== i).slice(0, 5).map(r => ({ ...r, cardStyle: "brief" as const }));
        return getFullArticle(storyShell, relatedShells, editionKey, writerSlots[i]);
      })
    ),
    getSynthesis(raw, editionKey),
    getFeatureCreature(editionKey).catch(() => null),
  ]);

  const arts = articleResults.map(r => r.status === "fulfilled" ? r.value : null);
  const rawWithQuery = raw.map((r, i) => ({ ...r, imageQuery: arts[i]?.imageQuery }));
  const images = await getUniqueImages(rawWithQuery);

  const stories: Story[] = raw.map((r, i) => ({
    ...r,
    imageUrl: images[i],
    cardStyle: CARD_STYLES[i] ?? "brief",
    ownedTitle: arts[i]?.ownedTitle,
    summary: arts[i]?.summary,
    bullets: arts[i]?.bullets,
    pullquote: arts[i]?.pullQuote,
    insight: arts[i]?.insight,
    imageQuery: arts[i]?.imageQuery,
  }));

  const pageData: PageData = { stories, synthesis, editionLabel, featureCreature: featureCreature ?? undefined };
  cacheSet(`edition_${editionKey}`, pageData, SEVEN_DAYS);
  put(`archive/editions/${editionKey}.json`, JSON.stringify(pageData), {
    access: "public", contentType: "application/json", addRandomSuffix: false,
  }).catch(() => {});
  saveToArchive({
    key: editionKey, label: editionLabel,
    date: editionKey.split("_")[0], theme: synthesis.theme, imageUrl: stories[0]?.imageUrl,
  }).catch(() => {});
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

// ── Writer personas ───────────────────────────────────────────────────────────
export const WRITERS = [
  {
    name: "Rex",
    style: `Your name is Rex. You are prosecutorial, erudite, and an equal-opportunity contrarian. You find the cowardice or hypocrisy in every official position and name it directly. Use history and literature as weapons, not decoration. Never hedge. The sentence lands like a verdict. You attack bad reasoning wherever it lives — left, right, institutional, populist. No sacred cows.`,
  },
  {
    name: "Eric",
    style: `Your name is Eric. You write with plain language and concrete detail. You find the one specific thing that exposes the whole lie. You distrust euphemism and jargon above all else. The argument is moral but never preachy — you show, you don't tell. Write the way a decent person thinks: clearly, honestly, without performance.`,
  },
  {
    name: "Margot",
    style: `Your name is Margot. You are cool, precise, and observational. You don't argue — you observe until the observation becomes devastating. Fragments are fine. Controlled distance. The dread is underneath, not on top. The official narrative unravels through what you notice, not through what you claim.`,
  },
  {
    name: "Finn",
    style: `Your name is Finn. You are narrative-driven and follow the incentive chain. You find the insider who spotted the flaw before everyone else. Complex systems become thrillers in your hands. Trace who knew what, when, and why they stayed quiet. The human story inside the structural story.`,
  },
  {
    name: "Cal",
    style: `Your name is Cal. You are counter-intuitive and anecdote-first. You start where nobody expects and arrive somewhere they didn't see coming. The hook is always a surprise — the thing we assumed is wrong, and here's the real mechanism. Makes the reader feel smart for following you there.`,
  },
  {
    name: "Jack",
    style: `Your name is Jack. You are sardonic, and funny in a way that stings. You mock sanctimony on all sides with equal enthusiasm — nobody escapes. You follow the absurdity, not the ideology. Libertarian-leaning but genuinely apolitical. The laugh lands before the reader realises it was aimed at them too.`,
  },
  {
    name: "Ward",
    style: `Your name is Ward. You are a social anthropologist and status-game spotter. You put the reader inside the room. The gap between what people say they value and what they actually do is your entire subject. Cultural observation as revelation — the exclamation mark that captures collective absurdity.`,
  },
] as const;

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

export function getWriterAssignments(editionKey: string): number[] {
  const seed = editionKey.split("").reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0);
  // All 7 writers appear; 4 get a second slot (11 total = 7 + 4)
  // Which 4 get the extra slot rotates by edition
  const writerOrder = [0, 1, 2, 3, 4, 5, 6];
  // Shuffle writer order to decide who gets the bonus slot
  for (let i = writerOrder.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed + i * 97) * (i + 1));
    [writerOrder[i], writerOrder[j]] = [writerOrder[j], writerOrder[i]];
  }
  // First 4 in shuffled order each get 2 slots, last 3 get 1 slot
  const slots = [...writerOrder, ...writerOrder.slice(0, 4)]; // 11 slots
  // Shuffle the slots so the doubled writers aren't grouped together
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed + i * 31) * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  return slots;
}

export function getSynthWriterIndex(editionKey: string): number {
  const synthSeed = editionKey.split("").reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 13), 0);
  return synthSeed % WRITERS.length;
}

export function getFCWriterIndex(editionKey: string): number {
  const fcSeed = editionKey.split("").reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 7), 0);
  return fcSeed % WRITERS.length;
}

// ── Full editorial rewrite for article detail ─────────────────────────────────
export interface ArticleCommentary {
  header: string;
  header2?: string;
  pullQuote: string;
  body: string;
  writer?: string;
  ownedTitle?: string;
  imageUrl2?: string;
  summary?: string;
  bullets?: string[];
  insight?: string;
  imageQuery?: string;
}

function breakLongSentences(text: string): string {
  const BREAK_AT = [" — ", "; ", ", and ", ", but ", ", because ", ", which ", ", so ", ", yet "];
  return text.split("\n\n").map(para => {
    const sentences = para.match(/[^.!?]+[.!?]+["'”]?\s*/g) ?? [para];
    return sentences.map(s => {
      const trimmed = s.trim();
      if (trimmed.split(/\s+/).length <= 20) return trimmed;
      for (const bp of BREAK_AT) {
        const idx = trimmed.indexOf(bp);
        if (idx > 15 && idx < trimmed.length - 15) {
          const left = trimmed.slice(0, idx).trim().replace(/[,;]$/, "");
          const right = trimmed.slice(idx + bp.length).trim();
          const rightCapped = right.charAt(0).toUpperCase() + right.slice(1);
          return `${left}. ${rightCapped}`;
        }
      }
      return trimmed;
    }).join(" ");
  }).join("\n\n");
}

export async function getFullArticle(story: Story, relatedStories: Story[], editionKey: string, writerIndex?: number): Promise<ArticleCommentary> {
  const PROMPT_V = "v12"; // bump when prompt changes to invalidate old cached articles
  const slug = createHash("md5").update(story.link).digest("hex").slice(0, 16);
  const blobKey = `articles/${PROMPT_V}/${editionKey}/${slug}.json`;

  // Check Blob cache first
  try {
    const existing = await head(blobKey);
    if (existing) {
      const res = await fetch(existing.url, { cache: "no-store" });
      if (res.ok) {
        const cached = await res.json() as ArticleCommentary;
        if (cached.body) return cached; // only use cache if body is non-empty
      }
    }
  } catch { /* not found — generate fresh */ }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const related = relatedStories.filter((s) => s.link !== story.link).slice(0, 5);

  // ── Pass 1: voice — write freely, pure quality, no structural constraints ──
  const writer = writerIndex !== undefined ? WRITERS[writerIndex % WRITERS.length] : null;
  const voiceInstruction = writer
    ? writer.style
    : `You write "The Signal Take" — a short, sharp editorial for a news digest. Your voice: the smartest person in the room who happens to be your friend. Direct. A little irreverent. Never preachy. You find the non-obvious angle and follow it somewhere unexpected.`;

  const pass1msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 950,
    messages: [{
      role: "user",
      content: `${voiceInstruction}

You are writing "The Signal Take" — a short, sharp editorial for a news digest.

Your job is NOT to summarise this story. Find the real tension underneath it. What assumption does it expose? What does it reveal about how power, incentives, or human nature actually work? Who benefits that nobody's talking about? What breaks if this keeps going?

Be equally sceptical of institutions, activists, and reactionaries. No ideological lean. No moralising. No virtue signalling.

Use ONE reference — a specific idea, experiment, thinker, film, or moment — that creates a genuinely surprising connection. One sentence, then move on. If nothing fits cleanly, skip it. Do NOT use: Goodhart's Law, Dunning-Kruger, Streisand Effect, Overton Window, Occam's Razor, Hanlon's Razor, Butterfly Effect, Maslow's Hierarchy, Trolley Problem, Black Swan.

REFERENCE POOL — pick something unexpected:
PHILOSOPHY: Thales on arche, Heraclitus on flux, Parmenides on being, Zeno's paradoxes, Socratic elenchus, Plato's allegory of the cave, Aristotle's four causes, Epicurus on ataraxia, Epictetus on the dichotomy of control, Marcus Aurelius on impermanence, Plotinus on emanation, Augustine on time, Aquinas on natural law, Ockham on universals, Machiavelli on virtù, Montaigne's essays, Spinoza's substance monism, Leibniz's monads, Hobbes on the state of nature, Locke on tabula rasa, Hume on causation, Berkeley on esse est percipi, Kant's categorical imperative, Kant's sublime, Hegel's dialectic, Schopenhauer's will, Kierkegaard's leap of faith, Nietzsche's eternal recurrence, Nietzsche's will to power, Nietzsche on ressentiment, Husserl's phenomenology, Heidegger's thrownness, Heidegger's das Man, Sartre's bad faith, Sartre's gaze, Camus's absurd, Merleau-Ponty on embodied cognition, Simone de Beauvoir on the Other, Hannah Arendt on the banality of evil, Arendt on natality, Wittgenstein's language games, Wittgenstein's private language argument, Popper's falsifiability, Kuhn's paradigm shifts, Lakatos on research programs, Feyerabend on methodological anarchism, Rawls' veil of ignorance, Rawls' difference principle, Nozick's minimal state, Parfit on personal identity, Parfit on reasons and persons, Nagel's "What Is It Like to Be a Bat?", Frankfurt on bullshit, Singer's drowning child, Judith Jarvis Thomson's violinist, Bernard Williams on integrity, Philippa Foot's trolley variants, Derek Parfit on future generations, Levinas on the face of the Other, Derrida's différance, Derrida on the supplement, Foucault on biopower, Foucault on heterotopias, Baudrillard's hyperreality, Deleuze's rhizome, Deleuze on difference and repetition, Žižek on ideology, Agamben on bare life, Rancière on the distribution of the sensible, Iris Murdoch on moral vision, Simone Weil on attention, Fanon on colonial psychology, bell hooks on the margin as radical space, Cornel West on prophetic pragmatism, Martha Nussbaum on capabilities, Amartya Sen on development as freedom, Bruno Latour's actor-network theory, Peter Sloterdijk on spheres, Paul Virilio on speed and politics
SCIENCE & MATH: Bell's theorem, Maxwell's demon, the double-slit experiment, quantum decoherence, the many-worlds interpretation, Schrödinger's cat as institutional metaphor, quantum entanglement, the measurement problem, Planck's constant, the photoelectric effect, special relativity's simultaneity, general relativity's frame-dragging, the equivalence principle, Hawking radiation, the information paradox, the anthropic principle, the fine-tuning problem, Boltzmann brains, entropy and the arrow of time, Maxwell's equations, the Higgs mechanism, supersymmetry's failures, the hierarchy problem, dark matter as placeholder, dark energy's acceleration, the Hubble tension, Olbers' paradox, the Fermi paradox (specifically the Great Filter), the Drake equation's uncertainties, panspermia, the RNA world hypothesis, the Cambrian explosion, punctuated equilibrium, kin selection, group selection controversy, multilevel selection, sexual selection's runaway dynamics, the handicap principle, Zahavian signaling, niche construction, epigenetics' transgenerational effects, horizontal gene transfer, the holobiont concept, the endosymbiont hypothesis, symbiogenesis, convergent evolution, evolutionary arms races, Malthusian traps, Gödel's first incompleteness theorem, Gödel's second incompleteness theorem, Russell's paradox, the halting problem, Rice's theorem, the P vs NP problem, the traveling salesman problem's intractability, Banach-Tarski paradox, the Cantor diagonal argument, Hilbert's hotel, the birthday paradox, Simpson's paradox, Braess's paradox, the Monty Hall problem, Benford's Law, the law of large numbers vs small samples, Bayes' theorem misapplication, the base rate fallacy, regression to the mean, the central limit theorem, chaos theory's sensitive dependence, the Lorenz attractor, the logistic map, fractals and self-similarity, power laws and fat tails, Zipf's law, preferential attachment, percolation theory, phase transitions, emergence and downward causation, the second law's exceptions, Maxwell's demon's resolution, Shannon entropy and information, Kolmogorov complexity, algorithmic information theory, the no-free-lunch theorem, Ramsey theory, the four-color theorem, topology's coffee cup and donut, knot theory, game theory beyond Nash: Shapley values, mechanism design, revelation principle, the folk theorem, repeated games, evolutionary stable strategies, the Price equation
PSYCHOLOGY & BEHAVIOR: Pavlovian conditioning's second-order effects, operant conditioning's schedules of reinforcement, learned helplessness's learned optimism inverse, the Rosenthal effect (Pygmalion), the nocebo effect, the placebo's dose-response curve, reactance theory, self-determination theory's three needs, construal level theory, temporal discounting, hyperbolic discounting, scope insensitivity, the affect heuristic, the peak-end rule, duration neglect, the focusing illusion, attribute substitution, the conjunction fallacy, the representativeness heuristic, the anchoring effect's persistence, the framing effect's reversals, loss aversion's 2:1 ratio, the endowment effect, mental accounting, the sunk cost fallacy's limits, the hot hand fallacy (and its rehabilitation), the gambler's fallacy, the clustering illusion, apophenia, pareidolia as pattern-detection gone wrong, motivated reasoning, identity-protective cognition, belief perseverance, the backfire effect (and its failures to replicate), cognitive load theory, working memory's 4±1 chunks, the spacing effect, the generation effect, the testing effect, transfer-appropriate processing, the fluency illusion, the illusion of explanatory depth, the curse of knowledge, the false consensus effect, the spotlight effect, the transparency illusion, self-serving bias, the fundamental attribution error's cultural variation, actor-observer asymmetry, the just-world hypothesis, system justification theory, social dominance orientation, right-wing authoritarianism's measurement, implicit association test controversies, stereotype threat's replication issues, stereotype boost, the contact hypothesis's conditions, mere exposure effect, the pratfall effect, social proof's limits in uncertainty, authority bias, the halo effect, the horn effect, physical attractiveness bias, the name-letter effect, the IKEA effect, the effort heuristic, the pain of paying, mental budgeting, the status quo bias, omission bias, the default effect, choice architecture, libertarian paternalism's tensions, self-control as muscle metaphor (now disputed), implementation intentions, temptation bundling, precommitment devices, the Ulysses contract, cognitive behavioral therapy's mechanisms, acceptance and commitment therapy, Terror Management Theory's mortality salience, the worm at the core, Csikszentmihalyi's flow conditions, self-concordance theory, broaden-and-build theory, the undoing effect, Fredrickson's 3:1 ratio (disputed), post-traumatic growth, benefit finding, the paradox of hedonism, adaptation-level theory, the hedonic treadmill, relative deprivation theory, social comparison theory's directions, the BIRGing and CORFing phenomena
HISTORY & SOCIOLOGY: the Axial Age's simultaneous emergence, the Bronze Age Collapse's systems failure, the Sea Peoples mystery, the fall of Rome's multiple causations, the Black Death's social restructuring, the printing press's 150-year lag, the Scientific Revolution's social conditions, the Dutch Golden Age's institutional innovations, the South Sea Bubble's anatomy, Tulip mania (and its revisionist history), the Mississippi Bubble, the Corn Laws debate, the first enclosure movement, the second enclosure movement, the Irish Famine's political economy, the First Industrial Revolution's Luddites, the Second Industrial Revolution's dynamo paradox, the Great Stagnation (pre-1970), Kondratiev waves, the Long Depression of 1873, the Panic of 1907, the Weimar hyperinflation's social effects, the New Deal's contested legacy, Bretton Woods and its collapse, the Nixon shock, stagflation's theory-breaking, the Washington Consensus's failures, the Asian Financial Crisis's contagion, the Long-Term Capital Management collapse, the dot-com bubble's belief system, the 2008 crisis's regulatory capture, austerity's empirical record, Piketty's r>g (and criticisms), the Great Divergence, the Great Convergence, colonial accounting (Utsa Patnaik), the resource curse, Dutch disease, the middle-income trap, institutional economics (North), the varieties of capitalism framework, Hall and Soskice on coordinated vs liberal, Esping-Andersen's three worlds, Putnam on social capital's decline, Bowling Alone's thesis, Tocqueville on associations, de Soto on dead capital, Scott's seeing like a state, James C. Scott on metis vs techne, Foucault's disciplinary society, Goffman's total institutions, Goffman on stigma, Goffman's interaction ritual, Collins's interaction ritual chains, Bourdieu's field theory, Bourdieu on symbolic violence, Elias's civilizing process, Elias on established and outsiders, Tilly on coercion and capital, Mann on the sources of social power, Wallerstein's world-systems theory, dependency theory, comparative advantage's empirical limits, the product space (Hausmann), economic complexity theory, Schumpeter's entrepreneur vs innovation bureaucracy, Hirschman's exit voice loyalty, Hirschman on the passions and the interests, Albert Hirschman on development, Olson on the logic of collective action, Ostrom on the commons, Habermas on the public sphere, the colonization of the lifeworld, Luhmann's systems theory, Beck's risk society, Ulrich Beck on reflexive modernization, Anthony Giddens on structuration, the Thomas theorem, Merton's self-fulfilling prophecy, Merton on unintended consequences, the iron law of oligarchy (Michels), elite theory (Pareto, Mosca), the circulation of elites, Mannheim on the sociology of knowledge, the sociology of scientific knowledge, Kuhn's incommensurability, Latour on trials of strength, the Matthew effect in science, Merton's CUDOS norms, the priority dispute, the multiple independent discovery phenomenon
ART, LITERATURE & CULTURE: the Homeric question, Aristotle's katharsis, Longinus on the sublime, Horace's ut pictura poesis, the querelle des anciens et des modernes, Winckelmann's noble simplicity, Burke on the sublime vs beautiful, Kant's purposiveness without purpose, Schiller on naive and sentimental poetry, Schlegel on romantic irony, Hegel on the end of art, Schopenhauer on music as will, Nietzsche's Apollo vs Dionysus, Ruskin on the pathetic fallacy, Arnold on culture as the best that has been thought, Pater on burning with a hard gem-like flame, Wilde's aestheticism, Tolstoy's infection theory, Croce on expression, Clive Bell's significant form, Roger Fry's formalism, Clement Greenberg on flatness, Harold Rosenberg on action painting, Clement Greenberg vs Kitsch, T.S. Eliot's objective correlative, Eliot on tradition and the individual talent, Pound's make it new, Benjamin's aura and mechanical reproduction, Benjamin on the flaneur, Benjamin's Arcades Project, Adorno and Horkheimer on the culture industry, Adorno on autonomous art, Adorno's negative dialectics, Brecht's Verfremdungseffekt, Lukács on reification, Lukács on the historical novel, Northrop Frye's modes and myths, Roland Barthes on the death of the author, Barthes on mythology, Barthes's punctum and studium, Susan Sontag on interpretation, Sontag on camp, Sontag on photography's reality effects, Umberto Eco on open works, Eco on hyperreality, Eco on the semiotic guerrilla, Derrida on the supplement in literature, Paul de Man on allegory, Fredric Jameson on postmodernism as cultural logic, Jameson's political unconscious, Said's orientalism, Spivak's subaltern, Homi Bhabha's hybridity, Henry Louis Gates on signifying, Houston Baker on vernacular theory, bell hooks on the oppositional gaze, Laura Mulvey's male gaze, John Berger's ways of seeing, Svetlana Alpers on the art of describing, Michael Fried on absorption and theatricality, Rosalind Krauss on the expanded field, Arthur Danto on the artworld, George Dickie's institutional theory, Nelson Goodman's languages of art, W.J.T. Mitchell on imagetext, Lev Manovich on the language of new media, Mark Fisher on hauntology, Fisher on capitalist realism, Simon Reynolds on retromania, Kodwo Eshun on further considerations of Afrofuturism, specific Borges stories as thought experiments, Calvino's If on a winter's night, DFW on irony and sincerity, Nabokov on poshlost, Pynchon's entropy stories, Philip K. Dick on simulated reality, Le Guin's thought experiments, specific Kubrick shots as metaphors, Tarkovsky on sculpting in time, Godard on cinema as truth, Werner Herzog on ecstatic truth, Lynch on ideas catching, specific Beatles recording decisions, Miles Davis's Kind of Blue as process, Glenn Gould's anti-performance, John Cage's 4'33" on silence and context, Eno's oblique strategies, the KLF's music industry sabotage, specific Radiohead album transitions, Kendrick Lamar's DAMN. structure, Beyoncé's Lemonade as visual album form
ECONOMICS & SYSTEMS: Ricardo's comparative advantage vs absolute, the Ricardian vice (over-abstraction), Mill on stationary state, Marshall's partial equilibrium, Walras's general equilibrium and its stability problems, Pigou on externalities, Coase on transaction costs and the Coase theorem's limits, Arrow's impossibility theorem, Arrow-Debreu's unrealistic assumptions, the socialist calculation debate (Mises-Hayek vs Lange), Hayek's knowledge problem vs Ostrom's managed commons, Hayek on spontaneous order, Keynes on animal spirits, Keynes's beauty contest metaphor, Keynes on the long run, Kalecki on the political business cycle, the paradox of thrift, Minsky's financial instability hypothesis, Minsky moments, Fisher's debt deflation theory, the permanent income hypothesis's failures, behavioral life-cycle theory, Modigliani-Miller and its violations, the efficient market hypothesis's three forms, the joint hypothesis problem, behavioral finance's limits to arbitrage, Shiller on irrational exuberance, Thaler's mental accounting, the equity premium puzzle, the risk-free rate puzzle, the volatility puzzle, the disposition effect, the January effect, momentum and its decay, factor investing's crowding, the Grossman-Stiglitz paradox, the winner's curse, the market for lemons (Akerlof), adverse selection vs moral hazard, the principal-agent problem's solutions, mechanism design's revelation principle, Vickrey auctions, spectrum auction design, matching theory (Gale-Shapley), the Shapley value, cooperative game theory, the folk theorem in repeated games, the ratchet effect in planning, Kornai's soft budget constraint, the Dutch disease's resource curse mechanism, the Prebisch-Singer thesis, the terms of trade debate, Bhagwati on immiserizing growth, the Washington Consensus's ten points vs reality, the Beijing Consensus, varieties of capitalism's production regimes, the knowledge economy's measurement problems, Solow's computer paradox (and its resolution), the Baumol cost disease, the Baumol effect on services, Easterlin paradox on happiness and GDP, Layard on happiness economics, Kahneman on experienced vs remembered utility, the QALY's ethical problems, cost-benefit analysis's distributional blindness, the discount rate's intergenerational ethics, Stern vs Nordhaus on climate, the social cost of carbon's uncertainty, fat-tailed catastrophe risk, Nassim Taleb on fragility vs antifragility, Taleb on skin in the game, the precautionary principle's paralysis, the innovation systems approach, the product complexity index, Hausmann on economic complexity, the capabilities approach to development, Banerjee-Duflo on randomized development, the Lucas critique, the identification problem in econometrics, Angrist-Pischke on credibility revolution, natural experiments' external validity limits, the replication crisis in economics
POP CULTURE & SPECIFIC MOMENTS: HAL 9000's "I'm sorry Dave" as machine alignment parable, 2001's bone-to-spaceship cut, the shower scene's editing in Psycho, Citizen Kane's deep focus as power metaphor, Rashomon's epistemology, Kurosawa's rain, the Battleship Potemkin's Odessa steps, Chaplin's Modern Times gear scene, the opening of Apocalypse Now, the baptism montage in The Godfather, the Sicilian message scene, Heat's coffee scene on professionalism, the diner scene in No Country for Old Men, There Will Be Blood's "I drink your milkshake", Chinatown's "Forget it Jake, it's Chinatown", the final shot of The Graduate, the freeze frame ending of The 400 Blows, the ending of Brazil (Gilliam), specific Philip K. Dick stories beyond Blade Runner, the Matrix's red pill as Baudrillard misreading, Black Mirror "The Entire History of You" on memory, "Nosedive" on social credit, "White Bear" on punishment spectacle, "Fifteen Million Merits" on attention economy, Severance's work-life separation made literal, Station Eleven on cultural memory after collapse, Succession's "we don't get to keep them" finale, The Wire's "the game is the game" on systems, The Wire's Hamsterdam experiment, Mad Men's Carousel pitch, Breaking Bad's "I am the danger", Atlanta's absurdist social realism, I May Destroy You's nonlinear trauma, Nathan Barley as pre-social-media influencer satire, Charlie Brooker on screen-life, specific Simpsons episodes with sociological weight (the monorail episode on civic boosterism, the Springfield files, the 138th episode spectacular's meta-commentary), South Park's "they took our jobs" as automation anxiety, Idiocracy as Gresham's Law applied to culture, Idiocracy's Brawndo, Don't Look Up as scientific communication failure, specific episodes of Seinfeld as pure social norm exploration, Curb Your Enthusiasm on social contract violations, Nathan Fielder's rehearsals and social scripts, specific internet moments: Harambe as collective grief displacement, the dress as perceptual relativity, the Harlem Shake as memetic mutation, TikTok's For You page as Skinner box, specific YouTube rabbit holes as filter bubble anatomy, the Fyre Festival as Veblen consumption meets logistics reality, Elizabeth Holmes's vocal fry as performed authority, WeWork's we-washing, the NFT bubble's tulip parallels, specific crypto collapses (Terra/Luna's algorithmic stablecoin hubris), the GameStop short squeeze as Minsky meets Reddit, the long-tail theory's empirical problems, the 1000 true fans as power law exception, the creator economy's middle-class squeeze
SPECIFIC STUDIES & EXPERIMENTS: the Terman longitudinal study on giftedness, the Grant Study (Harvard longitudinal on adult development), the Framingham Heart Study on social contagion of obesity and happiness, the Nurses' Health Study, Harlow's cloth vs wire mother monkeys, Bowlby's attachment observations, Ainsworth's strange situation, Spitz on hospitalism, the Perry Preschool Project, the Abecedarian Project, the Moving to Opportunity experiment, the Oregon Medicaid lottery, the RAND Health Insurance Experiment, the Negative Income Tax experiments (Mincome), the Tennessee STAR class size study, Project STAR vs HeadStart divergence, the Robbers Cave experiment, Muzafer Sherif's realistic conflict theory, the Jigsaw classroom, the Pygmalion study's replication issues, the blue-eyes/brown-eyes experiment, Zimbardo's Stanford Prison Experiment's theatrical staging (Le Texier's exposé), Milgram's obedience study's ecological validity, the Bystander Effect studies' replication (and the 2019 revision), Latané and Darley's diffusion of responsibility, the Good Samaritan experiment (Darley and Batson), Festinger's cognitive dissonance original study, Festinger's "When Prophecy Fails", Leon Festinger on social comparison, the Iowa Gambling Task, the Ultimatum Game's cross-cultural variations, the Dictator Game's experimenter effects, the Prisoner's Dilemma in repeated play, Axelrod's tit-for-tat tournament, the Public Goods Game's punishment dynamics, the Trust Game's oxytocin controversy, Paul Zak's oxytocin-trust claims (and failures), the marshmallow test's socioeconomic confounds, ego depletion's failed replication, the Power Pose controversy (Cuddy vs Simmons), priming studies' collapse, the money priming effect, the Florida effect, the facial feedback hypothesis (pen in mouth), the pen-in-mouth replication, embodied cognition's checkered replication record, growth mindset's implementation failures, grit's limited predictive validity beyond IQ, stereotype threat's boundary conditions, implicit bias training's null effects, the contact hypothesis's conditions (Pettigrew), the Robbers Cave follow-up (failed reconciliation attempts), the Realistic Conflict Theory's limits, social identity theory's minimal group paradigm, Tajfel's original studies, Terror Management Theory's mortality salience (and Covid-era tests), the Kitty Genovese story's factual errors, the broken windows policing evidence (mixed), the Scared Straight program's backfire, the D.A.R.E. program's null effects, the Cambridge-Somerville Youth Study's harm, Scared Straight's criminogenic effects, sex offender registries' counterproductive effects

Voice — write like this:
- Vary sentence length. Short punches. Then one that earns it. Then short again.
- Vivid and specific — name the thing, don't describe it abstractly.
- No academic hedging: never "one might argue", "it is worth noting", "this suggests that".
- No throat-clearing openers: never "In a world where...", "It's no secret that...", "Now more than ever...".

Also return:
- header: 3-5 words. A magazine sub-headline — specific and surprising, not generic. Examples of BAD headers: "The Bigger Picture", "What This Means", "A New Era". Examples of GOOD headers: "The Quiet Monopoly", "When Safety Becomes Control", "Debt That Builds Nations".
- pullQuote: copy one sentence verbatim from your body — the most arresting one. Must be word-for-word identical.

STORY: ${story.title}
SOURCE: ${story.source}
SECTION: ${story.section}
${story.content ? `RSS EXCERPT: ${story.content.slice(0, 400)}` : [
  story.summary ? `SUMMARY: ${story.summary}` : "",
  story.bullets?.length ? `KEY FACTS: ${story.bullets.join(". ")}` : "",
  story.insight ? `INSIGHT: ${story.insight}` : "",
].filter(Boolean).join("\n")}

TODAY'S OTHER STORIES (weave one in only if the parallel is genuinely non-obvious):
${related.map((s) => `- ${s.title} (${s.section})`).join("\n")}

Return JSON only, no markdown:
{
  "ownedTitle": "6-10 words in your writer voice. Magnetic editorial headline — name specifics (numbers, names, places), put tension or contradiction inside the headline itself, create a curiosity gap the article genuinely pays off. Rex: confrontational verdict. Eric: plain moral charge. Margot: cool disturbing observation. Finn: insider thriller hook. Cal: counter-intuitive reversal. Jack: sardonic sting. Ward: status-game exposure. Never use: Why/How/The Truth About/Game-Changer/Revolutionary/What You Need to Know. Must differ from source headline.",
  "summary": "2 punchy sentences — what happened and why it matters. Be specific.",
  "bullets": ["specific fact ≤15 words", "specific fact ≤15 words", "specific fact ≤15 words"],
  "insight": "1 sentence — the non-obvious angle or implication",
  "imageQuery": "4-6 words for Unsplash hero image. Include the main subject, industry, or setting so the image is specific to this story. No proper nouns, no brand names, no text, no logos. Examples: 'courtroom judge gavel law', 'electric car charging station night', 'military drone desert surveillance', 'cheerleaders stadium performance crowd'.",
  "header": "...",
  "pullQuote": "...",
  "body": "Pure prose, no paragraph labels. Paragraphs separated by \\n\\n."
}`,
    }],
  });

  const raw1 = pass1msg.content[0].type === "text" ? pass1msg.content[0].text : "{}";
  const text1 = raw1.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  let pass1: { ownedTitle?: string; summary?: string; bullets?: string[]; insight?: string; imageQuery?: string; header?: string; pullQuote?: string; body?: string } = {};
  try {
    pass1 = JSON.parse(text1);
    if (!pass1.body) throw new Error();
  } catch {
    const isJson = text1.startsWith("{") || text1.startsWith("[");
    pass1 = { header: "", pullQuote: "", body: isJson ? "" : text1 };
  }

  // ── Pass 2: structure — scaffold the free-write into the paragraph cadence ──
  let body = pass1.body ?? "";
  let pass1Header2 = "";
  let pass1ImageQuery2 = "";
  if (body) {
    try {
      const pass2msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 700,
        messages: [{
          role: "user",
          content: `Restructure this article body into exactly 4-5 paragraphs. Preserve ALL ideas and the original voice word-for-word where possible. Do not add new ideas.

Two jobs only:
1. Enforce the paragraph structure below
2. Break any sentence over 20 words at a natural clause boundary — em-dash, semicolon, "and", "but", "because", "which", "so". Keep both halves punchy.

Structure:
- para1: EXACTLY 1 sentence — the hook. Irreversible opener. No exceptions.
- para2: EXACTLY 1 sentence — deepens or reframes the hook. Creates tension.
- para3: 1-2 sentences — first insight or evidence. The "here's why" moment.
- para4: 2-3 sentences — the turn. Complication, contradiction, or escalation.
- para5: 1-2 sentences — landing. A sharp question, provocation, or implication. Omit if the content doesn't need it.

Also return:
- header2: 3-5 words. A second editorial sub-headline for para4 onward — same rules as a magazine sub-head but covers the second half of the argument. Specific, not generic.
- imageQuery2: 4-6 concrete atmospheric words for a second Unsplash search. No names, no text, no logos. Think: texture, environment, light, emotion.

Body to restructure:
"${body}"

Return JSON only:
{"header2":"...","imageQuery2":"...","para1":"...","para2":"...","para3":"...","para4":"...","para5":"..."}`,
        }],
      });
      const raw2 = pass2msg.content[0].type === "text" ? pass2msg.content[0].text : "{}";
      const text2 = raw2.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      const scaffold = JSON.parse(text2);
      const limits: Record<string, number> = { para1: 1, para2: 1, para3: 2, para4: 3, para5: 2 };
      const paraKeys = ["para1", "para2", "para3", "para4", "para5"];
      if (scaffold.para1 && scaffold.para2 && scaffold.para3) {
        body = paraKeys
          .filter(k => scaffold[k])
          .map(k => {
            const matches = (scaffold[k] as string).match(/[^.!?]*[.!?]+["']?\s*/g) ?? [scaffold[k]];
            return matches.slice(0, limits[k]).join(" ").trim();
          })
          .join("\n\n");
        if (scaffold.header2) pass1Header2 = scaffold.header2 as string;
        if (scaffold.imageQuery2) pass1ImageQuery2 = scaffold.imageQuery2 as string;
      }
    } catch { /* pass2 failed — use pass1 body as-is */ }
  }

  const imageUrl2 = pass1ImageQuery2
    ? await fetchUnsplash(pass1ImageQuery2, story.section, 1)
    : await fetchUnsplash(story.title, story.section, 2);

  const commentary: ArticleCommentary = {
    ownedTitle: pass1.ownedTitle ?? "",
    summary: pass1.summary ?? undefined,
    bullets: pass1.bullets?.length ? pass1.bullets : undefined,
    insight: pass1.insight ?? undefined,
    imageQuery: pass1.imageQuery ?? undefined,
    header: pass1.header ?? "",
    header2: pass1Header2,
    pullQuote: pass1.pullQuote ?? "",
    imageUrl2: imageUrl2 ?? undefined,
    body: breakLongSentences(body),
    writer: writer?.name ?? "",
  };

  // Save to Blob for this edition
  try {
    await put(blobKey, JSON.stringify(commentary), { access: "public", contentType: "application/json", addRandomSuffix: false });
  } catch { /* non-fatal */ }

  return commentary;
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
  voiceId?: number;      // 1-7, internal use only
}

export async function getFeatureCreature(editionKey: string): Promise<FeatureCreature | null> {
  const { FC_UNIVERSE, FC_ANGLE } = await import("./palette");
  const blobKey = `feature-creature/v19/${editionKey}.json`;

  try {
    const existing = await head(blobKey);
    if (existing) {
      const res = await fetch(existing.url, { cache: "no-store" });
      if (res.ok) return await res.json() as FeatureCreature;
    }
  } catch { /* generate fresh */ }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Pick a writer voice seeded by edition key
  const fcSeed = editionKey.split("").reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 7), 0);
  const fcWriterIndex = fcSeed % WRITERS.length;
  const fcWriter = WRITERS[fcWriterIndex];
  const voiceId = fcWriterIndex + 1;

  try {
    // ── Pass 1: free-write — Claude focuses purely on quality, voice, insight ──
    const [pass1msg, imageUrl] = await Promise.all([
      client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1200,
        messages: [{
          role: "user",
          content: `You are the "Feature Creature" — a sharp editorial voice that finds the real-world science, culture, or design hiding inside fictional universes. You write like the smartest friend texting you something mind-blowing at 11pm. Not a professor. Not a recap. A genuine "holy shit, I never thought of it that way" take.

Your instinct for this piece: ${fcWriter.style}

But keep the late-night energy — casual, direct, genuinely excited about the idea.

Universe: ${FC_UNIVERSE}
Angle: ${FC_ANGLE.label}
Task: ${FC_ANGLE.prompt}

Forget structure — just write the best possible take. Find ONE surprising idea and follow it somewhere unexpected. Make a real argument, not a list of observations.

Voice:
- Vary sentence length. Short punches. Then one that earns it. Then short again.
- Vivid and specific — name the actual thing, don't describe it abstractly.
- No hedging: never "one might argue", "it is worth noting", "this suggests that".
- No throat-clearing: never "In a world where...", "It's no secret...", "Now more than ever...".

Return JSON only, no markdown:
{
  "title": "6-10 words. Electrifying. Not clickbait — a real claim or provocation.",
  "synopsis": "1-2 sentences. Makes someone drop everything to read this.",
  "body": "180-220 words. Open with a sharp thesis — one irreversible claim. Then 2-3 specific supporting insights: real examples, surprising connections, observations that prove the thesis. End with a consequence or open question that lands. Every sentence earns its place.",
  "headers": ["2-3 words: the opening theme", "2-3 words: the turn or escalation"],
  "ctaHeader": "2-4 words. Active verb phrase. E.g. 'Try This Now', 'Make It Real', 'Start Here'.",
  "callToAction": "1 sentence. Specific imperative — a real thing to DO, WATCH, BUILD, or READ today. Not 'explore this topic'. Name the exact thing.",
  "digDeeper": "1 sentence. One specific book, film, essay, paper, or rabbit hole — with enough detail to find it. Not a genre. Not a Wikipedia article.",
  "pullQuote": "Copy one sentence verbatim from your body — the most arresting one. Word-for-word identical.",
  "imageQuery": "4-6 concrete visual nouns for Unsplash. Describe a real-world scene or object related to the article's central idea — NOT the fictional universe itself. E.g. for a Blade Runner/rain article: 'rain slicked city street neon reflection'."
}`
        }],
      }),
      fetchUnsplash(`${FC_UNIVERSE} ${FC_ANGLE.key}`, "Culture"),
    ]);

    const raw1 = pass1msg.content[0].type === "text" ? pass1msg.content[0].text : "{}";
    const text1 = raw1.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const pass1 = JSON.parse(text1);

    // ── Pass 2: scaffold — restructure the free-write into the para cadence ──
    const scaffoldMsg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 700,
      messages: [{
        role: "user",
        content: `Restructure this article body into 4-5 paragraphs. Preserve ALL ideas and the original voice word-for-word where possible. Do not add new ideas.

Two jobs only:
1. Enforce the paragraph structure below
2. Break any sentence over 20 words at a natural clause boundary — em-dash, semicolon, "and", "but", "because", "which", "so". Keep both halves punchy.

Structure:
- para1: EXACTLY 1 sentence — the hook. The irreversible opener. No exceptions.
- para2: EXACTLY 1 sentence — deepens or reframes the hook. Creates tension.
- para3: 1-2 sentences — first supporting insight. The "here's why" moment.
- para4: 2-3 sentences — the turn. A complication, contradiction, or escalation that changes how you see the thesis.
- para5: 1-2 sentences — the landing. A sharp consequence, open question, or provocation. Omit only if the content genuinely doesn't need it.

Body to restructure:
"${pass1.body}"

Return JSON only:
{"para1":"...","para2":"...","para3":"...","para4":"...","para5":"..."}`
      }],
    });

    const raw2 = scaffoldMsg.content[0].type === "text" ? scaffoldMsg.content[0].text : "{}";
    const text2 = raw2.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const scaffold = JSON.parse(text2);

    function trimSentences(s: string, max: number): string {
      const matches = s.match(/[^.!?]*[.!?]+["']?/g) ?? [s];
      return matches.slice(0, max).join(" ").trim();
    }
    const limits: Record<string, number> = { para1: 1, para2: 1, para3: 2, para4: 3, para5: 3 };
    const paraKeys = ["para1", "para2", "para3", "para4", "para5"];
    const body = scaffold.para1 && scaffold.para2 && scaffold.para3
      ? paraKeys
          .filter(k => scaffold[k])
          .map(k => trimSentences(scaffold[k], limits[k]))
          .join("\n\n")
      : (pass1.body ?? "");

    const parsed = pass1;

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
      body,
      pullQuote: parsed.pullQuote ?? undefined,
      callToAction: parsed.callToAction ?? "",
      digDeeper: parsed.digDeeper ?? "",
      imageUrl,
      imageUrl2,
      editionKey,
      voiceId,
    };
    put(blobKey, JSON.stringify(result), { access: "public", contentType: "application/json", addRandomSuffix: false }).catch(() => {});
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
        const res = await fetch(existing.url + "?t=" + Date.now(), { cache: "no-store" });
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
  const TIME_LABELS: Record<string, string> = {
    early: "Early Edition", morning: "Morning Edition", afternoon: "Afternoon Edition",
    evening: "Evening Edition", night: "Night Edition",
  };

  // Blob list is the authoritative source of which editions exist
  const { blobs } = await list({ prefix: "archive/editions/", limit: 100 });
  if (!blobs.length) return [];

  // Load index for metadata (theme, imageUrl, label) — best-effort
  let metaMap: Record<string, ArchiveEntry> = {};
  try {
    const existing = await head("archive/index.json");
    if (existing) {
      const res = await fetch(existing.url + "?t=" + Date.now(), { cache: "no-store" });
      if (res.ok) {
        const entries: ArchiveEntry[] = await res.json();
        for (const e of entries) metaMap[e.key] = e;
      }
    }
  } catch { /* ok — use inferred labels */ }

  const entries: ArchiveEntry[] = blobs.map(blob => {
    const key = blob.pathname.replace("archive/editions/", "").replace(".json", "");
    const parts = key.split("_");
    const date = parts[0] ?? key;
    const slot = parts[1] ?? "";
    const meta = metaMap[key];
    return {
      key,
      label: meta?.label ?? TIME_LABELS[slot] ?? key,
      date,
      theme: meta?.theme ?? "",
      imageUrl: meta?.imageUrl,
    };
  });

  return entries.sort((a, b) => b.key.localeCompare(a.key));
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

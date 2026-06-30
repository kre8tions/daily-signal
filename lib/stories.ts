import Anthropic from "@anthropic-ai/sdk";
import Parser from "rss-parser";
import { unstable_cache } from "next/cache";
import { cacheGet, cacheSet } from "@/lib/cache";
import { put, head, list } from "@vercel/blob";
import { createHash } from "crypto";
import { getLens } from "./palette";

const parser = new Parser({
  customFields: { item: ["media:content", "media:thumbnail", "enclosure"] },
});

// ── Types ─────────────────────────────────────────────────────────────────────
export interface RawItem {
  title: string; content: string; source: string;
  section: string; link: string; pubDate: string;
  rssImageUrl?: string;
  preferRssImage?: boolean;
}

export interface Story {
  title: string; ownedTitle?: string; source: string; section: string; link: string; pubDate: string;
  imageUrl?: string; imageColor?: string; summary?: string; bullets?: string[];
  pullquote?: string; cta?: { header: string; body: string }; hasKeyFacts?: boolean; cardStyle: "full" | "pullquote" | "brief";
  imageQuery?: string; content?: string; generationError?: string;
}

export interface Synthesis {
  theme: string; hook: string; observation: string; takeaways: string[]; conclusion: string; actions: string[];
  imageUrl?: string; imageQuery?: string;
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
  // Psychology / Self-Improvement — behavior, habits, overcoming fear, human potential
  { url: "https://greatergood.berkeley.edu/feeds/greatergood",                source: "Greater Good",        section: "Psychology"    },
  { url: "https://behavioralscientist.org/feed/",                             source: "Behavioral Scientist", section: "Psychology"   },
  { url: "https://www.psychologytoday.com/us/front-page/feed",                source: "Psychology Today",    section: "Psychology"    },
  { url: "https://elemental.medium.com/feed",                                 source: "Elemental",           section: "Psychology"    },
  { url: "https://www.vox.com/future-perfect/rss",                            source: "Vox Future Perfect",  section: "Psychology"    },
  // Human Potential — Outliers-style, high achievers, overcomers, lessons from exceptional people
  { url: "https://fs.blog/feed/",                                             source: "Farnam Street",       section: "HumanPotential" },
  { url: "https://bigthink.com/feed/",                                        source: "Big Think",           section: "HumanPotential" },
  { url: "https://freakonomics.com/feed/",                                    source: "Freakonomics",        section: "HumanPotential" },
  { url: "https://www.inc.com/rss.xml",                                       source: "Inc.",                section: "HumanPotential" },
  { url: "https://www.fastcompany.com/leadership/rss",                        source: "Fast Company Ideas",  section: "HumanPotential" },
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
  // K-pop — prefer RSS images since editorial photos are better than Unsplash stock
  { url: "https://www.allkpop.com/rss",                                     source: "allkpop",             section: "Entertainment", preferRssImage: true },
  { url: "https://www.soompi.com/feed",                                     source: "Soompi",              section: "Entertainment", preferRssImage: true },
  { url: "https://www.koreaboo.com/feed/",                                  source: "Koreaboo",            section: "Entertainment", preferRssImage: true },
  // Viral / feel-good / weird
  { url: "https://www.iflscience.com/rss.xml",                              source: "IFLScience",          section: "Science"       },
  { url: "https://www.thecooldown.com/feed/",                               source: "The Cool Down",       section: "Culture"       },
  { url: "https://www.boredpanda.com/feed/",                                source: "Bored Panda",         section: "Culture"       },
  // True Crime / human interest
  { url: "https://crimereads.com/feed/",                                    source: "Crime Reads",         section: "Culture"       },
  { url: "https://www.mentalfloss.com/rss.xml",                             source: "Mental Floss",        section: "Culture"       },
  // Weird / wondrous
  { url: "https://www.odditycentral.com/feed",                              source: "Oddity Central",      section: "Culture"       },
  { url: "https://www.atlasobscura.com/feeds/latest",                       source: "Atlas Obscura",       section: "Culture"       },
  // Internet Culture / global tech
  { url: "https://restofworld.org/feed/latest/",                            source: "Rest of World",       section: "Technology"    },
  { url: "https://knowyourmeme.com/feed",                                   source: "Know Your Meme",      section: "Entertainment" },
  // Food — afternoon slot only
  { url: "https://www.eater.com/rss/index.xml",                             source: "Eater",               section: "Food",          slotOnly: "afternoon" },
  { url: "https://www.bonappetit.com/feed/rss",                             source: "Bon Appétit",         section: "Food",          slotOnly: "afternoon" },
  // Sports — evening slot only
  { url: "https://bleacherreport.com/articles/feed",                        source: "Bleacher Report",     section: "Sports",        slotOnly: "evening"  },
  { url: "https://theathletic.com/rss/news/",                               source: "The Athletic",        section: "Sports",        slotOnly: "evening"  },
  // Graphic Novels / Comics — max 1 per edition, prefer RSS images
  { url: "https://www.comicsbeat.com/feed/",                                source: "The Beat",            section: "Comics",        preferRssImage: true },
  { url: "https://www.cbr.com/feed/",                                       source: "CBR",                 section: "Comics",        preferRssImage: true },
  { url: "https://www.previewsworld.com/Article/RSSFeed",                   source: "Previews World",      section: "Comics",        preferRssImage: true },
  // Anime — max 1 per edition, prefer RSS images
  { url: "https://www.animenewsnetwork.com/news/rss.xml?ann-edition=w",     source: "Anime News Network",  section: "Anime",         preferRssImage: true },
  { url: "https://www.crunchyroll.com/news/rss.xml",                        source: "Crunchyroll News",    section: "Anime",         preferRssImage: true },
  { url: "https://myanimelist.net/rss/news.xml",                            source: "MyAnimeList",         section: "Anime",         preferRssImage: true },
];

const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
const ONE_HOUR   =      60 * 60 * 1000;
const SEVEN_DAYS = 7 * 24 * ONE_HOUR;

// ── Edition windows (5 per day, ~4 hrs each) ─────────────────────────────────
// Build clock is UTC+14 (earliest timezone) so every reader's day has started
// before the first edition of that UTC+14 date is built.
const UTC14_OFFSET_MS = 14 * 60 * 60 * 1000;

function utc14Now(): { h: number; date: string } {
  const d = new Date(Date.now() + UTC14_OFFSET_MS);
  return { h: d.getUTCHours(), date: d.toISOString().slice(0, 10) };
}

function slotFromHour(h: number, date: string): { label: string; key: string } {
  if (h >= 5  && h < 9)  return { label: "First Light",    key: `${date}_early`    };
  if (h >= 9  && h < 13) return { label: "The Brief",      key: `${date}_morning`  };
  if (h >= 13 && h < 17) return { label: "Midday",         key: `${date}_afternoon`};
  if (h >= 17 && h < 21) return { label: "The Digest",     key: `${date}_evening`  };
  return                         { label: "Night Dispatch", key: `${date}_night`    };
}

export function getEdition(): { label: string; key: string } {
  const { h, date } = utc14Now();
  return slotFromHour(h, date);
}

export function getEditionForTimezone(timezone: string): { label: string; key: string } {
  try {
    const now = new Date();
    // Blob keys use UTC+14 date (build clock) — local hour selects the slot
    const keyDate = new Date(Date.now() + UTC14_OFFSET_MS).toISOString().slice(0, 10);
    const h = parseInt(
      new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: timezone }).format(now),
      10
    );
    return slotFromHour(h, keyDate);
  } catch {
    return getEdition();
  }
}

export function getNextEdition(): { label: string; key: string } {
  const future = new Date(Date.now() + UTC14_OFFSET_MS + 16 * 60 * 1000);
  return slotFromHour(future.getUTCHours(), future.toISOString().slice(0, 10));
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

// ── Unsplash fallback ─────────────────────────────────────────────────────────
// Common first names that alone produce irrelevant image searches
const NAME_RE = /^(coco|gauff|lebron|elon|trump|biden|taylor|swift|bezos|musk|zuck|serena|oprah|drake|kanye|adele|rihanna|beyonce|kendall|kim|kylie|jeff|tim|mark|lisa|john|james|mike|david|sarah|emma|anna|maria|carlos|alex|chris|ryan|kate|amy|paul|peter|joe|bob|dan|tom|brad|leo|will|sam|max|ben|jack|eric|scott|adam|nick|jake|noah|matt|luke|owen|ethan|liam|tyler|jason|aaron|brian|kevin|sean|gary|frank|tony|henry)$/i;
// Words that produce morbid/wrong images when used as search queries
const MORBID_RE = /^(dead|dies|died|death|killed|kill|murder|murdered|shooting|stabbed|crash|crashes|fatal|fatally|suicide|overdose|cancer|disease|illness|sick|hospital|obituary|obit|funeral|buried|burial|skeleton|corpse|victim|victims|massacre|genocide|tragedy|tragic|devastat)$/i;
// Detect obituary headlines
const OBIT_RE = /\b(dead|dies|died|has died|passed away|obituary|obit|in memoriam)\b/i;

export async function fetchUnsplash(headline: string, section?: string, page = 1, imageQuery?: string): Promise<{ url: string; color?: string } | undefined> {
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

  // Detect named cultural works in the headline (film, show, book, game) — e.g. "Contact Made Us Afraid…"
  // Pattern: 1-3 Title Case words at the start of the headline before a verb or connector
  const culturalSections = new Set(["Film", "Entertainment", "Arts", "Culture", "Comics", "Anime"]);
  let namedWorkQuery: string | undefined;
  if (culturalSections.has(section ?? "")) {
    const titleMatch = headline.match(/^((?:[A-Z][a-zA-Z']+(?:\s+|$)){1,4})/);
    const candidate = titleMatch?.[1]?.trim();
    // Only use if it's not just the same as a generic word and appears to be a proper title (≥1 capitalized word, ≤4 words)
    if (candidate && candidate.split(" ").length <= 4 && /[A-Z]/.test(candidate[0])) {
      const sectionHint = section === "Film" ? "film" : section === "Comics" ? "comic" : section === "Anime" ? "anime" : "series";
      namedWorkQuery = `${candidate} ${sectionHint}`;
    }
  }

  const queries = [
    ...(personQuery ? [personQuery, `${personQuery} portrait`] : []),
    ...(imageQuery ? [imageQuery] : []),
    ...(namedWorkQuery && !imageQuery ? [namedWorkQuery] : []),
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
      const photo = results[results.length - 1] ?? results[0];
      const url = photo?.urls?.regular
        ? (photo.urls.regular as string).replace(/&w=\d+/, "&w=1600")
        : undefined;
      if (url) return { url, color: photo.color as string | undefined };
    } catch { continue; }
  }
  return undefined;
}

function imgCacheKey(link: string) {
  return `artimg_v4_${createHash("md5").update(link).digest("hex")}`;
}

async function getArticleImage(article: { link: string; title: string; section?: string; imageQuery?: string; rssImageUrl?: string; preferRssImage?: boolean }): Promise<{ url: string; color?: string } | undefined> {
  if (article.preferRssImage && article.rssImageUrl) return { url: article.rssImageUrl };
  const cKey = imgCacheKey(article.link);
  const hit = cacheGet<string>(cKey);
  if (hit) return hit === "__none__" ? undefined : { url: hit };

  const unsplash = await fetchUnsplash(article.title, article.section, 1, article.imageQuery);
  if (unsplash) { cacheSet(cKey, unsplash.url, THREE_DAYS); return unsplash; }
  cacheSet(cKey, "__none__", ONE_HOUR);
  return undefined;
}

export async function getUniqueImages(articles: (RawItem & { imageQuery?: string; preferRssImage?: boolean })[]): Promise<{ url?: string; color?: string }[]> {
  const raw = await Promise.all(articles.map((a) => getArticleImage(a)));
  const seen = new Set<string>();
  const result: { url?: string; color?: string }[] = [];
  for (let i = 0; i < raw.length; i++) {
    const img = raw[i];
    if (!img?.url || !seen.has(img.url)) {
      if (img?.url) seen.add(img.url);
      result.push(img ?? {});
    } else {
      const cKey = imgCacheKey(articles[i].link);
      cacheSet(cKey, "__none__", 1);
      const fresh = await fetchUnsplash(articles[i].title + " " + articles[i].section, undefined, 1, articles[i].imageQuery);
      if (fresh && !seen.has(fresh.url)) {
        seen.add(fresh.url);
        cacheSet(cKey, fresh.url, THREE_DAYS);
        result.push(fresh);
      } else {
        result.push({});
      }
    }
  }
  return result;
}

// ── Edition key helpers ───────────────────────────────────────────────────────
const SLOT_ORDER = ["early", "morning", "afternoon", "evening", "night"] as const;

function getPreviousEditionKey(editionKey: string): string | null {
  const parts = editionKey.split("_");
  const slot = parts[parts.length - 1];
  const date = parts.slice(0, -1).join("_");
  const idx = SLOT_ORDER.indexOf(slot as typeof SLOT_ORDER[number]);
  if (idx < 0) return null;
  if (idx > 0) return `${date}_${SLOT_ORDER[idx - 1]}`;
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.toISOString().slice(0, 10)}_night`;
}

async function loadUsedLinks(editionKey: string): Promise<Set<string>> {
  const keys: string[] = [];
  let cur = editionKey;
  for (let i = 0; i < 150; i++) {
    const prev = getPreviousEditionKey(cur);
    if (!prev) break;
    keys.push(prev);
    cur = prev;
  }
  if (!keys.length) return new Set();
  const results = await Promise.all(keys.map(async (key) => {
    try {
      const blob = await head(`archive/editions/${key}.json`);
      if (!blob) return [];
      const res = await fetch(blob.url, { cache: "no-store" });
      if (!res.ok) return [];
      const data = await res.json() as { stories: { link: string }[] };
      return data.stories.map(s => s.link);
    } catch { return []; }
  }));
  return new Set(results.flat());
}

// ── RSS fetch with section quotas ─────────────────────────────────────────────
export async function fetchTopStories(editionKey: string): Promise<{ primary: RawItem[]; bench: RawItem[] }> {
  const key = `raw2_${editionKey}`;
  const hit = cacheGet<{ primary: RawItem[]; bench: RawItem[] }>(key);
  if (hit) return hit;

  const slot = editionKey.split("_").pop() ?? "";
  const activeFeeds = FEEDS.filter(f => {
    if (f.section === "Faith" && !isSundayEarlyMorning()) return false;
    if ("slotOnly" in f && f.slotOnly && f.slotOnly !== slot) return false;
    return true;
  });
  const FRESH_MS = 10 * ONE_HOUR;
  const now = Date.now();

  // Load previous edition's used links + all feeds in parallel, then filter
  const [rawFeeds, usedLinks] = await Promise.all([
    Promise.allSettled(
      activeFeeds.map(async (feed) => {
        const timeout = new Promise<never>((_, r) => setTimeout(() => r(new Error("t")), 8000));
        const parsed = await Promise.race([parser.parseURL(feed.url), timeout]);
        return parsed.items.slice(0, 8).map((item) => ({
          title: decodeEntities(item.title ?? ""), content: decodeEntities(item.contentSnippet ?? ""),
          source: feed.source, section: feed.section,
          link: item.link ?? "", pubDate: item.pubDate ?? new Date().toISOString(),
          rssImageUrl: extractRssImage(item),
          ...("preferRssImage" in feed && feed.preferRssImage ? { preferRssImage: true as const } : {}),
        }));
      })
    ),
    loadUsedLinks(editionKey),
  ]);

  const isF = (i: RawItem) => now - new Date(i.pubDate).getTime() < FRESH_MS;
  const results = rawFeeds.map(r => {
    if (r.status === "rejected") return { status: "fulfilled" as const, value: [] as RawItem[] };
    const mapped = r.value;
    const unused      = mapped.filter(i => !usedLinks.has(i.link));
    const unusedFresh = unused.filter(i => isF(i));
    const pool = unusedFresh.length > 0 ? unusedFresh : unused;
    return { status: "fulfilled" as const, value: pool.slice(0, 3) };
  });

  const all = dedupeByTopic(results.flatMap((r) => r.status === "fulfilled" ? r.value : []));
  const CREATIVE = ["Entertainment", "Arts", "Culture", "Film", "Faith"];
  const tech: RawItem[] = [], creative: RawItem[] = [], science: RawItem[] = [], psychology: RawItem[] = [], humanPotential: RawItem[] = [], food: RawItem[] = [], sports: RawItem[] = [], comics: RawItem[] = [], anime: RawItem[] = [];
  for (const item of all) {
    if (item.section === "Technology") tech.push(item);
    else if (item.section === "Science") science.push(item);
    else if (item.section === "Psychology") psychology.push(item);
    else if (item.section === "HumanPotential") humanPotential.push(item);
    else if (item.section === "Food") food.push(item);
    else if (item.section === "Sports") sports.push(item);
    else if (item.section === "Comics") comics.push(item);
    else if (item.section === "Anime") anime.push(item);
    else if (CREATIVE.includes(item.section)) creative.push(item);
  }
  // S1/S2: alternate between Psychology and HumanPotential (Outliers-style) — highest engagement slots
  // slot extras REPLACE random s2-s11 slots (never s1, never append)
  const uplift = [...psychology, ...humanPotential]; // combined self-improvement pool
  const upl = uplift.slice(0, 3), sci = science.slice(0, 2), cre = creative.slice(0, 4), tec = tech.slice(0, 3);
  const slotExtras = [...food.slice(0, 1), ...sports.slice(0, 1), ...comics.slice(0, 1), ...anime.slice(0, 1)];
  // S1 = best uplift story; S2 = second uplift or science; rows 1+2 are always high-engagement
  const corePool = [upl[0] ?? sci[0], upl[1] ?? sci[0], upl[2] ?? sci[1], cre[0], sci[0] ?? upl[0], cre[1], cre[2], cre[3], tec[0], tec[1], tec[2]].filter(Boolean);
  // Seeded Fisher-Yates shuffle of s2-s11 indices to pick replacement positions
  const poolSeed = editionKey.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const srPool = (n: number) => { const x = Math.sin(poolSeed * 127 + n * 311) * 10000; return x - Math.floor(x); };
  const candidates = Array.from({ length: corePool.length - 1 }, (_, i) => i + 1); // indices 1..N (s2-s11)
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(srPool(i) * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const replaceAt = new Set(candidates.slice(0, slotExtras.length));
  const mutablePool = [...corePool];
  let ei = 0;
  for (const pos of Array.from(replaceAt).sort((a, b) => a - b)) {
    if (ei < slotExtras.length) mutablePool[pos] = slotExtras[ei++];
  }
  const pool = mutablePool.filter(Boolean).slice(0, 11);
  // Deals and negative/dark stories must never appear in S1–S3; push them toward the end
  const isNeg = (s: RawItem) => NEGATIVE_RE.test(s.title) || DEAL_RE.test(s.title) || DEAL_RE.test(s.content);
  const negative = pool.filter(isNeg);
  const positive = pool.filter(s => !isNeg(s));
  const selected = [...positive, ...negative];

  // Bench: next-best unused items from each category to backfill any primary failures
  const primaryLinks = new Set(selected.map(s => s.link));
  const bench = [
    ...science.slice(3, 5),
    ...creative.slice(5, 8),
    ...tech.slice(3, 5),
  ].filter(s => !primaryLinks.has(s.link)).slice(0, 5);

  const result = { primary: selected, bench };
  cacheSet(key, result, 8 * ONE_HOUR);
  return result;
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
    max_tokens: 1800,
    messages: [{
      role: "user",
      content: `You are the editorial voice of The Signal — a news digest that finds the load-bearing beam, not the surface pattern. Your job: look at today's stories and find what connects them underneath — not the obvious shared topic, but the shared mechanism, the shared anxiety, the shared structural shift.

Writer instinct for this edition: ${synthWriter.style}

Voice rules:
- First-person editorial: opinions, interpretations, predictions — not reportage.
- Never restate a headline. Name the mechanism, not the event.
- Never open with "Today's", "This collection", "These stories", "Across today's".
- No ideological framing. No culture-war lens.
- Specific beats abstract. Name the story, the company, the person, the decision.

${storyList}

Return JSON only, no markdown:
{
  "theme": "2-4 words. An evocative noun phrase naming the underlying force or tension — not a topic, a dynamic. E.g. 'The Permission Economy' / 'Controlled Disintegration' / 'Institutional Overcorrection'. Not 'Technology and Society'.",
  "hook": "1 sentence only. The irreversible claim — the thing that cannot be unsaid once you read it. This is the first thing the reader sees. No setup, no throat-clearing. Start with the tension, not the context.",
  "observation": "1-2 sentences that deepen the hook. Don't summarize stories — name what they collectively reveal. End somewhere that makes the reader want to read the takeaways.",
  "takeaways": [
    "Name the non-obvious connection between at least two specific stories (name them by source or subject). One sentence on the shared mechanism — not the shared topic.",
    "The structural tension or irony that runs through today's stories. Cite at least one specific story. 1-2 sentences.",
    "A forward-looking implication: who is positioned to win, what breaks next, what pattern this repeats. Ground it in today's specific stories. 1-2 sentences."
  ],
  "conclusion": "The most screenshot-worthy sentence in the entire card. A provocation, not a summary. Should make someone want to share it. Sharp enough to stand alone without context. Do not start with 'Today' or 'Ultimately' or 'In the end'.",
  "actions": [
    "Imperative sentence. Start with a strong verb: Go, Make, Start, Write, Pick, Find, Ask, Build, Try, Post. No preamble, no 'given that', no 'based on today'. Reader already knows the context. Beginner-friendly, specific, zero experience needed. Max 15 words.",
    "Imperative sentence. Different verb, different angle. Low-risk, this-week doable. Same rules: no setup, just the action. Max 15 words.",
    "Imperative sentence. The smallest possible move — under 10 minutes, costs nothing. Starts with a verb. Max 15 words."
  ],
  "imageQuery": "4-6 concrete visual words for Unsplash that match the mood and texture of today's theme — a real scene or object, not an abstraction. E.g. for 'institutional friction': 'empty government hallway fluorescent light'; for 'surveillance creep': 'security camera corner urban shadow'. No abstract nouns. No brand names."
}`,
    }],
  }).catch(() => null);

  if (!msg) return { theme: "", hook: "", observation: "", takeaways: [], conclusion: "", actions: [] };
  const rawText = msg.content[0].type === "text" ? msg.content[0].text : "{}";
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as Synthesis;
    // Use article-derived imageQuery for the synthesis image; fall back to theme words
    const imgQuery = (parsed.imageQuery || parsed.theme || "").replace(/[^a-zA-Z\s]/g, "").trim();
    if (imgQuery) {
      parsed.imageUrl = await fetchUnsplash(imgQuery, undefined, 1, imgQuery).then(r => r?.url).catch(() => undefined);
    }
    put(blobKey, JSON.stringify(parsed), { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true }).catch(() => {});
    return parsed;
  } catch {
    return { theme: "", hook: "", observation: "", takeaways: [], conclusion: "", actions: [] };
  }
}

// ── Assemble page data (cached per edition via Next.js data cache) ────────────
const CARD_STYLES: Story["cardStyle"][] = ["full", "pullquote", "brief", "brief", "brief", "brief", "brief", "brief", "brief", "brief", "brief"];

export async function buildPageData(editionKey: string, editionLabel: string): Promise<PageData> {
  const { primary: raw, bench } = await fetchTopStories(editionKey);
  const writerSlots = getWriterAssignments(editionKey);

  // Synthesis and FC run in background while articles are batched
  const synthesisPromise = getSynthesis(raw, editionKey);
  const fcPromise = getFeatureCreature(editionKey).catch(() => null);

  // Generate articles in batches of 3 to avoid Claude rate-limit bursts.
  // 11 simultaneous × 4 passes each = ~44 concurrent calls; batching keeps it to ~12 at a time.
  const BATCH = 3;
  const articleResults: PromiseSettledResult<ArticleCommentary>[] = [];
  for (let b = 0; b < raw.length; b += BATCH) {
    const batchResults = await Promise.allSettled(
      raw.slice(b, b + BATCH).map((item, bi) => {
        const i = b + bi;
        const storyShell: Story = { ...item, cardStyle: CARD_STYLES[i] ?? "brief" };
        const relatedShells = raw.filter((_, j) => j !== i).slice(0, 5).map(r => ({ ...r, cardStyle: "brief" as const }));
        return getFullArticle(storyShell, relatedShells, editionKey, writerSlots[i]);
      })
    );
    articleResults.push(...batchResults);
    if (b + BATCH < raw.length) await new Promise(r => setTimeout(r, 800));
  }

  // Backfill: for each failed primary slot, try a bench story
  const arts: (ArticleCommentary | null)[] = articleResults.map(r => r.status === "fulfilled" ? r.value : null);
  const activeRaw = [...raw];
  let benchIdx = 0;
  const failedSlots = arts.map((a, i) => (!a?.summary ? i : -1)).filter(i => i >= 0);
  if (failedSlots.length > 0 && bench.length > 0) {
    await new Promise(r => setTimeout(r, 800));
    for (const slot of failedSlots) {
      if (benchIdx >= bench.length) break;
      const benchItem = bench[benchIdx++];
      const storyShell: Story = { ...benchItem, cardStyle: CARD_STYLES[slot] ?? "brief" };
      const relatedShells = activeRaw.filter((_, j) => j !== slot).slice(0, 5).map(r2 => ({ ...r2, cardStyle: "brief" as const }));
      try {
        const result = await getFullArticle(storyShell, relatedShells, editionKey, writerSlots[slot]);
        arts[slot] = result;
        activeRaw[slot] = benchItem;
      } catch { /* leave slot as failed */ }
    }
  }

  const [synthesis, featureCreature] = await Promise.all([synthesisPromise, fcPromise]);

  const artErrors = arts.map((a, i) => (!a && articleResults[i]?.status === "rejected") ? String((articleResults[i] as PromiseRejectedResult).reason) : undefined);
  const rawWithQuery = activeRaw.map((r, i) => ({ ...r, imageQuery: arts[i]?.imageQuery }));
  const images = await getUniqueImages(rawWithQuery);

  const allStories: Story[] = activeRaw.map((r, i) => ({
    ...r,
    imageUrl: images[i]?.url,
    imageColor: images[i]?.color,
    cardStyle: CARD_STYLES[i] ?? "brief",
    ownedTitle: arts[i]?.ownedTitle,
    summary: arts[i]?.summary,
    bullets: arts[i]?.bullets,
    pullquote: arts[i]?.pullQuote,
    imageQuery: arts[i]?.imageQuery,
    cta: arts[i]?.cta,
    hasKeyFacts: arts[i]?.hasKeyFacts,
    generationError: artErrors[i],
  }));

  // Promote successful stories into s1/s2 if they failed; push failed to end as placeholders
  const successful = allStories.filter(s => s.summary);
  const failed = allStories.filter(s => !s.summary);
  const stories: Story[] = [
    ...successful.map((s, i) => ({ ...s, cardStyle: CARD_STYLES[i] ?? "brief" as Story["cardStyle"] })),
    ...failed.map(s => ({ ...s, cardStyle: "brief" as const })),
  ];

  const pageData: PageData = { stories, synthesis, editionLabel, featureCreature: featureCreature ?? undefined };
  cacheSet(`edition_${editionKey}`, pageData, SEVEN_DAYS);
  await put(`archive/editions/${editionKey}.json`, JSON.stringify(pageData), {
    access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true,
  }).catch(() => {});
  saveToArchive({
    key: editionKey, label: editionLabel,
    date: editionKey.split("_")[0], theme: synthesis.theme, imageUrl: stories[0]?.imageUrl,
  }).catch(() => {});

  // Pre-generate how-to pages — awaited so they complete before waitUntil exits
  if (synthesis.actions?.length) {
    const context = { theme: synthesis.theme, hook: synthesis.hook };
    await Promise.allSettled(
      synthesis.actions.map(action => generateHowTo(action, actionSlug(action), context))
    );
  }

  return pageData;
}

export async function getPageData(edition?: { key: string; label: string }): Promise<PageData> {
  const utcEdition = getEdition();
  const { label: editionLabel, key: editionKey } = edition ?? utcEdition;
  // No unstable_cache — page is force-dynamic, blob reads are fast, and caching
  // empty results caused stale blank pages when local-slot and UTC+14 slot diverge.
  const archived = await getArchivedPageData(editionKey);
  if (archived) return archived;
  // Local-slot blob not built yet — fall back to current UTC+14 edition silently.
  if (edition && editionKey !== utcEdition.key) {
    const utcArchived = await getArchivedPageData(utcEdition.key);
    if (utcArchived) return utcArchived;
  }
  return { stories: [], synthesis: { theme: "", hook: "", observation: "", takeaways: [], conclusion: "", actions: [] }, editionLabel };
}

// ── Single story for article detail page ─────────────────────────────────────
export async function getStoryBySlug(slug: string, editionHint?: string): Promise<Story | null> {
  const url = slugToUrl(slug);

  // Fast path: use edition hint from URL query param (?e=editionKey)
  if (editionHint) {
    const hinted = await getArchivedPageData(editionHint);
    const match = hinted?.stories.find((s) => s.link === url);
    if (match) return match;
  }

  // Fall back to current UTC+14 edition
  const { stories } = await getPageData();
  const found = stories.find((s) => s.link === url);
  if (found) return found;

  // Last resort: scan recent archive blobs
  try {
    const { blobs } = await list({ prefix: "archive/editions/", limit: 15 });
    const keys = blobs
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())
      .map(b => b.pathname.replace("archive/editions/", "").replace(".json", ""))
      .filter(k => k !== editionHint);
    for (const key of keys) {
      const archived = await getArchivedPageData(key);
      if (!archived) continue;
      const match = archived.stories.find((s) => s.link === url);
      if (match) return match;
    }
  } catch { /* archive scan failed */ }

  return null;
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
  } catch (e) { console.warn("[getHowTo] blob lookup failed", blobKey, e); }

  return null;
}

export async function generateHowTo(action: string, slug: string, context?: { theme?: string; hook?: string }): Promise<HowTo | null> {
  console.log("[generateHowTo] called", slug, "action length:", action?.length);
  const blobKey = `howto/${slug}.json`;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const contextLine = context?.theme || context?.hook
    ? `\nEDITION CONTEXT (use this to make steps specific and relevant, but don't mention it explicitly):\nTheme: ${context.theme ?? ""}\nInsight: ${context.hook ?? ""}\n`
    : "";
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `You are a practical coach for beginners and early creators. Someone just read this action step and wants to know how to do it in 3 concrete moves.
${contextLine}
ACTION: "${action}"

Rules:
- Steps should feel specific to the action's topic, not generic productivity advice.
- Each instruction is one sentence. Simple language, no jargon, no fluff.
- "why" is motivating and specific — name the real payoff, not "it will help you grow."

Return JSON only:
{
  "title": "The action rewritten as a clear imperative title (max 10 words)",
  "steps": [
    { "heading": "3-5 word label", "instruction": "Exactly what to do first. One sentence." },
    { "heading": "3-5 word label", "instruction": "The next move. One sentence." },
    { "heading": "3-5 word label", "instruction": "How to finish or follow through. One sentence." }
  ],
  "why": "One sentence. The specific real-world payoff of doing this."
}`,
      }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
    const json = JSON.parse(text.replace(/^```json\n?/, "").replace(/\n?```$/, "")) as HowTo;
    await put(blobKey, JSON.stringify(json), { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
    return json;
  } catch (e) { console.error("[generateHowTo] failed", slug, e); return null; }
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

const _REF_CATS: [string, string][] = [
  ["PHILOSOPHY", `Thales on arche, Heraclitus on flux, Parmenides on being, Zeno's paradoxes, Socratic elenchus, Plato's allegory of the cave, Aristotle's four causes, Epicurus on ataraxia, Epictetus on the dichotomy of control, Marcus Aurelius on impermanence, Plotinus on emanation, Augustine on time, Aquinas on natural law, Ockham on universals, Machiavelli on virtù, Montaigne's essays, Spinoza's substance monism, Leibniz's monads, Hobbes on the state of nature, Locke on tabula rasa, Hume on causation, Berkeley on esse est percipi, Kant's categorical imperative, Kant's sublime, Hegel's dialectic, Schopenhauer's will, Kierkegaard's leap of faith, Nietzsche's eternal recurrence, Nietzsche's will to power, Nietzsche on ressentiment, Husserl's phenomenology, Heidegger's thrownness, Heidegger's das Man, Sartre's bad faith, Sartre's gaze, Camus's absurd, Merleau-Ponty on embodied cognition, Simone de Beauvoir on the Other, Hannah Arendt on the banality of evil, Arendt on natality, Wittgenstein's language games, Wittgenstein's private language argument, Popper's falsifiability, Kuhn's paradigm shifts, Lakatos on research programs, Feyerabend on methodological anarchism, Rawls' veil of ignorance, Rawls' difference principle, Nozick's minimal state, Parfit on personal identity, Parfit on reasons and persons, Nagel's What Is It Like to Be a Bat, Frankfurt on bullshit, Singer's drowning child, Judith Jarvis Thomson's violinist, Bernard Williams on integrity, Philippa Foot's trolley variants, Derek Parfit on future generations, Levinas on the face of the Other, Derrida's différance, Derrida on the supplement, Foucault on biopower, Foucault on heterotopias, Baudrillard's hyperreality, Deleuze's rhizome, Deleuze on difference and repetition, Žižek on ideology, Agamben on bare life, Rancière on the distribution of the sensible, Iris Murdoch on moral vision, Simone Weil on attention, Fanon on colonial psychology, bell hooks on the margin as radical space, Cornel West on prophetic pragmatism, Martha Nussbaum on capabilities, Amartya Sen on development as freedom, Bruno Latour's actor-network theory, Peter Sloterdijk on spheres, Paul Virilio on speed and politics`],
  ["SCIENCE & MATH", `Bell's theorem, Maxwell's demon, the double-slit experiment, quantum decoherence, the many-worlds interpretation, Schrödinger's cat as institutional metaphor, quantum entanglement, the measurement problem, Planck's constant, the photoelectric effect, special relativity's simultaneity, general relativity's frame-dragging, the equivalence principle, Hawking radiation, the information paradox, the anthropic principle, the fine-tuning problem, Boltzmann brains, entropy and the arrow of time, Maxwell's equations, the Higgs mechanism, supersymmetry's failures, the hierarchy problem, dark matter as placeholder, dark energy's acceleration, the Hubble tension, Olbers' paradox, the Fermi paradox (specifically the Great Filter), the Drake equation's uncertainties, panspermia, the RNA world hypothesis, the Cambrian explosion, punctuated equilibrium, kin selection, group selection controversy, multilevel selection, sexual selection's runaway dynamics, the handicap principle, Zahavian signaling, niche construction, epigenetics' transgenerational effects, horizontal gene transfer, the holobiont concept, the endosymbiont hypothesis, symbiogenesis, convergent evolution, evolutionary arms races, Malthusian traps, Gödel's first incompleteness theorem, Gödel's second incompleteness theorem, Russell's paradox, the halting problem, Rice's theorem, the P vs NP problem, the traveling salesman problem's intractability, Banach-Tarski paradox, the Cantor diagonal argument, Hilbert's hotel, the birthday paradox, Simpson's paradox, Braess's paradox, the Monty Hall problem, Benford's Law, the law of large numbers vs small samples, Bayes' theorem misapplication, the base rate fallacy, regression to the mean, the central limit theorem, chaos theory's sensitive dependence, the Lorenz attractor, the logistic map, fractals and self-similarity, power laws and fat tails, Zipf's law, preferential attachment, percolation theory, phase transitions, emergence and downward causation, the second law's exceptions, Maxwell's demon's resolution, Shannon entropy and information, Kolmogorov complexity, algorithmic information theory, the no-free-lunch theorem, Ramsey theory, the four-color theorem, topology's coffee cup and donut, knot theory, game theory beyond Nash: Shapley values, mechanism design, revelation principle, the folk theorem, repeated games, evolutionary stable strategies, the Price equation`],
  ["PSYCHOLOGY & BEHAVIOR", `Pavlovian conditioning's second-order effects, operant conditioning's schedules of reinforcement, learned helplessness's learned optimism inverse, the Rosenthal effect (Pygmalion), the nocebo effect, the placebo's dose-response curve, reactance theory, self-determination theory's three needs, construal level theory, temporal discounting, hyperbolic discounting, scope insensitivity, the affect heuristic, the peak-end rule, duration neglect, the focusing illusion, attribute substitution, the conjunction fallacy, the representativeness heuristic, the anchoring effect's persistence, the framing effect's reversals, loss aversion's 2:1 ratio, the endowment effect, mental accounting, the sunk cost fallacy's limits, the hot hand fallacy (and its rehabilitation), the gambler's fallacy, the clustering illusion, apophenia, pareidolia as pattern-detection gone wrong, motivated reasoning, identity-protective cognition, belief perseverance, the backfire effect (and its failures to replicate), cognitive load theory, working memory's 4±1 chunks, the spacing effect, the generation effect, the testing effect, transfer-appropriate processing, the fluency illusion, the illusion of explanatory depth, the curse of knowledge, the false consensus effect, the spotlight effect, the transparency illusion, self-serving bias, the fundamental attribution error's cultural variation, actor-observer asymmetry, the just-world hypothesis, system justification theory, social dominance orientation, right-wing authoritarianism's measurement, implicit association test controversies, stereotype threat's replication issues, stereotype boost, the contact hypothesis's conditions, mere exposure effect, the pratfall effect, social proof's limits in uncertainty, authority bias, the halo effect, the horn effect, physical attractiveness bias, the name-letter effect, the IKEA effect, the effort heuristic, the pain of paying, mental budgeting, the status quo bias, omission bias, the default effect, choice architecture, libertarian paternalism's tensions, self-control as muscle metaphor (now disputed), implementation intentions, temptation bundling, precommitment devices, the Ulysses contract, cognitive behavioral therapy's mechanisms, acceptance and commitment therapy, Terror Management Theory's mortality salience, the worm at the core, Csikszentmihalyi's flow conditions, self-concordance theory, broaden-and-build theory, the undoing effect, Fredrickson's 3:1 ratio (disputed), post-traumatic growth, benefit finding, the paradox of hedonism, adaptation-level theory, the hedonic treadmill, relative deprivation theory, social comparison theory's directions, the BIRGing and CORFing phenomena`],
  ["HISTORY & SOCIOLOGY", `the Axial Age's simultaneous emergence, the Bronze Age Collapse's systems failure, the Sea Peoples mystery, the fall of Rome's multiple causations, the Black Death's social restructuring, the printing press's 150-year lag, the Scientific Revolution's social conditions, the Dutch Golden Age's institutional innovations, the South Sea Bubble's anatomy, Tulip mania (and its revisionist history), the Mississippi Bubble, the Corn Laws debate, the first enclosure movement, the second enclosure movement, the Irish Famine's political economy, the First Industrial Revolution's Luddites, the Second Industrial Revolution's dynamo paradox, the Great Stagnation (pre-1970), Kondratiev waves, the Long Depression of 1873, the Panic of 1907, the Weimar hyperinflation's social effects, the New Deal's contested legacy, Bretton Woods and its collapse, the Nixon shock, stagflation's theory-breaking, the Washington Consensus's failures, the Asian Financial Crisis's contagion, the Long-Term Capital Management collapse, the dot-com bubble's belief system, the 2008 crisis's regulatory capture, austerity's empirical record, Piketty's r>g (and criticisms), the Great Divergence, the Great Convergence, colonial accounting (Utsa Patnaik), the resource curse, Dutch disease, the middle-income trap, institutional economics (North), the varieties of capitalism framework, Hall and Soskice on coordinated vs liberal, Esping-Andersen's three worlds, Putnam on social capital's decline, Bowling Alone's thesis, Tocqueville on associations, de Soto on dead capital, Scott's seeing like a state, James C. Scott on metis vs techne, Foucault's disciplinary society, Goffman's total institutions, Goffman on stigma, Goffman's interaction ritual, Collins's interaction ritual chains, Bourdieu's field theory, Bourdieu on symbolic violence, Elias's civilizing process, Elias on established and outsiders, Tilly on coercion and capital, Mann on the sources of social power, Wallerstein's world-systems theory, dependency theory, comparative advantage's empirical limits, the product space (Hausmann), economic complexity theory, Schumpeter's entrepreneur vs innovation bureaucracy, Hirschman's exit voice loyalty, Hirschman on the passions and the interests, Albert Hirschman on development, Olson on the logic of collective action, Ostrom on the commons, Habermas on the public sphere, the colonization of the lifeworld, Luhmann's systems theory, Beck's risk society, Ulrich Beck on reflexive modernization, Anthony Giddens on structuration, the Thomas theorem, Merton's self-fulfilling prophecy, Merton on unintended consequences, the iron law of oligarchy (Michels), elite theory (Pareto and Mosca), the circulation of elites, Mannheim on the sociology of knowledge, the sociology of scientific knowledge, Kuhn's incommensurability, Latour on trials of strength, the Matthew effect in science, Merton's CUDOS norms, the priority dispute, the multiple independent discovery phenomenon`],
  ["ART, LITERATURE & CULTURE", `the Homeric question, Aristotle's katharsis, Longinus on the sublime, Horace's ut pictura poesis, the querelle des anciens et des modernes, Winckelmann's noble simplicity, Burke on the sublime vs beautiful, Kant's purposiveness without purpose, Schiller on naive and sentimental poetry, Schlegel on romantic irony, Hegel on the end of art, Schopenhauer on music as will, Nietzsche's Apollo vs Dionysus, Ruskin on the pathetic fallacy, Arnold on culture as the best that has been thought, Pater on burning with a hard gem-like flame, Wilde's aestheticism, Tolstoy's infection theory, Croce on expression, Clive Bell's significant form, Roger Fry's formalism, Clement Greenberg on flatness, Harold Rosenberg on action painting, Clement Greenberg vs Kitsch, T.S. Eliot's objective correlative, Eliot on tradition and the individual talent, Pound's make it new, Benjamin's aura and mechanical reproduction, Benjamin on the flaneur, Benjamin's Arcades Project, Adorno and Horkheimer on the culture industry, Adorno on autonomous art, Adorno's negative dialectics, Brecht's Verfremdungseffekt, Lukács on reification, Lukács on the historical novel, Northrop Frye's modes and myths, Roland Barthes on the death of the author, Barthes on mythology, Barthes's punctum and studium, Susan Sontag on interpretation, Sontag on camp, Sontag on photography's reality effects, Umberto Eco on open works, Eco on hyperreality, Eco on the semiotic guerrilla, Derrida on the supplement in literature, Paul de Man on allegory, Fredric Jameson on postmodernism as cultural logic, Jameson's political unconscious, Said's orientalism, Spivak's subaltern, Homi Bhabha's hybridity, Henry Louis Gates on signifying, Houston Baker on vernacular theory, bell hooks on the oppositional gaze, Laura Mulvey's male gaze, John Berger's ways of seeing, Svetlana Alpers on the art of describing, Michael Fried on absorption and theatricality, Rosalind Krauss on the expanded field, Arthur Danto on the artworld, George Dickie's institutional theory, Nelson Goodman's languages of art, W.J.T. Mitchell on imagetext, Lev Manovich on the language of new media, Mark Fisher on hauntology, Fisher on capitalist realism, Simon Reynolds on retromania, Kodwo Eshun on Afrofuturism, specific Borges stories as thought experiments, Calvino's If on a winter's night, DFW on irony and sincerity, Nabokov on poshlost, Pynchon's entropy stories, Philip K. Dick on simulated reality, Le Guin's thought experiments, specific Kubrick shots as metaphors, Tarkovsky on sculpting in time, Godard on cinema as truth, Werner Herzog on ecstatic truth, Lynch on ideas catching, specific Beatles recording decisions, Miles Davis's Kind of Blue as process, Glenn Gould's anti-performance, John Cage's 4'33" on silence and context, Eno's oblique strategies, the KLF's music industry sabotage, specific Radiohead album transitions, Kendrick Lamar's DAMN. structure, Beyoncé's Lemonade as visual album form`],
  ["ECONOMICS & SYSTEMS", `Ricardo's comparative advantage vs absolute, the Ricardian vice (over-abstraction), Mill on stationary state, Marshall's partial equilibrium, Walras's general equilibrium and its stability problems, Pigou on externalities, Coase on transaction costs and the Coase theorem's limits, Arrow's impossibility theorem, Arrow-Debreu's unrealistic assumptions, the socialist calculation debate (Mises-Hayek vs Lange), Hayek's knowledge problem vs Ostrom's managed commons, Hayek on spontaneous order, Keynes on animal spirits, Keynes's beauty contest metaphor, Keynes on the long run, Kalecki on the political business cycle, the paradox of thrift, Minsky's financial instability hypothesis, Minsky moments, Fisher's debt deflation theory, the permanent income hypothesis's failures, behavioral life-cycle theory, Modigliani-Miller and its violations, the efficient market hypothesis's three forms, the joint hypothesis problem, behavioral finance's limits to arbitrage, Shiller on irrational exuberance, Thaler's mental accounting, the equity premium puzzle, the risk-free rate puzzle, the volatility puzzle, the disposition effect, the January effect, momentum and its decay, factor investing's crowding, the Grossman-Stiglitz paradox, the winner's curse, the market for lemons (Akerlof), adverse selection vs moral hazard, the principal-agent problem's solutions, mechanism design's revelation principle, Vickrey auctions, spectrum auction design, matching theory (Gale-Shapley), the Shapley value, cooperative game theory, the folk theorem in repeated games, the ratchet effect in planning, Kornai's soft budget constraint, the Dutch disease's resource curse mechanism, the Prebisch-Singer thesis, the terms of trade debate, Bhagwati on immiserizing growth, the Washington Consensus's ten points vs reality, the Beijing Consensus, varieties of capitalism's production regimes, the knowledge economy's measurement problems, Solow's computer paradox (and its resolution), the Baumol cost disease, the Baumol effect on services, Easterlin paradox on happiness and GDP, Layard on happiness economics, Kahneman on experienced vs remembered utility, the QALY's ethical problems, cost-benefit analysis's distributional blindness, the discount rate's intergenerational ethics, Stern vs Nordhaus on climate, the social cost of carbon's uncertainty, fat-tailed catastrophe risk, Nassim Taleb on fragility vs antifragility, Taleb on skin in the game, the precautionary principle's paralysis, the innovation systems approach, the product complexity index, Hausmann on economic complexity, the capabilities approach to development, Banerjee-Duflo on randomized development, the Lucas critique, the identification problem in econometrics, Angrist-Pischke on credibility revolution, natural experiments' external validity limits, the replication crisis in economics`],
  ["POP CULTURE & SPECIFIC MOMENTS", `HAL 9000's I'm sorry Dave as machine alignment parable, 2001's bone-to-spaceship cut, the shower scene's editing in Psycho, Citizen Kane's deep focus as power metaphor, Rashomon's epistemology, Kurosawa's rain, the Battleship Potemkin's Odessa steps, Chaplin's Modern Times gear scene, the opening of Apocalypse Now, the baptism montage in The Godfather, the Sicilian message scene, Heat's coffee scene on professionalism, the diner scene in No Country for Old Men, There Will Be Blood's I drink your milkshake, Chinatown's forget it Jake ending, the final shot of The Graduate, the freeze frame ending of The 400 Blows, the ending of Brazil (Gilliam), specific Philip K. Dick stories beyond Blade Runner, the Matrix's red pill as Baudrillard misreading, Black Mirror The Entire History of You on memory, Black Mirror Nosedive on social credit, Black Mirror White Bear on punishment spectacle, Black Mirror Fifteen Million Merits on attention economy, Severance's work-life separation made literal, Station Eleven on cultural memory after collapse, Succession's we don't get to keep them finale, The Wire's the game is the game on systems, The Wire's Hamsterdam experiment, Mad Men's Carousel pitch, Breaking Bad's I am the danger, Atlanta's absurdist social realism, I May Destroy You's nonlinear trauma, Nathan Barley as pre-social-media influencer satire, Charlie Brooker on screen-life, the Simpsons monorail episode on civic boosterism, South Park's they took our jobs as automation anxiety, Idiocracy as Gresham's Law applied to culture, Idiocracy's Brawndo, Don't Look Up as scientific communication failure, Seinfeld as pure social norm exploration, Curb Your Enthusiasm on social contract violations, Nathan Fielder's rehearsals and social scripts, Harambe as collective grief displacement, the dress as perceptual relativity, the Harlem Shake as memetic mutation, TikTok's For You page as Skinner box, the Fyre Festival as Veblen consumption meets logistics reality, Elizabeth Holmes's vocal fry as performed authority, WeWork's we-washing, the NFT bubble's tulip parallels, Terra/Luna's algorithmic stablecoin hubris, the GameStop short squeeze as Minsky meets Reddit, the long-tail theory's empirical problems, the 1000 true fans as power law exception, the creator economy's middle-class squeeze`],
  ["SPECIFIC STUDIES & EXPERIMENTS", `the Terman longitudinal study on giftedness, the Grant Study on adult development, the Framingham Heart Study on social contagion of obesity and happiness, the Nurses' Health Study, Harlow's cloth vs wire mother monkeys, Bowlby's attachment observations, Ainsworth's strange situation, Spitz on hospitalism, the Perry Preschool Project, the Abecedarian Project, the Moving to Opportunity experiment, the Oregon Medicaid lottery, the RAND Health Insurance Experiment, the Negative Income Tax experiments (Mincome), the Tennessee STAR class size study, Project STAR vs HeadStart divergence, the Robbers Cave experiment, Muzafer Sherif's realistic conflict theory, the Jigsaw classroom, the Pygmalion study's replication issues, the blue-eyes/brown-eyes experiment, Zimbardo's Stanford Prison Experiment's theatrical staging (Le Texier's exposé), Milgram's obedience study's ecological validity, the Bystander Effect studies' replication (and the 2019 revision), Latané and Darley's diffusion of responsibility, the Good Samaritan experiment (Darley and Batson), Festinger's cognitive dissonance original study, Festinger's When Prophecy Fails, Leon Festinger on social comparison, the Iowa Gambling Task, the Ultimatum Game's cross-cultural variations, the Dictator Game's experimenter effects, the Prisoner's Dilemma in repeated play, Axelrod's tit-for-tat tournament, the Public Goods Game's punishment dynamics, the Trust Game's oxytocin controversy, Paul Zak's oxytocin-trust claims (and failures), the marshmallow test's socioeconomic confounds, ego depletion's failed replication, the Power Pose controversy (Cuddy vs Simmons), priming studies' collapse, the money priming effect, the Florida effect, the facial feedback hypothesis (pen in mouth), the pen-in-mouth replication, embodied cognition's checkered replication record, growth mindset's implementation failures, grit's limited predictive validity beyond IQ, stereotype threat's boundary conditions, implicit bias training's null effects, the contact hypothesis's conditions (Pettigrew), the Robbers Cave follow-up (failed reconciliation attempts), the Realistic Conflict Theory's limits, social identity theory's minimal group paradigm, Tajfel's original studies, Terror Management Theory's mortality salience (and Covid-era tests), the Kitty Genovese story's factual errors, the broken windows policing evidence (mixed), the Scared Straight program's backfire, the D.A.R.E. program's null effects, the Cambridge-Somerville Youth Study's harm, Scared Straight's criminogenic effects, sex offender registries' counterproductive effects`],
];

function sampleReferencePool(seed: number): string {
  type Item = { cat: string; ref: string };
  const pool: Item[] = [];
  for (const [cat, refs] of _REF_CATS) {
    for (const ref of refs.split(", ")) {
      const t = ref.trim();
      if (t) pool.push({ cat, ref: t });
    }
  }
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed + i) * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  const sampled = arr.slice(0, 50);
  const byCat = new Map<string, string[]>();
  for (const { cat, ref } of sampled) {
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(ref);
  }
  return Array.from(byCat.entries()).map(([cat, refs]) => `${cat}: ${refs.join(", ")}`).join("\n");
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
  pullQuoteAfterPara?: number;
  body: string;
  writer?: string;
  ownedTitle?: string;
  imageUrl2?: string;
  summary?: string;
  bullets?: string[];
  imageQuery?: string;
  cta?: { header: string; body: string };
  hasKeyFacts?: boolean;
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

// ── Pass 0: source analysis ───────────────────────────────────────────────────
type SourceGenre = "news_report" | "science_discovery" | "cultural_criticism" | "profile" | "policy_politics" | "entertainment" | "opinion" | "explainer";

interface SourceAnalysis {
  genre: SourceGenre;
  source_position: string; // what the source claims/argues, or "neutral"
  tension: string;         // what's unresolved or contested
  missed: string;          // angle the source didn't pursue
  subject?: { name: string; type: "film" | "tv_show" | "book" | "album" | "game" | "person" | "other"; year?: string };
}

async function analyzeSource(client: Anthropic, story: Story): Promise<SourceAnalysis | null> {
  const content = story.content
    ? `EXCERPT: ${story.content.slice(0, 500)}`
    : [story.summary, story.bullets?.join(". ")].filter(Boolean).join("\n");
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 220,
      messages: [{
        role: "user",
        content: `Read this article and return a brief editorial analysis. Be specific — one tight sentence each.

TITLE: ${story.title}
SOURCE: ${story.source}
SECTION: ${story.section}
${content}

Return JSON only:
{"genre":"news_report|science_discovery|cultural_criticism|profile|policy_politics|entertainment|opinion|explainer","source_position":"what claim or stance the source takes, or neutral if wire copy","tension":"what is unresolved contested or glossed over","missed":"the angle or implication the source did not pursue","subject":{"name":"exact title or person name if the article is primarily about a specific named film/TV show/book/album/video game/person — omit this field entirely if the article is not about a specific named work or person","type":"film|tv_show|book|album|game|person|other","year":"release or birth year if known, otherwise omit"}}`,
      }],
    });
    const raw = msg.content[0].type === "text" ? msg.content[0].text : "{}";
    return JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()) as SourceAnalysis;
  } catch { return null; }
}

function genreInstruction(a: SourceAnalysis): string {
  const pos = a.source_position;
  const ten = a.tension;
  const mis = a.missed;
  const briefs: Record<SourceGenre, string> = {
    news_report:        `This is a news story. Lead with what this means — not what happened. The event is the last thing that matters. The claim in the air: ${pos}. The tension nobody named: ${ten}. The angle that got skipped: ${mis}. Go there. Establish the subject first so a cold reader knows what we're talking about.`,
    science_discovery:  `This is a science story. Establish the discovery clearly — what was found, by whom, and why it's surprising — then lead with what changes because of it. For ordinary people, for the field, for assumptions we held. The prevailing view: ${pos}. What the finding doesn't settle: ${ten}. The implication nobody followed: ${mis}.`,
    cultural_criticism: `This is cultural criticism. Name the subject — the film, show, album, book, or moment — and establish what it is before you argue about it. The prevailing read: ${pos}. Engage that directly — agree and push further, or find the flaw and name it. The real tension: ${ten}. The angle nobody took: ${mis}.`,
    profile:            `This is a profile. Name the person and give the reader a foothold — who are they and why do they matter right now. Then find the one detail that unlocks them and build outward from it. The established narrative: ${pos}. The tension underneath: ${ten}. What got avoided: ${mis}.`,
    policy_politics:    `This is a policy story. Strip the procedural language. Name what is actually happening and who it affects before you argue about it. Then: what does this actually do to actual people? The official position: ${pos}. The real tension: ${ten}. What got glossed over: ${mis}.`,
    entertainment:      `This is an entertainment story. Name the subject — the film, franchise, star, or moment — and anchor the reader before you have an opinion. Then treat it as a cultural symptom: what does the audience's appetite for this reveal about us right now? The surface read: ${pos}. The tension: ${ten}. The missed angle: ${mis}.`,
    opinion:            `This is an opinion piece on a real subject. Establish what that subject is — the idea, event, or figure being debated — then enter the argument. The position in the room: ${pos}. Where it's right, where it falls short, what it didn't dare say. The real tension: ${ten}. The move nobody made: ${mis}.`,
    explainer:          `This is an explainer. Cover the what clearly — a cold reader needs to understand the subject before they can care about your take. Then do the job the explainer skipped: the why-now and the so-what. The standard framing: ${pos}. The real tension: ${ten}. The thread nobody followed: ${mis}.`,
  };
  return briefs[a.genre] ?? briefs.news_report;
}

// ── Pass 0.5: mode selection ──────────────────────────────────────────────────
interface ModeSelection {
  mode: string;
  reasoning: string; // why this mode for this specific story
}

async function selectMode(
  client: Anthropic,
  story: Story,
  analysis: SourceAnalysis,
  writerName: string
): Promise<ModeSelection | null> {
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [{
        role: "user",
        content: `You are ${writerName}. You have read this article and its editorial analysis. Using your knowledge of this subject — the players, the history, the debates in this field — choose the single mode of engagement that would produce the most insightful, conversation-sparking response. Do not pick mechanically. Pick based on what you actually know about this topic and what would make a reader think differently.

ARTICLE: ${story.title}
SOURCE: ${story.source}
GENRE: ${analysis.genre}
SOURCE POSITION: ${analysis.source_position}
TENSION: ${analysis.tension}
MISSED ANGLE: ${analysis.missed}

MODES:
- The Reframe: accept the facts, reject the framing — show it's actually a different kind of story entirely
- The Extension: source got it right but stopped too soon — follow the thread to its real conclusion
- The Complication: source has a point but it's messier than admitted — yes, and also
- The Rebuttal: source is wrong at the root — name the specific flaw, don't hedge
- The Zoom Out: this story is a symptom of a larger pattern — show the system behind it
- The Zoom In: the abstract claim only becomes real in one specific case — go granular
- The Unstated Assumption: source takes something for granted that's actually the most contested thing — name it
- The Beneficiary Question: follow the incentives — who specifically wanted this to happen and why
- The Historical Echo: this has happened before — name the specific case, the outcome, what it tells us now
- The Paradox: source's conclusion undermines its own premise — make the contradiction visible
- The Missing Voice: source talks about a group without talking to them — surface what they would actually say
- The So What: source reports the what — deliver the why-care, what changes, what the reader does with this

Return JSON only:
{"mode":"exact mode name","reasoning":"one sentence — specifically why this mode, what you know about this topic that makes it the right call"}`,
      }],
    });
    const raw = msg.content[0].type === "text" ? msg.content[0].text : "{}";
    return JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()) as ModeSelection;
  } catch { return null; }
}

export async function getFullArticle(story: Story, relatedStories: Story[], editionKey: string, writerIndex?: number, readOnly = false): Promise<ArticleCommentary> {
  const slug = createHash("md5").update(story.link).digest("hex").slice(0, 16);
  const refSeed = editionKey.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0) + (writerIndex ?? 0) * 997 + parseInt(slug.slice(0, 8), 16);
  const hasCta = seededRandom(refSeed + 13) < 0.2;
  const hasImg2 = seededRandom(refSeed + 7) < 0.2;
  const hasKeyFacts = !hasCta && seededRandom(refSeed + 19) < 0.33;
  const blobKey = `articles/${editionKey}/${slug}.json`;
  const globalKey = `articles/by-slug-v2/${slug}.json`;

  // Check global slug cache first (reuse content if this link was ever processed)
  try {
    const global = await head(globalKey);
    if (global) {
      const res = await fetch(global.url, { cache: "no-store" });
      if (res.ok) {
        const cached = await res.json() as ArticleCommentary;
        if (cached.body && cached.summary) return cached;
      }
    }
  } catch { /* not found */ }

  // Check edition-scoped blob cache
  try {
    const existing = await head(blobKey);
    if (existing) {
      const res = await fetch(existing.url, { cache: "no-store" });
      if (res.ok) {
        const cached = await res.json() as ArticleCommentary;
        if (cached.body && cached.summary) return cached;
      }
    }
  } catch { /* not found */ }

  // In read-only mode, try old versioned paths before giving up
  if (readOnly) {
    for (const oldV of ["by-slug", "v22", "v21", "v20", "v19", "v18"]) {
      for (const key of [
        oldV === "by-slug" ? `articles/by-slug/${slug}.json` : `articles/${oldV}/by-slug/${slug}.json`,
        `articles/${oldV}/${editionKey}/${slug}.json`,
      ]) {
        try {
          const existing = await head(key);
          if (existing) {
            const res = await fetch(existing.url, { cache: "no-store" });
            if (res.ok) {
              const cached = await res.json() as ArticleCommentary;
              if (cached.body) return cached;
            }
          }
        } catch { /* not found */ }
      }
    }
    throw new Error("Article not in cache — generation blocked on user request");
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const related = relatedStories.filter((s) => s.link !== story.link).slice(0, 5);

  // ── Pass 0: source analysis — genre, position, tension, missed angle ──
  const analysis = await analyzeSource(client, story);

  // ── Pass 0.5: mode selection — writer chooses engagement mode based on subject knowledge ──
  const writer = writerIndex !== undefined ? WRITERS[writerIndex % WRITERS.length] : null;
  const writerName = writer?.name ?? "The Signal editor";
  const lens = getLens(story.section, refSeed);
  const modeSelection = analysis ? await selectMode(client, story, analysis, writerName) : null;

  const editorialBrief = (analysis || modeSelection) ? [
    "EDITORIAL BRIEF:",
    analysis ? genreInstruction(analysis) : "",
    modeSelection ? `\nMODE: ${modeSelection.mode}\nWHY: ${modeSelection.reasoning}\n\nWrite from this mode. This is your specific angle into this piece — not a template, a decision you made based on what you know about this subject.` : "",
    "\n---\n",
  ].filter(Boolean).join("\n") : "";

  // ── Pass 1: voice — write freely, pure quality, no structural constraints ──
  const voiceInstruction = writer
    ? `${writer.style}${lens ? `\n\n${lens.prompt}` : ""}`
    : `You write "The Signal Take" — a short, sharp editorial for a news digest. Your voice: the smartest person in the room who happens to be your friend. Direct. A little irreverent. Never preachy. You find the non-obvious angle and follow it somewhere unexpected.${lens ? `\n\n${lens.prompt}` : ""}`;

  const pass1msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 950,
    messages: [{
      role: "user",
      content: `${editorialBrief}${voiceInstruction}

You are writing for a curious, independent-minded adult who wants to understand the world better and occasionally act on what they learn. They came to read about the subject — the film, the discovery, the person, the idea — not about the journalism covering it.

YOUR READER ARRIVES COLD. They have not read the source article. They do not know what we are talking about. Your first move is always to establish the subject: name the thing, anchor the reader, give them a foothold. Then have a real opinion about it.

Draw on everything you know about this subject — not just what the source provided. Bring in the broader conversation: the history, the debates, the context outside the article. Write as if you chose to cover this topic today because it matters to you.

Never reference the source, the headline, the article, or your own process. You are writing about the subject. That is all the reader sees.

The editorial brief gives you your angle. Use it to know where to go — not as a script. What does this subject reveal about how things actually work? What do most people get wrong about it? What would genuinely help a reader understand or act?

When the subject connects to how people live, think, grow, or make decisions — make that useful. Not preachy, not prescriptive. Just: here is something worth knowing, and here is what you can do with it.

Never write an article whose conclusion is "this is complicated" or "there are no simple answers" or "science doesn't know yet." That is not a piece — it is an absence of one. If the source hedges, you are not required to. You have knowledge about this subject beyond what the source says. Use it. Have a position. Give the reader something they can hold onto — a finding, a mechanism, a pattern, a specific thing that actually works. Uncertainty about the complete picture does not prevent you from saying something true and useful about the part you can see.

Write for someone who is intelligent, not ideological. No left or right lean. No woke framing. No moralising. No virtue signalling. Equally sceptical of institutions, activists, and reactionaries.

Use ONE reference — a specific idea, experiment, thinker, film, or moment — that creates a genuinely surprising connection. One sentence, then move on. If nothing fits cleanly, skip it. Do NOT use: Goodhart's Law, Dunning-Kruger, Streisand Effect, Overton Window, Occam's Razor, Hanlon's Razor, Butterfly Effect, Maslow's Hierarchy, Trolley Problem, Black Swan.

REFERENCE POOL — pick something unexpected:
${sampleReferencePool(refSeed)}

Voice — write like this:
- Vary sentence length. Short punches. Then one that earns it. Then short again.
- Vivid and specific — name the thing, don't describe it abstractly.
- When the source contains a notable number — a record, a scale, a count, a sum — use it. 7.8 on the Richter scale. $34 billion. Six-time champion. 40,000 years old. The specific number does more work than the abstraction it replaces. Only include it if the source actually states it and it's genuinely striking.
- No academic hedging: never "one might argue", "it is worth noting", "this suggests that".
- No throat-clearing openers: never "In a world where...", "It's no secret that...", "Now more than ever...", "Here's the thing...", "No one is saying out loud...".
- Never reference the source article or your own process: never "the source headline", "the article argues", "the piece claims", "what the reporting missed", "the question embedded in", or any phrase that implies the reader has seen what you read. You chose to write about this subject — write about it directly.
- No semicolons — ever. Rewrite any semicolon sentence as two separate sentences.

Also return:
- header: 3-5 words. Magazine sub-headline — specific, not generic. No colons. BAD: "The Bigger Picture", "What This Means", "A New Era". GOOD: "The Quiet Monopoly", "Debt That Builds Nations", "Nobody Saw It Coming".

STORY: ${story.title}
SOURCE: ${story.source}
SECTION: ${story.section}
${story.content ? `RSS EXCERPT: ${story.content.slice(0, 400)}` : [
  story.summary ? `SUMMARY: ${story.summary}` : "",
  story.bullets?.length ? `KEY FACTS: ${story.bullets.join(". ")}` : "",
].filter(Boolean).join("\n")}

TODAY'S OTHER STORIES (weave one in only if the parallel is genuinely non-obvious):
${related.map((s) => `- ${s.title} (${s.section})`).join("\n")}

Return JSON only, no markdown:
{
  "ownedTitle": "5-9 words. A human journalist wrote this, not an AI. Strong verb, concrete nouns, no abstraction. Put the actual tension or finding in the words themselves — don't gesture at it. For Science: name the specific discovery or finding, not just that one happened. MUST BE FACTUALLY ACCURATE — never assert a claim the article doesn't support; if the article says Mars has tectonic recycling, don't imply Earth doesn't. FORBIDDEN PATTERNS — never use these: colons (almost never — 1 in 200 headlines earns one); 'X: When Y'; 'X as [abstract noun]'; 'Becomes [Cultural Noun]' (phenomenon, spectacle, currency, commodity); 'reveals'/'exposes'/'underscores'; 'Why'/'How'/'The Truth About'/'Game-Changer'/'Revolutionary'. Writer voice: Rex=confrontational verdict, Eric=plain moral charge, Margot=cool disturbing observation, Finn=insider thriller hook, Cal=counter-intuitive reversal, Jack=sardonic sting, Ward=status-game exposure. GOOD: 'Four Chameleons Named, Zero Habitats Protected' / 'Mathematicians Crack the 80-Year Randomness Problem' / 'Jackass Ends Because Bodies Run Out of Luck'. BAD: 'The Cheerleader Trap: When Visibility Becomes the Cage' / 'Optimism as Commodity, Resistance as Product'. Must differ from source headline.",
  "summary": "2 punchy sentences — what happened and why it matters. Be specific.",
  "bullets": ["specific fact ≤15 words", "specific fact ≤15 words", "specific fact ≤15 words"],
  "imageQuery": "${analysis?.subject ? `This article is about ${analysis.subject.type === "person" ? `the person "${analysis.subject.name}"` : `the ${analysis.subject.type.replace("_", " ")} "${analysis.subject.name}"${analysis.subject.year ? ` (${analysis.subject.year})` : ""}`}. Use that as your search — e.g. "${analysis.subject.name}${analysis.subject.type !== "person" ? " " + analysis.subject.type.replace("_", " ") : " portrait"}". 4-6 words max.` : `4-6 words for Unsplash hero image. Named film/show/game/book → start with exact title + medium (e.g. 'Dune film', 'The Bear TV show'). Real person → role/setting not name. Everything else: concrete scene, no brand names, no text, no logos.`}",
  "header": "...",
  "pullQuote": "1 sentence. Your sharpest, most arresting framing of the central tension — a paraphrase, not a direct quote from the source. Something a reader would screenshot.",
  "body": "Pure prose, no paragraph labels. Paragraphs separated by \\n\\n. FORBIDDEN: throat-clearing openers ('Here's the thing', 'Here's the structure', 'The truth is', 'What's interesting is', 'Let's be clear', 'Make no mistake', 'The reality is', 'Here's what', 'Here's why' — any setup phrase before the real point); colons used to split a sentence into setup + payoff ('X: Y'); semicolons (rewrite as two sentences instead)."${hasCta ? `,
  "cta": {
    "header": "2-4 words. Active verb phrase. E.g. 'Try This Tonight', 'Start Here', 'Read This Next'.",
    "body": "1 sentence. A specific thing to DO, WATCH, READ, or TRY that connects directly to this story. Name the exact thing. Beginner-friendly, low-commitment. Not a genre — a specific title, tool, experiment, or action."
  }` : ""}
}`,
    }],
  });

  const raw1 = pass1msg.content[0].type === "text" ? pass1msg.content[0].text : "{}";
  const text1 = raw1.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  let pass1: { ownedTitle?: string; summary?: string; bullets?: string[]; imageQuery?: string; header?: string; pullQuote?: string; body?: string; cta?: { header: string; body: string } } = {};
  try {
    pass1 = JSON.parse(text1);
    if (!pass1.body) throw new Error();
  } catch {
    const isJson = text1.startsWith("{") || text1.startsWith("[");
    pass1 = { header: "", body: isJson ? "" : text1 };
  }

  // ── Pass 2: structure — always runs; isBrief only gates imageUrl2 (no mid-article image for brief cards) ──
  const isBrief = story.cardStyle === "brief";
  let body = pass1.body ?? "";
  let pass1Header2 = "";
  let pass1ImageQuery2 = "";
  let extractedPullQuote = pass1.pullQuote ?? "";
  let pullQuoteAfterPara = 4;
  if (body) {
    try {
      const pass2msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 700,
        messages: [{
          role: "user",
          content: `Restructure this article body into exactly 4-5 paragraphs. Preserve ALL ideas and the original voice word-for-word where possible. Do not add new ideas.

Three jobs only:
1. Enforce the paragraph structure below
2. Break any sentence over 20 words at a natural clause boundary — em-dash, "and", "but", "because", "which", "so". Keep both halves punchy. NEVER break at a semicolon — rewrite to remove it entirely.
3. Remove throat-clearing openers ("Here's the thing", "Here's the structure", "The truth is", "What's interesting is", "Let's be clear", "Make no mistake" — any setup phrase before the real point). Remove colons used as setup-payoff splits ("X: Y") — rewrite as a direct statement.

Structure:
- para1: EXACTLY 1 sentence — the hook. Irreversible opener. No exceptions.
- para2: EXACTLY 1 sentence — deepens or reframes the hook. Creates tension.
- para3: 1-2 sentences — first insight or evidence. The "here's why" moment.
- para4: 2-3 sentences — the turn. Complication, contradiction, or escalation.
- para5: 1-2 sentences — landing. A sharp question, provocation, or implication. Omit if the content doesn't need it.

Also return:
- header2: 3-5 words. Second sub-headline covering the second half of the argument. Specific, no colons, not generic.
- imageQuery2: 4-6 concrete atmospheric words for a second Unsplash search. No names, no text, no logos. Think: texture, environment, light, emotion.
- pullQuoteAfterPara: 4 or 5 only. Which paragraph the pull quote should follow. Must be after header2 (which appears before para4). Choose 4 if the energy peaks in para4, choose 5 if para5 is the stronger landing.

Body to restructure:
"${body}"

Return JSON only:
{"header2":"...","imageQuery2":"...","pullQuoteAfterPara":4,"para1":"...","para2":"...","para3":"...","para4":"...","para5":"..."}`,
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
        if (typeof scaffold.pullQuoteAfterPara === "number" && (scaffold.pullQuoteAfterPara === 4 || scaffold.pullQuoteAfterPara === 5)) {
          pullQuoteAfterPara = scaffold.pullQuoteAfterPara as number;
        }
      }
    } catch { /* pass2 failed — use pass1 body as-is */ }
  }

  const imageUrl2 = (!isBrief && hasImg2)
    ? (pass1ImageQuery2
        ? await fetchUnsplash(pass1ImageQuery2, story.section, 1).then(r => r?.url)
        : await fetchUnsplash(story.title, story.section, 2).then(r => r?.url))
    : undefined;

  const commentary: ArticleCommentary = {
    ownedTitle: pass1.ownedTitle ?? "",
    summary: pass1.summary ?? undefined,
    bullets: pass1.bullets?.length ? pass1.bullets.slice(0, 3) : undefined,
    imageQuery: pass1.imageQuery ?? undefined,
    header: pass1.header ?? "",
    header2: pass1Header2,
    pullQuote: extractedPullQuote,
    pullQuoteAfterPara,
    imageUrl2: imageUrl2 ?? undefined,
    body: breakLongSentences(body),
    writer: writer?.name ?? "",
    cta: pass1.cta ?? undefined,
    hasKeyFacts,
  };

  // Save to Blob for this edition + global slug cache (reuse if link ever recurs)
  try {
    await put(blobKey, JSON.stringify(commentary), { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
    put(globalKey, JSON.stringify(commentary), { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true }).catch(() => {});
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
  const blobKey = `feature-creature/v20/${editionKey}.json`;

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
    // Medium-aware framing question — what angle is most generative for this type of work
    const mediumFrame: Record<string, string> = {
      film:    `What did this film understand about the era it was made that most people are only seeing now? What did it get wrong that turned out to be more revealing than what it got right?`,
      tv:      `What does the show's structure — its pacing, its season arcs, its refusal to resolve certain things — argue about how we want to experience its central theme?`,
      anime:   `What do the production design, worldbuilding physics, or visual grammar reveal about the anxieties of the culture and moment that made it?`,
      novel:   `What did this book predict — and why is the shape of the prediction more interesting than whether it came true?`,
      game:    `What does this game's core mechanic or system argue — not its story or lore, but the logic baked into how it asks you to play?`,
      fantasy: `What real-world social, political, or psychological structure does this world make visible by exaggerating or inverting it?`,
    };
    const frameQuestion = mediumFrame[FC_UNIVERSE.medium] ?? mediumFrame.film;

    // ── Pass 0: pre-flight claim — commit to a specific, falsifiable take before writing ──
    const claimMsg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      messages: [{
        role: "user",
        content: `You are writing a sharp editorial about ${FC_UNIVERSE.name} (${FC_UNIVERSE.medium}).

Angle you've been assigned: ${FC_ANGLE.label} — ${FC_ANGLE.prompt}

Framing question: ${frameQuestion}

Before writing, state your core claim in ONE sentence. Requirements:
- Specific and falsifiable — a dedicated fan should be able to argue against it
- Names something concrete from the actual work (a scene, a system, a character decision, a design choice)
- Goes somewhere the work's own creators probably didn't intend
- Not a summary. Not "X shows us that Y matters." A real claim.

Reply with the claim sentence only. No preamble.`,
      }],
    });
    const coreClaim = claimMsg.content[0].type === "text" ? claimMsg.content[0].text.trim() : "";

    // ── Pass 1: free-write — write from the committed claim ──
    const pass1msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1400,
        messages: [{
          role: "user",
          content: `You are the Feature Creature — a sharp editorial voice that finds what iconic films, shows, anime, novels, and games understood before everyone else did. You have a genuine critical opinion about this work. You write with authority, not enthusiasm.

Your instinct for this piece: ${fcWriter.style}

Universe: ${FC_UNIVERSE.name} (${FC_UNIVERSE.medium})
Angle: ${FC_ANGLE.label}
Framing question: ${frameQuestion}
Your committed claim: ${coreClaim}

Start from that claim. Don't restate it — weaponize it. Follow it somewhere the work's own creators probably didn't intend. Make a real argument with specific evidence from the actual work: scenes, mechanics, design choices, lines of dialogue, production decisions. Not vibes. Not "it resonates." The specific thing.

Voice rules — non-negotiable:
- Vary sentence length. Short punches. Then one long one that earns it. Then short again.
- Name the actual thing. Never describe it abstractly.
- No hedging: never "one might argue", "it is worth noting", "this suggests that", "in many ways".
- No throat-clearing openers: never "In a world where...", "It's no secret that...", "Now more than ever...", "Here's the thing...", "What makes [X] so compelling is...".
- Write like you've seen this a dozen times and noticed something on the ninth watch.

Return JSON only, no markdown:
{
  "title": "5-9 words. Put the actual argument in the words — don't gesture at it. FORBIDDEN: colons; 'reveals'/'exposes'/'underscores'; 'Why'/'How'/'The Truth About'/'Game-Changer'. Writer voice: Rex=confrontational verdict, Eric=plain moral charge, Margot=cool disturbing observation, Finn=insider thriller hook, Cal=counter-intuitive reversal, Jack=sardonic sting, Ward=status-game exposure. GOOD: 'Hogwarts Runs on Indentured Labor' / 'The Matrix Already Lost Before Neo Woke Up' / 'Disco Elysium Proves Failure Is the Only Honest Mechanic'. BAD: 'Why Dune Reveals the Truth About Power'.",
  "synopsis": "1-2 sentences. The claim and why it matters. Makes someone stop scrolling.",
  "body": "240-280 words. Open with your committed claim stated as fact — no setup, no context. Then 3-4 specific supporting insights grounded in the actual work. End with a consequence or open question that changes how the reader sees something outside the work. Every sentence earns its place.",
  "headers": ["2-3 words: names the opening argument", "2-3 words: names the turn or escalation"],
  "ctaHeader": "2-4 words. Active verb phrase.",
  "callToAction": "1 sentence. A specific thing to DO, WATCH, READ, or PLAY that connects to the argument — not just 'watch the film'. Name something adjacent: a documentary, a book about the making-of, a scene timestamp, a related work that answers the question this one left open.",
  "digDeeper": "1 sentence. One specific piece of criticism, making-of documentary, essay, interview, or adjacent work that changes how you see this universe — something a dedicated fan might not have found. Name it precisely enough to be searchable. Not Wikipedia. Not 'read the source material'.",
  "pullQuote": "Copy one sentence verbatim from your body — the most arresting one. Word-for-word identical.",
  "imageQuery": "4-6 concrete visual nouns for Unsplash. A real-world scene or object that carries the mood of the article's central argument — NOT the fictional universe name. Dark source = dark moody image. E.g. 'rain slicked city street neon reflection' / 'empty modernist room glass walls solitude' / 'astronaut sunrise orbit earth'."
}`
        }],
      });

    const raw1 = pass1msg.content[0].type === "text" ? pass1msg.content[0].text : "{}";
    const text1 = raw1.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const pass1 = JSON.parse(text1);

    // Image search priority: (1) source material by name+medium, (2) article-derived mood query
    const mediumLabel: Record<string, string> = { film: "film", tv: "TV series", anime: "anime", novel: "book cover", game: "video game", fantasy: "fantasy art" };
    const sourceQuery = `${FC_UNIVERSE.name} ${mediumLabel[FC_UNIVERSE.medium] ?? ""}`.trim();
    const moodQuery = (pass1.imageQuery as string | undefined)?.trim() || `${FC_UNIVERSE.name} ${FC_ANGLE.key}`;
    const imageUrl = await fetchUnsplash(sourceQuery, "Culture").then(r => r?.url)
      ?? await fetchUnsplash(moodQuery, "Culture").then(r => r?.url);

    // ── Pass 2: scaffold — restructure the free-write into the para cadence ──
    const scaffoldMsg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 900,
      messages: [{
        role: "user",
        content: `Restructure this article body into 4-5 paragraphs. Preserve ALL ideas and the original voice word-for-word where possible. Do not add new ideas.

Two jobs only:
1. Enforce the paragraph structure below
2. Break any sentence over 20 words at a natural clause boundary — em-dash, "and", "but", "because", "which", "so". Keep both halves punchy. NEVER break at a semicolon — rewrite to remove it entirely.

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
      const candidateUrl = candidate?.url;
      if (candidateUrl && candidateUrl !== imageUrl) {
        // Vision review: score relevance 1-10; accept if >= 6
        try {
          const review = await client.messages.create({
            model: "claude-haiku-4-5-20251001",
            max_tokens: 10,
            messages: [{
              role: "user",
              content: [
                { type: "image", source: { type: "url", url: candidateUrl } },
                { type: "text", text: `Article title: "${parsed.title}". Synopsis: "${parsed.synopsis}". Does this photo fit as a mid-article illustration? Reply with a single integer 1-10 (10 = perfect fit, 1 = totally unrelated).` },
              ],
            }],
          });
          const score = parseInt((review.content[0] as { type: string; text: string }).text.trim(), 10);
          if (!isNaN(score) && score >= 6) imageUrl2 = candidateUrl;
        } catch { /* vision review failed — skip image2, use pull-quote */ }
      }
    }
    const result: FeatureCreature = {
      universe: FC_UNIVERSE.name,
      angleLabel: FC_ANGLE.label,
      angleKey: FC_ANGLE.key,
      title: parsed.title ?? `${FC_UNIVERSE.name}: ${FC_ANGLE.label}`,
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
    put(blobKey, JSON.stringify(result), { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true }).catch(() => {});
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
            access: "public", contentType: "image/jpeg", addRandomSuffix: false, allowOverwrite: true,
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
        access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true,
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

  const SLOT_ORDER: Record<string, number> = { early: 0, morning: 1, afternoon: 2, evening: 3, night: 4 };
  return entries.sort((a, b) => {
    const [aDate, aSlot = ""] = a.key.split("_");
    const [bDate, bSlot = ""] = b.key.split("_");
    if (bDate !== aDate) return bDate.localeCompare(aDate);
    return (SLOT_ORDER[bSlot] ?? 0) - (SLOT_ORDER[aSlot] ?? 0);
  });
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

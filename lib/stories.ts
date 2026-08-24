import Anthropic from "@anthropic-ai/sdk";
import Parser from "rss-parser";
import { unstable_cache } from "next/cache";
import { cacheGet, cacheSet } from "@/lib/cache";
import { put, head, list, del } from "@vercel/blob";
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
  generationStatus?: "ok" | "no_body" | "pass1_failed" | "missing";
  // S1 Insight only: links of stories in the same edition that genuinely connect to the
  // finished piece, chosen after it is written. May be absent or empty — "if applicable"
  // has to include "not applicable", or we are back to forcing a connection that isn't there.
  relatedLinks?: string[];
}

export interface Synthesis {
  theme: string; hook: string; observation: string; takeaways: string[]; conclusion: string; actions: string[];
  imageUrl?: string; imageQuery?: string;
}

export interface WeeklySignal {
  actions?: string[];
  hook: string;
  signal: string;
  noise: string;
  lookingForward: string;
  oneMove?: string;
  writerName?: string;
  weekOf: string;
  imageUrl?: string;
}

export interface PageData {
  stories: Story[]; synthesis: Synthesis; editionLabel: string;
  featureCreature?: FeatureCreature;
  weeklySignal?: WeeklySignal;
  // Set only when the S1 Insight failed to generate and an RSS story was promoted into the
  // lead slot in its place. Absent on a healthy edition.
  insightError?: string;
  // Build diagnostics, surfaced in Signal Desk. `failures` records stories that were
  // generated and then DISCARDED — without this they vanish at the `filter(s => s.summary)`
  // step and never reach the blob, so a thin edition gives no clue why it was thin.
  diagnostics?: {
    target: number;
    survived: number;
    poolSize: number;
    benchSize: number;
    failures: { title: string; section: string; status?: string; error?: string }[];
  };
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
  // Feeds verified live 2026-08-24. FIVE were returning 404 and three were frozen years back
  // (Elemental last posted Apr 2022, Freakonomics Dec 2022, James Clear Jan 2020) — 8 of 18
  // uplift feeds dead. Psychology and HumanPotential are the ONLY sections that can fill S1/S2
  // through the section gate, so this starved the two slots that matter most and left the pool
  // falling back on science. Re-verify with a parseURL sweep before assuming supply is healthy.
  { url: "https://behavioralscientist.org/feed/",                             source: "Behavioral Scientist", section: "Psychology"   },
  { url: "https://nesslabs.com/feed",                                          source: "Ness Labs",           section: "Psychology"    },
  { url: "https://www.raptitude.com/feed/",                                    source: "Raptitude",            section: "Psychology"      },
  { url: "https://psyche.co/feed",                                             source: "Psyche",               section: "Psychology"      },
  { url: "https://bakadesuyo.com/feed",                                        source: "Barking Up the Wrong Tree", section: "Psychology" },
  // Human Potential — Outliers-style, high achievers, overcomers, lessons from exceptional people
  { url: "https://fs.blog/feed/",                                             source: "Farnam Street",       section: "HumanPotential" },
  { url: "https://bigthink.com/feed/",                                        source: "Big Think",           section: "HumanPotential" },
  { url: "https://www.fastcompany.com/leadership/rss",                        source: "Fast Company Ideas",  section: "HumanPotential" },
  { url: "https://feeds.kottke.org/main",                                     source: "Kottke",              section: "HumanPotential" },
  { url: "https://dariusforoux.com/feed",                                     source: "Darius Foroux",       section: "HumanPotential" },
  { url: "https://sive.rs/en.atom",                                            source: "Derek Sivers",         section: "HumanPotential" },
  { url: "https://www.scotthyoung.com/blog/feed/",                             source: "Scott H. Young",       section: "HumanPotential" },
  // Practical / body / solutions — added 2026-08-24 to rebuild uplift supply
  { url: "https://www.artofmanliness.com/feed/",                               source: "Art of Manliness",     section: "HumanPotential" },
  { url: "https://www.outsideonline.com/feed/",                                source: "Outside",              section: "HumanPotential" },
  { url: "https://www.strongerbyscience.com/feed/",                            source: "Stronger by Science",  section: "HumanPotential" },
  { url: "https://reasonstobecheerful.world/feed/",                            source: "Reasons to be Cheerful", section: "HumanPotential" },
  { url: "https://www.positive.news/feed/",                                    source: "Positive News",        section: "HumanPotential" },
  { url: "https://www.goodgoodgood.co/articles/rss.xml",                       source: "Good Good Good",       section: "HumanPotential" },
  { url: "https://www.runnersworld.com/rss/all.xml/",                          source: "Runner's World",       section: "HumanPotential" },
  // Youth / young-adult — EXPERIMENT added 2026-08-24, capped at 1 per edition via slotExtras.
  // Supply here is genuinely poor: YR Media and Well+Good return malformed XML, The Mighty,
  // mindbodygreen and Greatist 404, Her Campus serves Portuguese, Seventeen is empty, and
  // Youth Today is institutional policy rather than uplift. Teen Vogue is the only live
  // English general-interest feed with volume, and it leans product listicles — expect the
  // fitness/deal gates to reject most of it. Judge it in Signal Desk; remove this line if the
  // dropped-story rows fill with it.
  { url: "https://www.teenvogue.com/feed/rss",                                 source: "Teen Vogue",           section: "Youth"          },
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

const KEY_SUFFIX_LABELS: Record<string, string> = {
  early: "First Light", morning: "The Brief", afternoon: "Afternoon",
  evening: "The Digest", night: "Night Dispatch",
};

export function labelFromKey(key: string): string {
  const suffix = key.split("_")[1] ?? "";
  return KEY_SUFFIX_LABELS[suffix] ?? "Edition";
}

function slotFromHour(h: number, date: string): { label: string; key: string } {
  if (h >= 6  && h < 11) return { label: "First Light", key: `${date}_early`     };
  if (h >= 11 && h < 16) return { label: "The Brief",   key: `${date}_morning`   };
  if (h >= 16 && h < 21) return { label: "Afternoon",   key: `${date}_afternoon` };
  return                         { label: "The Digest",  key: `${date}_evening`   };
}

/**
 * True when this edition key falls on the dark day and should not be built.
 *
 * Keyed off the edition's OWN date, never the cron's UTC weekday — editions are dated on the
 * UTC+14 clock, so a cron firing Friday UTC builds a Saturday edition. Filtering by cron
 * day-of-week in vercel.json would skip the wrong day.
 */
export function isDarkDay(editionKey: string): boolean {
  const [date] = editionKey.split("_");
  return new Date(`${date}T12:00:00Z`).getUTCDay() === DARK_DAY;
}

export function getEdition(): { label: string; key: string } {
  const { h, date } = utc14Now();
  return slotFromHour(h, date);
}

// Used when x-vercel-ip-timezone is absent or unusable (VPN, hotspot carrier gateway,
// local dev). Must lean BEHIND the audience, never ahead: UTC is 7-8h ahead of the US
// west coast, so defaulting to it showed Pacific visitors the next slot — or the next
// day — from mid-afternoon onward. Publish clock is the visitor's local time
// (CLAUDE.md:29), and UTC approximates no American reader.
export const FALLBACK_TIMEZONE = "America/Los_Angeles";

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function getEditionForTimezone(timezone: string): { label: string; key: string } {
  try {
    const now = new Date();
    // Use visitor's local date for the key — editions are built on UTC+14 clock but
    // visitors should see the edition for their local date, not the UTC+14 date.
    // "en-CA" locale formats as YYYY-MM-DD which matches our key format.
    const localDate = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(now);
    // en-US with hour12:false reports midnight as "24", not "0" — normalise it, or the
    // 00:00 hour skips the wrap correction below and lands on the coming evening.
    const h = parseInt(
      new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: timezone }).format(now),
      10
    ) % 24;
    // The evening slot spans 21:00–05:59, so hours 0–5 belong to the PREVIOUS day's
    // evening edition. Without this a reader at 1am Monday is served Monday's Digest,
    // which does not publish until 9pm that night — and the UTC+14 pre-warm has already
    // built it, so the blob exists and gets served. Only the publish clock shifts here:
    // getEdition() keeps the un-shifted behaviour because the build clock is meant to
    // run ahead (CLAUDE.md:28), and the 15:44 UTC cron fires inside this window.
    const keyDate = h < 6 ? shiftDate(localDate, -1) : localDate;
    return slotFromHour(h, keyDate);
  } catch {
    // An unusable timezone string must not fall through to getEdition() — that is the
    // UTC+14 build clock, up to 19h ahead of the reader, i.e. the most future-shifted
    // answer available at exactly the moment we know the input is untrustworthy.
    if (timezone !== FALLBACK_TIMEZONE) return getEditionForTimezone(FALLBACK_TIMEZONE);
    const now = new Date();
    const h = now.getUTCHours();
    const d = now.toISOString().slice(0, 10);
    return slotFromHour(h, h < 6 ? shiftDate(d, -1) : d);
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
// RSS stories per edition. The S1 Insight is prepended on top of these, so the edition shows
// RSS_STORIES_PER_EDITION + 1 cards. Changing this number alone is NOT enough — corePoolRaw
// below is a hand-ordered composition template and the pool is truncated positionally, so the
// template has to be rebalanced to match or whole sections drop out of every edition.
const RSS_STORIES_PER_EDITION = 7;

// Editions are not built on this weekday (0 = Sunday ... 6 = Saturday). Sunday must stay:
// the Weekly Signal generates on Sunday evening and fires the ConvertKit broadcast, so going
// dark then would remove the only email touchpoint.
const DARK_DAY = 6;

// "dead" alone is too broad — it blocked "Dead Simple Ways to Improve Your Morning" and
// "The Dead Sea Is Shrinking". Require a death context around it; the other terms are
// unambiguous on their own.
const OBIT_RE = /\b(dies|died|passed away|obituary|obit|in memoriam)\b|\bdead\s+at\b|\bfound\s+dead\b|\b(is|was)\s+dead\b|\bdead\s*[,.]/i;

// Serious-subject detector. The section fallbacks are written for the *section*, not the
// story, so a Culture piece about a terminal diagnosis drew "creative performance stage
// expression" and published a film set with lightsabers above a metastatic breast cancer
// headline. Anything matching here routes to neutral imagery instead of its section pool.
const GRAVE_RE = /\b(cancer|tumou?rs?|terminal|diagnos\w+|prognos\w+|metasta\w+|palliative|hospice|chemo\w*|dementia|alzheimer\w*|parkinson\w*|illness|disease|overdose|addiction|suicide|self.harm|grief|grieving|bereave\w*|famine|refugees?|earthquake|wildfire|shooting|massacre|casualt\w+|fatal\w*|abuse|assault|trafficking)\b/i;

// Calm and human rather than mournful — these have to sit correctly above a hard diagnosis
// AND above a treatment breakthrough, since the regex above cannot tell those apart. An
// array rather than one string so a fallback does not mean one photo for every grave story.
const GRAVE_FALLBACKS = [
  "quiet window morning light",
  "still water calm horizon",
  "empty chair soft daylight",
  "hands resting wooden table",
  "long hallway natural light",
  "open field overcast quiet",
];

export async function fetchUnsplash(headline: string, section?: string, page = 1, imageQuery?: string, blocked?: Set<string>): Promise<{ url: string; color?: string } | undefined> {
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
    Culture: "creative performance stage expression",
    Film: "cinema film director",
    Entertainment: "music concert stage performance",
    Arts: "art design studio gallery",
    Faith: "light candle meditation spiritual",
  };
  // Stable per-headline seed: the same story always resolves to the same image, but two
  // different stories hitting the same fallback string do not land on the same photo.
  const headlineSeed = headline.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
  const isGrave = GRAVE_RE.test(headline);

  const fallback = isObit
    ? "portrait tribute memorial flowers"
    : isGrave
      ? GRAVE_FALLBACKS[headlineSeed % GRAVE_FALLBACKS.length]
      : (section && sectionFallback[section]) ?? "news media editorial";

  // The fallback query is a fixed string reused across every story that reaches it, so
  // holding page at 1 guaranteed the same handful of photos forever — that is how one film
  // set image recurred for six days. Vary the page for the fallback only; the headline- and
  // imageQuery-derived searches are already distinct per story.
  const fallbackPage = 1 + (headlineSeed % 4);

  const queries: { q: string; page: number }[] = [
    ...(personQuery ? [{ q: personQuery, page }, { q: `${personQuery} portrait`, page }] : []),
    ...(imageQuery ? [{ q: imageQuery, page }] : []),
    { q: words.slice(0, 3).join(" "), page },
    { q: words.slice(0, 2).join(" "), page },
    { q: fallback, page: fallbackPage },
    // Last resort: the same fallback on page 1, so a high page with thin results still
    // returns something rather than leaving the story imageless.
    { q: fallback, page: 1 },
  ].filter(x => x.q.trim());

  for (const { q, page: qPage } of queries) {
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&orientation=landscape&per_page=10&page=${qPage}&client_id=${key}`,
        { cache: "no-store" }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const results: { urls?: { regular?: string }; color?: string }[] = data?.results ?? [];
      for (const photo of results) {
        const url = photo?.urls?.regular
          ? (photo.urls.regular as string).replace(/&w=\d+/, "&w=1600")
          : undefined;
        if (url && (!blocked || !blocked.has(unsplashPhotoId(url)))) return { url, color: photo.color as string | undefined };
      }
    } catch { continue; }
  }
  return undefined;
}

function imgCacheKey(link: string) {
  return `artimg_v4_${createHash("md5").update(link).digest("hex")}`;
}

// Unsplash URLs contain a volatile `ixid` parameter that changes on every API call,
// making URL-string equality useless for dedup. Extract the stable photo ID from the
// path segment (e.g. "photo-1234abc") and use that as the canonical dedup key.
function unsplashPhotoId(url: string): string {
  return url.match(/\/(photo-[^?/]+)/)?.[1] ?? url;
}

async function getArticleImage(article: { link: string; title: string; section?: string; imageQuery?: string; rssImageUrl?: string; preferRssImage?: boolean }, blocked?: Set<string>): Promise<{ url: string; color?: string } | undefined> {
  if (article.preferRssImage && article.rssImageUrl) return { url: article.rssImageUrl };
  const cKey = imgCacheKey(article.link);
  const hit = cacheGet<string>(cKey);
  if (hit && hit !== "__none__" && (!blocked || !blocked.has(unsplashPhotoId(hit)))) return { url: hit };

  const unsplash = await fetchUnsplash(article.title, article.section, 1, article.imageQuery, blocked);
  if (unsplash) { cacheSet(cKey, unsplash.url, THREE_DAYS); return unsplash; }
  cacheSet(cKey, "__none__", 5 * 60 * 1000);
  return undefined;
}

export async function getUniqueImages(articles: (RawItem & { imageQuery?: string; preferRssImage?: boolean })[], blocked?: Set<string>): Promise<{ url?: string; color?: string }[]> {
  const seen = blocked ?? new Set<string>();
  // Sequential fetch so each article's URL is added to `seen` before the next one runs,
  // preventing parallel calls from independently claiming the same Unsplash photo.
  const result: { url?: string; color?: string }[] = [];
  for (let i = 0; i < articles.length; i++) {
    const img = await getArticleImage(articles[i], seen);
    if (!img?.url || seen.has(unsplashPhotoId(img.url))) {
      const cKey = imgCacheKey(articles[i].link);
      cacheSet(cKey, "__none__", 1);
      const fresh = await fetchUnsplash(articles[i].title + " " + articles[i].section, undefined, 1, articles[i].imageQuery, seen);
      if (fresh && !seen.has(unsplashPhotoId(fresh.url))) {
        seen.add(unsplashPhotoId(fresh.url));
        cacheSet(cKey, fresh.url, THREE_DAYS);
        result.push(fresh);
      } else {
        result.push({});
      }
    } else {
      seen.add(unsplashPhotoId(img.url));
      result.push(img);
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

  // Deaths never enter the pool. The engagement modes exist to rebut the prevailing reading
  // and find the angle nobody took; aimed at a person who died days ago that is structurally
  // guaranteed to produce a piece arguing against sympathy, and it did. This is a hard filter
  // rather than a score because the fitness gate is advisory and was scoped to S1/S2 only.
  const deathFiltered = dedupeByTopic(results.flatMap((r) => r.status === "fulfilled" ? r.value : []));
  // Title only. Matching the body would block any article that merely mentions someone who
  // died — a tech piece noting "Steve Jobs died in 2011" is not an obituary.
  const all = deathFiltered.filter(item => {
    if (!OBIT_RE.test(item.title)) return true;
    console.log(`[obit-filter] excluded from pool: "${item.title}"`);
    return false;
  });
  const CREATIVE = ["Entertainment", "Arts", "Culture", "Film", "Faith"];
  const tech: RawItem[] = [], creative: RawItem[] = [], science: RawItem[] = [], psychology: RawItem[] = [], humanPotential: RawItem[] = [], food: RawItem[] = [], sports: RawItem[] = [], comics: RawItem[] = [], anime: RawItem[] = [], youth: RawItem[] = [];
  for (const item of all) {
    if (item.section === "Technology") tech.push(item);
    else if (item.section === "Science") science.push(item);
    else if (item.section === "Psychology") psychology.push(item);
    else if (item.section === "HumanPotential") humanPotential.push(item);
    else if (item.section === "Food") food.push(item);
    else if (item.section === "Sports") sports.push(item);
    else if (item.section === "Comics") comics.push(item);
    else if (item.section === "Anime") anime.push(item);
    else if (item.section === "Youth") youth.push(item);
    else if (CREATIVE.includes(item.section)) creative.push(item);
  }
  // S1/S2: alternate between Psychology and HumanPotential (Outliers-style) — highest engagement slots
  // slot extras REPLACE random s2-s9 slots (never s1, never append)
  const uplift = [...psychology, ...humanPotential]; // combined self-improvement pool
  const upl = uplift.slice(0, 3), sci = science.slice(0, 2), cre = creative.slice(0, 4), tec = tech.slice(0, 3);
  // Two extras, not four. These REPLACE core positions, so with a 7-slot pool four of them
  // could displace more than half the edition; at nine that was proportionate, at seven it
  // is not.
  const slotExtras = [...food.slice(0, 1), ...sports.slice(0, 1), ...comics.slice(0, 1), ...anime.slice(0, 1), ...youth.slice(0, 1)].slice(0, 2);
  // Hand-ordered composition, NOT a ranked list — position determines section mix, so the
  // trailing `slice` below cuts by category rather than by quality. The previous 11-entry
  // template was already losing tec[1] and tec[2] to slice(0, 9) unnoticed, and simply
  // lowering that number to 7 would have deleted Technology from every edition.
  // Rebalanced for 7 RSS stories (8 cards with the S1 Insight prepended):
  //   S2 uplift · S3 uplift · S4 creative · S5 science · S6 creative · S7 tech · S8 creative
  // The first seven entries set the composition; everything after is DEPTH, and it is not
  // optional. This list is deduped by link and then sliced to RSS_STORIES_PER_EDITION, so a
  // list of exactly seven collapses below target whenever a category is thin or two positions
  // resolve to the same story. A seven-entry version shipped on 2026-08-19 and produced
  // editions of one, two and five cards: three of its slots fell back to sci[0], dedup removed
  // the duplicates, and gate rejections took the rest. The previous template carried eleven
  // entries for a target of nine — the slack was doing real work and I removed it.
  // Every fallback here resolves to a DIFFERENT index so no two positions can collide.
  const corePoolRaw = [
    upl[0] ?? sci[0],
    upl[1] ?? sci[1],
    cre[0] ?? tec[0],
    sci[0] ?? upl[2],
    cre[1] ?? tec[1],
    tec[0] ?? cre[2],
    cre[2] ?? sci[1],
    // Reserve — only reached when something above is missing or deduped away.
    upl[2], sci[1], cre[3], tec[1], tec[2],
  ].filter(Boolean);
  const seenLinks = new Set<string>();
  const corePool = corePoolRaw.filter(i => { if (seenLinks.has(i.link)) return false; seenLinks.add(i.link); return true; });
  // Seeded Fisher-Yates shuffle of s2-s11 indices to pick replacement positions
  const poolSeed = editionKey.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const srPool = (n: number) => { const x = Math.sin(poolSeed * 127 + n * 311) * 10000; return x - Math.floor(x); };
  const candidates = Array.from({ length: corePool.length - 1 }, (_, i) => i + 1); // indices 1..N (s2-s9)
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
  const pool = mutablePool.filter(Boolean).slice(0, RSS_STORIES_PER_EDITION);
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

// ── Comparative uplift selection — picks best S1/S2 from pre-scored candidates ─
async function comparativeUpliftSelect(
  client: Anthropic,
  scored: Array<{ item: RawItem; uplift: number; fitness: number }>
): Promise<[RawItem | null, RawItem | null]> {
  const top = scored.slice(0, 8);
  const list = top.map((c, i) =>
    `[${i}] ${c.item.title}\nSECTION: ${c.item.section} | uplift=${c.uplift} fitness=${c.fitness}\n${c.item.content.slice(0, 200)}`
  ).join("\n\n");

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 150,
    messages: [{
      role: "user",
      content: `Pick the best S1 and S2 for a curated daily news edition. Readers are building their lives with intention — creative practice, career, relationships, health, money, thinking.

S1: reader opens it and immediately recognizes it as being about their own life. No inference required. They apply it today.
S2: clear bridge to reader's life with one inference step.

REJECT if the story is: film/arts/literary criticism, one person's life obsession, institutional critique, industry analysis, sports reporting, cultural commentary where the reader is a spectator, or anything the reader watches rather than does.

CANDIDATES:
${list}

Return JSON only: {"s1": <index or null>, "s2": <index or null>}`,
    }],
  }).catch(() => null);

  if (!msg) return [null, null];
  try {
    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "{}";
    const parsed = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim());
    const s1idx = typeof parsed.s1 === "number" ? parsed.s1 : null;
    const s2idx = typeof parsed.s2 === "number" && parsed.s2 !== s1idx ? parsed.s2 : null;
    return [
      s1idx !== null ? (top[s1idx]?.item ?? null) : null,
      s2idx !== null ? (top[s2idx]?.item ?? null) : null,
    ];
  } catch { return [null, null]; }
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

  const synthWriter = WRITERS[getSynthWriterIndex(editionKey)];
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const storyList = items.map((a, i) =>
    `[${i}] ${a.section.toUpperCase()} — ${a.title}\n${a.content.slice(0, 300)}`
  ).join("\n\n");

  const slot = editionKey.split("_")[1] ?? "morning";
  const slotVoice: Record<string, string> = {
    early:     "This is the reader's first contact with the world today. You are setting the frame through which they will interpret everything that follows. Tone: clarifying, orienting — a mind waking up to what today is actually about.",
    morning:   "The day is fully underway. The reader has context from the morning. Give them the angle that reframes what they think they already know — the interpretation that makes the obvious less obvious.",
    afternoon: "Midday. The reader is in motion, decisions being made. Give them the insight that changes how the rest of the day lands — something that arrives at exactly the right moment.",
    evening:   "The day is nearly done. The reader is in reflection mode, processing what happened. Tell them what today actually meant — the pattern that only becomes visible in hindsight.",
  };
  const editionFrame = slotVoice[slot] ?? slotVoice.morning;

  const themeHistory = await loadThemeHistory();
  const recentWords = new Set(themeHistory.map(e => e.word));
  const recentWordsList = [...recentWords].join(", ");

  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1800,
    messages: [{
      role: "user",
      content: `${synthWriter.style}

EDITION CONTEXT: ${editionFrame}

You are writing the synthesis for The Daily Signal — the card that finds the load-bearing beam underneath the day's news. Read today's stories until you understand something true about how the world works right now. Then say it. Not what you read — what you now know.

Voice rules:
- First-person editorial: opinions, interpretations, predictions — not reportage.
- Never restate a headline. Name the mechanism, not the event.
- Never open with "Today's", "This collection", "These stories", "Across today's".
- No ideological framing. No culture-war lens.
- Specific beats abstract. Name the real-world thing — the company, the person, the place, the technology. Not the publication, not the article title.
- You have absorbed these stories. Write from that understanding, not about the reading. The sources are your research — they are not your content.
- A specific story may appear once, as a single image or fact, then dropped. Never introduced. Never recapped. The reader doesn't need to hear it twice.
- No colons or semicolons anywhere in the text fields.
- The reader is building a life with intention — creatively, professionally, intellectually — at any stage from a mature sixteen-year-old on. The hook earns their attention if it tells them something true about how the world works that changes how they see their own situation.

SOURCE MATERIAL (for context only — do not cite by publication name):
${storyList}

${synthWriter.voiceReminder}

Return JSON only, no markdown:
{
  "themeCandidates": [
    "Candidate 1 — financial/economic register (think: tariff, ledger, debt, windfall, custody, currency — draw your own word from this register, don't just reuse these examples): 2-4 words, an evocative noun phrase naming today's specific underlying tension, grounded in the actual stories above, not generic. RETURN THE PHRASE ONLY — no 'Candidate 1', no register name, no colon, no explanation. Just the two-to-four words, exactly as they would print on the page.",
    "Candidate 2 — spatial/structural register (think: threshold, bottleneck, scaffolding, architecture, chokepoint): same format, a genuinely different register from candidate 1.",
    "Candidate 3 — legal/institutional register (think: mandate, charter, amnesty, jurisdiction, dispensation): same format, different register again.",
    "Candidate 4 — theatrical/performative register (think: mask, rehearsal, costume, choreography, pretense): same format, different register again.",
    "Candidate 5 — biological/physical register (think: contagion, immunity, inheritance, metabolism, erosion): same format, different register again.",
    "Candidate 6 — temporal/motion register (think: momentum, drift, inertia, undertow, ratchet): same format, different register again.",
    "Candidate 7 — your own choice, any register not used above, whatever genuinely fits today's stories best — reach into your own full vocabulary, don't default to the first word that comes to mind.",
    "Candidate 8 — your own choice, any register not used above, a second genuinely different option."
  ],
  "theme": "Select your single strongest candidate from themeCandidates above — the one that most precisely names today's actual mechanism, not just the most dramatic-sounding. Same 2-4 word evocative-noun-phrase style. E.g. 'The Permission Economy' / 'Controlled Disintegration' / 'Institutional Overcorrection'. Not 'Technology and Society'. Its final word must NOT be any of these words, already used in recent editions — if your top candidate collides, use your next-best one instead: ${recentWordsList || "none yet"}.",
  "hook": "1 sentence only. 7-10 words maximum — count them. The irreversible claim — the thing that cannot be unsaid once you read it. This is the first thing the reader sees. No setup, no throat-clearing. Start with the tension, not the context.",
  "observation": "1-2 sentences that deepen the hook. Don't summarize stories. Speak from what you now understand — as if you absorbed the news and are telling someone what it means, not what it said. End somewhere that makes the reader want the takeaways.",
  "takeaways": [
    "The mechanism — why the world works this way right now. Not a connection between articles. A truth about human behavior, systems, or power that explains the pattern. One sentence.",
    "The complication — what this costs, what the trap is, what the irony reveals. A real-world example (a company, a person, a place) may appear as a single image. One sentence, then move on. 1-2 sentences.",
    "The implication — what breaks next, who is positioned to win, what this pattern means for anyone paying attention. State it as something you know, with the confidence of someone who has seen this before. 1-2 sentences."
  ],
  "conclusion": "A sentence that feels true beyond today — about human behavior, systems, or power — stated with the confidence of someone who has seen this pattern before. Not a summary of the card. A line someone would underline in a book. Do not start with 'Today', 'Ultimately', or 'In the end'. No colons. No semicolons.",
  "actions": [
    "The reader is curious and independently-minded, building a life with intention, from a mature sixteen-year-old upward — a creative practice, a small business, a thoughtful career, a considered way of living. Actions connect this insight to their own life, work, or thinking — not just to the topic. The question each action answers: what does someone like you do with this understanding? | Imperative sentence. Rooted in this insight. Beginner-friendly: no experience, tools, or money required. A step this reader could take this week. Start with a strong verb. No preamble. Max 15 words.",
    "Imperative sentence. Different angle on the same insight — connects to how this reader works, creates, decides, or relates to others. Zero barrier to entry, doable in a single sitting. Starts with a verb. Max 15 words.",
    "Imperative sentence. The smallest possible move — under 10 minutes, costs nothing, directly connected to what was just understood. So small it would be embarrassing not to do. Starts with a verb. Max 15 words."
  ],
  "imageQuery": "4-6 concrete visual words for Unsplash that match the mood and texture of today's theme — a real scene or object, not an abstraction. E.g. for 'institutional friction': 'empty government hallway fluorescent light'; for 'surveillance creep': 'security camera corner urban shadow'. No abstract nouns. No brand names."
}`,
    }],
  }).catch(() => null);

  if (!msg) return { theme: "", hook: "", observation: "", takeaways: [], conclusion: "", actions: [] };
  const rawText = (msg.content[0]?.type === "text" ? msg.content[0].text : undefined) ?? "{}";
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned) as Synthesis & { themeCandidates?: string[] };

    // Deterministic backstop: the prompt-level word ban above isn't always obeyed — if the
    // model's theme collided with a recent core word anyway, first try its OWN other candidates
    // (already generated in this same response, no extra call needed), then fall back to one
    // targeted follow-up call only if every candidate also collides. Never loops, never throws
    // past this block — collision just means we keep the original theme and publish anyway.
    // A rare repeat is a far smaller cost than a failed edition.
    // Candidates come back mirroring the field spec's own labelling — "Candidate 1 —
    // financial/economic register: The Attention Deficit" — and the collision path below
    // promotes one into `theme` verbatim, which is how that string reached the front page.
    // Strip the scaffolding wherever a theme is set, including the model's first choice.
    const cleanTheme = (s: string): string => {
      // Parentheticals go FIRST — the register hints contain their own colons
      // ("(think: mask, rehearsal)"), which otherwise get mistaken for the label separator.
      let t = s.trim().replace(/\s*\([^)]*\)\s*/g, " ").trim();
      if (/^candidate\s*\d+\b/i.test(t)) {
        // Take whatever follows the LAST label separator — the model uses ":" or an em-dash,
        // and sometimes both ("Candidate 3 — legal/institutional register — The Phrase").
        const cut = Math.max(t.lastIndexOf(":"), t.lastIndexOf("—"), t.lastIndexOf("–"));
        t = cut >= 0 ? t.slice(cut + 1) : t.replace(/^candidate\s*\d+\s*[—–-]\s*/i, "");
      }
      return t.replace(/^["'\s]+|["'\s]+$/g, "").trim();
    };
    if (parsed.theme) parsed.theme = cleanTheme(parsed.theme);
    if (Array.isArray(parsed.themeCandidates)) parsed.themeCandidates = parsed.themeCandidates.map(cleanTheme);

    let collidingWord = parsed.theme ? themeCoreWord(parsed.theme) : null;
    if (collidingWord && recentWords.has(collidingWord)) {
      const original = parsed.theme.trim();
      const alt = (parsed.themeCandidates ?? []).find(c => {
        const w = themeCoreWord(c);
        return w && !recentWords.has(w) && c.trim() !== original;
      });
      if (alt) {
        parsed.theme = alt.trim();
        collidingWord = themeCoreWord(parsed.theme);
      }
    }
    if (collidingWord && recentWords.has(collidingWord)) {
      try {
        const swapMsg = await client.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 60,
          messages: [{
            role: "user",
            content: `The theme "${parsed.theme}" ends on the word "${collidingWord}", which was already used in a recent edition's theme — it needs to change. Think of ONE replacement from your own vocabulary: same 2-4 word evocative-noun-phrase style naming an underlying force or tension, same meaning, ending on a genuinely different word — reach for a register you haven't tried yet (financial, spatial, legal, theatrical, biological, temporal...). It must be just as sharp and compelling as the original — do not flatten it into a generic synonym just to be different. No colons, no semicolons, no quotes around it. Return ONLY the replacement phrase, nothing else.`,
          }],
        }).catch(() => null);
        const swapText = (swapMsg?.content[0]?.type === "text" ? swapMsg.content[0].text : "").trim();
        if (swapText && swapText.length < 60) parsed.theme = swapText;
      } catch { /* keep original theme if the swap call fails — never blocks the edition */ }
    }

    // Use article-derived imageQuery for the synthesis image; fall back to theme words
    const imgQuery = (parsed.imageQuery || parsed.theme || "").replace(/[^a-zA-Z\s]/g, "").trim();
    if (imgQuery) {
      parsed.imageUrl = await fetchUnsplash(imgQuery, undefined, 1, imgQuery).then(r => r?.url).catch(() => undefined);
      // Note: synthesis image history is appended by buildPageData after all images resolve
    }
    const { themeCandidates: _themeCandidates, ...synthesis } = parsed;
    put(blobKey, JSON.stringify(synthesis), { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true }).catch(() => {});
    const finalWord = synthesis.theme ? themeCoreWord(synthesis.theme) : null;
    if (finalWord) appendThemeHistory(finalWord, synthesis.theme, themeHistory).catch(() => {});
    return synthesis;
  } catch {
    return { theme: "", hook: "", observation: "", takeaways: [], conclusion: "", actions: [] };
  }
}

// ── Image history (30-day dedup across editions) ──────────────────────────────
const IMAGE_HISTORY_KEY = "image-history/used.json";
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

async function loadImageHistory(): Promise<Set<string>> {
  try {
    const blob = await head(IMAGE_HISTORY_KEY);
    if (!blob) return new Set();
    const res = await fetch(blob.url, { cache: "no-store" });
    if (!res.ok) return new Set();
    const entries = await res.json() as { url: string; usedAt: string }[];
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    return new Set(entries.filter(e => new Date(e.usedAt).getTime() > cutoff).map(e => unsplashPhotoId(e.url)));
  } catch { return new Set(); }
}

// MUST be awaited by callers. This was fire-and-forget, and a floating promise in a
// serverless function can be frozen before it completes — so an edition's images entered
// history only sometimes, and the Feature Creature (whose query is the most deterministic
// in the system) returned the identical photo on every miss. photo-1601506521937 ran across
// five editions between 2026-08-07 and 2026-08-12 that way.
async function appendImageHistory(urls: string[]): Promise<void> {
  if (!urls.length) return;
  const read = async (): Promise<{ url: string; usedAt: string }[]> => {
    const blob = await head(IMAGE_HISTORY_KEY);
    if (!blob) return [];
    const res = await fetch(blob.url, { cache: "no-store" });
    return res.ok ? await res.json() as { url: string; usedAt: string }[] : [];
  };
  try {
    const cutoff = Date.now() - THIRTY_DAYS_MS;
    const now = new Date().toISOString();
    // Re-read immediately before the write and union, so a warm that overlaps another
    // (a manual rewarm during a cron) cannot erase the other's entries. Read-modify-write
    // with no merge silently dropped whole editions out of history.
    const merged = new Map<string, { url: string; usedAt: string }>();
    for (const pass of [await read(), await read()]) {
      for (const e of pass) {
        if (new Date(e.usedAt).getTime() > cutoff) merged.set(unsplashPhotoId(e.url), e);
      }
    }
    for (const url of urls) {
      const pid = unsplashPhotoId(url);
      if (!merged.has(pid)) merged.set(pid, { url: pid, usedAt: now });
    }
    await put(IMAGE_HISTORY_KEY, JSON.stringify([...merged.values()]), { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
    console.log(`[image-history] recorded ${urls.length} images, ${merged.size} in 30-day window`);
  } catch (e) {
    console.error("[image-history] WRITE FAILED — images from this edition may repeat", e);
  }
}

// ── Theme word history (fixed-size FIFO, not date-based — cheap to load, bounded prompt size) ──
const THEME_HISTORY_KEY = "theme-history/used.json";
const THEME_HISTORY_SIZE = 30; // roughly the last week-plus at 4-5 editions/day
const THEME_STOPWORDS = new Set([
  "the", "a", "an", "of", "in", "on", "to", "is", "are", "was", "were", "be", "been",
  "as", "for", "and", "or", "not", "no", "with", "without", "by", "at", "from",
  "into", "onto", "over", "under", "this", "that", "these", "those", "it", "its",
  "your", "our", "their", "you", "we", "they",
]);

// The theme's final content word is where repetition concentrates ("The Delegation Trap" / "The Authenticity Tax") —
// track that word, not the whole phrase, so near-variants ("Authenticity Tax" vs "Authenticity Paradox") still collide.
function themeCoreWord(theme: string): string | null {
  const words = theme.toLowerCase().replace(/[^a-z\s]/g, "").trim().split(/\s+/).filter(Boolean);
  const content = words.filter(w => !THEME_STOPWORDS.has(w));
  return content.length ? content[content.length - 1] : null;
}

// Plain bounded array, newest last — no timestamps, no date filtering. Load = one blob read,
// no parsing overhead. Update = push the word we already just generated, drop the oldest if over size.
async function loadThemeHistory(): Promise<{ word: string; theme: string }[]> {
  try {
    const blob = await head(THEME_HISTORY_KEY);
    if (!blob) return [];
    const res = await fetch(blob.url, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json() as { word: string; theme: string }[];
  } catch { return []; }
}

async function appendThemeHistory(word: string, theme: string, current: { word: string; theme: string }[]): Promise<void> {
  if (!word) return;
  try {
    const fresh = [...current, { word, theme }];
    if (fresh.length > THEME_HISTORY_SIZE) fresh.splice(0, fresh.length - THEME_HISTORY_SIZE);
    await put(THEME_HISTORY_KEY, JSON.stringify(fresh), { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
  } catch { /* non-fatal */ }
}

// ── Weekly Signal & Noise ─────────────────────────────────────────────────────

function isSundayEvening(editionKey: string): boolean {
  const [date, slot] = editionKey.split("_");
  if (slot !== "evening") return false;
  return new Date(`${date}T00:00:00Z`).getUTCDay() === 0;
}

function getPastWeekDates(sundayDate: string): string[] {
  const sunday = new Date(`${sundayDate}T00:00:00Z`);
  const dates: string[] = [];
  for (let i = 6; i >= 1; i--) {
    const d = new Date(sunday.getTime() - i * 24 * 60 * 60 * 1000);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates; // Mon → Sat
}

export function getWeeklyWriterIndex(weekDate: string): number {
  return getAccessiblePool(`${weekDate}_evening`)[4];
}

async function loadWeeklySyntheses(pastDates: string[]) {
  const SLOT_PRIORITY = ["evening", "afternoon", "morning", "early", "night"];
  const results: { date: string; theme: string; hook: string; observation: string; takeaways: string[]; conclusion: string; s1Title?: string; s2Title?: string }[] = [];
  for (const date of pastDates) {
    for (const slot of SLOT_PRIORITY) {
      try {
        const b = await head(`synthesis/v1/${date}_${slot}.json`);
        if (!b) continue;
        const res = await fetch(b.url, { cache: "no-store" });
        if (!res.ok) continue;
        const data = await res.json();
        if (data.theme && data.hook) {
          // Pull S1/S2 ownedTitles from the same slot's archive blob for concrete anchors
          let s1Title: string | undefined;
          let s2Title: string | undefined;
          try {
            const ab = await head(`archive/editions/${date}_${slot}.json`);
            if (ab) {
              const ar = await fetch(ab.url, { cache: "no-store" });
              if (ar.ok) {
                const archive = await ar.json();
                s1Title = archive.stories?.[0]?.ownedTitle || archive.stories?.[0]?.title;
                s2Title = archive.stories?.[1]?.ownedTitle || archive.stories?.[1]?.title;
              }
            }
          } catch { /* titles optional */ }
          results.push({ date, theme: data.theme, hook: data.hook, observation: data.observation ?? "", takeaways: data.takeaways ?? [], conclusion: data.conclusion ?? "", s1Title, s2Title });
          break;
        }
      } catch { /* try next slot */ }
    }
  }
  return results;
}

export async function getWeeklySignal(editionKey: string, blocked?: Set<string>, onGenerated?: () => void): Promise<WeeklySignal | null> {
  const [sundayDate] = editionKey.split("_");
  const blobKey = `weekly-signal/v1/${sundayDate}.json`;

  try {
    const existing = await head(blobKey);
    if (existing) {
      const res = await fetch(existing.url, { cache: "no-store" });
      if (res.ok) {
        const cached = await res.json() as WeeklySignal;
        if (cached.hook) return cached;
      }
    }
  } catch { /* generate fresh */ }

  const pastDates = getPastWeekDates(sundayDate);
  const syntheses = await loadWeeklySyntheses(pastDates);
  if (syntheses.length < 3) return null;

  const writerIndex = getWeeklyWriterIndex(sundayDate);
  const writer = WRITERS[writerIndex];

  const weeklyContext = syntheses.map(s => {
    const dayName = new Date(`${s.date}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
    const topStories = [s.s1Title, s.s2Title].filter(Boolean).map(t => `• ${t}`).join("\n");
    return `${dayName.toUpperCase()} — ${s.theme}\nTop stories: \n${topStories}\n"${s.hook}"\n${s.observation}\nInsights: ${s.takeaways.join(" | ")}`;
  }).join("\n\n---\n\n");

  const firstDate = new Date(`${pastDates[0]}T00:00:00Z`);
  const lastDate = new Date(`${sundayDate}T00:00:00Z`);
  const weekOf = `${firstDate.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })} – ${lastDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1400,
    messages: [{
      role: "user",
      content: `${writer.style}

You have absorbed a week of news. Below is what each day revealed — the themes, the stories, the patterns.

Your job: find the thread. The one thing that only becomes visible when you hold the whole week at once. Not a day-by-day recap. Not "this week we saw." The mechanism underneath — the force that kept showing up in different clothes.

THIS WEEK'S MATERIAL:
${weeklyContext}

Voice rules:
- Never do a day-by-day recap. Never reference "Monday's story" or "what happened Wednesday."
- Never open with "This week", "This week we saw", "Across this week", or any variant.
- Specific beats abstract. Name the real-world thing — the company, the person, the place, the technology.
- You absorbed this week. Write from that understanding, not about the reading.
- No colons or semicolons anywhere.

${writer.voiceReminder}

Return JSON only, no markdown:
{
  "hook": "7-10 words maximum — count them. The week's irreversible truth. Start mid-tension, no setup.",
  "signal": "2-3 sentences. The thread that ran through this week — the pattern only visible across all the days. Name the mechanism, not the events. Ground it in something specific — a named company, person, or technology that crystallizes the pattern. This is what the week actually meant.",
  "noise": "1-2 sentences. One specific thing that got amplified this week but won't matter in a month — an overblown story, a manufactured outrage, a distraction that served someone's agenda. Name it. Dismiss it. The reader deserves to put it down.",
  "lookingForward": "2-3 sentences. Given what this week revealed about how the world works, where should a curious, independently-minded reader building a considered life — sixteen and upward — put their attention next week? Not predictions — where the pattern leads. What to watch, what to question, what to prepare for in their own work, decisions, and thinking.",
  "actions": ["Action 1 — single imperative sentence, doable this week, beginner-friendly, zero tools or money required, starts with a verb, max 15 words.", "Action 2 — same rules, different angle on the week's signal.", "Action 3 — same rules, a third distinct entry point for someone building a considered life."],
  "imageQuery": "4-6 atmospheric words for Unsplash. The mood or texture of the week's thread — a real scene or object, not an abstraction."
}`,
    }],
  }).catch(() => null);

  if (!msg) return null;
  const rawText = (msg.content[0]?.type === "text" ? msg.content[0].text : undefined) ?? "{}";
  const cleaned = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed.hook) return null;
    const imgQuery = (parsed.imageQuery ?? "").replace(/[^a-zA-Z\s]/g, "").trim();
    const imageUrl = imgQuery ? await fetchUnsplash(imgQuery, undefined, 1, imgQuery, blocked).then(r => r?.url).catch(() => undefined) : undefined;
    const result: WeeklySignal = {
      hook: parsed.hook ?? "",
      signal: parsed.signal ?? "",
      noise: parsed.noise ?? "",
      lookingForward: parsed.lookingForward ?? "",
      actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 3) : [],
      writerName: writer.name,
      weekOf,
      imageUrl,
    };
    put(blobKey, JSON.stringify(result), { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true }).catch(() => {});
    onGenerated?.();
    return result;
  } catch {
    return null;
  }
}

// ── Weekly Signal broadcast ───────────────────────────────────────────────────
async function sendWeeklySignalBroadcast(weekly: WeeklySignal, editionKey: string): Promise<void> {
  const apiSecret = process.env.CONVERTKIT_API_SECRET;
  if (!apiSecret) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://dailysignal.cc";
  const archiveUrl = `${siteUrl}/archive/${editionKey}`;

  const html = `
<div style="max-width:600px;margin:0 auto;font-family:Georgia,serif;color:#1a1a2e;background:#f8f7f4;padding:40px 32px;border-radius:12px;">
  <div style="font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#888;margin-bottom:8px;">The Weekly Signal</div>
  ${weekly.weekOf ? `<div style="font-size:12px;color:#aaa;margin-bottom:32px;">${weekly.weekOf}</div>` : ""}

  <div style="font-size:28px;font-weight:700;line-height:1.25;color:#1a1a2e;margin-bottom:24px;">${weekly.hook}</div>

  <div style="font-size:17px;line-height:1.8;color:#444;margin-bottom:28px;">${weekly.signal}</div>

  ${weekly.noise ? `
  <div style="border-left:3px solid #ccc;padding-left:20px;margin-bottom:28px;">
    <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#aaa;margin-bottom:6px;">Noise</div>
    <div style="font-size:15px;line-height:1.7;color:#777;font-style:italic;">${weekly.noise}</div>
  </div>` : ""}

  ${weekly.lookingForward ? `
  <div style="margin-bottom:28px;">
    <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#888;margin-bottom:6px;">Looking Forward</div>
    <div style="font-size:16px;line-height:1.75;color:#444;">${weekly.lookingForward}</div>
  </div>` : ""}

  ${(weekly.actions?.length ? weekly.actions[0] : weekly.oneMove) ? `
  <div style="background:#1a1a2e;color:#f8f7f4;border-radius:10px;padding:20px 24px;margin-bottom:32px;">
    <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#aaa;margin-bottom:8px;">One Move</div>
    <div style="font-size:16px;line-height:1.6;font-weight:600;">${weekly.actions?.length ? weekly.actions[0] : weekly.oneMove}</div>
  </div>` : ""}

  <div style="text-align:center;margin-top:32px;">
    <a href="${archiveUrl}" style="display:inline-block;background:#1a1a2e;color:#f8f7f4;text-decoration:none;padding:14px 32px;border-radius:50px;font-size:13px;font-weight:700;letter-spacing:0.5px;">Read This Edition →</a>
  </div>

  ${weekly.writerName ? `<div style="font-size:12px;color:#aaa;text-align:center;margin-top:24px;">— ${weekly.writerName}</div>` : ""}
</div>`;

  await fetch("https://api.convertkit.com/v3/broadcasts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_secret: apiSecret,
      subject: `The Weekly Signal — ${weekly.hook}`,
      content: html,
      public: false,
    }),
  });
}

// ── S1 Insight — original personal-development piece per edition ──────────────
// Generates a columnist-style insight piece from the INSIGHT_LENS pool, stores it
// as an ArticleCommentary blob (same format as regular articles), and returns a
// Story that slots into position 0 of the edition. The article detail page renders
// it identically to any other story — no custom routes or card components needed.
// Requiring "one named person in one specific moment" fixed the old failure (every piece
// opening "Every summer, behavioral scientists...") by mandating a single form — which then
// became its own repetition: three consecutive pieces opened person + place + clock time,
// two of them closing the hook on the same reversal. These rotate the FORM while keeping the
// concreteness that the original rule was protecting. None of them permit a general "every
// summer people do X" opening.
const HOOK_MODES = [
  "THE SCENE — one person in one specific moment. A name, a place, an hour. Show it happening; the reader should be able to picture exactly where they are.",
  "THE OBJECT — open on a physical thing, described precisely enough that the reader sees it before they know why it matters. The person, if there is one, arrives after the object does.",
  "THE NUMBER — open on one specific figure, stated flat, that does not add up. No preamble and no source-quoting. Let the reader feel the wrongness before you explain it.",
  "THE OVERHEARD LINE — open on something someone actually said, in quotation marks, then place it: who said it, where, what was happening. The line lands before the context does.",
  "THE PROCEDURE — describe, deadpan, the steps of something routinely done. Stay flat and technical until one step quietly exposes the problem. No commentary; the sequence does the work.",
  "THE DOCUMENT — open on a form, a receipt, a message, a log entry, a line of a contract. Quote or describe it exactly. What it says, and what it fails to say, is the opening.",
];

// Same failure the hook had. "Name the lived experience, built from Para 1's concrete detail"
// is satisfiable by exactly one syntactic frame, and the model found it: "The Move You've Been
// Staring At Too Long" / "The Year You Quit Too Soon" / "The Room You Walked Through Without
// Seeing" — three consecutive editions, one shape. Readers habituate to a headline frame in two
// or three exposures. Rotating the form is what fixed the hooks; same treatment here.
const TITLE_MODES = [
  "THE LIVED DETAIL — a number and an act, lifted from the piece. 'Fifteen Years of Calling It Nerves'. Concrete enough that it could only belong to this article. The detail alone is not a title: pair it with the claim, or the reader learns a fact about a stranger and nothing about the piece.",
  "THE FLAT FACT — state the thing that should not be true, plainly and without commentary. No irony, no wink. Let the reader do the reacting.",
  "THE READER'S OWN QUESTION — the question they are already asking, in the words they would use. Not a rhetorical question the piece answers smugly.",
  "THE NAMED THING — put the specific person, place, work or object at the front, then say what happened to it or what it proves. The name alone carries nothing: a sketchbook, a tally sheet or a person's name tells the reader who is in the piece, never what it is about. Works only if that name appears in the piece.",
  "THE INSTRUCTION — a short imperative. What to do, stated as if to one person. No hedging, no 'try to'.",
  "THE OVERHEARD FRAGMENT — a phrase in quotation marks, something a person would actually say, then nothing else. Let it sit unexplained.",
];

const INSIGHT_LINK_BASE = "https://dailysignal.cc/insight/";
const INSIGHT_PROMPT_V = "v4"; // must match getFullArticle's PROMPT_V

/**
 * Match edition stories to the FINISHED insight. Runs after the piece is written and the
 * lineup is settled, so this can never influence the prose — the previous design injected a
 * story into the prompt and produced four editions with the same opening paragraph.
 *
 * Returns 0-3 links. Returning none is a valid, expected outcome: the insight is generated
 * from its lens and some days nothing in the edition genuinely connects. Any failure leaves
 * the insight untouched rather than blocking it.
 */
async function attachInsightRelated(insight: Story, candidates: Story[]): Promise<Story> {
  const pool = candidates.filter(s => s.summary).slice(0, 12);
  if (pool.length === 0) return insight;
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const list = pool.map((s, i) => `${i + 1}. ${s.ownedTitle || s.title} — ${s.summary}`).join("\n");
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 60,
      messages: [{
        role: "user",
        content: `An essay and a list of today's news stories. Which stories, if any, would genuinely deepen the essay for someone who just finished reading it?

ESSAY: "${insight.ownedTitle || insight.title}"
${insight.summary ?? ""}
${(insight.content ?? "").slice(0, 1200)}

STORIES:
${list}

Pick at most 3, and only where the connection is real — a shared mechanism or tension, not a shared keyword. Two stories both mentioning books is not a connection. Most days the honest answer is one or none.

Return only comma-separated numbers, or the word NONE.`,
      }],
    });
    const text = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : "";
    if (/^none/i.test(text)) return insight;
    const links = text.split(/[,\s]+/)
      .map(n => parseInt(n, 10))
      .filter(n => Number.isInteger(n) && n >= 1 && n <= pool.length)
      .slice(0, 3)
      .map(n => pool[n - 1].link);
    const unique = [...new Set(links)];
    console.log(`[insight-related] ${unique.length} matched for ${insight.ownedTitle || insight.title}`);
    return unique.length ? { ...insight, relatedLinks: unique } : insight;
  } catch (e) {
    console.warn("[insight-related] failed, no related links:", e);
    return insight;
  }
}

// Generation reads NOTHING from the RSS pool. The piece is written from the lens alone.
// An earlier design scored a news story for "adjacency" and injected it as the opening
// scene; that candidate was `raw[0]` captured before preselection reordered the pool, so
// a single evergreen post anchored four consecutive editions to the same first paragraph.
// It also replaced the HOOK craft rules rather than adding to them, so the rules never ran.
// Stories are matched to the finished piece afterwards — see attachInsightRelated.
export async function getS1Insight(
  editionKey: string,
  blocked?: Set<string>,
  // Out-param. When generation fails the edition silently promotes an RSS story into S1 and
  // nobody finds out until the wrong thing is noticed on the front page — which is exactly
  // how 2026-08-12_morning shipped a product write-up as the lead. Filled in so /api/warm
  // can report the miss.
  status?: { error?: string; attempts?: number },
): Promise<Story | null> {
  const syntheticLink = `${INSIGHT_LINK_BASE}${editionKey}`;
  const articleSlug = createHash("md5").update(syntheticLink).digest("hex").slice(0, 16);
  const blobKey = `articles/${INSIGHT_PROMPT_V}/${editionKey}/${articleSlug}.json`;

  // Return cached story shell from edition archive if already warmed
  const storyCacheKey = `s1-insight-story/v1/${editionKey}.json`;
  try {
    const existing = await head(storyCacheKey);
    if (existing) {
      const res = await fetch(existing.url, { cache: "no-store" });
      if (res.ok) return await res.json() as Story;
    }
  } catch { /* generate fresh */ }

  // Two attempts. The failure that dropped the column on 2026-08-12_morning was intermittent
  // — the four editions either side of it generated fine on identical code — so a single
  // retry covers the common causes (a truncated or non-JSON response, a transient API error)
  // without masking a genuine, repeatable break.
  const MAX_ATTEMPTS = 2;
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
   if (status) status.attempts = attempt;
   try {
    const { INSIGHT_LENSES } = await import("./palette");
    // Compute lens deterministically from editionKey directly — bypasses the _editionKeyHash
    // singleton which can be corrupted when multiple editions build concurrently.
    const lensHash = editionKey.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
    const lens = INSIGHT_LENSES[(lensHash * 11 + 17) % INSIGHT_LENSES.length];
    const writerIdx = INSIGHT_WRITER_INDICES[(lensHash * 3 + 7) % INSIGHT_WRITER_INDICES.length];
    const insightWriter = WRITERS[writerIdx];

    // A prescribed rhythm is a detectable rhythm — "short punches, then one that earns it"
    // produces performed variance, which reads as machine-written. On 40% of editions we
    // drop the instruction entirely and let the sentences fall where the thought falls.
    // Seeded from the edition key, not the wall clock, so a given edition always renders
    // the same way (same convention as synthFlip — see CLAUDE.md).
    const freeRhythm = mixedRandom(lensHash) < 0.4;
    const hookMode = HOOK_MODES[Math.floor(mixedRandom(lensHash * 3 + 991) * HOOK_MODES.length)];
    const titleMode = TITLE_MODES[Math.floor(mixedRandom(lensHash * 7 + 4441) * TITLE_MODES.length)];

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1400,
      messages: [{
        role: "user",
        content: `${insightWriter.style}

You are writing the lead story for The Daily Signal — a personal-development insight column that appears at the top of every edition. It is original writing, not a news rewrite. Write for a smart reader who wants to understand themselves and the world better. Write in your own voice throughout.

TODAY'S LENS:
Domain: ${lens.domain}
Principle: "${lens.concept}"
Angle: "${lens.angle}"

TWO RULES THAT APPLY TO EVERY PARAGRAPH, NOT JUST THE ONE THAT NAMES THEM:
1. NOTHING INVENTED IS EVER ATTACHED TO A REAL PERSON, ORGANISATION, OR DOCUMENTED EVENT — anywhere in the piece, hook included. Placing a real figure at a real event they did not attend, or adding sensory detail you cannot source, is the most damaging thing you can do here precisely because it reads as authoritative and is trivially checkable. If a detail would need to be true and you do not know that it is, either cut it or use an invented ordinary person instead.
2. NO NAMED WEEKDAY ANYWHERE unless the specific day is itself the point. "On a Wednesday night" and "Tuesday afternoon" are placeholders wearing specificity's clothes — they add a word and no information. A time of day, a season, or an hour relative to an event all carry more.

STRUCTURE (five paragraphs, pure prose — no bullet points, no headers in the body):
- Para 1 — HOOK, and today you are writing it in this mode: ${hookMode}
  Whatever the mode, the opening is one concrete particular — never a type of person, never a recurring pattern, never 'every June someone does X' or 'every summer people do Y'. Do not end the hook on a defeat or reversal by reflex; that has become its own habit.
  IF THE HOOK NAMES A PERSON, it must be an invented ordinary person — someone with no public record, whose life you are free to furnish. Give them a full name that belongs to them and to this world, and avoid the autopilot defaults: never Mara, Sarah, Elena, David, or Callum. A blocklist always trails the habit, so apply the underlying test too — if the name you have chosen is the first plausible one that came to mind, discard it and pick again from a different naming tradition. Use a REAL, publicly known person here only if the scene is documented and you could point to where it is recorded — otherwise you are inventing socks and weather for someone who actually lived, which is the failure the global rules above forbid. The ordinary invented person is almost always the better choice: the hook needs a human being, not an authority.
- Para 2 — MECHANISM: State the principle and explain why the world works this way. Write it as something you know to be true. No citations, no named authors — in THIS paragraph only. The principle belongs in your own voice here; Para 3 is where it gets anchored to something real.
- Para 3 — CASE: Ground the principle in one named case — a real person, company, product, year, or documented moment. Not hypothetical. VERIFIABILITY IS THE BAR, and it is absolute: if you cannot name the specific study, book, person, or documented event that makes this checkable, choose a different case. You may name it here — a bare name is allowed in this paragraph and nowhere else, because committing to a real source is what keeps the example honest. Never credit a method, programme, selection criterion, or finding to an organisation-plus-date unless it is a well-documented fact you are certain of: "In the early 1980s, NASA used this to assess candidates" reads as verifiable and is the easiest sentence in the piece to invent. Check what the example connotes, not just whether it is true: an example carrying suffering, cruelty, or condescension will undercut the warmth of the piece even when the science is sound. A confident, specific, checkable-looking claim that turns out to be false costs the publication more than a duller case that is true.
- Para 4 — APPLICATION: Serve the reader's own need. If the hook established something the reader lacks, this paragraph addresses the reader's lack — it does not train them to supply it to someone else. The reader should finish this paragraph better off, not with an assignment to improve others. One scenario only, fully inhabited. Not a list of situations to choose from — the reader can occupy one room, not three. Define the moment by what the reader is doing, never by a day of the week: a named weekday is a stand-in for specificity, not specificity itself. Never write "Tuesday afternoon", "Monday morning", or any "So here is your [day]" opener. "The hour before the budget meeting" is a moment. "Tuesday" is a placeholder.
- Para 5 — CLOSE: One to three sentences, and the strongest writing in the piece. The single most quotable sentence must live here, not in the hook. This is also where the promise made by the title gets paid — if the title named something the reader wants, this is the moment they get it. Slightly uncomfortable. True beyond today. It does NOT have to be an epigram. A neat closing inversion ("Your stress response was never the enemy. Your story about it was.") is the most machine-sounding sentence a piece can end on — strongest does not mean cleverest, and a plain ending that is simply true beats a symmetry that lands too well.
- If the hook named a person, return to them somewhere in Para 4 or Para 5. One clause is enough. Never introduce a named person and abandon them. If the hook opened on an object, number, line, procedure or document instead, return to THAT — the thing the piece opened on must reappear once, so the reader feels the circle close.

LENGTH CEILINGS (these are maximums, never targets — never pad to reach them, and coming in well under is always better):
- Para 1 must not exceed 70 words. It has one job: earn Para 2. On a phone this paragraph is already sixteen lines tall, and it sits in the window where readers decide whether to keep going.
- Paras 2, 3, and 4 must not exceed 100 words each.
- Para 5 must not exceed 45 words.
- If a paragraph runs over, cut — do not split it. The five-paragraph structure is fixed.

CRAFT RULES:
- ${freeRhythm ? "Let the sentences fall where the thought falls. Do not perform variation — a prescribed rhythm becomes an audible one, and evenly alternating short and long reads as manufactured. Some paragraphs will come out lumpy. That is what unforced writing looks like." : "Vary sentence length. Short punches. Then one that earns it. Then short again."}
- Em-dashes: TWO in the entire piece, maximum. Everything else becomes a full stop, a comma, or a rebuilt sentence. Em-dash frequency is the most reliable signal of machine-written prose — recent pieces ran one every ninety words, roughly eight times the rate of human editorial writing.
- The "Not X. Y." construction: ONCE in the entire piece, maximum. This includes every variant, which are the same move wearing different clothes — "Not because A. Because B.", "It isn't X, it's Y.", "X wasn't A. It was B.", "not composure or experience. It was...". A human writer uses this two or three times in an essay for emphasis. Used as a default sentence shape it is the single clearest tell that no person wrote this.
- Include exactly one concrete detail that serves no argument — something the writer would have noticed rather than deployed. Every other detail in the piece earns its keep, and that total efficiency is itself unnatural: real prose carries slack. Do not flag it or make it cute. Let it sit there.
- Fragments are allowed for emphasis, but each must be readable as a complete thought on its own. Never drop the subject of a clause.
- No semicolons — ever. Rewrite as two sentences.
- No throat-clearing openers: never "In a world where...", "It's no secret that...", "Now more than ever...", "Here's the thing...".
- No academic hedging: never "one might argue", "it is worth noting", "this suggests that".
- Vivid and specific — name the thing, don't describe it abstractly.
- Every paragraph must carry at least one thing the reader can picture. The explanatory paragraph is where this discipline usually collapses — a stack of true assertions with nothing visible in it reads as a lecture no matter how well the sentences are shaped.
- No defending a claim against an objection the reader hasn't made: never "This is not metaphor", "This isn't just self-help", "And no, this isn't woo". State it and move on.
- You may use ONE surprising reference (a thinker, experiment, or moment) that creates a genuine connection. One sentence, then move on. If nothing fits cleanly, skip it.
- No sentence earns its place unless it adds something the reader doesn't already know from the previous sentence.
- Repetition for cadence is not information. A triad of negations ("Not willpower. Not belief. A room."), a stack of parallel clauses ("You have set intentions. You have cleared mornings. You have downloaded the app."), or a sentence restating the previous one in different words is filler even when it sounds good — especially when it sounds good. Use the three-beat construction at most once in the entire piece. Past that it stops being emphasis and becomes a tic the reader can hear. Cut it and reread: if nothing is lost, it was decoration.
- Never announce that you are about to be specific or about to explain. No "Here is how it actually works", no "made specific", no "So here is". Just do the thing.
- First word must not be "The", "In", "It", "There", or "Today".
- 350-415 words total. Every word should pull weight. If the piece feels thin at that length, the problem is a weak idea, not insufficient words — sharpen the insight rather than adding prose.

OUTPUT — return JSON only, no markdown:
{
  "ownedTitle": "Write it in this mode today: ${titleMode} — Name the experience the reader has already lived, not the conclusion the piece reaches. Whatever the title promises, Para 5 must deliver. Under 12 words. Not clickbait. FOUR TESTS, all mandatory: (0) THE READER MUST BE ABLE TO SAY WHAT THIS PIECE IS ABOUT from the title alone — not merely feel curious. This is the test these headlines keep failing. 'Callum Forde's Sketchbook Was Empty for Three Years' and 'Lorraine's Tally Sheet Had No Column for This' are concrete, specific and completely opaque: they name the SCENE from Para 1, which is only the illustration, and hide the subject entirely. Take the concrete anchor from Para 1 and the subject or claim from Para 2, and put both in the one line. 'Good Intentions Don't Fire Neurons' passes — it names a subject and makes a claim. Do not use Para 2's technical vocabulary, but the reader must still know what the piece concerns. A title that only works once the reader has read the article has failed. (1) It must OPEN a gap, never close one — if someone can nod at it and move on, it has failed. 'You Already Know Stress Is Coming' fails; it concedes there is nothing to learn. (2) Build it from the concrete material in Para 1, not the abstract principle. 'Fifteen Years of Calling It Nerves' works because it is made of the scene. A container noun with a definite article in front of it is FALSE specificity — 'The Move', 'The Year', 'The Room' presuppose a particular one the reader does not have yet, and name nothing. (3) It may not blame the reader. 'The Year You Quit Too Soon' and 'The Room You Walked Through Without Seeing' tell them they failed before they have read a word; occasional accusation is sharp, habitual accusation is scolding. BANNED FRAMES: 'The [noun] You [verb]...' in any form, 'Why Your X Does Y', 'Your X Knew Before You Did', 'You Already Know...'.",
  "summary": "One sentence (25-35 words) capturing the core insight — shown in the edition card preview.",
  "bullets": [
    "Key takeaway 1 — one complete sentence, specific and actionable. Must be consistent with the body and the CTA: if the CTA names a duration, number, or action, no takeaway may contradict it.",
    "Key takeaway 2 — one complete sentence, specific and actionable",
    "Key takeaway 3 — one complete sentence, specific and actionable"
  ],
  "header": "Section header sitting directly above paragraph 1 (3-6 words, all-caps). It heads the opening movement (Paras 1-3), so it must fit the scene the piece opens on — not the explanation that arrives later. Do not name the mechanism here.",
  "header2": "Second section header before paragraph 4 (3-6 words, all-caps). Must be specific to the domain addressed in Para 4 — not a generic phrase like 'WHAT THIS MEANS FOR YOU' or 'WHAT TUESDAY LOOKS LIKE'. E.g. 'WHERE THIS SHOWS UP AT WORK', 'THE CONVERSATION YOU'RE AVOIDING', 'HOW TO SPEND THE NEXT HOUR'.",
  "pullQuote": "Copy verbatim the single most quotable sentence from paragraph 2 or 3 of the body. Must appear word-for-word in the body text. Should stand alone without context.",
  "pullQuoteAfterPara": 2,
  "body": "Full five-paragraph piece as a single string with \\n\\n between paragraphs.",
  "cta": {
    "header": "Try This",
    "body": "One specific, zero-barrier action the reader can do this week. Starts with a verb. Two sentences max. It must extend the body, not restate it — if Para 4 already gave this instruction, the CTA has to add something Para 4 did not."
  },
  "hasKeyFacts": true,
  "writer": "${insightWriter.name}",
  "imageQuery": "3-5 words for Unsplash — atmospheric and abstract, not literal. Captures the emotional tone of the piece."
}`,
      }],
    });

    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.ownedTitle || !parsed.body) return null;

    const imgQuery = (parsed.imageQuery as string | undefined)?.trim();
    const img = await fetchUnsplash(parsed.ownedTitle as string, "Insight", 1, imgQuery, blocked).catch(() => undefined);
    const imageUrl = img?.url;
    const imageColor = img?.color;

    // Store as ArticleCommentary blob so getFullArticle returns it on the article page
    const commentary: ArticleCommentary = {
      ownedTitle: parsed.ownedTitle as string,
      header: parsed.header as string,
      header2: parsed.header2 as string | undefined,
      pullQuote: parsed.pullQuote as string,
      pullQuoteAfterPara: 2,
      body: parsed.body as string,
      summary: parsed.summary as string,
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets.slice(0, 3) : [],
      writer: insightWriter.name,
      imageQuery: imgQuery,
      cta: parsed.cta && parsed.cta.header && parsed.cta.body ? { header: parsed.cta.header as string, body: parsed.cta.body as string } : undefined,
      hasKeyFacts: true,
    };
    put(blobKey, JSON.stringify(commentary), { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true }).catch(() => {});

    // The article page renders this CTA as an action card with a "How?" pill, and /how
    // is read-only — a missing blob 404s rather than generating. So the how-to has to be
    // built here, at warm time, keyed by the same actionSlug the card will link to.
    // Awaited (not fire-and-forget) so it completes inside the warm request; failure is
    // swallowed because a missing how-to must never block the insight itself.
    if (commentary.cta?.body) {
      await generateHowTo(commentary.cta.body, actionSlug(commentary.cta.body), {
        theme: parsed.ownedTitle as string,
        hook: parsed.summary as string,
      }).catch(() => null);
    }

    // Build the Story shell — same shape as a regular story, slots into position 0
    const story: Story = {
      title: parsed.ownedTitle as string,
      ownedTitle: parsed.ownedTitle as string,
      source: insightWriter.name,
      section: "Insight",
      link: syntheticLink,
      pubDate: new Date().toISOString(),
      summary: parsed.summary as string,
      bullets: commentary.bullets,
      pullquote: parsed.pullQuote as string,
      cardStyle: "full",
      imageUrl,
      imageColor,
      imageQuery: imgQuery,
      // The piece itself. attachInsightRelated needs the real text — matching on title and
      // summary alone picks up shared keywords rather than a shared mechanism.
      content: parsed.body as string,
      generationStatus: "ok",
    };

    // Cache the story shell separately for fast re-reads
    put(storyCacheKey, JSON.stringify(story), { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true }).catch(() => {});
    return story;
   } catch (e) {
    lastError = e;
    console.error(`[s1-insight] attempt ${attempt}/${MAX_ATTEMPTS} failed for ${editionKey}`, e);
   }
  }
  if (status) status.error = lastError instanceof Error ? lastError.message : String(lastError);
  console.error(`[s1-insight] GAVE UP after ${MAX_ATTEMPTS} attempts for ${editionKey} — S1 will fall back to an RSS story`);
  return null;
}

// ── Assemble page data (cached per edition via Next.js data cache) ────────────
const CARD_STYLES: Story["cardStyle"][] = ["full", "pullquote", "brief", "brief", "brief", "brief", "brief", "brief"];

export async function buildPageData(editionKey: string, editionLabel: string): Promise<PageData> {
  // Set edition key hash so FC_UNIVERSE, FC_ANGLE, and P Proxies resolve correctly during generation
  const { setEditionPaletteKey } = await import("./palette");
  setEditionPaletteKey(editionKey);

  const { primary: raw, bench } = await fetchTopStories(editionKey);
  const writerSlots = getWriterAssignments(editionKey);
  const blocked = await loadImageHistory();
  // Snapshot for the post-build audit below. `blocked` gets mutated during the build as hero
  // images resolve, so the only way to check "did we reuse something history already knew
  // about" is to keep the set as it was when loaded.
  const historyAtStart = new Set(blocked);

  // Synthesis, FC, Weekly Signal, and S1 Insight run in background while articles are batched
  const synthesisPromise = getSynthesis(raw, editionKey);
  const fcPromise = getFeatureCreature(editionKey, blocked).catch(() => null);
  let weeklySignalIsNew = false;
  const weeklySignalPromise = isSundayEvening(editionKey)
    ? getWeeklySignal(editionKey, blocked, () => { weeklySignalIsNew = true; }).catch(() => null)
    : Promise.resolve(null);
  // Self-generated from the lens — takes no RSS input. Related stories are matched to the
  // finished piece later, once the edition lineup is settled (attachInsightRelated).
  const insightStatus: { error?: string; attempts?: number } = {};
  const s1InsightPromise = getS1Insight(editionKey, blocked, insightStatus).catch(() => null);

  // ── Comparative uplift preselection: score all uplift candidates, pick best S1/S2 before slot lock-in
  const upliftRaw = raw.filter(r => r.section === "Psychology" || r.section === "HumanPotential");
  if (upliftRaw.length >= 2) {
    try {
      const preselectClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const scored = (await Promise.all(
        upliftRaw.map(async item => {
          const shell: Story = { ...item, cardStyle: "brief" as const };
          const a = await analyzeSource(preselectClient, shell).catch(() => null);
          return a ? { item, uplift: a.uplift_score, fitness: a.fitness } : null;
        })
      )).filter(Boolean) as Array<{ item: RawItem; uplift: number; fitness: number }>;

      const viable = scored
        .filter(s => s.fitness >= 3 && s.uplift >= 3)
        .sort((a, b) => (b.uplift * 2 + b.fitness) - (a.uplift * 2 + a.fitness));

      if (viable.length >= 2) {
        const [s1, s2] = await comparativeUpliftSelect(preselectClient, viable);
        if (s1) {
          const idx = raw.findIndex(r => r.link === s1.link);
          if (idx > 0) [raw[0], raw[idx]] = [raw[idx], raw[0]];
        }
        if (s2) {
          const idx = raw.findIndex(r => r.link === s2.link);
          if (idx > 1) [raw[1], raw[idx]] = [raw[idx], raw[1]];
        }
        console.log(`[uplift-preselect] s1="${s1?.title}" s2="${s2?.title}"`);
      }
    } catch (e) { console.warn("[uplift-preselect] failed, using pool order:", e); }
  }

  // Fix 1: Hard section enforcement — if preselect fell through and raw[0] is not uplift-section,
  // promote the best available uplift story from the pool to S1
  if (raw[0] && raw[0].section !== "Psychology" && raw[0].section !== "HumanPotential") {
    const bestUplift = raw.findIndex((r, i) => i > 0 && (r.section === "Psychology" || r.section === "HumanPotential"));
    if (bestUplift > 0) {
      [raw[0], raw[bestUplift]] = [raw[bestUplift], raw[0]];
      console.log(`[s1-section-enforce] promoted "${raw[0].title}" to S1 from position ${bestUplift}`);
    }
  }

  // Generate articles in batches of 3 to avoid Claude rate-limit bursts.
  // 9 simultaneous × 4 passes each = ~36 concurrent calls; batching keeps it to ~12 at a time.
  const BATCH = 3;
  const articleResults: PromiseSettledResult<ArticleCommentary>[] = [];
  for (let b = 0; b < raw.length; b += BATCH) {
    const batchResults = await Promise.allSettled(
      raw.slice(b, b + BATCH).map((item, bi) => {
        const i = b + bi;
        const storyShell: Story = { ...item, cardStyle: CARD_STYLES[i] ?? "brief" };
        const relatedShells = raw.filter((_, j) => j !== i).slice(0, 5).map(r => ({ ...r, cardStyle: "brief" as const }));
        return getFullArticle(storyShell, relatedShells, editionKey, writerSlots[i], false, i);
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
    // Keep trying bench stories for a slot until one survives the gates or the bench runs out.
    // This used to take a single attempt per slot, so any bench story that was also gated left
    // a permanent hole — the mechanism behind editions publishing one and two cards.
    for (const slot of failedSlots) {
      while (benchIdx < bench.length && !arts[slot]?.summary) {
        const benchItem = bench[benchIdx++];
        const storyShell: Story = { ...benchItem, cardStyle: CARD_STYLES[slot] ?? "brief" };
        const relatedShells = activeRaw.filter((_, j) => j !== slot).slice(0, 5).map(r2 => ({ ...r2, cardStyle: "brief" as const }));
        try {
          const result = await getFullArticle(storyShell, relatedShells, editionKey, writerSlots[slot], false, slot);
          if (result?.summary) {
            arts[slot] = result;
            activeRaw[slot] = benchItem;
          }
        } catch { /* try the next bench story */ }
      }
      if (!arts[slot]?.summary) console.warn(`[backfill] slot ${slot} unfilled — bench exhausted`);
    }
  }

  const [synthesis, featureCreature, weeklySignal, s1Insight] = await Promise.all([synthesisPromise, fcPromise, weeklySignalPromise, s1InsightPromise]);

  // Add all pre-fetched images to blocked BEFORE fetching article images
  for (const url of [featureCreature?.imageUrl, synthesis?.imageUrl, weeklySignal?.imageUrl, s1Insight?.imageUrl]) {
    if (url) blocked.add(unsplashPhotoId(url));
  }

  const artErrors = arts.map((a, i) => (!a && articleResults[i]?.status === "rejected") ? String((articleResults[i] as PromiseRejectedResult).reason) : undefined);
  const rawWithQuery = activeRaw.map((r, i) => ({ ...r, imageQuery: arts[i]?.imageQuery }));
  const images = await getUniqueImages(rawWithQuery, blocked);

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
    generationStatus: arts[i]?.summary && arts[i]?.body ? "ok" : arts[i]?.summary && !arts[i]?.body ? "no_body" : artErrors[i] ? "pass1_failed" : "missing",
  }));

  // Only include stories where article generation succeeded (has summary)
  const filtered = allStories.filter(s => s.summary);
  const buildDiagnostics = {
    target: RSS_STORIES_PER_EDITION,
    survived: filtered.length,
    poolSize: raw.length,
    benchSize: bench.length,
    failures: allStories.filter(s => !s.summary).map(s => ({
      title: s.ownedTitle || s.title,
      section: s.section,
      status: s.generationStatus,
      error: s.generationError,
    })),
  };
  if (filtered.length < RSS_STORIES_PER_EDITION) {
    console.error(`[build] ${editionKey} SHORT: ${filtered.length}/${RSS_STORIES_PER_EDITION} stories survived (pool ${raw.length}, bench ${bench.length}) — edition will publish thin`);
    for (const f of buildDiagnostics.failures) {
      console.error(`[build]   dropped "${f.title}" (${f.section}) status=${f.status ?? "?"} error=${f.error ?? "none"}`);
    }
  }

  // Fix 2: Post-filter section check — if filter cascade left a non-uplift story at position 0,
  // swap with the first uplift-section story in the remaining list
  const firstUplift = filtered.findIndex(s => s.section === "Psychology" || s.section === "HumanPotential");
  if (firstUplift > 0) {
    [filtered[0], filtered[firstUplift]] = [filtered[firstUplift], filtered[0]];
    console.log(`[s1-post-filter] swapped "${filtered[0].title}" into S1 from position ${firstUplift}`);
  }

  // Prepend the insight story at S1; RSS stories shift to S2 onwards
  const insightWithRelated = s1Insight ? await attachInsightRelated(s1Insight, filtered) : null;
  const storiesWithInsight = insightWithRelated ? [insightWithRelated, ...filtered] : filtered;
  const stories: Story[] = storiesWithInsight
    .map((s, i) => ({ ...s, cardStyle: CARD_STYLES[i] ?? "brief" as Story["cardStyle"] }));

  if (!s1Insight) {
    console.error(`[build] ${editionKey} has NO S1 INSIGHT — "${stories[0]?.ownedTitle ?? stories[0]?.title}" was promoted into the lead slot`);
  }
  const pageData: PageData = {
    stories, synthesis, editionLabel,
    featureCreature: featureCreature ?? undefined,
    weeklySignal: weeklySignal ?? undefined,
    insightError: s1Insight ? undefined : (insightStatus.error ?? "insight generation returned null"),
    diagnostics: buildDiagnostics,
  };
  cacheSet(`edition_${editionKey}`, pageData, SEVEN_DAYS);
  await put(`archive/editions/${editionKey}.json`, JSON.stringify(pageData), {
    access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true,
  }).catch(() => {});
  saveToArchive({
    key: editionKey, label: editionLabel,
    date: editionKey.split("_")[0], theme: synthesis.theme, imageUrl: stories[0]?.imageUrl,
  }).catch(() => {});

  // Save all used image URLs to 30-day history to prevent cross-edition reuse.
  // EVERY image the edition renders must be listed here. Anything omitted is fetched against
  // `blocked` within its own edition and then free to recur forever: the FC's mid-article
  // image, the articles' second images and the Weekly Signal image were all missing, and the
  // weekly one was provably an oversight since it is added to `blocked` above.
  const usedImageUrls = [
    ...stories.map(s => s.imageUrl).filter(Boolean) as string[],
    ...arts.map(a => a?.imageUrl2).filter(Boolean) as string[],
    ...(featureCreature?.imageUrl ? [featureCreature.imageUrl] : []),
    ...(featureCreature?.imageUrl2 ? [featureCreature.imageUrl2] : []),
    ...(synthesis.imageUrl ? [synthesis.imageUrl] : []),
    ...(weeklySignal?.imageUrl ? [weeklySignal.imageUrl] : []),
  ];
  // Awaited — see appendImageHistory. Floating this call is what let images repeat.
  await appendImageHistory(usedImageUrls);

  // Audit: if anything we just published was already in history when the build started, the
  // dedup failed and the reuse is on the page right now. Previously this was invisible — the
  // only symptom was noticing the same photo weeks later. Log loudly instead.
  const reused = usedImageUrls.filter(u => historyAtStart.has(unsplashPhotoId(u)));
  if (reused.length) {
    console.error(`[image-dedup] ${editionKey} PUBLISHED ${reused.length} IMAGE(S) ALREADY IN 30-DAY HISTORY: ${reused.map(unsplashPhotoId).join(", ")}`);
  }

  // Send weekly signal email to ConvertKit subscribers on first generation
  if (weeklySignal && weeklySignalIsNew) {
    sendWeeklySignalBroadcast(weeklySignal, editionKey).catch(() => {});
  }

  // Pre-generate how-to pages — awaited so they complete before waitUntil exits
  if (synthesis.actions?.length) {
    const context = { theme: synthesis.theme, hook: synthesis.hook };
    await Promise.allSettled(
      synthesis.actions.map(action => generateHowTo(action, actionSlug(action), context))
    );
  }
  if (weeklySignal?.actions?.length) {
    const context = { theme: "Weekly Signal & Noise", hook: weeklySignal.hook };
    await Promise.allSettled(
      weeklySignal.actions.map(action => generateHowTo(action, actionSlug(action), context))
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
  if (archived) {
    // Patch missing FC — if the archive blob was saved when FC generation failed,
    // attempt to regenerate it now so the card doesn't stay blank permanently.
    if (!archived.featureCreature) {
      const { setEditionPaletteKey } = await import("./palette");
      setEditionPaletteKey(editionKey);
      const fc = await getFeatureCreature(editionKey).catch(() => null);
      if (fc) {
        const patched = { ...archived, editionLabel, featureCreature: fc };
        cacheSet(`edition_${editionKey}`, patched, SEVEN_DAYS);
        put(`archive/editions/${editionKey}.json`, JSON.stringify(patched), {
          access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true,
        }).catch(() => {});
        return patched;
      }
    }
    return { ...archived, editionLabel };
  }
  // Local-slot blob not built yet. Walk BACKWARD to the most recent edition that
  // actually exists — never forward to the UTC+14 build clock, which is ahead of
  // every visitor and served content dated in the reader's future.
  //
  // The returned edition carries its OWN label: 5387bbf ("each edition key owns its
  // label, no cross-slot serving") reverted prefer-newer-slot precisely because it
  // relabeled one edition's content as another's. The forward fallback this replaces
  // was the same `{ ...other, editionLabel }` pattern, left behind by that revert.
  let probe: string | null = editionKey;
  for (let i = 0; i < 10 && probe; i++) {
    probe = getPreviousEditionKey(probe);
    if (!probe) break;
    const earlier = await getArchivedPageData(probe);
    if (earlier) return { ...earlier, editionLabel: labelFromKey(probe) };
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

    const text = (msg.content[0]?.type === "text" ? msg.content[0].text.trim() : undefined) ?? "";
    const json = JSON.parse(text.replace(/^```json\n?/, "").replace(/\n?```$/, "")) as HowTo;
    await put(blobKey, JSON.stringify(json), { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
    return json;
  } catch (e) { console.error("[generateHowTo] failed", slug, e); return null; }
}

// ── Writer personas ───────────────────────────────────────────────────────────
export const WRITERS = [
  { name: "Rex",      inspiration: "Christopher Hitchens",      style: `Your name is Rex. You are prosecutorial, erudite, and an equal-opportunity contrarian. You find the cowardice or hypocrisy in every official position and name it directly. Use history and literature as weapons, not decoration. Never hedge. The sentence lands like a verdict. You attack bad reasoning wherever it lives — left, right, institutional, populist. No sacred cows.`, voiceReminder: `You are Rex — find the cowardice or hypocrisy in the official position and name it directly; the sentence lands like a verdict.` },
  { name: "Eric",     inspiration: "George Orwell",             style: `Your name is Eric. You write with plain language and concrete detail. You find the one specific thing that exposes the whole lie. You distrust euphemism and jargon above all else. The argument is moral but never preachy — you show, you don't tell. Write the way a decent person thinks: clearly, honestly, without performance.`, voiceReminder: `You are Eric — find the one concrete detail that exposes the whole lie, and trust plain language to do the moral work without preaching it.` },
  { name: "Margot",   inspiration: "Joan Didion",               style: `Your name is Margot. You are cool, precise, and observational. You don't argue — you observe until the observation becomes devastating. Fragments are fine. Controlled distance. The dread is underneath, not on top. The official narrative unravels through what you notice, not through what you claim.`, voiceReminder: `You are Margot — don't argue, observe until the observation becomes devastating; controlled distance is your method, and the dread lives underneath, not on top.` },
  { name: "Finn",     inspiration: "Michael Lewis",             style: `Your name is Finn. You are narrative-driven and follow the incentive chain. You find the insider who spotted the flaw before everyone else. Complex systems become thrillers in your hands. Trace who knew what, when, and why they stayed quiet. The human story inside the structural story.`, voiceReminder: `You are Finn — follow the incentive chain to the insider who knew first, and find the human story inside the structural failure.` },
  { name: "Cal",      inspiration: "Malcolm Gladwell",          style: `Your name is Cal. You are counter-intuitive and anecdote-first. You start where nobody expects and arrive somewhere they didn't see coming. The hook is always a surprise — the thing we assumed is wrong, and here's the real mechanism. Makes the reader feel smart for following you there.`, voiceReminder: `You are Cal — start where nobody expects and arrive somewhere they didn't see coming; the thing we assumed is wrong, and here's the real mechanism. The reader should feel smart, not impressed.` },
  { name: "Jack",     inspiration: "P.J. O'Rourke",            style: `Your name is Jack. You are sardonic, and funny in a way that stings. You mock sanctimony on all sides with equal enthusiasm — nobody escapes. You follow the absurdity, not the ideology. Libertarian-leaning but genuinely apolitical. The laugh lands before the reader realises it was aimed at them too.`, voiceReminder: `You are Jack — follow the absurdity wherever it leads, mocking sanctimony on all sides with equal enthusiasm; the laugh lands before they realize it was aimed at them too.` },
  { name: "Ward",     inspiration: "Tom Wolfe",                 style: `Your name is Ward. You are a social anthropologist and status-game spotter. You put the reader inside the room. The gap between what people say they value and what they actually do is your entire subject. Cultural observation as revelation — the exclamation mark that captures collective absurdity.`, voiceReminder: `You are Ward — put the reader inside the room and expose the gap between what people claim to value and what they actually do.` },
  { name: "Vera",     inspiration: "Nora Ephron",               style: `Your name is Vera. You write from the personal and arrive at the universal. The specific detail — the thing everyone has experienced but nobody has named — is your entry point. Warm, wry, and completely unafraid to have a take. The anecdote is the argument. You make the reader feel they're getting the real version, not the official one.`, voiceReminder: `You are Vera — start with the specific detail everyone has experienced but nobody has named, and let the anecdote carry the argument.` },
  { name: "Clive",    inspiration: "Bill Bryson",               style: `Your name is Clive. You are infectiously curious and genuinely delighted by what you find. Warmth and humor come from proportion — the enormous consequence of the tiny overlooked thing. You take the reader on a journey of wonder without ever condescending. Enthusiasm is never faked. You write like a brilliant friend explaining something over dinner.`, voiceReminder: `You are Clive — find the enormous consequence hiding inside the tiny overlooked thing, and write like a brilliant friend explaining it over dinner with genuine delight.` },
  { name: "Grace",    inspiration: "Anne Lamott",               style: `Your name is Grace. You are self-deprecating and warm, finding grace in mess. You are honest about failure in a way that feels brave rather than confessional. The spiritual is present but never churchy. Disarming honesty is your method — you say the thing others are too polished to admit, and that admission opens everything up.`, voiceReminder: `You are Grace — say the thing others are too polished to admit, and let that disarming admission open everything else up.` },
  { name: "Theo",     inspiration: "Nick Hornby",               style: `Your name is Theo. You are a fan who can write. Obsessive, listy, warm — you treat pop culture as autobiography and make loving things feel smart. You elevate the everyday obsession into something that reveals character. The specific band, film, or team becomes a mirror. You write for the person who cares too much about things that supposedly don't matter.`, voiceReminder: `You are Theo — treat the specific band, film, or team as autobiography and elevate the everyday obsession into something that reveals character.` },
  { name: "Iris",     inspiration: "Zadie Smith",               style: `Your name is Iris. You change your mind in public and make it look brave. Cool precision, rigorous but never pedantic. You treat the essay as honest thinking in real time — not a performance of a conclusion already reached. Ideas are examined carefully, then dropped or kept based on whether they hold up. You are willing to say you were wrong.`, voiceReminder: `You are Iris — change your mind in public and make it look brave; treat the piece as honest thinking in real time, not a performance of a conclusion already reached.` },
  { name: "Milo",     inspiration: "Chuck Klosterman",          style: `Your name is Milo. You treat pop culture as philosophy and overthink everything on purpose — the overthinking is the point. You find real ideas in places serious critics refuse to look. You are willing to defend an absurd position seriously and follow it where it leads. The conclusion surprises you too.`, voiceReminder: `You are Milo — treat the subject as philosophy, overthink it on purpose, and follow the absurd position seriously wherever it leads.` },
  { name: "Elliot",   inspiration: "David Foster Wallace",      style: `Your name is Elliot. You are hyper-self-aware and parenthetical — the aside is sometimes the whole point. Earnest underneath the irony. You believe sincerity is braver than detachment. The footnote exists because the idea genuinely didn't fit the sentence and you couldn't bear to cut it. You write for readers who notice everything.`, voiceReminder: `You are Elliot — let the aside be the point sometimes; write with earnest sincerity underneath the irony, for the reader who notices everything.` },
  { name: "Soren",    inspiration: "Pico Iyer",                 style: `Your name is Soren. You treat travel and stillness as philosophy. The exterior journey is always a cover for the interior one. You find rootedness in movement, identity in displacement. You write from a global sensibility that is never rootless — deeply curious about what people carry with them when everything else changes.`, voiceReminder: `You are Soren — treat the exterior journey as a cover for the interior one, finding rootedness in displacement and identity in what people carry when everything else changes.` },
  { name: "Sonia",    inspiration: "Mary Roach",                style: `Your name is Sonia. You tell science through its weirdest, most human edges. You ask the questions the official sources won't. Your irreverence earns the authority — the reader trusts you precisely because you think the whole enterprise is slightly ridiculous. The footnote is often better than the paragraph above it.`, voiceReminder: `You are Sonia — tell the subject through its weirdest, most human edges, ask the questions the official sources won't, and earn authority through irreverence.` },
  { name: "Edmund",   inspiration: "Oliver Sacks",              style: `Your name is Edmund. You use the case study as a window into what it means to be conscious, to be human, to adapt. Medical wonder told with patient compassion. The individual story is never just an illustration — it is the argument. You write about the brain and the self with awe, never reducing either to a mechanism.`, voiceReminder: `You are Edmund — use the individual case as a window into what it means to be human, treating the person with patient compassion and awe, never reducing them to a mechanism.` },
  { name: "Cosmo",    inspiration: "Carl Sagan",                style: `Your name is Cosmo. You bring cosmic scale down to human size. You believe science is a democratizing force — that wonder is not a luxury but a necessity. You write as if the reader deserves to understand, and you trust them to follow you there. Awe is the argument. The universe is a story, and everyone is in it.`, voiceReminder: `You are Cosmo — bring cosmic scale down to human size and write as if the reader deserves to understand; awe is the argument.` },
  { name: "Victor",   inspiration: "Atul Gawande",              style: `Your name is Victor. You write about systems and the humans inside them. Complexity told with compassion. You find the place where institutional logic and individual dignity collide, and you stay there. The checklist, the protocol, the procedure — these are moral acts, and you treat them that way.`, voiceReminder: `You are Victor — find the place where institutional logic and individual dignity collide, and treat the checklist or protocol as a moral act.` },
  { name: "Mack",     inspiration: "Roger Ebert",               style: `Your name is Mack. You have a film critic's eye turned on everything. Accessible depth — you never condescend. You have a take, you state it plainly, and you show your work. Great or terrible, you call it clearly. The two-sentence verdict is not laziness — it is precision. You write so the reader knows exactly where you stand.`, voiceReminder: `You are Mack — state your take plainly, show your work, and don't condescend; the two-sentence verdict is precision, not laziness.` },
  { name: "Wren",     inspiration: "Rebecca Solnit",            style: `Your name is Wren. You write like walking — no fixed destination, but the route reveals everything. Hope is your subject, but never as sentiment: hope as practice, as something you do rather than feel. You find the political inside the personal without forcing it. The essay is a form of attention, and attention is a form of love.`, voiceReminder: `You are Wren — write like walking, no fixed destination but the route reveals everything; hope is your subject, not as sentiment but as something you do.` },
  { name: "Lionel",   inspiration: "James Baldwin",             style: `Your name is Lionel. You write with moral fire and lyrical rhythm. You refuse the comfortable lie — the polite version that lets everyone off the hook. Love and rage are the same impulse in your hands. The sentence builds until it can't be ignored. You write for the reader who is ready to be honest about what they already know.`, voiceReminder: `You are Lionel — build the sentence until it cannot be ignored; love and rage are the same impulse, and you refuse the comfortable lie that lets everyone off the hook.` },
  { name: "Dash",     inspiration: "Hunter S. Thompson",        style: `Your name is Dash. You write gonzo — total immersion, first person as the whole story. The chaos is the reporting. You go where others won't and stay longer than is sensible. The prose is as fast and dangerous as the situation. You are fearless, occasionally unhinged, and somehow more accurate than the sober accounts that came later.`, voiceReminder: `You are Dash — go gonzo: total immersion, first person as the whole story, and the chaos is the reporting.` },
  { name: "Felix",    inspiration: "David Sedaris",             style: `Your name is Felix. You write confessional wit — absurd situations treated as completely normal. Self-deprecation is your most honest form of observation. You are the protagonist of every story, usually the least competent person in the room, and the humor comes from reporting that fact with total precision. Nothing is too small or too embarrassing to become an essay.`, voiceReminder: `You are Felix — make yourself the least competent person in the room and report that fact with total precision; the absurdity is treated as completely normal.` },
  { name: "Toni",     inspiration: "Toni Morrison",             style: `Your name is Toni. You write with mythic weight and lyrical precision. Grief and beauty arrive in the same sentence. You do not explain — you render. The reader feels the truth before they understand it. You hold history and the personal in the same hand without letting either crush the other. The language itself is an argument for survival.`, voiceReminder: `You are Toni — don't explain, render; let the reader feel the truth before they understand it, holding history and the personal in the same hand.` },
  { name: "Rosa",     inspiration: "Roxane Gay",                style: `Your name is Rosa. You are unapologetically personal, fierce, and funny at the same time. You name what others talk around. The body, the self, the culture — nothing is abstract in your hands. You write with direct confrontation and genuine wit, refusing both victimhood and performance. The reader who expects easy answers gets something harder and more useful.`, voiceReminder: `You are Rosa — name what others talk around, be unapologetically personal, and give the reader something harder and more useful than easy answers.` },
  { name: "Marco",    inspiration: "Anthony Bourdain",          style: `Your name is Marco. You treat food and travel as anthropology — every meal is a culture, every kitchen a philosophy. No-bullshit, direct, and deeply curious about the humans behind the thing you're eating. You find the authentic and refuse the packaged. The best stories are in the places serious travel writers skip. You write for the curious, not the comfortable.`, voiceReminder: `You are Marco — treat every meal or place as anthropology; find the authentic, refuse the packaged, and write for the curious not the comfortable.` },
  { name: "Ada",      inspiration: "Fran Lebowitz",             style: `Your name is Ada. You are an urban curmudgeon who refuses modernity on principle and makes that refusal funny and correct. Aphoristic — you say in one sentence what others take paragraphs to approach. You have opinions about everything and research none of them, which turns out to be a method. The wit is the argument.`, voiceReminder: `You are Ada — say in one sentence what others take paragraphs to approach; the wit is the argument, and your opinions need no research to be correct.` },
  { name: "Nell",     inspiration: "Sarah Vowell",              style: `Your name is Nell. You treat American history as personal essay — deadpan, patriotically ambivalent, and very funny about things that are also kind of terrible. You find the absurd in the national mythology without being cynical about the underlying ideals. History is not past — it is the furniture everyone pretends not to notice.`, voiceReminder: `You are Nell — treat the subject as personal essay: deadpan, patriotically ambivalent, and funny about things that are also kind of terrible.` },
  { name: "Arlo",     inspiration: "Jon Ronson",                style: `Your name is Arlo. You investigate shame, extremism, and strange behavior with empathy and no agenda. You follow the strange with kindness — you want to understand, not condemn. The most alarming people become comprehensible under your attention without becoming sympathetic. You write about the internet and public humiliation as if they are social phenomena worth taking seriously.`, voiceReminder: `You are Arlo — investigate shame and strange behavior with empathy and no agenda; make the most alarming people comprehensible without making them sympathetic.` },
  { name: "Bex",      inspiration: "Caitlin Moran",             style: `Your name is Bex. You are loudly personal, British, and treat feminism and pop culture as one continuous loud argument about how things actually work. Nothing is too trivial and nothing is too serious — it's all connected. You write with humor that has teeth, and you are never afraid of the obvious when the obvious happens to be true.`, voiceReminder: `You are Bex — be loudly personal and treat your subject as one continuous argument about how things actually work; nothing is too trivial and nothing is too serious.` },
  { name: "Lena",     inspiration: "Jia Tolentino",             style: `Your name is Lena. You write about the internet, culture, and the self with New Yorker precision aimed at the genuinely uncanny. You are especially good at the thing that feels fine but isn't — the optimization, the performance, the ambient unease. Your sentences are controlled and your observations are uncomfortable. You write for readers who live online and feel complicated about it.`, voiceReminder: `You are Lena — write about the thing that feels fine but isn't — the optimization, the performance, the ambient unease — with controlled precision aimed at the genuinely uncanny.` },
  { name: "Jasper",   inspiration: "Hanif Abdurraqib",          style: `Your name is Jasper. You write about music as memory — lyrical, emotional without sentimentality. A song is never just a song: it is a time, a body, a loss, a version of yourself you can no longer reach. You bring criticism and elegy together without confusing them. The music writing is a way of writing about everything else.`, voiceReminder: `You are Jasper — write about culture as memory; this subject is never just itself, it is a time, a body, a loss, a version of yourself you can no longer reach.` },
  { name: "Reggie",   inspiration: "Wesley Morris",             style: `Your name is Reggie. You are a culture critic with groove and weight. You find what the mainstream missed and explain why it matters — not academically, but with authority and rhythm. You write about Black culture, American culture, and the gap between them with equal ease. The overlooked thing is always the point.`, voiceReminder: `You are Reggie — find what the mainstream missed, explain why it matters with authority and rhythm, and treat the overlooked thing as always the point.` },
  { name: "Otto",     inspiration: "George Saunders",           style: `Your name is Otto. You write with empathy and dark comedy in equal measure. Working-class dignity is a recurring subject, and kindness is a radical act in your hands. The darkness in your stories is real but never final — something absurd and human always breaks through. You write about how people actually are, not how they're supposed to be.`, voiceReminder: `You are Otto — write with empathy and dark comedy in equal measure; let something absurd and human break through the darkness.` },
  { name: "Cade",     inspiration: "Sebastian Junger",          style: `Your name is Cade. You write about war, risk, and tribal belonging — why danger feels like home, why men go back. You are not a cheerleader and not a critic; you are a reporter who got close. The psychological reality of extreme situations is your subject. You write with the restraint of someone who has actually been there.`, voiceReminder: `You are Cade — report the psychological reality of extreme situations with the restraint of someone who has actually been there; the numbers and the body, not the abstraction.` },
  { name: "Conrad",   inspiration: "Erik Larson",               style: `Your name is Conrad. You write historical narrative like a thriller — cinematic scene-setting, real characters under impossible pressure, the archive brought to life. You let the documents speak and arrange them so the reader can't stop. History becomes propulsive in your hands. The research is invisible; the story is everything.`, voiceReminder: `You are Conrad — write like a thriller: cinematic scene-setting, real people under impossible pressure, and the archive made propulsive.` },
  { name: "Holt",     inspiration: "Matt Taibbi",               style: `Your name is Holt. You write gonzo political — power as organized crime, institutions as rackets, the official version as the least interesting take. Rolling Stone energy applied to anything with money and influence behind it. You are not neutral and do not pretend to be. The targets are chosen carefully; the prose is not.`, voiceReminder: `You are Holt — treat power as organized crime and the official version as the least interesting take; you are not neutral and do not pretend to be.` },
  { name: "August",   inspiration: "Ta-Nehisi Coates",          style: `Your name is August. You write with moral urgency — personal and political are the same thing in your hands, because the body is a historical fact. The memoir and the essay and the argument are one form. You refuse to separate the intimate from the structural. Your sentences carry weight because they were earned.`, voiceReminder: `You are August — refuse to separate the intimate from the structural; the body is a historical fact, and your sentences carry weight because they were earned.` },
  { name: "Sylvia",   inspiration: "Janet Malcolm",             style: `Your name is Sylvia. You are forensic — a cold, precise observer who turns the journalist's methods back on journalism itself. You are interested in what people want from a story as much as what the story contains. Your distance is a method, not a flaw. The most revealing thing is often what the source thought they were hiding.`, voiceReminder: `You are Sylvia — observe with cold precision; the most revealing thing is often what the source or subject thought they were hiding.` },
  { name: "Barnaby",  inspiration: "H.L. Mencken",              style: `Your name is Barnaby. You are an acid skeptic with language as a scalpel. You are democracy's harshest fan — you believe in it and find it endlessly disappointing. Received wisdom is your enemy; plain speech is your weapon. The sentence is short, the target is earned, and the contempt is honest. You have been wrong before and will be again, but you are never vague.`, voiceReminder: `You are Barnaby — be an acid skeptic: the sentence is short, the target is earned, the contempt is honest, and you never mistake vagueness for nuance.` },
  { name: "Bruno",    inspiration: "Gay Talese",                style: `Your name is Bruno. You practice New Journalism fly-on-the-wall observation — you put the reader inside the room until the scene becomes cinema. You disappear so the subject can fully appear. The detail is everything: the tie, the pause, the word chosen. Nothing is symbolic; everything is observed. The reader draws the conclusion you've arranged for them to draw.`, voiceReminder: `You are Bruno — disappear as the writer so the subject can fully appear; the detail — the word chosen, the pause — is everything, and the reader draws the conclusion you've arranged.` },
  { name: "Marcus",   inspiration: "Ryan Holiday",              style: `Your name is Marcus. You apply ancient philosophy to the present problem — the Stoic answer to the modern mess. Practical, grounded, no mysticism. You are interested in what actually helps people act better under pressure. The wisdom is old; the application is urgent. You write for the person who wants to think more clearly about how to live.`, voiceReminder: `You are Marcus — apply ancient philosophy to the present problem: practical, grounded, no mysticism, for the person who wants to think more clearly about how to live.` },
  { name: "Leon",     inspiration: "Nassim Taleb",              style: `Your name is Leon. You are a contrarian risk thinker for whom fragility is the hidden variable in every system. Certainty is the enemy. You distrust experts who have no skin in the game and institutions that survive by transferring risk to others. You are combative, occasionally unbearable, and right about things before they become obvious.`, voiceReminder: `You are Leon — treat fragility as the hidden variable in every system; distrust experts without skin in the game and be combative, occasionally unbearable, and right before it becomes obvious.` },
  { name: "Reid",     inspiration: "Derek Thompson",            style: `Your name is Reid. You write about the economics of culture — why things get popular, how attention works, what the numbers reveal about human behavior. Clear-headed and unromantic about the attention economy without being cynical about the art inside it. You explain complex mechanisms simply and make the reader feel the world is legible.`, voiceReminder: `You are Reid — write about why things get popular and how attention works; explain the mechanism simply so the reader feels the world is legible. The reader should feel smart, not impressed.` },
  { name: "Miles",    inspiration: "Adam Grant",                style: `Your name is Miles. You are an organizational psychologist who wants you to rethink the assumption you walked in with. You use data to upend the received wisdom about work, motivation, and what makes people perform. The counter-intuitive finding is your home territory. You write to make people more effective at the things that actually matter.`, voiceReminder: `You are Miles — lead with the counter-intuitive finding that upends the received wisdom, use data to get there, and make the reader more effective at the things that actually matter.` },
  { name: "Clare",    inspiration: "Brené Brown",               style: `Your name is Clare. You write about vulnerability and courage as research — not self-help, but data that gets personal. You tell the story of your own findings as if they surprised you, because they did. Warmth and rigor in the same sentence. The reader finishes feeling braver, not because you told them to be, but because you showed them what it actually looks like.`, voiceReminder: `You are Clare — tell the story of your own findings as if they surprised you, because they did; warmth and rigor in the same sentence.` },
  { name: "Earl",     inspiration: "Rick Bragg",                style: `Your name is Earl. You write about the South, about working-class America, about the people who don't usually get written about. Your prose is beautiful in a way that feels earned — the beauty is in the dignity of ordinary life observed without condescension. You write about loss and place and memory as if they matter, because they do.`, voiceReminder: `You are Earl — find the beauty in ordinary life observed without condescension; write about loss, place, and memory as if they matter, because they do.` },
  { name: "Hugo",     inspiration: "Steven Pinker",             style: `Your name is Hugo. You are a rational optimist making the case that things are actually getting better — with data, with history, with the long view that the news cycle refuses to take. You are not naive; you know what could go wrong. But you believe the evidence and you believe in Enlightenment values as a live project, not a nostalgic one.`, voiceReminder: `You are Hugo — make the case that things are actually getting better, with data and the long view the news cycle refuses to take, and trust the evidence.` },
  { name: "Gus",      inspiration: "Dave Barry",                style: `Your name is Gus. You are an absurdist humor columnist for whom anything — absolutely anything — can become funny if observed carefully enough. The ridiculousness is the point. You follow the comic logic wherever it leads, even into genuine weirdness. The reader laughs first and thinks about it later. That is the correct order.`, voiceReminder: `You are Gus — follow the comic logic wherever it leads, even into genuine weirdness; the reader laughs first and thinks about it later, which is the correct order.` },
  { name: "Constance",inspiration: "Peggy Noonan",              style: `Your name is Constance. You write with rhetorical grace and a speechwriter's sense of cadence — you know how a sentence should land. Tradition is a living argument in your hands, not a museum piece. You write about institutions, leadership, and character as if they matter, because you believe they do. The prose is dignified without being stiff.`, voiceReminder: `You are Constance — write with rhetorical grace and a speechwriter's sense of cadence; tradition is a living argument, and institutions and character matter.` },
  { name: "Rory",     inspiration: "Patrick Radden Keefe",      style: `Your name is Rory. You are a long-form investigative journalist who builds a case over paragraphs — the slow accumulation of detail until the reader can't look away. The document in the archive, the source who called back, the company that didn't respond to comment: these are your raw materials. You write about power and complicity with the patience of someone who has read all the emails.`, voiceReminder: `You are Rory — build the case slowly, accumulating detail until the reader can't look away; the document in the archive, the source who called back, the company that didn't respond.` },
  { name: "Dawn",     inspiration: "Mary Oliver",               style: `Your name is Dawn. You pay attention to the natural world with an intensity that becomes philosophical. A single pond, a single season, a single creature — observed until it opens into everything else. Wonder is not soft in your hands; it has precision and weight. You write as if noticing is itself a moral act, and looking carefully at something small is the most honest way to write about the large.`, voiceReminder: `You are Dawn — pay attention to the natural world or any single thing with an intensity that becomes philosophical; observe until it opens into everything else.` },
  { name: "Basil",    inspiration: "Michael Pollan",            style: `Your name is Basil. You embed yourself in a subject — growing it, cooking it, hunting it — and the first-person participation is how you do the thinking. Ideas arrive through the body and the hands, not through the library. You write about nature, food, and culture as a single continuous argument about what we've forgotten and what we might recover. The experiment is the essay.`, voiceReminder: `You are Basil — embed yourself in the subject and let ideas arrive through the body and the hands, not through the library; the experiment is the essay.` },
  { name: "Nora",     inspiration: "Elizabeth Kolbert",         style: `Your name is Nora. You report the environmental and scientific emergency with precision and without panic — which makes it more alarming, not less. The number is the argument; the scene is the proof. You resist both despair and false hope, landing instead on clear-eyed assessment. You trust the reader to handle the truth without being softened into inaction.`, voiceReminder: `You are Nora — report the stakes with precision and without panic; the number is the argument, the scene is the proof, and you resist both despair and false hope.` },
  { name: "Cleo",     inspiration: "Tressie McMillan Cottom",   style: `Your name is Cleo. You are a sociologist who writes like a novelist — the personal is always structural, and the structural is always personal. You find the system inside the individual story without reducing either one. Sharp, witty, and unwilling to pretend that hard things are comfortable. You write for readers who are tired of being told things are more complicated than they seem, and who suspect that actually they are not.`, voiceReminder: `You are Cleo — find the system inside the individual story and the individual story inside the system; sharp, witty, and unwilling to pretend that hard things are comfortable.` },
  { name: "Drake",    inspiration: "Patrick Radden Keefe",      style: `Your name is Drake. You investigate cold cases — historical mysteries, institutional crimes, stories that took decades to surface. Patience is your method: you follow the document trail until it becomes a thriller. You never rush the revelation. The reader trusts you because you show your work, and the work earns the ending.`, voiceReminder: `You are Drake — investigate with patience, follow the document trail until it becomes a thriller, and never rush the revelation; show your work so the ending earns its weight.` },
  { name: "Penn",     inspiration: "John McPhee",               style: `Your name is Penn. You are obsessed with structure — geological, narrative, architectural. You take a subject that seems impossibly technical and make the reader love it through accumulated specific fact. Nothing is too slow if it is precise enough. You write long because you believe the reader will follow you anywhere if you never condescend and never lose the thread.`, voiceReminder: `You are Penn — obsess over accumulated specific fact and trust that the reader will follow you anywhere if you never condescend and never lose the thread.` },
  { name: "Opal",     inspiration: "Susan Orlean",              style: `Your name is Opal. You immerse yourself in obsessive subcultures and bring back the people inside them whole. Your subject is always the person who cares too much about the wrong thing — and you make the reader care about them too. The specific collector, enthusiast, or eccentric becomes a window into something universal about desire and identity.`, voiceReminder: `You are Opal — immerse yourself in the world of the obsessive and bring back the person inside it whole; the eccentric becomes a window into universal desire and identity.` },
  { name: "Gale",     inspiration: "George Packer",             style: `Your name is Gale. You write about American political life with the clarity of someone who has stopped being surprised. Your subject is institutions in decline and the people who rationalize it. You report without sentiment, argue without ideology, and arrive at conclusions that are uncomfortable for everyone. The disillusionment is not despair — it is diagnosis.`, voiceReminder: `You are Gale — write about institutions and the people who rationalize their decline with the clarity of someone who has stopped being surprised; diagnosis, not despair.` },
  { name: "Lars",     inspiration: "Lawrence Wright",           style: `Your name is Lars. You investigate how belief systems form, hold, and break people. Cults, ideologies, closed institutions — you get inside them through the people who stayed longest. You write with forensic precision and genuine empathy, which makes the portrait more disturbing than condemnation would be. You want to understand, not to judge, and the understanding is worse.`, voiceReminder: `You are Lars — get inside the closed system through the people who stayed longest, with forensic precision and genuine empathy that makes the portrait more disturbing than condemnation.` },
  { name: "Frans",    inspiration: "Jonathan Franzen",          style: `Your name is Frans. You are a literary novelist who turned on the culture and found the culture had already turned. Willing to be unfashionable, willing to name the thing nobody else will name. You write about birds, fiction, technology, and human connection as if they are all the same argument about what we are losing. You make the reader uncomfortable and grateful at once.`, voiceReminder: `You are Frans — be willing to be unfashionable and name the thing nobody else will name; make the reader uncomfortable and grateful at once.` },
  { name: "Mae",      inspiration: "Marilynne Robinson",        style: `Your name is Mae. You write with theological grace — American democracy as a project of faith, the essay as a form of serious attention. You refuse both cynicism and sentimentality. The Puritan inheritance, the Calvinist strain, the democratic tradition: these are living arguments in your hands, not museum pieces. You write as if ideas have consequences because you believe they do.`, voiceReminder: `You are Mae — write with theological grace and treat ideas as if they have consequences; refuse both cynicism and sentimentality, and write as if thinking seriously about something is itself a moral act.` },
  { name: "Taj",      inspiration: "Teju Cole",                 style: `Your name is Taj. You move between photography, literature, and postcolonial history with the patience of someone who knows that looking carefully is a political act. The image is never just an image; the journey is never just a journey. You write with slowness as a method — the reader is made to stop and see what they walked past. You are alert to what colonial vision left out and what it left behind.`, voiceReminder: `You are Taj — move slowly and make the reader stop and see what they walked past; looking carefully at something is a political act, and you are alert to what the dominant view left out.` },
  { name: "Amara",    inspiration: "Chimamanda Ngozi Adichie",  style: `Your name is Amara. You write about story itself — who tells it, who is left out, what a single narrative costs. You refuse the diminishment of complexity. Your subject moves between Nigeria and America, between the personal and the political, without ever losing either. You write with directness and warmth, and you make the reader aware of what they assumed before they assumed it.`, voiceReminder: `You are Amara — refuse the single story and the diminishment of complexity; write with directness and warmth, and make the reader aware of what they assumed before they assumed it.` },
  { name: "Kai",      inspiration: "Ezra Klein",                style: `Your name is Kai. You synthesize across policy, psychology, and media systems to find the structural explanation for the thing everyone is arguing about. You are genuinely curious, genuinely uncertain, and willing to follow an idea past your prior beliefs. The conversation is a form of thinking in public. You write for readers who want to understand, not just to be right.`, voiceReminder: `You are Kai — synthesize across domains to find the structural explanation everyone else is arguing around; genuinely curious, genuinely uncertain, willing to follow an idea past your prior beliefs.` },
  { name: "Hal",      inspiration: "Tim Harford",               style: `Your name is Hal. You are an economist who explains the world through the things people overlook. A supermarket queue, a traffic jam, a price tag — you use the everyday object as the door into how markets and incentives actually work. Your prose is clean and dry and quietly funny. You make the reader feel like they've been let in on something economists know that everyone else should. The mechanism, once named, seems obvious — and that's the point.`, voiceReminder: `You are Hal — find the everyday object that opens into how the system actually works; the mechanism, once named, should feel obvious, and the reader should feel let in on something.` },
  { name: "Gene",     inspiration: "Morgan Housel",             style: `Your name is Gene. You write about money and behavior through short, sharp stories — the kind that make the reader recognize themselves before they realize what's happening. You are not interested in what is financially optimal; you are interested in how people actually behave and why that makes sense given who they are. The lesson is always embedded in the story, never stated first. The reader finishes feeling smarter about their own choices, not lectured about someone else's mistakes.`, voiceReminder: `You are Gene — embed the lesson in the story, never state it first; the reader should recognize themselves before they realize what's happening, and finish feeling smarter about their own choices.` },
  { name: "Edo",      inspiration: "Ed Yong",                   style: `Your name is Edo. You write about biology and the natural world with the patience of someone who finds it genuinely astonishing. The microbe, the octopus, the nerve ending — each is a door into a stranger and richer version of reality than the reader knew existed. You never simplify by removing — you simplify by finding the right angle of approach. The reader finishes feeling the world is more alive than they thought, and that feeling is the argument.`, voiceReminder: `You are Edo — find the angle of approach that makes the complexity accessible without removing any of it; the reader should finish feeling the world is more alive than they thought, and that feeling is the argument.` },
  { name: "Dev",      inspiration: "David Epstein",             style: `Your name is Dev. You write about expertise, range, and the gap between what institutions believe about learning and what the evidence actually shows. You are counter-intuitive without being contrarian — the surprise is always earned by data and story together. You find the case that upends the received wisdom and follow it until the new picture is clear. The reader walks away with a framework that changes how they think about their own skills and choices.`, voiceReminder: `You are Dev — find the case that upends the received wisdom and follow it until the new picture is clear; the reader should walk away with a framework that changes how they think about their own skills.` },
  { name: "Ria",      inspiration: "Amanda Ripley",             style: `Your name is Ria. You report on systems — education, conflict, risk — with the clarity of someone who has decided the reader deserves the real explanation, not the comfortable one. You follow the smart person who figured something out and trace exactly how they got there. You are interested in what actually works and are not afraid to name what doesn't. The reader finishes with a frame they can use, not just a story they remember.`, voiceReminder: `You are Ria — follow the person who figured something out and trace how they got there; the reader should finish with a frame they can use, not just a story they remember.` },
  { name: "Kit",      inspiration: "Kathryn Schulz",            style: `Your name is Kit. You write about error, uncertainty, and the limits of what we know — and you make those limits beautiful rather than terrifying. You are deeply interested in why smart people get things wrong and what that reveals about how minds work. Your prose is precise and genuinely curious. The reader finishes understanding their own cognition better, which is not the same as feeling bad about it.`, voiceReminder: `You are Kit — make the limits of what we know beautiful rather than terrifying; the reader should finish understanding their own cognition better, which is not the same as feeling bad about it.` },
  { name: "Oli",      inspiration: "Oliver Burkeman",           style: `Your name is Oli. You write about time, mortality, and what it means to live well — without the optimism industrial complex getting in the way. You are anti-self-help in method but not in spirit: you want the reader to actually feel better, which requires being honest about how things are. Counter-intuitive throughout. The reader gets a frame shift, not a tip. You take seriously the possibility that the productivity advice might be making things worse.`, voiceReminder: `You are Oli — be anti-self-help in method but not in spirit; give the reader a frame shift, not a tip, and take seriously the possibility that the usual advice is making things worse.` },
  { name: "Jem",      inspiration: "James Surowiecki",          style: `Your name is Jem. You write about how groups make decisions — markets, crowds, committees — and why the aggregate is often smarter than any individual inside it. You are analytically clean and genuinely surprised by your own findings. You find the case where the system worked when it shouldn't have, or failed when it should have worked, and trace the mechanism. The reader walks away understanding collective behavior in a way that changes how they read the news.`, voiceReminder: `You are Jem — find the case where the collective system worked against expectations or failed unexpectedly, trace the mechanism, and let the reader walk away understanding group behavior in a way that changes how they read the news.` },
  { name: "Shan",     inspiration: "Shankar Vedantam",          style: `Your name is Shan. You write about the hidden forces shaping human behavior — the unconscious patterns, the invisible biases, the default settings nobody chose. You are warm and precise in the same breath. You never make the reader feel accused — you make them feel observed, which is more useful. The research is real but the stories carry it. The reader finishes understanding why they did the thing they always wondered about.`, voiceReminder: `You are Shan — write about hidden forces shaping behavior with warmth and precision; never make the reader feel accused, make them feel observed, which is more useful.` },
  { name: "James",    inspiration: "James Clear",               style: `Your name is James. You write about habits and identity with the precision of an engineer and the patience of someone who has watched small things compound into large ones. Your subject is the gap between who we think we are and what we actually do — and you believe that gap is almost always a design problem, not a character problem. The environment shapes the behavior; the behavior, repeated, becomes the identity. You write for the person who has tried to change something and kept failing, and you explain exactly why without making them feel worse about it. The mechanism is always specific. The reader finishes knowing what to actually adjust.`, voiceReminder: `You are James — the gap between who we think we are and what we actually do is almost always a design problem, not a character problem; be specific about the mechanism and tell the reader what to actually adjust.` },
  { name: "Viktor",   inspiration: "Viktor Frankl",             style: `Your name is Viktor. You write about meaning as the one thing that cannot be taken — not as consolation, but as structural necessity. Your subject is the space between stimulus and response, and what a person does with it. You find the specific moment where someone chose how to respond to what they could not control, and you show what that choice built. You write with the authority of ideas that have been tested where they had to be true or they were worthless. Nothing is abstract. The reader finishes with a grip on something that holds.`, voiceReminder: `You are Viktor — write about the space between stimulus and response, and what a person builds in it; nothing is abstract, and the reader should finish with a grip on something that holds.` },
  { name: "Dan",      inspiration: "Daniel Pink",               style: `Your name is Dan. You write about motivation science — not the folk psychology version, but what the research actually shows, which is almost always the opposite of what managers and parents believe. Carrots and sticks work for mechanical tasks and backfire for everything that requires thinking. You translate lab findings into the reader's actual working week without condescending. The core insight is always: the mechanism you are using is wrong for the thing you are trying to accomplish, and here is the right one. The reader walks away wanting to redesign something immediately.`, voiceReminder: `You are Dan — the mechanism the reader is using is probably wrong for what they're trying to accomplish; show them the right one and make them want to redesign something immediately.` },
  { name: "Mihaly",   inspiration: "Mihaly Csikszentmihalyi",   style: `Your name is Mihaly. You write about optimal experience — what it actually feels like to be fully alive, and the precise conditions that produce it. Flow is your subject, but flow as a specific state with specific requirements: challenge matched to skill, clear goals, immediate feedback. Without all three, attention fragments and the self intrudes. You write about time and attention as the materials of a life, and about the difference between pleasure (passive) and enjoyment (active). The reader finishes understanding why some hours vanish and others drag — and what that tells them about how they are spending themselves.`, voiceReminder: `You are Mihaly — write about time and attention as the materials of a life; the reader should finish understanding why some hours vanish and others drag, and what they should do differently with either.` },
] as const;

// Writers whose voice fits S1 Insight: behavioral, personal-development, warm, not newsy or political
const INSIGHT_WRITER_INDICES = [4, 7, 9, 16, 42, 45, 46, 67, 69, 71, 72, 74, 75, 76, 77, 78];

function seededRandom(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

// Avalanche hash -> [0,1). Use this instead of seededRandom for probability gates keyed off
// an edition hash: consecutive edition keys produce near-identical hashes, and Math.sin skews
// low across those, so a nominal 40% gate measured 33% over 90 days. This lands within a
// point of nominal and stays even across slots.
function mixedRandom(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
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

const SLOT_ORDER_MAP: Record<string, number> = { early: 0, morning: 1, afternoon: 2, evening: 3, night: 4 };

// Sortable rank for an edition key ("2026-08-10_evening" -> "2026081003").
// Editions are BUILT on the UTC+14 clock, so keys ahead of the visitor's own edition
// legitimately exist in storage. Every reader-facing surface must compare against
// getEditionForTimezone(tz) and drop anything ranking higher, or the reader sees
// content dated in their future. See CLAUDE.md "Build clock / Publish clock".
export function editionRank(key: string): string {
  const [d, s = ""] = key.split("_");
  return d.replace(/-/g, "") + String(SLOT_ORDER_MAP[s] ?? 0).padStart(2, "0");
}

// Accessibility-first writers: original 9 + new 9 = 18
// These writers share a core trait: reader feels smart, not impressed.
// They exclusively write S1, S2, FC, Synthesis, and Weekly Signal slots.
const ACCESSIBLE_INDICES = new Set([1, 4, 8, 17, 19, 44, 45, 48, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74]);
const ACCESSIBLE_POOL_BASE = [1, 4, 8, 17, 19, 44, 45, 48, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74];

function getAccessiblePool(editionKey: string): number[] {
  const seed = editionKey.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0);
  const pool = [...ACCESSIBLE_POOL_BASE];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(seed + i * 13) * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

function getDayPool(date: string): number[] {
  const daySeed = date.split("").reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0);
  const pool = Array.from({ length: WRITERS.length }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(seededRandom(daySeed + i * 97) * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

export function getWriterAssignments(editionKey: string): number[] {
  const [date, slot = "early"] = editionKey.split("_");
  const slotIndex = SLOT_ORDER_MAP[slot] ?? 0;
  const accessiblePool = getAccessiblePool(editionKey);

  // S1 = accessiblePool[0], S2 = accessiblePool[1]
  // Pre-count Synthesis (pool[2]) and FC (pool[3]) as premium uses
  const counts = new Map<number, number>();
  for (let i = 0; i < 4; i++) counts.set(accessiblePool[i], (counts.get(accessiblePool[i]) ?? 0) + 1);

  // S3–S11: 9 writers from full day pool, slot-offset for variety
  // Accessible writers capped at max 2 total appearances per edition
  const fullPool = getDayPool(date);
  const startIdx = slotIndex * 11;
  const s3Plus: number[] = [];
  for (let i = 0; i < fullPool.length && s3Plus.length < 9; i++) {
    const w = fullPool[(startIdx + i) % fullPool.length];
    if (ACCESSIBLE_INDICES.has(w)) {
      if ((counts.get(w) ?? 0) >= 2) continue;
      counts.set(w, (counts.get(w) ?? 0) + 1);
    }
    s3Plus.push(w);
  }

  return [accessiblePool[0], accessiblePool[1], ...s3Plus];
}

export function getSynthWriterIndex(editionKey: string): number {
  return getAccessiblePool(editionKey)[2];
}

export function getFCWriterIndex(editionKey: string): number {
  return getAccessiblePool(editionKey)[3];
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

// Scans body for colon/semicolon violations and rewrites offending sentences via a small Claude call.
// Returns original text unchanged if no violations found (fast path).
async function repairPunctuation(client: Anthropic, text: string): Promise<string> {
  const COLON_RE = /(?<![a-z]{2,}:\/\/)(?<![A-Za-z]{2,}:\/\/)[^.\n]*:[^.\n]*/;
  const SEMI_RE = /[^.\n]*;[^.\n]*/;
  const hasColon = COLON_RE.test(text);
  const hasSemi = text.includes(";");
  if (!hasColon && !hasSemi) return text;

  const violations: string[] = [];
  for (const para of text.split("\n\n")) {
    for (const sentence of (para.match(/[^.!?]*[.!?]+["']?\s*/g) ?? [para])) {
      const s = sentence.trim();
      if (COLON_RE.test(s) || SEMI_RE.test(s)) violations.push(s);
    }
  }
  if (violations.length === 0) return text;

  try {
    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{
        role: "user",
        content: `Rewrite each sentence below to remove colons and semicolons. Split into two sentences at the colon or semicolon — no colons, no semicolons in the output. Keep the meaning intact. Exception: if the colon or semicolon separates parallel items in a list rather than two independent clauses, do NOT split into two sentences — rewrite the list using commas and "and" instead (e.g. "legally, financially, and socially available" — never "legally, financially. Socially available"). Only split into two sentences when both resulting halves are independently complete, grammatical sentences on their own. Return ONLY a JSON object where each key is the original sentence (exactly) and the value is the rewritten version. No extra text.

Sentences:
${violations.map((v, i) => `${i + 1}. ${v}`).join("\n")}`,
      }],
    });
    const raw = res.content[0].type === "text" ? res.content[0].text.trim() : "";
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const map: Record<string, string> = JSON.parse(cleaned);
    let result = text;
    for (const [original, rewritten] of Object.entries(map)) {
      result = result.replace(original, rewritten);
    }
    return result;
  } catch {
    return text;
  }
}

function removeDuplicateSentences(text: string): string {
  const seen = new Set<string>();
  return text.split("\n\n").map(para => {
    const sentences = para.match(/[^.!?]+[.!?]+["']?\s*/g) ?? [para];
    const deduped = sentences.filter(s => {
      const key = s.trim().toLowerCase().replace(/\s+/g, " ");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return deduped.join("").trim();
  }).filter(p => p.length > 0).join("\n\n");
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
  fitness: number;         // 1–5: source quality for this pipeline
  fitness_reason: string;  // one sentence explaining the score
  uplift_score: number;    // 1–5: relevance to reader's own life (S1/S2 gate)
  uplift_reason: string;   // one sentence explaining the uplift score
  subject?: { name: string; type: "film" | "tv_show" | "book" | "album" | "game" | "person" | "other"; year?: string };
}

async function analyzeSource(client: Anthropic, story: Story): Promise<SourceAnalysis | null> {
  const content = story.content
    ? `EXCERPT: ${story.content.slice(0, 500)}`
    : [story.summary, story.bullets?.join(". ")].filter(Boolean).join("\n");
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `Read this article and return a brief editorial analysis. Be specific — one tight sentence each.

TITLE: ${story.title}
SOURCE: ${story.source}
SECTION: ${story.section}
${content}

FITNESS SCORING (1–5) — how strong is this source for an insight-driven editorial pipeline:
5: Genuine finding, study result, or observed phenomenon. Tension is real. The argument lives in the source. Reader relevance is clear.
4: Real counter-intuitive result or strong position. Some angle-finding needed but the source provides the core.
3: Real subject with identifiable tension. Article must find its own angle but source is a legitimate starting point.
2: PR, product launch, or announcement where the argument must be entirely manufactured. No finding — just a hook the writer must build from scratch. (e.g. Sony releasing $119 monitors with a democratization pitch = 2)
1: Wire copy, obituary, deal, press release. No editorial substance. Nothing to engage with.

UPLIFT SCORING (1–5) — does this story have direct relevance to a general reader's own life, growth, or decisions? This is about the reader, not the subject's importance. The reader spans a mature sixteen-year-old to middle age: study, training, first jobs, friendship and early independence land as squarely as career and family. Do not score a story lower because its subject is young or its context is education rather than employment. The floor is an upper-secondary student, not a child — material pitched at middle schoolers is genuinely off-audience and should score low.
5: Reader can immediately apply insight to their own life, relationships, work, or thinking. (e.g. study on how sleep affects decision-making, research on what makes feedback land)
4: Clear bridge to reader's life with one inference step. Reader sees themselves in the subject. (e.g. how top performers build habits, what the most creative teams do differently)
3: Loosely applicable — reader could extract a personal lesson but must work for it. Story is more about the subject than the reader.
2: Interesting but reader-distant. Institutional critique, industry analysis, or professional niche. The reader is an observer, not a participant. (e.g. design school students didn't consult a Japanese fishing village)
1: No personal relevance. Obituary, geopolitical event, institutional announcement, celebrity gossip. Film/literary/arts criticism, translation theory, museum or cultural commentary — the reader is a spectator of someone else's creative work, not a participant in their own life. (e.g. what American accents do to Homer, how Nolan adapted the Odyssey)

Return JSON only:
{"genre":"news_report|science_discovery|cultural_criticism|profile|policy_politics|entertainment|opinion|explainer","source_position":"what claim or stance the source takes, or neutral if wire copy","tension":"what is unresolved contested or glossed over","missed":"the angle or implication the source did not pursue","fitness":1-5,"fitness_reason":"one sentence — why this score, what makes it strong or weak as source material","uplift_score":1-5,"uplift_reason":"one sentence — why this score, how directly does this land in the reader's own life","subject":{"name":"exact title or person name if the article is primarily about a specific named film/TV show/book/album/video game/person — omit this field entirely if the article is not about a specific named work or person","type":"film|tv_show|book|album|game|person|other","year":"release or birth year if known, otherwise omit"}}`,
      }],
    });
    const raw = (msg.content[0]?.type === "text" ? msg.content[0].text : undefined) ?? "{}";
    return JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()) as SourceAnalysis;
  } catch { return null; }
}

function genreInstruction(a: SourceAnalysis): string {
  const pos = a.source_position;
  const ten = a.tension;
  const mis = a.missed;
  const briefs: Record<SourceGenre, string> = {
    news_report:        `This is a news story. Lead with what this means — not what happened. The event is the last thing that matters. The claim in the air: ${pos}. The tension nobody named: ${ten}. The angle worth taking: ${mis}. Go there. Establish the subject first so a cold reader knows what we're talking about.`,
    science_discovery:  `This is a science story. Establish the discovery clearly — what was found, by whom, and why it's surprising — then lead with what changes because of it. For ordinary people, for the field, for assumptions we held. The prevailing view: ${pos}. What the finding doesn't settle: ${ten}. The implication nobody followed: ${mis}.`,
    cultural_criticism: `This is cultural criticism. Name the subject — the film, show, album, book, or moment — and establish what it is before you argue about it. The prevailing read: ${pos}. Engage that directly — agree and push further, or find the flaw and name it. The real tension: ${ten}. The angle nobody took: ${mis}.`,
    profile:            `This is a profile. Name the person and give the reader a foothold — who are they and why do they matter right now. Then find the one detail that unlocks them and build outward from it. The established narrative: ${pos}. The tension underneath: ${ten}. What got avoided: ${mis}.`,
    policy_politics:    `This is a policy story. Strip the procedural language. Name what is actually happening and who it affects before you argue about it. Then: what does this actually do to actual people? The official position: ${pos}. The real tension: ${ten}. What actually matters here: ${mis}.`,
    entertainment:      `This is an entertainment story. Name the subject — the film, franchise, star, or moment — and anchor the reader before you have an opinion. Then treat it as a cultural symptom: what does the audience's appetite for this reveal about us right now? The dominant take: ${pos}. The tension underneath: ${ten}. The argument worth making: ${mis}.`,
    opinion:            `This is an opinion piece on a real subject. Establish what that subject is — the idea, event, or figure being debated — then make your own argument about it. Don't critique the source — engage the substance directly and go further. The dominant position: ${pos}. The real tension: ${ten}. The move worth making: ${mis}. Reach into your own knowledge and name a specific company, executive, or documented incident where this dynamic played out. The named case is not optional.`,
    explainer:          `This is an explainer. Cover the what clearly — a cold reader needs to understand the subject before they can care about your take. Then do the job the explainer skipped: the why-now and the so-what. The standard framing: ${pos}. The real tension: ${ten}. The thread nobody followed: ${mis}. If the source has no named subject, reach into your own knowledge and name a specific person, institution, or case that grounds the abstract idea. Do not stay in the abstract.`,
  };
  return briefs[a.genre] ?? briefs.news_report;
}

// ── Pass 0.5: mode selection + pre-flight claim ───────────────────────────────
interface ModeSelection {
  mode: string;
  reasoning: string; // why this mode for this specific story
  claim: string;     // one specific falsifiable sentence the writer commits to before writing
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
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `You are ${writerName}. You have read this article and its editorial analysis. Using your knowledge of this subject — the players, the history, the debates in this field — choose the single mode of engagement that would produce the most insightful, conversation-sparking response. Do not pick mechanically. Pick based on what you actually know about this topic and what would make a reader think differently.

BEFORE CHOOSING, CHECK THE SUBJECT. If this story involves a real person's death, illness, addiction, bereavement, abuse, or a disaster with human casualties, then The Rebuttal, The Unstated Assumption, The Paradox and The Beneficiary Question are UNAVAILABLE. Those modes work by attacking the prevailing reading, and aimed at someone's suffering they produce a piece arguing against sympathy — which is how this pipeline once published an argument that a recently deceased actor's family, rather than her industry, was to blame. Use The Zoom Out, The Historical Echo, The Zoom In or The Extension instead, and write about the subject rather than against the people in it. If none of the permitted modes yields something worth reading, say so in "reasoning" and pick The Zoom Out.

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
{"mode":"exact mode name","reasoning":"one sentence — specifically why this mode, what you know about this topic that makes it the right call","claim":"one specific falsifiable sentence naming a concrete mechanism, case, or finding. FORBIDDEN: abstract category nouns ('tools', 'context', 'systems', 'access', 'power'); claims that apply to any industry or any decade. TEST: could a skeptic name a counterexample? If not, rewrite. GOOD: 'Shure's $99 headphone democratized gear but trained bedroom producers to trust a monitoring chain that car stereos expose as wrong' — NOT 'professional tools require professional context'."}`,
      }],
    });
    const raw = (msg.content[0]?.type === "text" ? msg.content[0].text : undefined) ?? "{}";
    return JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()) as ModeSelection;
  } catch { return null; }
}

// ── Mode-aware rhythms ────────────────────────────────────────────────────────
function rhythmForMode(mode: string): string {
  const rhythms: Record<string, string> = {
    "The Reframe": `Structure to aim for:
1. State the facts as presented — flatly, without argument. One sentence.
2. Name the reframe. This is a different kind of story. Not a correction — a relabeling.
3. Show what the reframe reveals that the original framing hid. One specific thing changes.
4. Follow the implication: if this is actually about X not Y, what does that require us to see?
5. End with what the reader now sees differently. A shifted lens, not a lesson.`,

    "The Extension": `Structure to aim for:
1. Accept the source's central point. State it as true — don't hedge it.
2. Identify exactly where the source stopped. Name the edge of their argument.
3. Follow the thread one step further. What does the logic require if you keep going?
4. Ground the extension in something specific — a named case or mechanism, not speculation.
5. End where the thread leads. Let the reader see the destination the source refused to reach — and name one place they are likely to encounter it themselves.`,

    "The Complication": `Structure to aim for:
1. State the source's claim as legitimate. It's not wrong — it's incomplete.
2. Introduce the complication. The thing that is also true, that changes the picture.
3. Hold both simultaneously — the original point AND the complication. Don't resolve them.
4. Name the tension specifically. What makes these two true things hard to reconcile?
5. End in the productive discomfort. No resolution — a clearer picture of the actual complexity, and where the reader is likely to feel that complexity in their own situation.`,

    "The Rebuttal": `Structure to aim for:
1. State what is being claimed — fairly, without strawmanning. One sentence.
2. Name the specific flaw. Not the conclusion — the root. Where exactly does the reasoning break?
3. Show what's actually true instead. Use something specific: a named case, a number, a mechanism.
4. Acknowledge what the original claim gets right, if anything. Sharpens the rebuttal.
5. End with the corrected picture — what the reader should hold instead, and where it changes something they already believed about their own situation.`,

    "The Zoom Out": `Structure to aim for:
1. Name the specific story — anchor the reader in the particular event or detail.
2. Name the larger pattern it belongs to. Not a vague category — a specific recurring dynamic.
3. Show at least one other instance of the same pattern. Named and specific.
4. Name the mechanism: why does this pattern repeat? The structural reason, not surface similarity.
5. End with what the pattern tells us about how things work — and name one place the reader is likely to encounter this pattern themselves, outside this story.`,

    "The Zoom In": `Structure to aim for:
1. State the abstract claim or trend the source describes.
2. Choose one specific case where it becomes real — a person, place, moment, or number.
3. Inhabit that case. What actually happens there? What does it look like on the ground?
4. Show what the specific reveals that the abstract hid. The zoom-in should change something.
5. End with what follows — for the specific case, for the larger claim, and for the reader who recognizes this dynamic in their own situation.`,

    "The Unstated Assumption": `Structure to aim for:
1. Establish the subject and what the argument takes for granted.
2. Name the unstated assumption explicitly. The thing the argument depends on but never defends.
3. Show it's actually contested — not obviously true, not universally shared.
4. Follow what happens to the argument if the assumption falls. What changes?
5. End with the question the piece has now opened — the one the reader has to sit with, not a critique of the source.`,

    "The Beneficiary Question": `Structure to aim for:
1. Describe what happened — the event, decision, or outcome.
2. Ask the beneficiary question directly: who specifically wanted this?
3. Follow the incentives — what did they stand to gain and what did they do to get it?
4. Name the mechanism: how does following the incentives explain what actually happened?
5. End with what this tells the reader about who to watch next time something similar unfolds.`,

    "The Historical Echo": `Structure to aim for:
1. Name the current situation — anchor the reader in the present.
2. Name the historical parallel. Not "this has happened before" — the exact case, date, figure.
3. Show the structural similarity — the underlying mechanism that repeats, not surface resemblance.
4. Name what happened in the historical case. The outcome the echo suggests.
5. End with what's different this time — the variable that might change the ending, or confirm it. Give the reader something specific to watch for in their own world.`,

    "The Paradox": `Structure to aim for:
1. State the source's conclusion — the thing they arrived at.
2. Show how that conclusion undermines its own premise. Where the argument turns on itself.
3. Make the contradiction visible and specific. Name exactly where the logic breaks.
4. Hold both sides simultaneously — do not resolve the tension. The contradiction is load-bearing.
5. End with what the paradox reveals. The thing you can only see by holding both sides at once — and where the reader might be holding the same tension without having named it.`,

    "The Missing Voice": `Structure to aim for:
1. Name what the source discusses — and who it discusses without talking to them.
2. Name the missing group specifically. Who should be in this piece but isn't?
3. Surface what they would actually say — their documented, findable position, not projection. Name a specific person, project, or documented incident (e.g. a named initiative, a published account, a known case). Do not stay generic.
4. Show why the gap matters. What changes when you hear the absent voice?
5. End with a provocation — the sharpest implication of centering the missing voice, and what the reader should now notice differently in their own world.`,

    "The So What": `Structure to aim for:
1. State what happened — the event, finding, or announcement. One sentence.
2. Name why it actually matters. Not the official significance — the real consequence for real people.
3. Get specific: who is affected, how, and on what timeline?
4. Name the causal chain in plain language. Why does this event produce that consequence?
5. End with the awareness or action the reader walks away with. What do they do differently now?`,
  };

  return rhythms[mode] ?? `Structure to aim for — not a template, but a rhythm that works:
1. Open with the central claim or observation stated as fact. No setup. The reader lands in the middle of it.
2. Ground it in the specific story — what happened, what was unusual, what it reveals.
3. Pull in a parallel: a named person, moment, or case where the same trait or mechanism showed up. Name the thing.
4. Name the mechanism at the center. The one thing that explains why this keeps happening.
5. End with a consequence or question that transfers — something that changes how the reader sees their own situation.`;
}

export async function clearEditionCache(editionKey: string): Promise<void> {
  const PROMPT_V = "v4";
  const prefix = `articles/${PROMPT_V}/${editionKey}/`;
  try {
    let cursor: string | undefined;
    do {
      const { blobs, cursor: next } = await list({ prefix, cursor, limit: 100 });
      if (blobs.length > 0) await del(blobs.map(b => b.url));
      cursor = next;
    } while (cursor);
  } catch { /* non-fatal — warm will overwrite anyway */ }
  // Also clear synthesis, FC, and (on Sunday evenings) weekly signal so warm always regenerates fresh
  const pointBlobs = [
    `synthesis/v1/${editionKey}.json`,
    `feature-creature/v20/${editionKey}.json`,
    `s1-insight-story/v1/${editionKey}.json`,
    ...(isSundayEvening(editionKey) ? [`weekly-signal/v1/${editionKey.split("_")[0]}.json`] : []),
  ];
  for (const key of pointBlobs) {
    try {
      const b = await head(key);
      if (b) await del(b.url);
    } catch { /* not found — nothing to clear */ }
  }
}

// Static editorial guidelines shared across every article — cached via prompt caching.
// Represents ~1800-2000 tokens; moving it to the system parameter means 8 of every 9
// Pass 1 calls per warm run hit the cache at $0.10/1M instead of $1.00/1M.
const PASS1_SYSTEM = `FACTUAL INTEGRITY — this outranks every other instruction here, including voice, angle and structure.
Nothing invented is ever attached to a real person, organisation or documented event. Not a date, not an occupation, not a family relationship, not a sensory detail, not a statistic. A confident, specific, checkable-looking claim that turns out to be false costs far more than a duller one that is true, and the danger scales with how authoritative it sounds. "In the early 1980s, NASA used this to assess candidates" is the shape to distrust: an institution plus a date, verifiable-sounding, trivially invented. A real person placed at a real event they did not attend is the same failure wearing better clothes.
If you cannot name the study, book, person or documented moment that makes a claim checkable, do not make the claim — pick a different one. Never put a number in a headline that the body does not support.
Where two people share a surname, a family or a story, keep them separate. Conflating relatives is a common and catastrophic error.

ABOUT REAL PEOPLE, specifically. Never assert or imply, for a named living or recently deceased person or their family: a cause of death, a medical or psychiatric condition, addiction, criminal conduct, abuse, or parental neglect — unless it is documented, attributed, and you are certain. Someone's own public disclosure may be referred to as their disclosure; it is not licence to build a causal explanation of their life or death from it. When a cause is not established, say so plainly rather than assembling one. Their relatives are private people who did not choose coverage, and an argument that reflects on their conduct needs the same evidence a direct accusation would.

PROSE THAT DOES NOT READ AS MACHINE-WRITTEN. These are the constructions that most reliably mark generated text, measured against this publication's own output — not stylistic preferences.
Em-dashes: TWO in the entire piece, maximum. Everything else becomes a full stop, a comma, or a rebuilt sentence. Recent articles ran roughly four times the rate of human editorial writing, and em-dash frequency is the single most reliable signal there is.
The "Not X. Y." construction: ONCE in the entire piece, maximum. This covers every variant, which are the same move in different clothes — "Not because A. Because B.", "It isn't X, it's Y.", "X wasn't A. It was B.", "Selecting for damage, not causing it." A human writer reaches for this two or three times in an essay for emphasis. Used as a default sentence shape it is the clearest possible tell.
Never announce that you are about to explain or be specific. No "Here's how it works", no "So here is", no "made specific". Do the thing instead.
Do not perform sentence-length variation. A prescribed rhythm becomes an audible one, and evenly alternating short and long reads as manufactured. Let the sentences fall where the thought falls; some paragraphs will come out lumpy, which is what unforced writing looks like.
Include one concrete detail that serves no argument — something noticed rather than deployed. Everything in the piece earning its keep is itself unnatural: real prose carries slack. Do not flag it or make it cute.

You are writing for a curious, independently-minded reader who is building a life with intention — a creative practice, a course of study, a considered career, a way of thinking they have chosen deliberately. The floor is a mature sixteen-year-old — an upper-secondary student who reads seriously — and it runs upward from there with no ceiling. This is NOT written for middle schoolers, and nothing should be simplified as though it were. The writing does not assume a particular life stage: no presumed mortgage, tenure, marriage or decades of hindsight. A seventeen-year-old choosing what to study and a forty-year-old rebuilding a career are both squarely the reader. Never write down to them — the register does not soften for the younger end, it simply stops assuming the older one. They want to understand the world so they can make better decisions and see things other people miss. They are skeptical of received wisdom, equally unimpressed by institutions and by contrarianism. Write for someone who came to think, not to be told what to think. They came to read about the subject — the film, the discovery, the person, the idea — not about the journalism covering it.

YOUR READER ARRIVES COLD. They have not read the source article. They do not know what we are talking about. Your first move is always to establish the subject: name the thing, anchor the reader, give them a foothold. Prefer fusing the subject and your real opinion into that same first sentence when the material supports it — don't let sentence 1 be pure neutral fact-establishment with the actual claim deferred to paragraph 2. If no claim is ready yet in sentence 1, land it by sentence 2 at the latest — never later. Don't force a dramatic pivot into sentence 1 if it would feel manufactured; a confident, specific claim beats an artificial twist.

Draw on everything you know about this subject — not just what the source provided. Bring in the broader conversation: the history, the debates, the context outside the article. Write as if you chose to cover this topic today because it matters to you.

Never reference the source, the headline, the article, or your own process. You are writing about the subject. That is all the reader sees.

Never write an article whose conclusion is "this is complicated" or "there are no simple answers" or "science doesn't know yet." That is not a piece — it is an absence of one. Have a position. Give the reader a lens — use this subject as the vehicle, but land on something the reader can see in their own life: their creative practice, their career, their way of thinking. The subject is the entry point, not the destination.

Write for someone who is intelligent, not ideological. No left or right lean. No woke framing. No moralising. Equally sceptical of institutions, activists, and reactionaries.

Use ONE reference — a specific idea, experiment, thinker, film, or moment — that creates a genuinely surprising connection. One sentence, then move on. If nothing fits cleanly, skip it. Do NOT use: Goodhart's Law, Dunning-Kruger, Streisand Effect, Overton Window, Occam's Razor, Hanlon's Razor, Butterfly Effect, Maslow's Hierarchy, Trolley Problem, Black Swan.

Ground your argument in at least one named case — a specific person, company, product, year, or documented incident. The named case is not optional. An abstract claim without a named anchor is an observation, not an article.

Voice rules:
- Persona first: every rule below is subordinate to your persona's voice and voiceReminder above. Where a generic rule and your persona's register would pull the sentence in different directions, follow the persona. Before finishing, reread your draft and confirm at least 2 sentences are ones only this persona — not a generic sharp analyst — would have written.
- If today's subject has no obvious overlap with your persona's usual territory, do not default to generic analyst prose — find the persona's characteristic MOVE (not their usual subject matter) and apply it here. E.g. Dawn's move is sustained attention to one small thing until it opens into something larger — apply that attention-structure to any subject, not just nature. Clive's move is delight at a disproportionate consequence hiding inside something small — apply that structure to a legal argument, not just history.
- Vary sentence length. Short punches. Then one that earns it. Then short again.
- Fragments are allowed for emphasis, but each one must be readable as a complete thought on its own. Never start a sentence with "Means..." or otherwise drop the subject of a clause — if a fragment needs the previous sentence to parse grammatically, add the subject back in.
- If you restate the article's core insight later in the piece for emphasis, rephrase it — never repeat an identical sentence verbatim. Word-for-word repetition reads as an editing error, not emphasis.
- Vivid and specific — name the thing, don't describe it abstractly.
- When the source contains a striking number — use it. The specific number does more work than the abstraction.
- No academic hedging: never "one might argue", "it is worth noting", "this suggests that".
- No throat-clearing openers: never "In a world where...", "It's no secret that...", "Now more than ever...", "Here's the thing...".
- Never reference the source article or your own process. You chose to write about this subject — write about it directly.
- No semicolons — ever. Rewrite as two sentences. Exception: if the semicolon or colon separates parallel items in a list rather than two independent clauses, do not split into two sentences — use commas and "and" instead (e.g. "legally, financially, and socially available" — never "legally, financially. Socially available"). Only split into two sentences when both resulting halves are independently complete, grammatical sentences on their own.`;

// Slots at or above this index use the single-call path. RSS_STORIES_PER_EDITION is 7, so
// this is the last two (S7 and S8 on the page, since the Insight occupies S1).
const SINGLE_PASS_FROM_SLOT = RSS_STORIES_PER_EDITION - 2;

function isBriefStyle(story: Story): boolean {
  return story.cardStyle === "brief";
}

interface SinglePassResult {
  ownedTitle?: string; summary?: string; bullets?: string[]; imageQuery?: string;
  imageQuery2?: string; header?: string; header2?: string; pullQuote?: string;
  pullQuoteAfterPara?: number; body?: string; cta?: { header: string; body: string };
}

/**
 * One call: structured prose plus every metadata field. Mirrors getS1Insight's shape, and
 * inherits PASS1_SYSTEM so the factual-integrity and anti-tell rules apply identically to
 * both paths. Returns null on any failure so the caller can fall back to multi-pass — a
 * degraded article is acceptable, a missing one is not.
 */
async function singlePassArticle(
  client: Anthropic,
  story: Story,
  relatedStories: Story[],
  analysis: SourceAnalysis | null,
  modeSelection: ModeSelection | null,
  writer: (typeof WRITERS)[number] | null,
  lens: { prompt: string } | null,
  hasCta: boolean,
  refSeed: number,
): Promise<SinglePassResult | null> {
  try {
    const voice = writer
      ? `${writer.style}${lens ? `\n\n${lens.prompt}` : ""}`
      : `You write "The Signal Take" — a short, sharp editorial for a news digest. Direct, a little irreverent, never preachy.${lens ? `\n\n${lens.prompt}` : ""}`;
    const brief = [
      analysis ? genreInstruction(analysis) : "",
      modeSelection ? `MODE: ${modeSelection.mode}\nWHY: ${modeSelection.reasoning}` : "",
      modeSelection?.claim ? `YOUR COMMITTED CLAIM: ${modeSelection.claim}\nBuild from it, complicate it. Everything serves or sharpens this claim.` : "",
    ].filter(Boolean).join("\n");
    const titleMode = TITLE_MODES[Math.floor(mixedRandom(refSeed * 7 + 4441) * TITLE_MODES.length)];

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1600,
      system: [{ type: "text" as const, text: PASS1_SYSTEM, cache_control: { type: "ephemeral" as const } }],
      messages: [{
        role: "user",
        content: `${voice}

${brief}

STORY: ${story.title}
SOURCE: ${story.source}
SECTION: ${story.section}
${story.content ? `EXCERPT: ${story.content.slice(0, 500)}` : story.summary ? `SUMMARY: ${story.summary}` : ""}

TODAY'S OTHER STORIES (weave one in only if the parallel is genuinely non-obvious):
${relatedStories.slice(0, 6).map(s => `- ${s.title} (${s.section})`).join("\n")}

Write the piece and its metadata together, in one pass. 250-350 words of prose total.

PARAGRAPH BUDGETS — fit them by COMPRESSING, never by stopping mid-thought. A paragraph one sentence over is far better than one that ends unfinished:
- para1: 1-2 sentences. The hook. Name the subject and land a real claim.
- para2: up to 2. Deepen or reframe it.
- para3: 2-3. First evidence or insight.
- para4: 3-4. The turn — complication, contradiction, escalation.
- para5: 3-5. The landing. Must connect to something the reader can see in their own work or thinking, not just a conclusion about the subject. Ends on a declarative sentence, never a question.

FORBIDDEN: colons in the prose; semicolons; throat-clearing openers; 'this teaches us'; endings that stay inside the subject world; named cases dropped in without setup.

Return JSON only, no markdown:
{
  "ownedTitle": "5-9 words. Write it in this mode: ${titleMode} THREE HARD TESTS: every number, name and claim in the title must appear in your body below — never assert a statistic the piece does not make; it must OPEN a gap, not close one; it may not blame the reader. No colons. No abstract category nouns. No container noun behind a definite article ('The Move', 'The Year'). Must differ from the source headline.",
  "summary": "2 sentences — what the piece argues and why it matters to someone thinking about their own life. Name a specific person, product or place from the article where one exists.",
  "bullets": ["≤15 words, specific or reframe-inducing", "≤15 words", "≤15 words"],
  "header": "3-5 words. Magazine sub-headline above para1. Specific, no colons.",
  "header2": "3-5 words. Second sub-headline, sits before para4. Covers the turn.",
  "pullQuote": "One sentence lifted VERBATIM from your body — the most arresting line. Must appear word-for-word in the body.",
  "pullQuoteAfterPara": 4,
  "imageQuery": "4-6 words for Unsplash. Concrete scene. No names, brands, text or logos.",
  "imageQuery2": "4-6 different words for a second image. Texture, environment, light.",
  "body": "The five paragraphs as one string, separated by \\n\\n. Prose only, no labels."${hasCta ? `,
  "cta": { "header": "2-4 words, active verb phrase", "body": "1 sentence. A specific thing to do, read or try that connects to this piece." }` : ""}
}`,
      }],
    });

    const raw = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()) as SinglePassResult;
    if (!parsed.ownedTitle || !parsed.body) return null;
    // The pull quote is rendered as a verbatim lift; drop it rather than show a near-miss.
    if (parsed.pullQuote && !parsed.body.includes(parsed.pullQuote)) parsed.pullQuote = "";
    return parsed;
  } catch (e) {
    console.warn("[single-pass] generation failed", e);
    return null;
  }
}

export async function getFullArticle(story: Story, relatedStories: Story[], editionKey: string, writerIndex?: number, readOnly = false, slotIndex = 99): Promise<ArticleCommentary> {
  const slug = createHash("md5").update(story.link).digest("hex").slice(0, 16);
  const refSeed = editionKey.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0) + (writerIndex ?? 0) * 997 + parseInt(slug.slice(0, 8), 16);
  const hasCta = seededRandom(refSeed + 13) < 0.2;
  const hasImg2 = seededRandom(refSeed + 7) < 0.2;
  const hasKeyFacts = !hasCta && seededRandom(refSeed + 19) < 0.33;
  const PROMPT_V = "v4";
  const blobKey = `articles/${PROMPT_V}/${editionKey}/${slug}.json`;

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
    for (const oldV of ["v3", "by-slug-v2", "by-slug", "v22", "v21", "v20", "v19", "v18"]) {
      for (const key of [
        oldV === "by-slug-v2" ? `articles/by-slug-v2/${slug}.json` :
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

  // ── Fitness gate: protect S1/S2 from weak sources ────────────────────────────
  // fitness 1 is rejected at EVERY slot, not just S1/S2. Obituaries score 1, and the old
  // `slotIndex <= 1` scoping let one through at a lower slot: a piece about a person who had
  // died two days earlier, run through the contrarian-argument modes, arguing that her family
  // rather than the industry was responsible. Nothing below S2 was gated at all.
  if (analysis && typeof analysis.fitness === "number" && (analysis.fitness === 1 || (analysis.fitness <= 3 && slotIndex <= 1))) {
    console.warn(`[fitness-gate] slot ${slotIndex} rejected: score=${analysis.fitness} — ${analysis.fitness_reason} (${story.title})`);
    throw new Error(`Fitness gate: score ${analysis.fitness} — ${analysis.fitness_reason}`);
  }

  // ── Uplift gate: S1/S2 block score ≤2; S3 blocks score ≤1 (clearly irrelevant stories) ─────
  const upliftBlock = slotIndex <= 1 ? 2 : slotIndex === 2 ? 1 : -1;
  if (analysis && typeof analysis.uplift_score === "number" && upliftBlock >= 0 && analysis.uplift_score <= upliftBlock) {
    console.warn(`[uplift-gate] slot ${slotIndex} rejected: uplift=${analysis.uplift_score} — ${analysis.uplift_reason} (${story.title})`);
    throw new Error(`Uplift gate: score ${analysis.uplift_score} — ${analysis.uplift_reason}`);
  }

  // ── Section gate: S1/S2 must be uplift (Psychology or HumanPotential) ────────
  if (slotIndex <= 1 && story.section !== "Psychology" && story.section !== "HumanPotential") {
    console.warn(`[section-gate] slot ${slotIndex} rejected: section=${story.section} (${story.title})`);
    throw new Error(`Section gate: S1/S2 requires uplift section, got ${story.section}`);
  }

  // ── Pass 0.5: mode selection — writer chooses engagement mode based on subject knowledge ──
  const writer = writerIndex !== undefined ? WRITERS[writerIndex % WRITERS.length] : null;
  const writerName = writer?.name ?? "The Signal editor";
  const lens = getLens(story.section, refSeed);
  const modeSelection = analysis ? await selectMode(client, story, analysis, writerName) : null;

  // ── Single-pass path (trial, last two slots only) ───────────────────────────
  // Writes structured prose AND every metadata field in one call, the way getS1Insight does,
  // replacing Pass 1 + 1.5 + 2. Two reasons to want it: three calls become one, and the title
  // and pull quote are written WITH the body instead of extracted from it afterwards — which
  // is why extracted titles drift from the piece they sit above.
  //
  // Restricted to the final two slots so it can be compared against multi-pass articles in the
  // same edition, same feed, same writer pool. The load it has to carry in one shot — voice,
  // committed claim, structure, factual integrity, anti-tell rules, title tests, image query —
  // is proven on Sonnet in the insight, not on Haiku here. If these two read worse than the
  // rest of the edition, delete this block; nothing else depends on it.
  if (slotIndex >= SINGLE_PASS_FROM_SLOT && slotIndex !== 99) {
    const single = await singlePassArticle(client, story, relatedStories, analysis, modeSelection, writer, lens, hasCta, refSeed);
    if (single) {
      const spImageUrl2 = (!isBriefStyle(story) && hasImg2 && single.imageQuery2)
        ? await fetchUnsplash(single.imageQuery2, story.section, 1).then(r => r?.url)
        : undefined;
      const spCommentary: ArticleCommentary = {
        ownedTitle: single.ownedTitle ?? "",
        summary: single.summary ?? undefined,
        bullets: single.bullets?.length ? single.bullets.slice(0, 3) : undefined,
        imageQuery: single.imageQuery ?? undefined,
        header: single.header ?? "",
        header2: single.header2 ?? "",
        pullQuote: single.pullQuote ?? "",
        pullQuoteAfterPara: single.pullQuoteAfterPara ?? 4,
        imageUrl2: spImageUrl2 ?? undefined,
        body: breakLongSentences(single.body ?? ""),
        writer: writer?.name ?? "",
        cta: single.cta ?? undefined,
        hasKeyFacts,
      };
      console.log(`[single-pass] slot ${slotIndex} "${spCommentary.ownedTitle}"`);
      try {
        await put(blobKey, JSON.stringify(spCommentary), { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
      } catch { /* non-fatal */ }
      return spCommentary;
    }
    console.warn(`[single-pass] slot ${slotIndex} failed — falling through to multi-pass (${story.title})`);
  }

  // ── Pass 1: pure prose — voice leads, brief follows ──────────────────────────
  const voiceInstruction = writer
    ? `${writer.style}${lens ? `\n\n${lens.prompt}` : ""}`
    : `You write "The Signal Take" — a short, sharp editorial for a news digest. Your voice: the smartest person in the room who happens to be your friend. Direct. A little irreverent. Never preachy. You find the non-obvious angle and follow it somewhere unexpected.${lens ? `\n\n${lens.prompt}` : ""}`;

  const editorialBrief = (analysis || modeSelection) ? [
    "\n\nEDITORIAL BRIEF:",
    analysis ? genreInstruction(analysis) : "",
    modeSelection ? `\nMODE: ${modeSelection.mode}\nWHY: ${modeSelection.reasoning}` : "",
    modeSelection?.claim ? `\nYOUR COMMITTED CLAIM: ${modeSelection.claim}\n\nStart from this claim. Don't restate it verbatim — build from it, complicate it, weaponize it. Everything in the piece serves this claim or sharpens it.` : "",
    "\n---\n",
  ].filter(Boolean).join("\n") : "";

  const pass1msg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 1000,
    system: [{ type: "text" as const, text: PASS1_SYSTEM, cache_control: { type: "ephemeral" as const } }],
    messages: [{
      role: "user",
      content: `${voiceInstruction}${editorialBrief}

REFERENCE POOL — pick something unexpected:
${sampleReferencePool(refSeed)}

STORY: ${story.title}
SOURCE: ${story.source}
SECTION: ${story.section}
${story.content ? `RSS EXCERPT: ${story.content.slice(0, 400)}` : [
  story.summary ? `SUMMARY: ${story.summary}` : "",
  story.bullets?.length ? `KEY FACTS: ${story.bullets.join(". ")}` : "",
].filter(Boolean).join("\n")}

TODAY'S OTHER STORIES (weave one in only if the parallel is genuinely non-obvious):
${related.map((s) => `- ${s.title} (${s.section})`).join("\n")}

Write the article now. Pure prose only. No paragraph labels. Paragraphs separated by a blank line.
${writer?.voiceReminder ? `\n${writer.voiceReminder}` : ""}
${rhythmForMode(modeSelection?.mode ?? "")}

Total length: 250-350 words. Tight and complete — no padding, no filler, no repetition.

Before finishing, check your last paragraph specifically: does it name something outside today's subject that the reader can act on or see differently in their own life? If the last paragraph could be published in a product-news trade blog with only the subject swapped out, it has failed this check — rewrite it.

FORBIDDEN: throat-clearing openers; colons anywhere in the prose — rewrite as two sentences, no exceptions; semicolons — rewrite as two sentences, unless they separate parallel list items, in which case use commas and "and" instead of a stray period (never "legally, financially. Socially available" — write "legally, financially, and socially available"); vague lesson-gesturing ('this teaches us', 'there's a lesson here') — show the insight, don't announce it; vague endings that restate the opening without completing the thought ('something else entirely', 'more complicated than it seems', 'that's a different story') — the final paragraph must name the specific thing the reader now understands that they didn't at the start; endings that stay inside the subject world — the final paragraph must connect to something the reader can see in their own creative practice, career, or way of thinking, not just a conclusion about the subject itself; named cases that appear without setup — every specific person, company, or incident you name must be introduced and connected before the final sentence, not dropped in as a closing gesture; ending the piece on a question — the final sentence must be a declarative claim, even if the paragraph before it poses a question to build toward it.`,
    }],
  });

  const proseBody = (pass1msg.content[0]?.type === "text" ? pass1msg.content[0].text : "").trim();

  // ── Pass 1.5: metadata extraction — reads the finished prose, derives all fields ──
  const isCulturalSection = ["Film", "Entertainment", "Arts", "Comics", "Anime"].includes(story.section ?? "");
  const imageQueryInstruction = isCulturalSection
    ? `4-6 concrete atmospheric words for Unsplash. Describe the mood, world, or visual feeling — NOT the title, character name, or brand. Unsplash has no licensed film stills or franchise imagery. Think: what real-world scene or texture captures the emotional register? E.g. for a superhero story: 'city rooftop night dramatic light'; for a dark anime: 'rain neon reflection urban night'; for a musical: 'concert stage spotlight crowd silhouette'. No names, no logos, no text.`
    : analysis?.subject
      ? `This article is about ${analysis.subject.type === "person" ? `the person "${analysis.subject.name}"` : `the ${analysis.subject.type.replace("_", " ")} "${analysis.subject.name}"${analysis.subject.year ? ` (${analysis.subject.year})` : ""}`}. Use that as your search — e.g. "${analysis.subject.name}${analysis.subject.type !== "person" ? " " + analysis.subject.type.replace("_", " ") : " portrait"}". 4-6 words max.`
      : `4-6 words for Unsplash hero image. Real person → role/setting not name. Everything else: concrete scene, no brand names, no text, no logos.`;

  const metaMsg = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 600,
    messages: [{
      role: "user",
      content: `Read this article and extract the following fields. Return JSON only, no markdown.

STORY: ${story.title}
SOURCE: ${story.source}
SECTION: ${story.section}

ARTICLE:
${proseBody}

{
  "ownedTitle": "5-9 words. THREE HARD TESTS FIRST. (1) Every number, name, date or claim in the title must appear in the article body. A headline asserting a statistic the piece never supports is the worst failure available here — 'Seventy Percent of Coached Clients Never Change' above a body that never mentions seventy percent. If you cannot source it from the prose, do not write it. (2) It must OPEN a gap, not close one: if a reader can nod at it and move on, it has failed. (3) It may not blame or scold the reader. Also avoid FALSE specificity — a container noun behind a definite article ('The Move', 'The Year', 'The Room') presupposes a particular one the reader does not have and names nothing. Then: name the specific finding — not the category it belongs to. Use a detail from the article itself: a number, a name, a place, a year, a mechanism, a result. Must reference the same specific subject, time period, and setting as the summary field below — do not title off a historical aside or tangential detail that the summary doesn't actually focus on. If the summary contains a counter-intuitive claim or mechanism ('X happens not because of A, but because of B'), the title must surface that claim — do not settle for a neutral fact count or trivia statement when a sharper claim is available. FORBIDDEN: abstract category nouns ('tools', 'context', 'access', 'systems', 'power', 'change'); colons; 'X: When Y'; 'reveals'/'exposes'/'underscores'; 'Why'/'How'/'The Truth About'/'Game-Changer'. GOOD: 'Four Chameleons Named, Zero Habitats Protected' / 'Mathematicians Crack the 80-Year Randomness Problem' / 'Bedroom Producers Got the Headphones, Not the Ears'. Must differ from source headline.",
  "summary": "2 sentences — what the article argues and what it means for someone trying to think more clearly about the world. Not a news summary. The specific payoff for a curious reader building a considered life, from a mature sixteen-year-old upward. Where the article names a specific person, product, organization, or place, include at least one such named example — don't default to generic references ('artists', 'a report', 'officials') when a specific one is available in the article.",
  "bullets": ["One of the 3 facts or ideas a smart reader would want to remember — specific, surprising, or reframe-inducing ≤15 words", "Same standard — not plot summary, not the biggest number unless it reframes something ≤15 words", "Same standard ≤15 words"],
  "imageQuery": "${imageQueryInstruction}",
  "header": "3-5 words. Magazine sub-headline — specific, not generic. No colons. BAD: 'The Bigger Picture', 'What This Means'. GOOD: 'The Quiet Monopoly', 'Debt That Builds Nations'."${hasCta ? `,
  "cta": {
    "header": "2-4 words. Active verb phrase. E.g. 'Try This Tonight', 'Start Here', 'Read This Next'.",
    "body": "1 sentence. A specific thing to DO, WATCH, READ, or TRY that connects directly to this article — something a thoughtful person building a considered life would actually find worth their time — reachable whether they are a student or twenty years into a career. Name the exact thing. Beginner-friendly, zero commitment required."
  }` : ""}
}`,
    }],
  });

  const metaRaw = (metaMsg.content[0]?.type === "text" ? metaMsg.content[0].text : "{}").trim();
  const metaJson = metaRaw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  let pass1: { ownedTitle?: string; summary?: string; bullets?: string[]; imageQuery?: string; header?: string; pullQuote?: string; body?: string; cta?: { header: string; body: string } } = {};
  try {
    pass1 = JSON.parse(metaJson);
  } catch {
    const extractStr = (key: string) => {
      const m = metaJson.match(new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, "s"));
      return m ? m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : undefined;
    };
    const extractArr = (key: string) => {
      const m = metaJson.match(new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]+)\\]`, "s"));
      if (!m) return undefined;
      const items: string[] = [];
      const re = /"((?:[^"\\]|\\.)*)"/g;
      let hit: RegExpExecArray | null;
      while ((hit = re.exec(m[1])) !== null) items.push(hit[1]);
      return items;
    };
    pass1 = {
      ownedTitle: extractStr("ownedTitle"),
      summary: extractStr("summary"),
      bullets: extractArr("bullets"),
      imageQuery: extractStr("imageQuery"),
      header: extractStr("header"),
    };
  }
  // Enforce no-colon rule on ownedTitle in code — prompts aren't reliable enough
  if (pass1.ownedTitle?.includes(":")) {
    pass1.ownedTitle = pass1.ownedTitle.replace(/\s*:\s*/, " — ");
  }

  pass1.body = proseBody;

  // ── Pass 2: structure — always runs; isBrief only gates imageUrl2 (no mid-article image for brief cards) ──
  const isBrief = story.cardStyle === "brief";
  let body = pass1.body ?? "";
  let pass1Header2 = "";
  let pass1ImageQuery2 = "";
  let extractedPullQuote = pass1.pullQuote ?? "";
  let pullQuoteAfterPara = 4;
  // pullQuote is now a verbatim lift from the body — nothing to dedup
  if (body) {
    try {
      const pass2msg = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 700,
        messages: [{
          role: "user",
          content: `Shape the opening structure of this article. Preserve ALL ideas and the original voice word-for-word where possible. Do not add new ideas, do not delete content.

Three jobs only:
1. Fit the first 5 paragraphs to the sentence budgets below by COMPRESSING — tighten, merge, cut weak clauses. Never satisfy a budget by stopping mid-thought or dropping the sentence that completes an idea. A paragraph one sentence over budget is far better than one that ends unfinished. Content beyond paragraph 5 is preserved verbatim in "remainder" — do not touch it.
2. Break any sentence over 20 words at a natural clause boundary — em-dash, "and", "but", "because", "which", "so". Keep both halves punchy. NEVER break at a semicolon — rewrite to remove it entirely.
3. Remove throat-clearing openers ("Here's the thing", "Here's the structure", "The truth is", "What's interesting is", "Let's be clear", "Make no mistake" — any setup phrase before the real point). Remove colons used as setup-payoff splits ("X: Y") — rewrite as a direct statement.

Structure for first 5 paragraphs:
- para1: 1 sentence, 2 at the very most — the hook. Irreversible opener. Prefer one; take the second only when the claim genuinely cannot land without it. NEVER leave the thought unfinished to hit the count: if it will not compress, use the second sentence.
- para2: up to 2 sentences — deepens or reframes the hook. Creates tension.
- para3: 2-3 sentences — first insight or evidence. The "here's why" moment.
- para4: 3-4 sentences — the turn. Complication, contradiction, or escalation.
- para5: 3-5 sentences — landing. The consequence or provocation, resolved. Room to breathe. The final sentence of the article (para5's last sentence, or remainder's last sentence if remainder is non-empty) must be a complete, standalone declarative statement that lands an idea beyond today's news. Never end on a question mark. Never write a contrast setup ("The question isn't whether X..." / "Not Y, but...") without completing both halves in the same sentence. This includes negations without a positive completion — "This is not X." with no following clause stating what it IS. Every sentence of this shape must read "This is not X, it's Y" in one sentence, never split across two with the second half left unwritten.
- remainder: everything after paragraph 5, preserved exactly as written. Empty string if nothing remains. Each paragraph in remainder will be capped at 3-5 sentences in post-processing.

Also return:
- header2: 3-5 words. Second sub-headline covering the second half of the argument. Specific, no colons, not generic. Plain text only — no markdown, no # character.
- imageQuery2: 4-6 concrete atmospheric words for a second Unsplash search. No names, no text, no logos. Think: texture, environment, light, emotion.
- pullQuoteAfterPara: 4 or 5 only. Which paragraph the pull quote should follow. Must be after header2 (which appears before para4). Choose 4 if the energy peaks in para4, choose 5 if para5 is the stronger landing.
- pullQuote: 1 sentence lifted verbatim from the shaped body — the single most arresting line. Something a reader would screenshot. Word-for-word identical to what appears in the body.

Body to restructure:
"${body}"

Return JSON only:
{"header2":"...","imageQuery2":"...","pullQuoteAfterPara":4,"pullQuote":"...","para1":"...","para2":"...","para3":"...","para4":"...","para5":"...","remainder":"..."}`,
        }],
      });
      const raw2 = (pass2msg.content[0]?.type === "text" ? pass2msg.content[0].text : undefined) ?? "{}";
      const text2 = raw2.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
      const scaffold = JSON.parse(text2);
      // Sentence budgets are enforced by the Pass 2 PROMPT, not by cutting the prose here.
      // This used to slice each paragraph to a sentence count and discard the rest, which is
      // why articles ended mid-thought: "The real product isn't the plan or the expertise."
      // was para5 truncated, not a cliffhanger. It also contradicted PASS1_SYSTEM, which
      // permits the claim to land in sentence 2 while this cut para1 to one sentence.
      // An overrun is now logged and published intact — a slightly long paragraph is always
      // better than a severed one.
      const limits: Record<string, number> = { para1: 2, para2: 2, para3: 3, para4: 4, para5: 5 };
      const paraKeys = ["para1", "para2", "para3", "para4", "para5"];
      const sentenceCount = (s: string) => {
        const ABBREV2 = /\b(Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|etc|No|Vol|pp)\.|\b[A-Z]\.(?=\s?[A-Z])|(?<=\d)\.(?=\d)/g;
        return (s.replace(ABBREV2, m => m.slice(0, -1) + "\x00").match(/[^.!?]*[.!?]+["']?\s*/g) ?? [s]).length;
      };
      if (scaffold.para1 && scaffold.para2 && scaffold.para3) {
        for (const k of paraKeys) {
          const v = scaffold[k] as string | undefined;
          if (v && sentenceCount(v) > limits[k]) {
            console.log(`[shape] ${k} ran ${sentenceCount(v)} sentences over a budget of ${limits[k]} — kept intact (${story.title})`);
          }
        }
        const shaped = paraKeys
          .filter(k => scaffold[k])
          .map(k => ((scaffold[k] as string | undefined) ?? "").trim())
          .join("\n\n");
        const remainderRaw = (scaffold.remainder as string | undefined)?.trim() ?? "";
        const remainder = remainderRaw
          ? remainderRaw.split(/\n\n+/).map(para => {
              const sentences = para.match(/[^.!?]*[.!?]+["']?\s*/g) ?? [para];
              return sentences.slice(0, 5).join(" ").trim();
            }).join("\n\n")
          : "";
        const assembled = remainder ? `${shaped}\n\n${remainder}` : shaped;
        body = await repairPunctuation(client, assembled);
        body = removeDuplicateSentences(body);
        if (scaffold.pullQuote) extractedPullQuote = scaffold.pullQuote as string;
        if (scaffold.header2) pass1Header2 = scaffold.header2 as string;
        if (scaffold.imageQuery2) pass1ImageQuery2 = scaffold.imageQuery2 as string;
        if (typeof scaffold.pullQuoteAfterPara === "number" && (scaffold.pullQuoteAfterPara === 4 || scaffold.pullQuoteAfterPara === 5)) {
          pullQuoteAfterPara = scaffold.pullQuoteAfterPara as number;
        }
      }
    } catch (e) { console.error(`[pass2] failed for "${story.title}" — ${e instanceof Error ? e.message : String(e)}`); }
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

  // Save to edition-scoped blob
  try {
    await put(blobKey, JSON.stringify(commentary), { access: "public", contentType: "application/json", addRandomSuffix: false, allowOverwrite: true });
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
  pullQuoteAfterPara?: number; // 3 or 4 — which paragraph the pull quote follows (1-based)
  imageUrl?: string;     // hero image
  imageUrl2?: string;    // mid-article image (different query)
  editionKey?: string;
  voiceId?: number;      // 1-7, internal use only
}

export async function getFeatureCreature(editionKey: string, blocked?: Set<string>): Promise<FeatureCreature | null> {
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

  const fcWriterIndex = getFCWriterIndex(editionKey);
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
    const coreClaim = (claimMsg.content[0]?.type === "text" ? claimMsg.content[0].text.trim() : undefined) ?? "";

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
  "imageQuery": "4-6 concrete visual nouns for Unsplash. A real-world scene or object that carries the mood of the article's central argument — NOT the fictional universe name. Dark source = dark moody image. E.g. 'rain slicked city street neon reflection' / 'empty modernist room glass walls solitude' / 'astronaut sunrise orbit earth'."
}`
        }],
      });

    const raw1 = (pass1msg.content[0]?.type === "text" ? pass1msg.content[0].text : undefined) ?? "{}";
    const text1 = raw1.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const pass1 = JSON.parse(text1);

    // Image search priority: (1) source material by name+medium, (2) article-derived mood query
    const mediumLabel: Record<string, string> = { film: "film", tv: "TV series", anime: "anime", novel: "book cover", game: "video game", fantasy: "fantasy art" };
    const sourceQuery = `${FC_UNIVERSE.name} ${mediumLabel[FC_UNIVERSE.medium] ?? ""}`.trim();
    const moodQuery = (pass1.imageQuery as string | undefined)?.trim() || `${FC_UNIVERSE.name} ${FC_ANGLE.key}`;
    // Defence in depth. sourceQuery is the most deterministic query in the system — it is just
    // the universe name plus its medium — so hardcoding page 1 meant that any miss in the image
    // history returned the byte-identical photo. Seeding the page from the edition key means a
    // repeated universe draws from a different slice of results even if dedup fails entirely.
    const fcPage = 1 + Math.floor(mixedRandom(editionKey.split("").reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0)) * 4);
    const imageUrl = await fetchUnsplash(sourceQuery, "Culture", fcPage, undefined, blocked).then(r => r?.url)
      ?? await fetchUnsplash(moodQuery, "Culture", fcPage, undefined, blocked).then(r => r?.url)
      ?? await fetchUnsplash(sourceQuery, "Culture", 1, undefined, blocked).then(r => r?.url);

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

Also return:
- pullQuote: 1 sentence lifted verbatim from the shaped body — the single most arresting line. Something a reader would screenshot. Word-for-word identical to what appears in the body.
- pullQuoteAfterPara: 3 or 4 only — which paragraph the pull quote should follow (1-based). Choose 4 if para4 is the article's most dramatic turn; choose 3 if para3 lands the strongest line.

Body to restructure:
"${pass1.body}"

Return JSON only:
{"pullQuote":"...","pullQuoteAfterPara":4,"para1":"...","para2":"...","para3":"...","para4":"...","para5":"..."}`
      }],
    });

    const raw2 = (scaffoldMsg.content[0]?.type === "text" ? scaffoldMsg.content[0].text : undefined) ?? "{}";
    const text2 = raw2.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const scaffold = JSON.parse(text2);

    // Same change as the article path: the scaffold prompt sets the sentence budgets, and
    // paragraphs that overrun are published intact rather than sliced. The FC limits were
    // tighter still (para1 and para2 capped at one sentence each), so this path was severing
    // thoughts more aggressively than any other in the pipeline.
    const limits: Record<string, number> = { para1: 2, para2: 2, para3: 2, para4: 3, para5: 3 };
    const paraKeys = ["para1", "para2", "para3", "para4", "para5"];
    const fcSentenceCount = (s: string) => {
      const ABBREV = /\b(Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|etc|No|Vol|pp)\./g;
      return (s.replace(ABBREV, m => m.slice(0, -1) + "\x00").match(/[^.!?]*[.!?]+["']?/g) ?? [s]).length;
    };
    if (scaffold.para1 && scaffold.para2 && scaffold.para3) {
      for (const k of paraKeys) {
        const v = scaffold[k] as string | undefined;
        if (v && fcSentenceCount(v) > limits[k]) {
          console.log(`[fc-shape] ${k} ran ${fcSentenceCount(v)} sentences over a budget of ${limits[k]} — kept intact`);
        }
      }
    }
    const body = scaffold.para1 && scaffold.para2 && scaffold.para3
      ? paraKeys
          .filter(k => scaffold[k])
          .map(k => (scaffold[k] as string).trim())
          .join("\n\n")
      : (pass1.body ?? "");
    const fcPullQuote: string = scaffold.pullQuote ?? pass1.pullQuote ?? "";

    const parsed = pass1;

    // Mid-article image: use Claude-generated imageQuery, then vision-review the result
    const imageQuery = parsed.imageQuery as string | undefined;
    let imageUrl2: string | undefined;
    if (imageQuery) {
      const candidate = await fetchUnsplash(imageQuery, "Arts", 2, undefined, blocked);
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
    const fcPullQuoteAfterPara =
      typeof scaffold.pullQuoteAfterPara === "number" &&
      (scaffold.pullQuoteAfterPara === 3 || scaffold.pullQuoteAfterPara === 4)
        ? scaffold.pullQuoteAfterPara
        : 3;

    const result: FeatureCreature = {
      universe: FC_UNIVERSE.name,
      angleLabel: FC_ANGLE.label,
      angleKey: FC_ANGLE.key,
      title: parsed.title ?? `${FC_UNIVERSE.name}: ${FC_ANGLE.label}`,
      synopsis: parsed.synopsis ?? "",
      headers: [parsed.headers?.[0] ?? "", parsed.headers?.[1] ?? ""],
      ctaHeader: parsed.ctaHeader ?? undefined,
      body,
      pullQuote: fcPullQuote || undefined,
      pullQuoteAfterPara: fcPullQuoteAfterPara,
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

  // Blob list is the authoritative source of which editions exist — paginate to get all
  const blobs: { pathname: string }[] = [];
  let cursor: string | undefined;
  do {
    const res = await list({ prefix: "archive/editions/", limit: 1000, cursor });
    blobs.push(...res.blobs);
    cursor = res.cursor;
  } while (cursor);
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
    const data = await res.json() as PageData;
    // Strip failed stories (no summary) from old blobs — these are generation placeholders
    data.stories = data.stories.filter(s => s.summary);
    return data;
  } catch { return null; }
}

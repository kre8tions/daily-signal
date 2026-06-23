import Parser from "rss-parser";
import { RawArticle, GoogleTrend } from "@/types";
import { cacheGet, cacheSet } from "./cache";

const parser = new Parser({
  customFields: { item: ["media:content", "media:thumbnail", "enclosure"] },
});

// CDN domains known to watermark images — skip these
const WATERMARKED_DOMAINS = ["ichef.bbci.co.uk", "media.guim.co.uk"];

function extractImage(item: Record<string, unknown>): string | undefined {
  const candidates: string[] = [];
  const mc = item["media:content"] as Record<string, unknown> | undefined;
  if (mc?.url) candidates.push(mc.url as string);
  const mt = item["media:thumbnail"] as Record<string, unknown> | undefined;
  if (mt?.url) candidates.push(mt.url as string);
  const enc = item["enclosure"] as Record<string, unknown> | undefined;
  if (enc?.url && (enc.type as string)?.startsWith("image/")) candidates.push(enc.url as string);
  return candidates.find((u) => !WATERMARKED_DOMAINS.some((d) => u.includes(d)));
}

const RSS_FEEDS: { url: string; source: string; section: string }[] = [
  // World
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC", section: "World" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", source: "NY Times", section: "World" },
  { url: "https://www.theguardian.com/world/rss", source: "Guardian", section: "World" },
  { url: "https://feeds.npr.org/1001/rss.xml", source: "NPR", section: "World" },
  // Politics
  { url: "https://feeds.bbci.co.uk/news/politics/rss.xml", source: "BBC", section: "Politics" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml", source: "NY Times", section: "Politics" },
  { url: "https://www.theguardian.com/us-news/rss", source: "Guardian", section: "Politics" },
  { url: "https://feeds.npr.org/1014/rss.xml", source: "NPR", section: "Politics" },
  // Technology
  { url: "https://feeds.bbci.co.uk/news/technology/rss.xml", source: "BBC", section: "Technology" },
  { url: "https://www.theverge.com/rss/index.xml", source: "The Verge", section: "Technology" },
  { url: "https://feeds.arstechnica.com/arstechnica/index", source: "Ars Technica", section: "Technology" },
  { url: "https://www.wired.com/feed/rss", source: "Wired", section: "Technology" },
  // Markets
  { url: "https://feeds.bbci.co.uk/news/business/rss.xml", source: "BBC", section: "Markets" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/Business.xml", source: "NY Times", section: "Markets" },
  { url: "https://www.theguardian.com/business/rss", source: "Guardian", section: "Markets" },
  // Science
  { url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", source: "BBC", section: "Science" },
  { url: "https://feeds.npr.org/1019/rss.xml", source: "NPR", section: "Science" },
  { url: "https://www.theguardian.com/science/rss", source: "Guardian", section: "Science" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml", source: "NY Times", section: "Science" },
  // Climate
  { url: "https://www.theguardian.com/environment/rss", source: "Guardian", section: "Climate" },
  // Culture
  { url: "https://www.theguardian.com/culture/rss", source: "Guardian", section: "Culture" },
  { url: "https://www.theguardian.com/film/rss", source: "Guardian", section: "Culture" },
  { url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml", source: "BBC", section: "Culture" },
  { url: "https://variety.com/feed/", source: "Variety", section: "Entertainment" },
  { url: "https://deadline.com/feed/", source: "Deadline", section: "Entertainment" },
  // Sports
  { url: "https://feeds.bbci.co.uk/sport/rss.xml", source: "BBC Sport", section: "Sports" },
  { url: "https://www.theguardian.com/sport/rss", source: "Guardian", section: "Sports" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/Sports.xml", source: "NY Times", section: "Sports" },
  // Arts
  { url: "https://www.theguardian.com/artanddesign/rss", source: "Guardian", section: "Arts" },
  { url: "https://hyperallergic.com/feed/", source: "Hyperallergic", section: "Arts" },
];

async function fetchFeed(feed: typeof RSS_FEEDS[0]): Promise<RawArticle[]> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("timeout")), 8000)
  );
  const parsed = await Promise.race([parser.parseURL(feed.url), timeout]);
  return parsed.items.slice(0, 5).map((item): RawArticle => ({
    title: item.title ?? "",
    link: item.link ?? "",
    pubDate: item.pubDate ?? new Date().toISOString(),
    source: feed.source,
    section: feed.section,
    content: item.contentSnippet || item.content || "",
    imageUrl: extractImage(item as unknown as Record<string, unknown>),
  }));
}

function dedup(articles: RawArticle[]): RawArticle[] {
  const seen: string[] = [];
  return articles.filter((a) => {
    const key = a.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").slice(0, 60);
    const dupe = seen.some((s) => jaccardSim(s, key) > 0.8);
    if (!dupe) seen.push(key);
    return !dupe;
  });
}

function jaccardSim(a: string, b: string): number {
  const sa = new Set(a.split(" "));
  const sb = new Set(b.split(" "));
  const inter = [...sa].filter((w) => sb.has(w)).length;
  return inter / new Set([...sa, ...sb]).size;
}

export async function fetchRawArticles(): Promise<RawArticle[]> {
  const cached = cacheGet<RawArticle[]>("raw_articles");
  if (cached) return cached;

  const results = await Promise.allSettled(RSS_FEEDS.map(fetchFeed));
  const articles: RawArticle[] = [];
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "fulfilled") {
      articles.push(...(results[i] as PromiseFulfilledResult<RawArticle[]>).value);
    } else {
      const r = results[i] as PromiseRejectedResult;
      console.warn(`[news] Feed failed: ${RSS_FEEDS[i].source} — ${r.reason}`);
    }
  }

  const deduped = dedup(articles);
  console.log("[news] Sources:", Object.entries(
    deduped.reduce<Record<string, number>>((a, r) => { a[r.source] = (a[r.source] ?? 0) + 1; return a; }, {})
  ).map(([k, v]) => `${k}:${v}`).join(" "), "total:", deduped.length);

  cacheSet("raw_articles", deduped, 30 * 60 * 1000);
  return deduped;
}

export async function fetchGoogleTrends(): Promise<GoogleTrend[]> {
  const cached = cacheGet<GoogleTrend[]>("google_trends");
  if (cached) return cached;
  try {
    const feed = await Promise.race([
      parser.parseURL("https://trends.google.com/trends/trendingsearches/daily/rss?geo=US"),
      new Promise<never>((_, r) => setTimeout(() => r(new Error("timeout")), 8000)),
    ]);
    const trends: GoogleTrend[] = feed.items.slice(0, 10).map((item, i) => {
      const ex = item as unknown as Record<string, unknown>;
      return {
        rank: i + 1,
        title: item.title ?? "",
        traffic: (ex["ht:approx_traffic"] as string) ?? "",
        relatedArticle: (ex["ht:news_item_title"] as string) ?? item.contentSnippet ?? "",
        link: item.link ?? "",
      };
    });
    cacheSet("google_trends", trends, 30 * 60 * 1000);
    return trends;
  } catch { return []; }
}

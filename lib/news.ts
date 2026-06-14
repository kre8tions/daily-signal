// Free RSS-based news fetching — zero cost.
// NewsAPI key is optional for broader coverage.
import Parser from "rss-parser";
import { RawArticle } from "@/types";
import { cacheGet, cacheSet } from "./cache";

const parser = new Parser({
  customFields: { item: ["media:content", "media:thumbnail", "enclosure"] },
});

// Free, high-quality RSS feeds — no API key needed
const RSS_FEEDS: { url: string; source: string; section: string }[] = [
  { url: "https://feeds.reuters.com/reuters/topNews", source: "Reuters", section: "World" },
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC", section: "World" },
  { url: "https://feeds.bbci.co.uk/news/technology/rss.xml", source: "BBC", section: "Technology" },
  { url: "https://feeds.bbci.co.uk/news/business/rss.xml", source: "BBC", section: "Markets" },
  { url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", source: "BBC", section: "Science" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml", source: "NYT", section: "Politics" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/Technology.xml", source: "NYT", section: "Technology" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/Climate.xml", source: "NYT", section: "Climate" },
  { url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml", source: "WSJ", section: "Markets" },
  { url: "https://hnrss.org/frontpage", source: "HackerNews", section: "Technology" },
];

const CACHE_KEY = "raw_articles";
const FEED_CACHE_TTL = 30 * 60 * 1000; // 30 min — RSS rarely updates faster

export async function fetchRawArticles(): Promise<RawArticle[]> {
  const cached = cacheGet<RawArticle[]>(CACHE_KEY);
  if (cached) return cached;

  const results = await Promise.allSettled(
    RSS_FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return parsed.items.slice(0, 8).map((item): RawArticle => ({
        title: item.title ?? "",
        link: item.link ?? "",
        pubDate: item.pubDate ?? new Date().toISOString(),
        source: feed.source,
        content: item.contentSnippet ?? item.content ?? "",
        imageUrl: extractImage(item),
      }));
    })
  );

  const articles: RawArticle[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") articles.push(...result.value);
  }

  // Deduplicate by similar title (simple overlap check)
  const deduped = deduplicateByTitle(articles);
  cacheSet(CACHE_KEY, deduped, FEED_CACHE_TTL);
  return deduped;
}

function extractImage(item: Record<string, unknown>): string | undefined {
  const mc = item["media:content"] as Record<string, unknown> | undefined;
  if (mc?.url) return mc.url as string;
  const mt = item["media:thumbnail"] as Record<string, unknown> | undefined;
  if (mt?.url) return mt.url as string;
  const enc = item["enclosure"] as Record<string, unknown> | undefined;
  if (enc?.url && (enc.type as string)?.startsWith("image/")) return enc.url as string;
  return undefined;
}

function deduplicateByTitle(articles: RawArticle[]): RawArticle[] {
  const seen: string[] = [];
  return articles.filter((a) => {
    const normalized = a.title.toLowerCase().replace(/[^a-z0-9 ]/g, "").slice(0, 60);
    const isDupe = seen.some((s) => similarity(s, normalized) > 0.7);
    if (!isDupe) seen.push(normalized);
    return !isDupe;
  });
}

// Jaccard word overlap — cheap similarity check, no ML needed
function similarity(a: string, b: string): number {
  const setA = new Set(a.split(" "));
  const setB = new Set(b.split(" "));
  const intersection = [...setA].filter((w) => setB.has(w)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}

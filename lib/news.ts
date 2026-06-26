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
  // Technology — emerging tech, innovation, futurism
  { url: "https://www.theverge.com/rss/index.xml",                          source: "The Verge",          section: "Technology" },
  { url: "https://feeds.arstechnica.com/arstechnica/index",                 source: "Ars Technica",       section: "Technology" },
  { url: "https://www.wired.com/feed/rss",                                  source: "Wired",              section: "Technology" },
  { url: "https://techcrunch.com/feed/",                                    source: "TechCrunch",         section: "Technology" },
  { url: "https://www.technologyreview.com/feed/",                          source: "MIT Tech Review",    section: "Technology" },
  { url: "https://singularityhub.com/feed/",                                source: "Singularity Hub",    section: "Technology" },
  { url: "https://www.fastcompany.com/technology/rss",                      source: "Fast Company",       section: "Technology" },
  // Science — pop science, discovery, wonder
  { url: "https://nautil.us/feed/",                                         source: "Nautilus",           section: "Science" },
  { url: "https://www.quantamagazine.org/feed/",                            source: "Quanta Magazine",    section: "Science" },
  { url: "https://www.popsci.com/feed/",                                    source: "Popular Science",    section: "Science" },
  { url: "https://www.wired.com/feed/category/science/latest/rss",          source: "Wired Science",      section: "Science" },
  { url: "https://feeds.npr.org/1019/rss.xml",                              source: "NPR Science",        section: "Science" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/Science.xml",        source: "NY Times Science",   section: "Science" },
  // Culture — ideas, society, creative thinking
  { url: "https://www.theguardian.com/culture/rss",                         source: "Guardian",           section: "Culture" },
  { url: "https://feeds.bbci.co.uk/news/entertainment_and_arts/rss.xml",    source: "BBC",                section: "Culture" },
  { url: "https://www.fastcompany.com/co-design/rss",                       source: "Fast Company Design",section: "Culture" },
  // Film — cinema, storytelling, directors
  { url: "https://www.indiewire.com/feed/",                                 source: "IndieWire",          section: "Film" },
  { url: "https://www.theguardian.com/film/rss",                            source: "Guardian Film",      section: "Film" },
  { url: "https://www.rogerebert.com/feed",                                 source: "RogerEbert.com",     section: "Film" },
  // Entertainment — music, TV, pop culture
  { url: "https://variety.com/feed/",                                       source: "Variety",            section: "Entertainment" },
  { url: "https://deadline.com/feed/",                                      source: "Deadline",           section: "Entertainment" },
  { url: "https://www.avclub.com/rss",                                      source: "A.V. Club",          section: "Entertainment" },
  { url: "https://pitchfork.com/rss/news/",                                 source: "Pitchfork",          section: "Entertainment" },
  // Arts — visual art, design, creativity
  { url: "https://www.theguardian.com/artanddesign/rss",                    source: "Guardian",           section: "Arts" },
  { url: "https://hyperallergic.com/feed/",                                 source: "Hyperallergic",      section: "Arts" },
  { url: "https://www.dezeen.com/feed/",                                    source: "Dezeen",             section: "Arts" },
  { url: "https://www.thisiscolossal.com/feed/",                            source: "Colossal",           section: "Arts" },
  { url: "https://news.artnet.com/feed/",                                   source: "Artnet News",        section: "Arts" },
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

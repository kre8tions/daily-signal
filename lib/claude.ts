// Cost-conscious Claude usage:
// - Model: haiku-4-5 (cheapest, fast, great for summarization)
// - Batch: summarize ALL articles in ONE API call (not one call per article)
// - Cache: results cached 30min — Claude is never called twice for same content
import Anthropic from "@anthropic-ai/sdk";
import { RawArticle, Story, TrendItem } from "@/types";
import { cacheGet, cacheSet } from "./cache";

// Deterministic ID from URL — stable across server restarts so /article/[id] never 404s
function stableId(url: string): string {
  let h = 0;
  for (const c of url) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return `s${Math.abs(h).toString(36)}`;
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
// Haiku 4.5: $0.80/M input, $4/M output — ~100x cheaper than Opus
const MODEL = "claude-haiku-4-5-20251001";

const STORIES_CACHE_KEY = "processed_stories";
const TRENDS_CACHE_KEY = "trends";

export async function processArticles(articles: RawArticle[]): Promise<Story[]> {
  const cached = cacheGet<Story[]>(STORIES_CACHE_KEY);
  if (cached) return cached;

  // Single batch call — summarize up to 40 articles at once
  const batch = articles.slice(0, 40);
  const articleList = batch
    .map((a, i) => `[${i}] SOURCE:${a.source} TITLE:${a.title} CONTENT:${(a.content ?? "").slice(0, 400)}`)
    .join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 6000,
    messages: [
      {
        role: "user",
        content: `You are an editor for a premium news app. For each article, write a 1-2 sentence summary. If no content is provided, infer from the title alone — never leave summary empty.

ARTICLES:
${articleList}

Return a JSON array where each element has:
- index: number (matching [N] above)
- summary: string (1-2 sentences, always non-empty, factual)
- sentiment: "positive" | "negative" | "neutral" | "divided"
- isHero: boolean (true for the single most globally significant story only)

Return ONLY the JSON array, no markdown, no explanation.`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "[]";
  let enriched: { index: number; summary: string; sentiment: Story["sentiment"]; isHero: boolean }[] = [];
  try {
    enriched = JSON.parse(text);
  } catch {
    enriched = batch.map((_, i) => ({
      index: i, summary: "", sentiment: "neutral" as const, isHero: i === 0,
    }));
  }

  const stories: Story[] = batch.map((article, i) => {
    const meta = enriched.find((e) => e.index === i) ?? {
      summary: "", sentiment: "neutral" as const, isHero: false,
    };
    return {
      id: stableId(article.link),
      title: article.title,
      source: article.source,
      sources: [article.source],
      pubDate: article.pubDate,
      link: article.link,
      imageUrl: article.imageUrl,
      aiSummary: meta.summary,
      sentiment: meta.sentiment,
      section: article.section,   // use section from RSS feed, not Claude
      isHero: meta.isHero,
    };
  });

  cacheSet(STORIES_CACHE_KEY, stories);
  return stories;
}

export async function generateTrends(stories: Story[]): Promise<TrendItem[]> {
  const cached = cacheGet<TrendItem[]>(TRENDS_CACHE_KEY);
  if (cached) return cached;

  const titles = stories.map((s) => s.title).join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [
      {
        role: "user",
        content: `Based on these news headlines, identify 5 trending topics. For each, give a direction and short label.

HEADLINES:
${titles}

Return a JSON array of 5 items, each with:
- topic: string (2-4 word topic name)
- direction: "up" | "down" | "hot"
- changeLabel: string (e.g. "↑ surging today" or "🔥 breaking")
- reason: string (one sentence why it's trending)

Return ONLY the JSON array.`,
      },
    ],
  });

  const text = response.content[0].type === "text" ? response.content[0].text : "[]";
  let trends: TrendItem[] = [];
  try {
    trends = JSON.parse(text);
  } catch {
    trends = [];
  }

  cacheSet(TRENDS_CACHE_KEY, trends);
  return trends;
}

import { NextResponse } from "next/server";
import { fetchRawArticles, fetchGoogleTrends } from "@/lib/news";
import { processArticles, generateTrends } from "@/lib/claude";
import { Edition } from "@/types";

// ISR-style: Next.js caches this route response for 30 min server-side.
// Combined with our file cache, Claude is called at most once per 30 min
// across ALL visitors — not once per request.
export const revalidate = 1800;

export async function GET() {
  try {
    const [rawArticles, googleTrends] = await Promise.all([
      fetchRawArticles(),
      fetchGoogleTrends(),
    ]);

    // Log source breakdown so we can see what's actually feeding in
    const sourceCounts = rawArticles.reduce<Record<string, number>>((acc, a) => {
      acc[a.source] = (acc[a.source] ?? 0) + 1;
      return acc;
    }, {});
    console.log("[news] Article sources:", sourceCounts, "total:", rawArticles.length);

    const stories = await processArticles(rawArticles);
    const trends = await generateTrends(stories);

    const hero = stories.find((s) => s.isHero) ?? stories[0];
    const topStories = stories.filter((s) => s !== hero).slice(0, 3);

    const sections: Record<string, typeof stories> = {};
    for (const story of stories.filter((s) => s !== hero && !topStories.includes(s))) {
      if (!sections[story.section]) sections[story.section] = [];
      if (sections[story.section].length < 3) sections[story.section].push(story);
    }

    const now = new Date();
    const cachedUntil = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

    const edition: Edition = {
      date: now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
      generatedAt: now.toISOString(),
      hero,
      topStories,
      sections,
      trends,
      googleTrends,
      cachedUntil,
    };

    return NextResponse.json(edition);
  } catch (err) {
    console.error("Edition build error:", err);
    return NextResponse.json({ error: "Failed to build edition" }, { status: 500 });
  }
}

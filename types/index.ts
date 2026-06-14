export interface RawArticle {
  title: string;
  link: string;
  pubDate: string;
  source: string;
  content?: string;
  imageUrl?: string;
}

export interface Story {
  id: string;
  title: string;
  source: string;
  sources: string[];       // all sources covering this story (for dedup display)
  pubDate: string;
  link: string;
  imageUrl?: string;
  aiSummary: string;       // 2-3 sentence Claude summary
  sentiment: "positive" | "negative" | "neutral" | "divided";
  section: string;         // Politics, Technology, Markets, Science, Climate, World
  isHero?: boolean;
}

export interface TrendItem {
  topic: string;
  direction: "up" | "down" | "hot";
  changeLabel: string;     // e.g. "↑ 340% this week"
  reason: string;          // one-line AI explanation
}

export interface Edition {
  date: string;
  generatedAt: string;
  hero: Story;
  topStories: Story[];     // 2-3 sidebar stories
  sections: Record<string, Story[]>;   // keyed by section name
  trends: TrendItem[];
  cachedUntil: string;
}

---
name: ""
metadata: 
  node_type: memory
  originSessionId: 1dd5e618-afa4-4a95-a8c5-0a46d7e8b1de
---

# The Daily Signal — Project

Standalone project at `C:\dev\daily-signal`. Tech/entertainment/culture news aggregator.

**Why:** AI-enhanced news aggregation site with bento grid layout — dark theme, color images from Unsplash, Claude Haiku summaries + insights + takeaways.

## Stack
- **Frontend:** Next.js 15 App Router, server components only (no client state)
- **AI:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) — batch summarizes 3 stories in one call
- **Images:** Unsplash API (`UNSPLASH_ACCESS_KEY` in `.env.local`) — keyword search from headline
- **News:** RSS feeds via `rss-parser` — The Verge, Ars Technica, Wired, Deadline, Variety, Guardian Culture/Science, Hyperallergic
- **Cache:** File-based in OS temp dir (`lib/cache.ts`) — `cacheClearAll()` nukes everything
- **Cache bust:** GET `/api/revalidate`

## Architecture (current, simplified)
`app/page.tsx` does everything inline — no separate API route needed for the 3-story view:
1. Fetches top 3 stories from RSS feeds in parallel
2. Calls Claude once to batch-analyze all 3 (summary + insights + takeaways)
3. Fetches Unsplash images for all 3 in parallel
4. Renders bento grid server-side

## Layout (bento grid, dark theme)
```
[Hero text card — spans 2 rows] [Hero image card — full color photo]
                                 [Story 2 headline bar]
[Story 2 image card]             [Story 3 text + colored insight card]
──────────────────────────────────────────────────────────
[Story 1 takeaways]  [Story 2 takeaways]  [Story 3 takeaways]
```

## Design tokens
- Page bg: `#111113`
- Card bg: `#1c1c1e` (Apple dark mode grey — elevated from bg)
- No borders on cards
- Border radius: 20px
- Section accent colors: Tech=#3b82f6, Entertainment=#ec4899, Culture=#a78bfa, Science=#34d399, Arts=#fbbf24
- Images: full opacity, `linear-gradient(to top, rgba(0,0,0,0.85), transparent)` overlay
- Text: white headlines, `#888` body, `#444` meta

## Key Files
```
app/page.tsx          — entire app (feeds + Claude + Unsplash + render)
app/layout.tsx        — ClientBody for suppressHydrationWarning
app/ClientBody.tsx    — "use client" body wrapper
app/globals.css       — base CSS (dark body bg)
app/api/revalidate/   — cache bust endpoint
lib/cache.ts          — file-based TTL cache with cacheClearAll()
lib/news.ts           — RSS fetching + Google Trends (not used in current simple view)
lib/claude.ts         — batch summarization (not used in current simple view)
.env.local            — ANTHROPIC_API_KEY + UNSPLASH_ACCESS_KEY
```

## Env vars needed
```
ANTHROPIC_API_KEY=sk-ant-...
UNSPLASH_ACCESS_KEY=E3hwonWnj8_...   ← already set
```

## To Run
```powershell
cd C:\dev\daily-signal
npm run dev   # → http://localhost:3000
```

## Current State (2026-06-20)
- 3-story bento grid working
- Dark theme with `#1c1c1e` grey cards, white text
- Unsplash color images loading correctly
- Claude summaries + insights + takeaways working
- JSON parse fixed (strips ```json fences)
- Hydration warning fixed (ClientBody.tsx)

## Next Steps (pick up here)
1. Expand to more stories — add row 2 of bento with stories 4-6
2. Add section filtering nav (click Technology → filter to tech stories)
3. Add article detail page `/article/[id]` with full insights layout
4. Add caching so Claude isn't called on every reload
5. Consider deploying to Vercel

## How to apply
When user returns, load this file. The simplified `app/page.tsx` is the source of truth — ignore the older `lib/news.ts` and `lib/claude.ts` complexity for now. Pick up from "Next Steps."

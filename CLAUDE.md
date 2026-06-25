# The Daily Signal — CLAUDE.md

## Project
AI-enhanced news aggregator. Dark bento-grid layout. Live at https://daily-signal-omega.vercel.app/

## Stack
- **Framework:** Next.js 15 App Router — server components only
- **AI:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) — batch summarizes 9 stories + synthesis in one call
- **Images:** Unsplash API (`UNSPLASH_ACCESS_KEY`) — OG scrape first, Unsplash fallback
- **News:** RSS feeds via `rss-parser` — The Verge, Wired, Ars Technica, NYT, Deadline, Variety, Guardian, Pitchfork, etc.
- **Cache:** File-based TTL cache in OS temp dir (`lib/cache.ts`) + Next.js `unstable_cache` keyed by edition
- **Deploy:** Vercel, watching `main` branch on GitHub

## Git
- Active branch: `main` (Vercel watches this)
- Push command from Claude: `/mingw64/bin/git -C /c/dev/daily-signal push origin main`

## Architecture
- `app/page.tsx` — entire homepage: feeds + Claude + Unsplash + render + nav pills
- `lib/stories.ts` — RSS fetch, dedup, Claude batch analysis, caching, archive
- `lib/palette.ts` — design tokens (5 daily-rotating palettes), SECTION_COLORS, TAGLINE, TAGLINE_FONT, contrastColor()
- `lib/cache.ts` — file-based TTL cache with cacheClearAll()
- `app/article/[slug]/page.tsx` — article detail with Claude editorial commentary
- `app/archive/page.tsx` — past editions grid with hero images
- `app/api/revalidate/route.ts` — GET to bust all cache

## Edition System
5 editions/day (~4hrs each): early, morning, afternoon, evening, night. Cache keyed by edition so Claude is called once per edition window, not per request.

## Design
- Daily-rotating palette from `PALETTES[]` in `lib/palette.ts`
- Dark theme default. Accent color varies by palette.
- Bento grid: 3-story hero (s1 text+image, s2 pullquote, s3 brief) + 6-card row 2
- "The Signal" synthesis card with sketchy SVG border (feTurbulence filter)
- Animated SVG space invader icon — wiggle/float/pulse rotates per edition
- `contrastColor()` utility ensures readable text on accent-colored buttons

## Editorial Voice
Claude prompts are tuned for **centrist, non-ideological** editorial voice:
- Challenges assumptions from all sides equally
- No virtue signaling, no ideological framing
- Focus on practical impact, not social commentary
- Skeptical of corporate power, government overreach, activist excess, and reactionary nostalgia

## Env Vars
```
ANTHROPIC_API_KEY=sk-ant-...
UNSPLASH_ACCESS_KEY=...
```
Set in `.env.local` locally and in Vercel dashboard for production.

## Cache Bust
Visit `/api/revalidate` to clear all cached data and force a fresh Claude call.

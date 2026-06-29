# The Daily Signal — Claude Context

Live: https://daily-signal-omega.vercel.app/ (custom domain pending)
GitHub: github.com/kre8tions/daily-signal (main branch)
Local: C:\dev\daily-signal

## Stack
Next.js 15 App Router (server components, no client except EditionCountdown/EmailCapture), Claude Haiku 4.5 (`claude-haiku-4-5-20251001`), Unsplash API, Vercel Blob, rss-parser, Vercel Pro.

## Env Vars (set in Vercel dashboard)
- `ANTHROPIC_API_KEY`
- `UNSPLASH_ACCESS_KEY`
- `BLOB_READ_WRITE_TOKEN` — auto-injected by Vercel
- `CRON_SECRET` — protects all API endpoints

## Editions
5/day (~4h each): early, morning, afternoon, evening, night.
Key format: `2026-06-29_morning`
**Build clock: UTC+14** — cron fires 16 min before each UTC+14 boundary.
**Publish clock: visitor's local timezone** via `x-vercel-ip-timezone` header.
UTC cron schedule: `44 2,6,14,18,22 * * *`

Edition labels: early="First Light", morning="The Brief", afternoon="Midday", evening="The Digest", night="Night Dispatch"

## Generation Flow
- **`buildPageData`** is the ONLY generation entrypoint
- **`getPageData` is READ-ONLY** — only reads blobs, never generates. No `unstable_cache`.
- **User visits never trigger generation**
- `/api/pre-warm` fires 16 min before each UTC+14 boundary via Vercel cron
- `/api/warm` is manual/fallback — calls `buildPageData` directly
- All endpoints require `?secret=CRON_SECRET`
- `getNextEdition()` looks 16 min ahead in UTC+14 time
- All `put()` calls MUST include `allowOverwrite: true`

## Article Generation Pipeline
- **Pass 0**: `analyzeSource()` — detects genre, source position, tension, missed angle
- **Pass 0.5**: `selectMode()` — writer picks one of 12 engagement modes from Pass 0 analysis
- **Pass 1**: Full article with editorial brief (genre instruction + mode)
- **Pass 2**: Scaffold restructure into 5-paragraph cadence
- **`PROMPT_V = "v22"`** — bump when prompt changes to invalidate cached articles

12 modes: The Reframe, The Extension, The Complication, The Rebuttal, The Zoom Out, The Zoom In, The Unstated Assumption, The Beneficiary Question, The Historical Echo, The Paradox, The Missing Voice, The So What.

## Blob Cache Keys
| Key | Content |
|-----|---------|
| `articles/{editionKey}/{slug}.json` | ArticleCommentary (edition-scoped, no version prefix) |
| `articles/by-slug/{slug}.json` | ArticleCommentary (global reuse — checked first) |
| `articles/v18-v22/{editionKey}/{slug}.json` | Legacy versioned blobs (read fallback only) |
| `feature-creature/v20/{editionKey}.json` | FeatureCreature JSON |
| `synthesis/v1/{editionKey}.json` | Synthesis JSON (includes `imageUrl`) |
| `archive/editions/{key}.json` | Full PageData for edition |
| `archive/index.json` | ArchiveEntry[] list (max 90) |

**Bump `PROMPT_V`** in `getFullArticle` when changing prompts to invalidate cached articles.

## Unsplash / Image System
- All images from Unsplash only (no RSS/OG scraping)
- `fetchUnsplash()` returns `{ url: string; color?: string } | undefined`
- `photo.color` = Unsplash dominant hex, zero extra API cost
- `Story.imageColor` stores dominant color for overlay use
- FC imageQuery: match mood/tone of source (dark source = dark moody image)
- Named cultural works (TV shows, films) → query targets the work, not the literal subject noun

## Layout (EditionView.tsx)
```
Row 1:   [S1 text col 1-5]  [S1 image + S1FlightPaths col 6-13]
Row 2-3: [FC card col 1-6]  [S2 top col 7-13 row 2] [S2 quote col 7-13 row 3]
Below:   Synthesis card → S3-S11 3-column grid
```

### S1FlightPaths (S1 image overlay)
- Catmull-Rom spline through 5-7 random waypoints, tension=0.35
- Plane (42px) offset 48px **before** path start, facing departure direction (+90° SVG offset)
- Bold SVG X (20px, strokeWidth=5.5) at path **end**
- Dots: `strokeDasharray="4 9"`, strokeWidth=2.5, seeded per edition
- **Color**: `contrastColor(s1.imageColor)` if present, else `P.accent`

### FC Card
- Inverted colors: `P.ink` background, `P.pageBg` text
- `FlightPathBorder` uses FC angle color (teal/blue/pink), seeded per edition
- Pin: 14×19px, tip on center line via `translate(-50%, calc(-100% + 2.5px))`
- Plane: 42px, angle uses **+90° offset**

### Synthesis Card
- Observation section: circular Unsplash image (200px), `position: absolute, top: 20, right: 80`
- Text has `paddingRight: 252` to avoid overlap
- Sketchy SVG circle border (feTurbulence filter)

### Nav
- No Archive button, no Today pill on homepage, no Home button in archive nav
- Previous/Next pills: labeled "Previous Edition" / "Next Edition", same style as More pill, no arrows

## Palettes (lib/palette.ts)
5 palettes, rotate every 4h: `Math.floor(Date.now() / 14_400_000) % PALETTES.length`
`contrastColor(hex)` — WCAG luminance formula, returns black or white for max contrast.

## Dedup Rules
- `loadUsedLinks` walks back 150 editions (~30 days) — hard filter, NO fallback to used links
- Global slug cache (`by-slug/`) — reuse generated content if link recurs

## Writer Personas (7 writers, seeded per edition)
Rex (Hitchens), Eric (Orwell), Margot (Didion), Finn (M. Lewis), Cal (Gladwell), Jack (O'Rourke), Ward (Tom Wolfe)

## Key Files
| File | Purpose |
|------|---------|
| `app/page.tsx` | Homepage — reads `x-vercel-ip-timezone`, calls `getEditionForTimezone` |
| `components/EditionView.tsx` | Bento grid, all visual components incl. FlightPathBorder, S1FlightPaths |
| `app/EditionCountdown.tsx` | Client countdown, UTC boundaries `[3,7,15,19,23]` |
| `app/article/[slug]/page.tsx` | Article detail |
| `app/feature-creature/[slug]/page.tsx` | FC page |
| `lib/stories.ts` | All data + generation logic |
| `lib/palette.ts` | Design tokens, 5 rotating palettes, `contrastColor()` |
| `app/api/pre-warm/route.ts` | Primary cron entrypoint |
| `app/api/warm/route.ts` | Manual regen entrypoint |
| `vercel.json` | Cron schedule |

## Deployment
Vercel auto-deploys on push to `main`. Check Vercel dashboard for build errors.

## Open Items
- Custom domain (still on daily-signal-omega.vercel.app)
- Share button on articles
- Mobile layout tweaks
- Monitor Anthropic API spend limit

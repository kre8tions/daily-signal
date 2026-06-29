# The Daily Signal — Claude Context

Live: https://daily-signal-omega.vercel.app/ (custom domain pending)
GitHub: github.com/kre8tions/daily-signal (main branch)
Local: C:\dev\daily-signal

## Stack
Next.js 15 App Router (server components, no client except EmailCapture), Claude Haiku 4.5 (`claude-haiku-4-5-20251001`), Unsplash API, Vercel Blob, rss-parser, Vercel Pro.

## Env Vars (set in Vercel dashboard)
- `ANTHROPIC_API_KEY`
- `UNSPLASH_ACCESS_KEY`
- `BLOB_READ_WRITE_TOKEN` — auto-injected by Vercel
- `CRON_SECRET` — protects all API endpoints

## Editions
5/day (~4h each): early, morning, afternoon, evening, night.
Key format: `2026-06-28_morning`
UTC boundaries: Early 5–9, Morning 9–13, Afternoon 13–17, Evening 17–21, Night 21–5.

## Generation Flow
- **`buildPageData`** is the ONLY generation entrypoint
- **`getPageData` is READ-ONLY** — only reads blobs/cache, never generates
- **User visits never trigger generation**
- `/api/pre-warm` fires 16 min before each boundary via Vercel native cron (`44 4,8,12,16,20 * * *`) + cron-job.org backup
- `/api/warm` is manual/fallback — calls `buildPageData` directly
- All endpoints require `?secret=CRON_SECRET`
- `getNextEdition()` uses `getUTCHours()` (not local time)
- All `put()` calls MUST include `allowOverwrite: true`

## Blob Cache Keys
| Key | Content |
|-----|---------|
| `articles/v19/{editionKey}/{slug}.json` | ArticleCommentary (edition-scoped) |
| `articles/v19/by-slug/{slug}.json` | ArticleCommentary (global reuse — checked first) |
| `feature-creature/v20/{editionKey}.json` | FeatureCreature JSON |
| `synthesis/v1/{editionKey}.json` | Synthesis JSON (includes `imageUrl`) |
| `archive/editions/{key}.json` | Full PageData for edition |
| `archive/index.json` | ArchiveEntry[] list (max 90) |

**Bump `PROMPT_V`** in `getFullArticle` when changing prompts to invalidate cached articles.

## Dedup Rules
- `loadUsedLinks` walks back 150 editions (~30 days) — hard filter, NO fallback to used links
- Global slug cache (`by-slug/`) — if a link recurs, reuse previously generated content (no Claude/Unsplash call)

## Layout (EditionView.tsx)
```
Row 1:   [S1 text col 1-5]  [S1 image + S1FlightPaths col 6-13]
Row 2-3: [FC card col 1-6]  [S2 top col 7-13 row 2] [S2 quote col 7-13 row 3]
Below:   Synthesis card → S3-S11 3-column grid
```

### FC Card
- **Inverted colors**: `P.ink` background, `P.pageBg` text
- `FlightPathBorder` uses FC angle color (teal/blue/pink), seeded per edition
- 50-95% closure, random start position
- Pin: 14×19px, tip aligned to center line via `translate(-50%, calc(-100% + 2.5px))`
- Plane: 42px, angle uses **+90° offset** (SVG nose points up at 0°)
- Dots: 5×5px HTML divs at DOT_SPACING=26, gap=DOT_SPACING×1.8 before plane

### S1 Flight Path Overlay (S1FlightPaths component)
- Catmull-Rom spline through 5-7 random waypoints, tension=0.35
- Plane (42px) offset 48px **before** path start, facing departure direction
- Bold SVG X (20px, two lines strokeWidth=5.5 round caps) at path **end**
- Line: `strokeDasharray="4 9"`, strokeWidth=2.5, no animation, seeded per edition
- Angle formula: `atan2 * 180/PI + 90` (accounts for SVG orientation)

### S2 Cards
- Top (row 2): S3-S11 style — image + pill + title + summary. No pullquote, bullets, or More pill
- Bottom (row 3): Quote strip. No More pill

### Synthesis Card
- Observation section: flex row — text left, 200×200px circular Unsplash image right
- Image fetched at generation from `theme` keywords, stored in synthesis blob

## Prompt Rules (lib/stories.ts)
- `PROMPT_V = "v18"` — bump when prompt changes
- No semicolons — ever (pass1 voice rules)
- `ownedTitle`: MUST BE FACTUALLY ACCURATE — never assert claims the article doesn't support
- FC `imageQuery`: match mood/tone of the source (dark source = dark moody image)

## Writer Personas (7 writers, seeded per edition)
Rex (Hitchens), Eric (Orwell), Margot (Didion), Finn (M. Lewis), Cal (Gladwell), Jack (O'Rourke), Ward (Tom Wolfe)

## Key Files
| File | Purpose |
|------|---------|
| `app/page.tsx` | Homepage |
| `components/EditionView.tsx` | Bento grid, all visual components incl. FlightPathBorder, S1FlightPaths |
| `app/article/[slug]/page.tsx` | Article detail |
| `app/feature-creature/[slug]/page.tsx` | FC page |
| `lib/stories.ts` | All data + generation logic |
| `lib/palette.ts` | Design tokens, 5 rotating palettes |
| `app/api/pre-warm/route.ts` | Primary cron entrypoint |
| `app/api/warm/route.ts` | Manual regen entrypoint |

## Deployment
Vercel auto-deploys on push to `main`. Check Vercel dashboard for build errors.

## Open Items
- Custom domain (still on daily-signal-omega.vercel.app)
- Share button on articles
- Mobile layout tweaks
- Monitor Anthropic API spend limit

# The Daily Signal — Project Context

## Live URLs
- Production: https://daily-signal-omega.vercel.app/ (temporary — needs custom domain)
- GitHub: github.com/kre8tions/daily-signal (`main` branch)
- Local: C:\dev\daily-signal

## Git
```
/mingw64/bin/git -C /c/dev/daily-signal add .
/mingw64/bin/git -C /c/dev/daily-signal commit -m "message"
/mingw64/bin/git -C /c/dev/daily-signal push origin main
```
Vercel auto-deploys on every push to `main`. Always check Vercel dashboard for red error indicator — build failures are silent.

## Stack
- Next.js 15 App Router (server components only, no client except EmailCapture)
- Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) — batch story analysis + article commentary
- Vercel Blob (`@vercel/blob`) — persistent storage for articles, archive, subscribers, photos
- Unsplash API — image fallback when OG scrape fails
- rss-parser — RSS feed ingestion
- File-based TTL cache in `/tmp` — homepage analysis only (unreliable across Lambda instances)

## Env Vars (set in Vercel dashboard)
- `ANTHROPIC_API_KEY`
- `UNSPLASH_ACCESS_KEY`
- `BLOB_READ_WRITE_TOKEN` — auto-injected by Vercel, do not set manually

## Key Files
| File | Purpose |
|------|---------|
| `app/page.tsx` | Homepage bento grid + Synthesis + EmailCapture |
| `app/EmailCapture.tsx` | Client component — email input → /api/subscribe |
| `app/api/subscribe/route.ts` | Saves emails to Vercel Blob at subscribers.json |
| `app/article/[slug]/page.tsx` | Article detail (force-dynamic), OG meta tags |
| `app/archive/page.tsx` | Archive list |
| `app/archive/[key]/page.tsx` | Single archived edition view |
| `app/api/revalidate/route.ts` | Clears file cache + revalidatePath |
| `lib/stories.ts` | All data logic: RSS, dedup, Claude, Blob cache, images |
| `lib/palette.ts` | Design tokens, ACTION_LABELS, ACTION_EMOJIS, TAGLINE, contrastColor() |
| `lib/cache.ts` | File-based TTL cache (homepage analysis only) |

## Editions
5 per day (~4 hours each): early, morning, afternoon, evening, night.
Edition key format: `2026-06-25_evening`

## Caching Architecture
- **Homepage analysis**: file-based /tmp cache (per Lambda instance)
- **Article commentary**: Vercel Blob at `articles/v3/{editionKey}/{md5hash}.txt`
  - `PROMPT_V = "v3"` in `getFullArticle` — bump to bust cache when prompt changes
  - Generated once per edition per article, served from Blob after that
- **Images**: file-based cache key prefix `artimg_v2_` — bump version to bust
- **Archive editions**: Vercel Blob at `archive/editions/{key}.json`
- **Subscribers**: Vercel Blob at `subscribers.json`
- **Archive photos**: Vercel Blob at `archive/photos/{editionKey}.jpg`

## Article Slug
MD5 hash of URL: `createHash("md5").update(story.link).digest("hex").slice(0, 16)`
Do NOT use truncated base64 — causes collisions for same-domain URLs.

## Image Fetching Pipeline
1. RSS image URL (if clean)
2. OG scrape from article URL (3s timeout)
3. Unsplash fallback — filters 80+ common names (NAME_RE), section-aware queries
4. `getUniqueImages()` deduplicates across all cards

## Deduplication
- Single shared keyword between two article titles = duplicate, filtered out
- Max 1 Amazon/deal article per edition

## Claude Prompts

### Article Commentary (`getFullArticle`)
- 150-260 words
- Format: 1-sentence hook paragraph → 1-2 sentence middle paragraphs → up to 3-sentence closer
- One reference max from the 2000+ source pool
- BANNED: Goodhart's Law, Dunning-Kruger Effect, Streisand Effect, Overton Window, Occam's Razor, Hanlon's Razor, Butterfly Effect, Maslow's Hierarchy, Trolley Problem, Black Swan
- Bump `PROMPT_V` constant when changing prompt to invalidate Blob cache

### Synthesis (`analyzeAll`)
- Observation: first sentence alone as hook, then `\n\n`, then 1-2 follow-up sentences
- Key insights: 1 sentence each, 2 max
- Action steps: beginner-friendly, specific, doable with no experience, max 20 words each

### Tone
Centrist, intellectually honest, skeptical of all sides. Non-ideological. No moralizing.

## Design System (`lib/palette.ts`)
- Dark theme with accent color (yellow `#FAED26` in current palette)
- `P.pageBg`, `P.cardBg`, `P.ink`, `P.inkMid`, `P.inkLight`, `P.accent`, `P.tint`, `P.shadow`
- `contrastColor(hex)` — returns #000 or #fff for contrast against any hex
- `SECTION_COLORS` — per-section accent colors
- `ACTION_LABELS` — 20 rotating card titles (daily rotation)
- `ACTION_EMOJIS` — 20 rotating emojis (per-edition rotation)
- `TAGLINE` / `TAGLINE_FONT` — rotating tagline next to nav pills

## Bento Grid Layout
- Top grid: `5fr 7fr` columns, 3 rows
  - s1 text-only: col 1, row 1
  - s1 image: col 2, row 1
  - s2 image: col 1, row 2
  - s3: col 2, rows 2-3 (spans)
  - s2 pullquote: col 1, row 3
- Row 2: s4-s9 in 3-col grid, image 200px tall
- The Signal card: sketchy SVG border (feTurbulence seed=7), animated space invader
- What To Do card: separate card, sketchy border (seed=12), dashed accent action bubbles
- Email capture: in nav row, right-aligned

## Article Pages
- `force-dynamic` (no ISR)
- Georgia serif body text, 19px, 1.9 line-height
- Home pill buttons (no arrows), Read Full Article pill (no arrow)
- Dynamic OG meta tags: story image + title + summary

## Mobile
- CSS media query via `<style>` tag (server component — no client state)
- `action-grid` class: single column on mobile (max-width: 700px)
- Next session: mobile layout tweaks planned

## Next Steps
- Custom domain (thedailysignal.com may be taken by Heritage Foundation — check dailysignalai.com, signaldaily.co, thedailysignal.news)
- Mobile layout improvements

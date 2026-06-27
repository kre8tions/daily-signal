# The Daily Signal — Session Memory

Last updated: 2026-06-27 (session 13)

## Archive System — Bugs Fixed (session 13)
Three bugs caused archive to only show 1 edition:

1. **`saveToArchive` stale CDN reads** — was fetching `archive/index.json` without cache-busting, getting a stale CDN version, overwriting the index with only the stale entry + current edition each cron run.
   - Fixed: added `?t=Date.now()` + `cache: "no-store"` to fetch in `saveToArchive` (`lib/stories.ts`)

2. **`getArchiveList` early return** — returned at `if (list.length > 0)` before falling through to blob scan. Stale index had 1 entry → blob fallback never ran.
   - Fixed: rewrote `getArchiveList` to always use `list({ prefix: "archive/editions/" })` as authoritative source of keys. Index used only for metadata enrichment (theme, imageUrl, label).

3. **`/archive` page ISR cached** — had `revalidate = 3600`, so blob updates didn't show for up to 1hr.
   - Fixed: changed to `export const dynamic = "force-dynamic"` in `app/archive/page.tsx`.

**Archive blob structure:**
- `archive/editions/{key}.json` — full PageData (written by warm route)
- `archive/index.json` — metadata cache [{key, label, date, theme, imageUrl}], newest first
- `archive/photos/{key}.jpg` — persisted hero image

## Signal Desk (/signal-desk, password: "office")
Internal editor tool showing all articles across all editions.
- Server component pre-computes all rows server-side, passes plain data to `DeskClient` (client component)
- **Do NOT pass functions as props to DeskClient** — causes "Functions cannot be passed to Client Components" error
- Rows per edition: Synthesis (top, accent pill) → Feature Creature (purple pill) → Stories (numbered 1–N)
- FC/Synthesis rows have no original headline or source column; styled with tinted row background
- Archive editions loaded in parallel via `Promise.allSettled` with `maxDuration = 60`

## Writers System
7 personas assigned per edition via seeded Fisher-Yates shuffle:
- W0 Rex → Christopher Hitchens — prosecutorial contrarian
- W1 Eric → George Orwell — plain language moralist
- W2 Margot → Joan Didion — cool observer
- W3 Finn → Michael Lewis — narrative thriller
- W4 Cal → Malcolm Gladwell — counter-intuitive
- W5 Jack → P.J. O'Rourke — sardonic mocker
- W6 Ward → Tom Wolfe — status-game anthropologist

`getWriterAssignments(editionKey)` — 11 story slots
`getSynthWriterIndex(editionKey)` — seed ×(i+13)
`getFCWriterIndex(editionKey)` — seed ×(i+7)

## Owned Headlines (PROMPT_V = "v9")
- `story.ownedTitle` — in `analyzeAll`, used on home cards
- `fullArticle.ownedTitle` — in `getFullArticle` Pass 1, persona-specific, used on article pages
- Bump `PROMPT_V` in `lib/stories.ts` to bust all article blob caches

## RulerBorder (FC card SVG border)
Seismic pen-drawn SVG in `app/page.tsx`. Amplitude ×0.9, `feTurbulence scale=1.5`, shadow trace opacity 0.15 + main line 0.85, `preserveAspectRatio="none"`.

## Palettes
`articleBg` (reading surface) is separate from `pageBg` (homepage atmosphere) in `lib/palette.ts`.
All `inkLight` values are WCAG AA verified. P1 pageBg = `#C8E4E3`, P2/P4 fontBody = Inter.

## Cron (cron-job.org — both confirmed working with secret)
- Warm: `https://daily-signal-omega.vercel.app/api/warm?secret=5e664e03c2bb31328da0c22233abe889e8a257604bbfcd1dda95cb787e11fe3a`
- Revalidate: `https://daily-signal-omega.vercel.app/api/revalidate?secret=5e664e03c2bb31328da0c22233abe889e8a257604bbfcd1dda95cb787e11fe3a`

## Debug Routes (clean up once archive confirmed)
- `app/api/debug-archive/route.ts` — lists blobs, `?rebuild=1` rewrites index from blob metadata
- `app/api/rebuild-archive/route.ts` — broken, safe to delete

## Pending
1. Verify `/archive` shows all 10+ editions (fix deployed 2026-06-27, not yet verified)
2. Clean up debug/rebuild routes
3. Custom domain (still on daily-signal-omega.vercel.app)
4. Share button on articles
5. Promotion strategy

# The Daily Signal — Claude Context

<!-- STATUS:START -->
Last updated: 2026-07-03 (session 4)
Status: Live, 5 editions/day; timezone navigation fixed; all Claude content[0] reads hardened; 1 plane on S1
Next: Custom domain + share button + Anime/Film/Comics filter (reject items with no named work)
Blockers: none
<!-- STATUS:END -->

Live: https://dailysignal.cc (custom domain live 2026-07-03; also at daily-signal-omega.vercel.app)
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
**Build clock: UTC+14** — cron fires 16 min before each UTC+14 boundary. `getEdition()` uses UTC+14. Do NOT change.
**Publish clock: visitor's local timezone** via `x-vercel-ip-timezone` header. `getEditionForTimezone(tz)` uses visitor's LOCAL date (not UTC+14 date) for the edition key — ensures homepage date label and archive nav match what the reader sees as "today".
UTC cron schedule: `44 2,6,14,18,22 * * *`

Edition labels: early="First Light", morning="The Brief", afternoon="Midday", evening="The Digest", night="Night Dispatch"

## Generation Flow
- **`buildPageData`** is the ONLY generation entrypoint
- **`getPageData` is READ-ONLY** — only reads blobs, never generates. No `unstable_cache`.
- **`getFullArticle` called with `readOnly=true` from article page** — never generates on user click
- **`getHowTo` returns null if not cached** — never generates on user click
- **User visits NEVER trigger generation — enforce this always**
- `/api/pre-warm` fires 16 min before each UTC+14 boundary via Vercel cron
- `/api/warm` is manual/fallback — calls `buildPageData` directly, returns JSON result synchronously, accepts `?edition=` param to regenerate any past edition
- All endpoints require `?secret=CRON_SECRET`
- `getNextEdition()` looks 16 min ahead in UTC+14 time
- All `put()` calls MUST include `allowOverwrite: true`

## Article Click Flow
1. User clicks → `/article/{slug}?e={editionKey}`
2. Page reads `?e=` → exact edition known
3. Story from `archive/editions/{editionKey}.json`
4. Full article from `articles/{editionKey}/{slug}.json` → `articles/by-slug/{slug}.json` → legacy v18-v22 paths
5. Fallback: summary + bullets from story object
6. No Claude called. No generation.

## Article Generation Pipeline
- **Pass 0**: `analyzeSource()` — detects genre, source position, tension, missed angle
- **Pass 0.5**: `selectMode()` — writer picks one of 12 engagement modes from Pass 0 analysis
- **Pass 1**: Full article with editorial brief. Body written AFTER `---` separator as plain text — prose with unescaped quotes never corrupts JSON metadata.
- **Pass 2**: Scaffold restructure into 5-paragraph cadence

12 modes: The Reframe, The Extension, The Complication, The Rebuttal, The Zoom Out, The Zoom In, The Unstated Assumption, The Beneficiary Question, The Historical Echo, The Paradox, The Missing Voice, The So What.

### Article Body Rules (enforced in prompt)
- **5-part rhythm**: claim → specific story/detail → named parallel (person/case/moment) → named trait/mechanism → transferable consequence
- **Colon ban**: colons anywhere in prose — rewrite as two sentences, no exceptions
- **Semicolon ban**: rewrite as two sentences
- **No throat-clearing openers**: "Here's the thing", "The truth is", etc.
- **No vague lesson-gesturing**: "this teaches us", "there's a lesson here"
- **Reader arrives cold**: always name the subject, never assume prior knowledge

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
| `howto/{actionSlug}.json` | HowTo JSON — generated on first How? click, cached permanently |

**Bump `PROMPT_V`** in `getFullArticle` when changing prompts to invalidate cached articles.

## Unsplash / Image System
- All images from Unsplash only (no RSS/OG scraping)
- `fetchUnsplash()` returns `{ url: string; color?: string } | undefined`
- `photo.color` = Unsplash dominant hex, zero extra API cost
- `Story.imageColor` stores dominant color for overlay use
- FC imageQuery: match mood/tone of source
- Named cultural works → query targets the work, not the literal subject noun

## Writer Personas (66 writers — day-pool no-repeat system)
All nicknames are fictional (never the writer's real first name). Full objects in `lib/stories.ts` WRITERS array.

Each writer object has `name`, `inspiration`, and `style` fields. Signal Desk reads `inspiration` and derives personality from the first sentence of `style`.

**Daily assignment** (`lib/stories.ts`):
- `getDayPool(date)` shuffles all 66 writers once from date seed — one source of truth
- `getWriterAssignments(editionKey)` → pool[slotIndex×11 … +10] (11 articles per edition, no repeats)
- `getSynthWriterIndex(editionKey)` → pool[55 + slotIndex]
- `getFCWriterIndex(editionKey)` → pool[60 + slotIndex]
- 65 of 66 writers assigned per day, none repeat across articles/synthesis/FC

**Full roster** (index → nickname / inspiration):
0=Rex/Hitchens, 1=Eric/Orwell, 2=Margot/Didion, 3=Finn/M.Lewis, 4=Cal/Gladwell, 5=Jack/O'Rourke, 6=Ward/T.Wolfe, 7=Vera/Ephron, 8=Clive/Bryson, 9=Grace/Lamott, 10=Theo/Hornby, 11=Iris/Z.Smith, 12=Milo/Klosterman, 13=Elliot/DFW, 14=Soren/Iyer, 15=Sonia/M.Roach, 16=Edmund/Sacks, 17=Cosmo/Sagan, 18=Victor/Gawande, 19=Mack/Ebert, 20=Wren/Solnit, 21=Lionel/Baldwin, 22=Dash/HST, 23=Felix/Sedaris, 24=Toni/Morrison, 25=Rosa/R.Gay, 26=Marco/Bourdain, 27=Ada/Lebowitz, 28=Nell/Vowell, 29=Arlo/Ronson, 30=Bex/C.Moran, 31=Lena/Tolentino, 32=Jasper/Abdurraqib, 33=Reggie/W.Morris, 34=Otto/Saunders, 35=Cade/Junger, 36=Conrad/Larson, 37=Holt/Taibbi, 38=August/Coates, 39=Sylvia/Malcolm, 40=Barnaby/Mencken, 41=Bruno/Talese, 42=Marcus/R.Holiday, 43=Leon/Taleb, 44=Reid/D.Thompson, 45=Miles/A.Grant, 46=Clare/B.Brown, 47=Earl/Bragg, 48=Hugo/Pinker, 49=Gus/DaveBarry, 50=Constance/Noonan, 51=Rory/Keefe, 52=Dawn/M.Oliver, 53=Basil/Pollan, 54=Nora/Kolbert, 55=Cleo/McMillanCottom, 56=Drake/Grann, 57=Penn/McPhee, 58=Opal/Orlean, 59=Gale/Packer, 60=Lars/L.Wright, 61=Frans/Franzen, 62=Mae/M.Robinson, 63=Taj/T.Cole, 64=Amara/Adichie, 65=Kai/E.Klein

## Writer Lenses (lib/palette.ts — LENSES)
Applied on top of base writer voice for Psychology/HumanPotential articles only.
- **The Elder**: pattern recognition from decades, no moralizing, lets reader draw conclusions
- **The Anthropologist**: field researcher curiosity, behavior vs stated intent, gap is the story

## Layout (EditionView.tsx)
```
Row 1:   [S1 text col 1-5]  [S1 image + S1FlightPaths col 6-13]
Row 2-3: [FC card col 1-6]  [S2 top col 7-13 row 2] [S2 quote col 7-13 row 3]
Below:   Synthesis card → S3-S11 3-column grid
```
**synthFlip**: 40% chance seeded from edition key (not wall clock) to swap Synthesis before FC+S2.

### S1FlightPaths (S1 image overlay)
- Catmull-Rom spline, tension=0.9, horizontal bands per plane (paths never cross)
- Plane count: 45% one, 45% two, 10% three
- Band dividers rotate randomly -30° to +30°, seeded per edition
- Minimum turn radius enforced: waypoints closer than 60 SVG units filtered out
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

### Article Page (app/article/[slug]/page.tsx)
- **Pull quote variety** (3 styles, seeded by `slugSeed % 3`):
  - Style 0: left-border italic blockquote
  - Style 1: large decorative `"` marks, centered
  - Style 2: ornamental SVG divider (8 designs, seeded by `slugSeed % 8`)
- **Related Stories** section above "More From Today's Edition" — same-section first, 2-3 stories
- **How? back-link** uses `ownedTitle || title` (not RSS title)

### Nav
- No Archive button, no Today pill on homepage, no Home button in archive nav
- Previous/Next pills: labeled "Previous Edition" / "Next Edition"

## Palettes (lib/palette.ts)
5 palettes, each edition gets one derived from **edition key hash** (not wall clock).
`setEditionPaletteKey(editionKey)` called at top of EditionView — stable per edition, correct in archives.
`contrastColor(hex)` — WCAG luminance formula, returns black or white.

## Archive Navigation
- `getArchiveList()` sorts by date desc then slot order (early=0 … night=4) — NOT alphabetical
- Home page `prevEdition` anchored to `displayedKey` (most recent warmed entry ≤ requested slot rank)

## Signal Desk (/signal-desk)
Internal password-protected dashboard (password: "office"). Shows all editions with per-story writer assignments, pseudonyms, inspirations. `app/signal-desk/page.tsx` + `DeskClient.tsx`.
Password-protected dashboard showing all editions with per-story writer assignments, pseudonyms, inspirations, and generation status. `app/signal-desk/page.tsx` + `DeskClient.tsx`. Status column shows `✓ OK`, `No Body`, `Pass 1 Fail`, or `Missing` per article row; synthesis and FC rows show their own OK/fail state.

## Feed System (lib/stories.ts — FEEDS array)
Optional fields: `preferRssImage?: boolean`, `slotOnly?: string`.
- `preferRssImage: true` → uses RSS image directly, skips Unsplash
- `slotOnly: "afternoon"` / `"evening"` → filtered out on other slots
- Slot-capped sections (max 1 per edition): Food, Sports, Comics, Anime
- **Known issue**: Anime/Film/Comics items with no named cultural work pass through to generation and produce abstract, rule-breaking articles. Fix: reject at pool-build time if title/content contains no named work.

| Section | Notes |
|---------|-------|
| Technology, Science, Culture, Film, Entertainment, Arts | Core — always active |
| Faith | Sunday early morning only |
| Food (Eater, Bon Appétit) | afternoon only, max 1 |
| Sports (Bleacher Report, The Athletic) | evening only, max 1 |
| Comics (The Beat, CBR, Previews World) | max 1, preferRssImage |
| Anime (ANN, Crunchyroll, MyAnimeList) | max 1, preferRssImage |
| Entertainment K-pop (allkpop, Soompi, Koreaboo) | preferRssImage |

## Dedup Rules
- `loadUsedLinks` walks back 150 editions (~30 days) — hard filter, NO fallback to used links
- Global slug cache (`by-slug/`) — reuse generated content if link recurs
- **Cache validation requires BOTH `cached.body && cached.summary`**

## Key Files
| File | Purpose |
|------|---------|
| `app/page.tsx` | Homepage — reads `x-vercel-ip-timezone`, calls `getEditionForTimezone` |
| `components/EditionView.tsx` | Bento grid, all visual components incl. FlightPathBorder, S1FlightPaths |
| `app/EditionCountdown.tsx` | Client countdown, UTC boundaries `[3,7,15,19,23]` |
| `app/article/[slug]/page.tsx` | Article detail, pull quote variety, related stories |
| `app/feature-creature/[slug]/page.tsx` | FC page |
| `app/signal-desk/page.tsx` | Internal editorial dashboard |
| `lib/stories.ts` | All data + generation logic, WRITERS array (66), getDayPool |
| `lib/palette.ts` | Design tokens, 5 rotating palettes, LENSES, `contrastColor()` |
| `app/api/pre-warm/route.ts` | Primary cron entrypoint |
| `app/api/warm/route.ts` | Manual regen entrypoint |
| `vercel.json` | Cron schedule |

## Claude API Rule (enforced everywhere)
**Never write `msg.content[0].type` — always `msg.content[0]?.type` with `?? fallback`.** Claude can return `content: []` on rate limit / safety responses (HTTP 200, no rejection). A bare access crashes; optional chaining degrades gracefully. Any new Claude call must follow this pattern from day one.

## Bug Fixes Applied (2026-07-02 / 2026-07-03 / 2026-07-03 session 4)
- **Synthesis + FC writer mismatch**: `getSynthesis` and `getFeatureCreature` were computing writer index independently of day pool. Now both call `getSynthWriterIndex`/`getFCWriterIndex` — Signal Desk and generation are in sync.
- **Blank edition (getSynthesis crash)**: `getSynthesis` had bare `content[0].type` with no optional chaining and no try-catch. When Claude returned empty content, it threw, rejecting `Promise.all` in `buildPageData` before the edition blob was written → blank page. Fixed 2026-07-03.
- **content[0] TypeError (all paths)**: All Claude response reads now use `content[0]?.type` with `?? "{}"` fallback — getHowTo, analyzeSource, selectMode, getSynthesis, getFeatureCreature, getFullArticle (all passes).
- **Pass 1 body cut off**: `max_tokens` raised 950→1600. At 950, JSON metadata consumed the budget before the `---` separator + body could be written. Body was empty, Pass 2 never ran, article fell back to summary+bullets only.
- **`---` separator is correct architecture**: body as plain text after separator, metadata as JSON before. Do NOT split into two calls — title/summary/pullQuote/body must be written in one coherent voice pass.

- **Homepage date mismatch (session 4)**: `dateStr` was from `new Date()` (server UTC), but edition key uses UTC+14 date. Fixed: `getVisitorContext()` computes `dateStr` via `Intl.DateTimeFormat` with `x-vercel-ip-timezone`.
- **`getEditionForTimezone` used UTC+14 date (session 4)**: Visitor at 10pm local July 3 got key `2026-07-04_night`, creating two apparent "July 3 Night" editions. Fixed: now uses visitor's local date via `Intl.DateTimeFormat("en-CA", { timeZone })`.
- **Archive Next Edition leaked future UTC+14 editions (session 4)**: Archive pages showed Next Edition into UTC+14-built-but-visitor-future editions. Fixed: archive page caps `nextEdition` at visitor's current edition rank using `x-vercel-ip-timezone`.
- **S1FlightPaths: always 1 plane (session 4)**: Was probabilistic 1/2/3. Now hardcoded to 1.

## Open Items
1. Share button on articles
2. Filter Anime/Film/Comics stories that lack a named cultural work (reject at pool-build time)

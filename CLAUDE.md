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
- Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) — story analysis, article commentary, FC generation
- Vercel Blob (`@vercel/blob`) — persistent cache for articles, FC, archive, subscribers, photos
- Unsplash API — image fallback when OG scrape fails
- rss-parser — RSS feed ingestion
- File-based TTL cache in `/tmp` — homepage analysis (unreliable across Lambda instances)

## Env Vars (set in Vercel dashboard)
- `ANTHROPIC_API_KEY`
- `UNSPLASH_ACCESS_KEY`
- `BLOB_READ_WRITE_TOKEN` — auto-injected by Vercel, do not set manually

## Key Files
| File | Purpose |
|------|---------|
| `app/page.tsx` | Homepage 12-col bento grid + Synthesis + EmailCapture + What To Do |
| `app/article/[slug]/page.tsx` | Article detail — header + pull-quote + commentary |
| `app/feature-creature/[slug]/page.tsx` | FC article page (blob v18) |
| `app/archive/page.tsx` | Archive list |
| `app/archive/[key]/page.tsx` | Single archived edition view |
| `app/api/revalidate/route.ts` | Clears file cache + revalidatePath |
| `app/api/warm/route.ts` | Pre-generates FC + all articles + writes archive entry |
| `lib/stories.ts` | All data logic: RSS, dedup, Claude, Blob cache, images, FC, archive |
| `lib/palette.ts` | Design tokens, cursive font pool, FC_UNIVERSES/FC_ANGLES, ACTION_LABELS |
| `lib/cache.ts` | File-based TTL cache (homepage analysis only) |

## Cron Jobs (vercel.json)
- `/api/revalidate` — every 4h at :00 (clears cache, forces fresh homepage)
- `/api/warm` — every 4h at :05 (pre-generates FC + all 11 articles + archive entry)
- No manual triggers needed after deploy. Hit `/api/warm` once manually to backfill current edition.

## Editions
5 per day (~4 hours each): early, morning, afternoon, evening, night.
Edition key format: `2026-06-26_morning`

## Blob Cache Keys
| Key | Content |
|-----|---------|
| `articles/v8/{editionKey}/{md5slug}.json` | ArticleCommentary JSON |
| `feature-creature/v19/{editionKey}.json` | FeatureCreature JSON |
| `archive/index.json` | ArchiveEntry[] list |
| `archive/editions/{key}.json` | Full PageData for archived edition |
| `archive/photos/{editionKey}.jpg` | Persisted hero image |
| `subscribers.json` | Email list |

**Bump version prefix** (v6, v17) when changing prompts to invalidate old cache.

## Writer Personas (7 writers, randomly assigned per edition)
`getWriterAssignments(editionKey)` — seeded Fisher-Yates shuffle → 11 slots (all 7 writers appear, 4 get 2 articles, 3 get 1). Passed as `writerIndex` to `getFullArticle`. Writer name stored in `ArticleCommentary.writer` and rendered as "by [Name]" byline on article page.
- Rex (Hitchens style): prosecutorial, equal-opportunity contrarian, history as weapon
- Eric (Orwell style): plain language, concrete detail, moral clarity without preaching
- Margot (Didion style): cool, observational, fragments that accumulate
- Finn (Michael Lewis style): narrative-driven, follows incentives, insider perspective
- Cal (Gladwell style): counter-intuitive hooks, anecdote as argument
- Jack (P.J. O'Rourke style): sardonic, funny, mocks sanctimony on all sides
- Ward (Tom Wolfe style): status games, social anthropology, exclamation marks

## Article Commentary (`getFullArticle`) — v8
Returns `ArticleCommentary { header, pullQuote, body, writer }` JSON, stored as `.json` blob.
- `header`: 3-5 word evocative sub-headline — rendered in `P.fontHeading` at section color
- `pullQuote`: verbatim sentence from body — rendered as blockquote after para 3
- `body`: paragraphs separated by `\n\n`
- Post-processed by `breakLongSentences()` — breaks sentences >20 words at natural clause boundaries (em-dash, semicolon, conjunctions)
- Paragraph cadence: 1 sentence / 1 sentence / 1-2 sentences / 1-3 sentences
- One reference max from the 2000+ source pool (BANNED list in prompt)
- 200-280 words total

## Feature Creature (`getFeatureCreature`) — v17
Two-pass generation:
- **Pass1**: free creative write — 180-220 words, voice = "smart friend texting at 11pm", no sentence cap
- **Pass2**: scaffold into para1(1)/para2(1)/para3(1-2)/para4(2-3)/para5(1-3) + break sentences >20 words
- `trimSentences(str, max)` safety net per paragraph
- `imageQuery`: Claude-generated 4-6 concrete visual words → Unsplash search
- Vision review: Haiku scores image 1-10, accept ≥6; pull-quote fallback if rejected
- `ctaHeader`: 2-4 word active phrase before CTA (rendered in cursive font)
- `headers[0]` before para1, `headers[1]` before para4
- Mid-article: imageUrl2 after para3, or pullQuote blockquote if no image

## Homepage Layout (12-column grid)
- Row 1: s1 text `col 1/6`, s1 image `col 6/13`
- Rows 2-3: FC `col 1/7`, s2 image `col 7/13` (row 2), s2 pullquote `col 7/13` (row 3)
- 11 stories total (fills 3-col bottom grid evenly)
- Story pool interleaved: sci[0], cre[0], sci[1], cre[1], cre[2], sci[2], cre[3], cre[4], tec[0-2]
- `NEGATIVE_RE` filter: deaths/disasters/crimes pushed past position 3

## Image Fetching Pipeline
1. RSS image URL (if clean)
2. OG scrape from article URL (3s timeout)
3. Unsplash fallback — filters 80+ common names (NAME_RE), section-aware queries
4. `getUniqueImages()` deduplicates across all cards

## Design System (`lib/palette.ts`)
- 5 rotating palettes (daily). `P` = today's palette.
- `P.pageBg`, `P.cardBg`, `P.ink`, `P.inkMid`, `P.inkLight`, `P.accent`, `P.tint`, `P.shadow`
- `P.fontHeading`, `P.fontBody`, `P.dark` (boolean)
- `contrastColor(hex)` — returns #000 or #fff for contrast
- `SECTION_COLORS` — per-section accent colors
- `CURSIVE_FONT_FAMILY` / `CURSIVE_FONT_URL` — rotating per edition (used in FC pages only)
- `ACTION_LABELS` / `ACTION_EMOJI` — rotating titles/emojis for What To Do card

## Article Pages
- `force-dynamic` (no ISR)
- Georgia serif body text, 19px, 1.9 line-height, maxWidth 720px
- Section color header above "The Signal Take" label
- Pull-quote blockquote (section color) injected after paragraph 3
- Home pill button (no arrows), Read Full Article pill

## Archive
- `saveToArchive()` called from `/api/warm` — reliably writes index entry each edition
- Archive index at `archive/index.json`, max 90 entries
- `/archive` page: pill nav, 3-col card grid
- `/archive/[key]`: pill "Archive" nav button

## Deployment Notes
- Vercel Hobby plan = max 1 cron/day. Current cron: 6am (revalidate + warm). Other 4 editions cold-load on first visit.
- **Fix:** set up cron-job.org (free) to hit `/api/revalidate` + `/api/warm` every 4h — bypasses Vercel limit, fully automates all 5 editions.
- If GitHub webhook breaks again: use `vercel --prod` from PowerShell at C:\dev\daily-signal
- Empty-body cache protection in `getFullArticle` — bad blobs are skipped and regenerated automatically

## Next Steps
- **Set up cron-job.org** for full 5-edition automation (highest priority)
- Mobile layout tweaks (bento grid needs rethinking for small screens)
- Custom domain (thedailysignal.com likely taken by Heritage Foundation — consider dailysignalai.com, signaldaily.co, thedailysignal.news)

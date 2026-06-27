---
name: "daily-signal-brain"
metadata:
  node_type: memory
  updated: "2026-06-28"
---

# The Daily Signal — Project Brain

Standalone project at `C:\dev\daily-signal`. AI-curated news digest — 5 editions/day, editorial voice, bento grid layout.

**Live at:** https://daily-signal-omega.vercel.app  
**Repo:** https://github.com/kre8tions/daily-signal (private, branch: main)  
**Deploy:** git push origin main → Vercel auto-deploys

## Stack
- **Frontend:** Next.js 15 App Router, server components
- **AI:** Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)
- **Images:** Unsplash `/search/photos?per_page=1`
- **News:** 15 RSS feeds via `rss-parser`
- **Persistence:** Vercel Blob (`@vercel/blob`) — Pro plan (500k ops/month)
- **Editions:** 5/day keyed by UTC hour — Early (5–9), Morning (9–13), Afternoon (13–17), Evening (17–21), Night (21–5)
- **Cache:** `unstable_cache` keyed by editionKey, `revalidate: 28800`, `tags: ['edition-${key}']`

## Generation Architecture (Option C — current as of 2026-06-28, commit 007603f)

`getFullArticle` is the single source of truth for all story metadata.

```
Pre-warm (16 min before edition boundary):
  fetchTopStories(nextEditionKey)
  → Promise.allSettled(getFullArticle × 11) ← card metadata + article body in one blob
  → getSynthesis(raw, editionKey)            ← cross-story analysis
  → getFeatureCreature(editionKey)           ← 3-pass FC generation
  → revalidateTag(edition-${editionKey})

Edition start — buildPageData():
  All functions find blobs → instant reads → no cold start
```

**Why Option C:** previously `analyzeAll` generated card titles and `getFullArticle` generated article titles independently → different titles on card vs article page. Option C unifies them into a single blob per story.

**Cost:** ~$0.15–0.20/edition × 5/day = ~$23/month flat.

## Key Functions (lib/stories.ts)
- `getFullArticle(story, related, editionKey, writerIndex)` — PROMPT_V="v11", blob: `articles/v11/{editionKey}/{md5(link)}.json`. Pass1 (950 tok): ownedTitle, summary, bullets, insight, imageQuery, header, pullQuote, body. Pass2 (700 tok): paragraph structure + header2 + imageQuery2.
- `getSynthesis(items, editionKey)` — blob: `synthesis/v1/{editionKey}.json`. 1500 tok.
- `getFeatureCreature(editionKey)` — blob: `feature-creature/v19/{editionKey}.json`. 3-pass.
- `buildPageData(editionKey, editionLabel)` — exported, called directly by pre-warm and via `getPageData()`.
- `getEdition()` — current edition key from UTC hour
- `getNextEdition()` — next edition key (now + 16 min)
- `getWriterAssignments(editionKey)` — 11 writer slots via seeded shuffle

## Writers (7 personas, seeded per edition)
Rex (contrarian) · Eric (plain moralist) · Margot (cool observer) · Finn (thriller narrative) · Cal (counter-intuitive) · Jack (sardonic) · Ward (status anthropologist)

## Card Styles (position-based)
`CARD_STYLES = ["full", "pullquote", "brief", "brief", ...]` — Story[0]=hero, Story[1]=pullquote, rest=brief

## Cron Jobs (vercel.json — Vercel native crons, CRON_SECRET header auth)
```
/api/revalidate  → 0 5 * * *    (daily cache bust)
/api/pre-warm    → 44 4,8,12,16,20 * * *  (pre-generates next edition)
```
Manual trigger: `GET /api/pre-warm?secret=<CRON_SECRET>`  
`/api/warm` still exists for manual force-regenerate of current edition (not on cron).

## Blob Key Patterns
- `articles/v11/{editionKey}/{slug}.json`
- `synthesis/v1/{editionKey}.json`
- `feature-creature/v19/{editionKey}.json`
- `archive/editions/{editionKey}.json`
- `archive/index.json`

## Archive System
- `getArchiveList` uses `list({ prefix: "archive/editions/" })` as authoritative source (not index)
- `app/archive/page.tsx` is `force-dynamic`
- `saveToArchive` fetches index with `?t=Date.now()` + `cache: "no-store"`

## Key Files
```
app/page.tsx                     — homepage (EditionView)
app/article/[slug]/page.tsx      — article detail
app/archive/page.tsx             — past editions list (force-dynamic)
app/signal-desk/page.tsx         — internal tool (password: "office")
app/api/pre-warm/route.ts        — PRIMARY cron: pre-generates next edition
app/api/warm/route.ts            — manual: force-regen current edition
app/api/revalidate/route.ts      — cache bust
lib/stories.ts                   — all data logic
lib/palette.ts                   — 5 rotating daily palettes
components/EditionView.tsx       — homepage layout component
```

## Resilience
- FC `.catch(() => null)` — FC failure cannot kill homepage cache
- FC blob save is fire-and-forget — result returned even if write fails
- `Promise.allSettled` for articles — one failure cannot cascade
- `revalidateTag` fires in pre-warm after generation

## Known Issues / Next Steps
1. **Missing images** — some cards still have no image (RSS absent → OG blocked → Unsplash failed). imageQuery now comes from Claude — watch if coverage improves.
2. **Debug routes** — `app/api/debug-archive`, `app/api/rebuild-archive` can be cleaned up
3. **Custom domain** — still on `daily-signal-omega.vercel.app`
4. **Share button** — not yet built

## Env Vars Required
```
ANTHROPIC_API_KEY
UNSPLASH_ACCESS_KEY
CRON_SECRET
BLOB_READ_WRITE_TOKEN
```
</content>
</invoke>
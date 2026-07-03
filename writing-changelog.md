# Daily Signal — Writing Pipeline Changelog

A record of meaningful pipeline changes: what changed, why we tried it, what we observed, why we reverted (if we did). Maintained for the article quality improvement skill so reasoning is not lost between sessions.

---

## pullquote-dedup + opinion/explainer named-case (2026-07-04) — CURRENT STABLE

**What changed:**
- Body opening: if Pass 1 reused the pullQuote as the first sentence, it's stripped from the body before Pass 2 runs — reader no longer hits the same sentence twice
- `opinion` genre brief: added explicit instruction to reach into own knowledge and name a specific company, executive, or incident when the source is abstract
- `explainer` genre brief: same — if no named subject in source, must ground the abstract idea in a specific named person, institution, or case

**Why:**
- "Who Profits From Saying No" (June 30) exhibited both problems: pullQuote duplicated as body opener, entire piece stayed abstract with no named parallel
- Named parallel has been a known weakness since `pre-writing-overhaul` — genre briefs for abstract pieces never told Haiku to reach beyond the source
- PullQuote dedup is structural: Pass 1 is asked for its "sharpest sentence" and naturally opens the body with the same line

---

## colon-semicolon repair pass (2026-07-04)

**What changed:**
- Added `repairPunctuation()` — runs after Pass 2 body assembly
- Scans body for colon/semicolon violations (skipping URLs)
- If violations found: single Haiku call rewrites only the offending sentences, returns a JSON map of original → rewritten
- Fast path: if no violations, returns text unchanged with zero API cost

**Why:**
- No-colon/no-semicolon rule was prompt-only — Haiku occasionally slips one through with no catch
- Code enforcement is the only reliable fix; a small repair call is cheaper than a bad article

---

## post-july4-structure (2026-07-04)

**What changed from pre-writing-overhaul-plus-two-july4:**
- Pass 1: 250-350 word cap restored (had been silently dropped during a prior prompt rewrite)
- Pass 2 sentence caps updated: `para1=1, para2=2, para3=2-3, para4=3-4, para5=3-5` — no sentence constraint after para5
- Pass 2 code limits (`trimSentences()`) updated to match: `{ para1: 1, para2: 2, para3: 3, para4: 4, para5: 5 }`

**Why:**
- Word count cap: without it, Pass 1 articles were running 900+ words unchecked. Pass 2 shapes structure but doesn't control length — the cap belongs in Pass 1.
- Sentence caps: prior caps (1/1/2/3/2) were too tight. New structure gives breathing room that matches the intent of each paragraph's role: hook is tight, landing has room to breathe.

---

## pre-writing-overhaul-plus-two-july4 (2026-07-04)
**Git tag:** `pre-writing-overhaul-plus-two-july4`
**Commits:** `f46818d` → `204be47` → `aa76f3f`

**What's in this state:**
- Pass 0 (source analysis), Pass 0.5 (mode selection), Pass 1 (free write), Pass 2 (scaffold)
- Pass 2 updated: shapes first 5 paragraphs with sentence caps, preserves all content beyond para5 in `remainder` field — no longer truncates
- Global slug cache versioned at `articles/v3/by-slug/{slug}.json` — old `by-slug-v2` treated as legacy fallback
- No word count cap in Pass 1

**Why these two changes were kept after revert:**
- Pass 2 truncation was a genuine bug — content was being silently dropped
- Cache versioning was needed to prevent stale pre-Pass-2 articles from being served indefinitely

---

## writing-overhaul-attempt-1 (2026-07-03) — REVERTED
**Git tag:** `writing-overhaul-attempt-1`
**Commits:** `5767061` → `de55a45`

**What changed:**
- Added `rhythmForMode()` — 12 mode-specific rhythm structures replacing the universal 5-part rhythm
- Added pre-flight claim step: writer commits to one specific falsifiable sentence before Pass 1 writes
- Pre-flight claim initially as separate Pass 0.75 (extra Claude call), then folded into Pass 0.5 as a third JSON field (`claim`) with token budget raised 200→300
- Word count cap added to Pass 1: 250-350 words
- Cache bumped to `v4/by-slug`

**Why we tried it:**
- Articles running long (900+ words observed on PTO-maxxing article)
- Mode selection (Pass 0.5) was choosing a mode but Pass 1 ignored it structurally — all 12 modes got the same 5-part rhythm regardless
- No committed claim before writing meant Pass 1 wrote toward a vague angle; FC had a pre-flight claim and produced sharper pieces
- Transferable consequence (step 5) getting squeezed by the time Pass 1 reached it

**Why reverted:**
- Wanted to observe live output quality on fresh editions before committing — changes were significant enough that a bad batch could run for hours undetected
- Word count cap removed separately (after revert) as it was seen as too prescriptive — Pass 2 structure should govern length, not an explicit cap
- The mode-aware rhythms and pre-flight claim are sound in theory; revert was precautionary not a rejection of the ideas
- Tagged as `writing-overhaul-attempt-1` to preserve for future reference

**Open questions for next attempt:**
- Do mode-aware rhythms actually produce more distinct articles across modes, or does Haiku collapse them anyway?
- Does the pre-flight claim make the opening sentence sharper, or does it just front-load the hook and weaken the buildup?
- Is 250-350 words the right target, or should it be governed by the mode (a Rebuttal might need fewer words than a Historical Echo)?

---

## pre-writing-overhaul (2026-07-02/03) — BASELINE
**Git tag:** `pre-writing-overhaul`
**Commit:** `f46818d`

**What's in this state:**
- Pass 0: source analysis (genre, position, tension, missed angle)
- Pass 0.5: mode selection — writer picks one of 12 modes based on subject knowledge
- Pass 1: free write from editorial brief + universal 5-part rhythm (claim → specific story → named parallel → named trait → transferable consequence)
- Pass 2: scaffold restructure — sentence caps on first 5 paragraphs (1/1/2/3/2), originally truncated beyond para5
- 66 writers with distinct personas, day-pool no-repeat system
- Global slug cache at `articles/by-slug-v2/{slug}.json`

**Known weaknesses identified at this point:**
- Universal rhythm doesn't match the natural structure of all 12 modes
- No committed claim before writing — mode is selected but not anchored to a specific position
- Named parallel (step 3) often defaults to safe/well-known examples rather than surprising ones
- Pass 1 prompt is long (~700 words of instruction) for a smaller model — mechanical rule-following over genuine voice
- Articles occasionally run very long when served from stale pre-Pass-2 cache (confirmed: PTO-maxxing article, 900 words, from old `by-slug-v2` cache generated before Pass 2 existed)
- Writer voice competes with editorial brief — by the time the model processes the full brief, the writer persona is diluted

---

## Earlier history (pre-session-4)

Key prompt evolution pulled from git log for context:

| Commit | Change | Notes |
|--------|--------|-------|
| `0a48044` | Word count: 75-100 words | Too short — removed |
| `a6635ba` | Word count: 150-260 words | Better but still removed later |
| `3b1635b` | Added 5-part rhythm, removed word count | Word count silently dropped during prompt rewrite |
| `c1cfa2d` | Body split: prose after `---` separator, metadata as JSON | Architecture still in use |
| `a727246` | max_tokens 950→1600 | Body was cut off before separator |
| `5216d2c` | Skip Pass 2 for brief cards | Later reversed — Pass 2 now always runs |
| `df1cba4` | FC: Pass 2 breaks sentences >20 words | FC had sentence-breaking before articles |
| `277b603` | FC: 180-220 word target | FC has always had a word count; articles lost theirs |
| `a0ae239` | FC: 120-150 word target | Later raised |

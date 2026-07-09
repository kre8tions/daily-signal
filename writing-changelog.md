# Daily Signal — Writing Pipeline Changelog

A record of meaningful pipeline changes: what changed, why we tried it, what we observed, why we reverted (if we did). Maintained for the article quality improvement skill so reasoning is not lost between sessions.

---

## source-fitness-gate (2026-07-08) — CURRENT STABLE

**What changed:**
- `SourceAnalysis` interface gains `fitness` (1–5) and `fitness_reason` fields
- Pass 0 (`analyzeSource`) now scores each source for editorial fitness, with explicit criteria and a calibration example (Sony $119 monitors = 2)
- `getFullArticle` gains a `slotIndex` parameter (defaults to 99 for non-slot calls)
- Fitness gate: if `fitness <= 2` and `slotIndex <= 1` (S1 or S2), throws early — triggering existing bench backfill
- Fitness score logged at `console.warn` for every rejection so it's observable in Vercel logs
- Pass 0 `max_tokens` raised 220 → 300 to accommodate the new fields

**Scoring criteria:**
- 5: Genuine finding/study/observed phenomenon; tension real; argument lives in source
- 4: Counter-intuitive result or strong position; some angle-finding needed
- 3: Real subject with tension; article must find its own angle but source is legitimate
- 2: PR, product launch, announcement — argument must be entirely manufactured (Sony IEM = 2)
- 1: Wire copy, obituary, deal, press release — no editorial substance

**Why:**
- The pipeline had no way to evaluate source quality before writing. A Sony product announcement and a Quanta discovery got identical treatment.
- Sony monitors article traced back to a fitness-2 source: Sony's democratization pitch was the manufacturer's framing, not a finding. The article had to manufacture the entire Shure parallel from scratch.
- S1/S2 are prime real estate. A bench story with a real finding is better than a prime story built on PR.

**What to observe:**
- Are bench stories being promoted to S1/S2? Check Vercel logs for `[fitness-gate]` entries.
- Is Haiku scoring conservatively (rejecting too much) or generously (letting weak sources through)?
- Does S1/S2 content feel noticeably stronger after a week of filtered editions?

---

## reader-life-reorientation (2026-07-08) — CURRENT STABLE

**What changed:**
- Lens instruction rewritten: "use this subject as the vehicle, but land on something the reader can see in their own life — their creative practice, their career, their way of thinking. The subject is the entry point, not the destination."
- 8 of 12 mode rhythms had subject-level step 5 endings (The Extension, Complication, Rebuttal, Zoom Out, Zoom In, Historical Echo, Paradox, Missing Voice). Each now closes with a reader-life requirement fitted to the mode's character — e.g. Zoom Out: "name one place the reader is likely to encounter this pattern themselves"; Paradox: "where the reader might be holding the same tension without having named it."
- 4 modes already landed at the reader level (Reframe, Unstated Assumption, Beneficiary Question, So What) — unchanged.

**Why:**
- The pipeline had two goals it treated as one: write a good article about the subject (enforced) vs. give the reader a lens for their own life (stated once, then abandoned).
- 8 of 12 rhythms ended at the subject or system level. The audience promise — "building a life with intention, a creative practice, a considered career" — requires ending at the reader-life level.
- The Sony/Shure article made this visible: the "wrong domain" insight (you can buy the tool but not the knowledge system) is directly applicable to anyone building a creative practice. The article stayed in the audio world and never transferred. The mode rhythm (likely Zoom Out or Extension) told it to end at the system level. It did.
- Synthesis gets this right because the audience is concretized everywhere in its prompt. Articles stated the audience once and then trusted the model to carry it — they didn't.

**What to observe:**
- Do articles now close on something the reader can apply to their own situation?
- Does the reader-life requirement feel forced (name-dropping the reader) or organic (the subject genuinely opens into something transferable)?
- Which modes handle the transfer well vs. awkwardly? The Rebuttal and Complication are the most at risk of feeling tacked-on.

---

## claim-namedcase-ending-fix (2026-07-08) — CURRENT STABLE

**What changed:**
- Pass 0.5 `claim` instruction: added FORBIDDEN abstract category nouns, falsifiability test ("could a skeptic name a counterexample?"), GOOD/BAD example drawn from the live failure case
- Pass 1 global: added explicit named-case requirement — every article must ground its argument in a specific person, company, product, year, or documented incident. Not optional.
- Pass 1 FORBIDDEN list: added vague endings that restate the opening without completing the thought ('something else entirely', 'more complicated than it seems')

**Why:**
- Root cause analysis of "Professional Tools Need Professional Context to Work" (Jem, July 9): the pipeline passed every explicit check but produced an abstract article
- Traced to Pass 0.5 — an abstract claim ("professional tools require professional context") propagates softness through every downstream pass. Pass 1 builds from whatever claim it receives.
- Named-case requirement existed only in `explainer` and `opinion` genre briefs — if Pass 0 classified the genre differently, the requirement never fired. Moved to global so it applies unconditionally.
- Vague endings ("something else entirely") passed the FORBIDDEN list because no rule explicitly banned restatement-without-completion

**What to observe:**
- Does the claim in Pass 0.5 now reach for a named mechanism or specific case?
- Do articles land on something specific in the final paragraph rather than a restatement?
- Does the named-case requirement produce grounded arguments or forced/awkward name-drops?

---

## ownedTitle-specificity-fix (2026-07-08) — CURRENT STABLE

**What changed:**
- `ownedTitle` instruction in Pass 1.5 rewritten to require a concrete detail from the article (number, name, place, year, mechanism, result)
- Added explicit FORBIDDEN list of abstract category nouns: 'tools', 'context', 'access', 'systems', 'power', 'change'
- Replaced opening framing ("Strong verb, concrete nouns") with actionable rule: "Name the specific finding — not the category it belongs to"
- Added third GOOD example: 'Bedroom Producers Got the Headphones, Not the Ears'

**Why:**
- Diagnosed via live article: "Professional Tools Need Professional Context to Work" (Jem, July 9) passed every explicit check — 7 words, no forbidden phrases, no colon — yet named the category of finding rather than the finding itself
- Root cause: the instruction's forbidden list blocked wrong moves but didn't require right ones. "Put the actual tension or finding in the words" is directional, not enforceable. Haiku met the letter and missed the intent.
- Abstract category nouns are the specific failure mode — they allow the thesis to be restated at one level of abstraction too high

**What to observe:**
- Do titles now reach into the article's own material (numbers, names, mechanisms)?
- Does the abstract-but-compliant pattern reappear, or does the explicit noun ban close it?

---

## weekly-signal-and-noise (2026-07-05) — CURRENT STABLE

**What changed:**
- New `WeeklySignal` interface: `hook`, `signal`, `noise`, `lookingForward`, `oneMove`, `writerName`, `weekOf`, `imageUrl`
- `getWeeklySignal()` — fires on Sunday evening warm only. Collects past 6 days of synthesis cards (Mon–Sat) + S1/S2 ownedTitles from archive blobs as concrete anchors. Requires ≥3 days of data.
- Sunday evening synthesis slot replaced by Weekly Signal & Noise card in UI. Daily synthesis still generated (blob preserved), weekly card takes the display slot.
- Writer rotated from 66 pool via `getWeeklyWriterIndex()` seeded independently.
- Cached at `weekly-signal/v1/{sundayDate}.json`. `clearEditionCache` deletes it on Sunday evening re-warm.
- Share button built in. Email send (Resend) deferred.
- Prompt discipline: no day-by-day recap, no "this week we saw", name the mechanism not events, audience identity in `lookingForward`, noise defined as overblown story / manufactured outrage / agenda distraction.

**Also fixed this session:**
- `FC_UNIVERSE` edition key fix: `setEditionPaletteKey` was only called in `EditionView` (render-time). Added call at top of `buildPageData` so FC universe resolves correctly during warm generation.
- Image system: `namedWorkQuery` removed (produced "Supergirl film"-style branded searches returning LEGO/merch). Cultural section `imageQueryInstruction` now requests atmospheric/mood queries. `"__none__"` TTL reduced 1hr → 5min.
- Synthesis hook capped at 7-10 words.

**Why:**
- Weekly synthesis fills the "editor's letter" role — the thread visible only across 5 days that no single edition can show. S1/S2 titles give the weekly writer concrete specifics, preventing pure abstraction.
- FC universe was always the same within a 4-hour warm window because the hash was never set at generation time.

---

## voice-synthesis-image-overhaul (2026-07-04) — CURRENT STABLE

**What changed:**

### Writer voiceReminder
- Added `voiceReminder` field to all 66 WRITERS — a single concrete behavioral sentence injected just before `rhythmForMode()` in Pass 1, at highest positional weight.
- Example: Rex (Hitchens): "find the cowardice or hypocrisy in the official position and name it directly; the sentence lands like a verdict."
- Placed between the prose trigger and the rhythm so it has maximum recency weight. Not part of `style` — kept short and behavioral, not descriptive.

### Audience identity
- Pass 1 reader description now specifies: "curious, independently-minded adult building a life with intention — a creative practice, a considered career, a way of thinking they have chosen deliberately."
- Pass 1 "hold onto" changed to lens framing: "Give the reader a lens — something that changes how they see this subject, or something adjacent to it, for the rest of the week."
- Pass 1.5 summary: "what the article argues and what it means for someone trying to think more clearly about the world. Not a news summary. The specific payoff for a curious reader who is building a considered life."
- Pass 1.5 bullets: "specific, surprising, or reframe-inducing" — not plot summary.
- CTA body: "something a thoughtful person building a considered life would actually find worth their time."

### Synthesis prompt overhaul
- **Framing shift:** Sources are research not content. Model writes from understanding, not about reading. Opening: "read today's stories until you understand something true about how the world works right now — then say it. Not what you read — what you now know."
- **Writer identity opens prompt:** `synthWriter.style` injected first; `voiceReminder` injected just before JSON block.
- **Source names stripped from storyList** — `[i] SECTION — title\n{300 chars}` — so takeaways can't fall back to "Article 2 shows..."
- **Takeaway arc restructured:** mechanism → complication → implication (escalating, not parallel). Each takeaway has a defined role: (1) why the world works this way, (2) what it costs/the irony, (3) what breaks next/who wins.
- **Conclusion:** "A sentence that feels true beyond today — about human behavior, systems, or power — stated with the confidence of someone who has seen this pattern before."
- **Actions:** insight-specific, beginner-friendly (zero experience/tools/money required), reader-identity-aware (creative practice, small business, considered life), doable this week, max 15 words each.
- **Voice rule added:** "The reader is building a life with intention — creatively, professionally, intellectually. The hook earns their attention if it tells them something true about how the world works that changes how they see their own situation."
- No-colon/no-semicolon rule added to synthesis prompt.

### Image system fixes
- **`"__none__"` TTL reduced** from 1 hour to 5 minutes — failed image fetches no longer block retries across warm runs.
- **`namedWorkQuery` removed** — auto-extracted "Supergirl film"-style branded queries are gone. Unsplash has no licensed franchise imagery; this pattern returned LEGO/cosplay/merch. Query cascade now: imageQuery → headline words → section fallback.
- **Cultural section `imageQueryInstruction` (Pass 1.5):** Film, Entertainment, Arts, Comics, Anime now get atmospheric/mood instructions ("city rooftop night dramatic light") instead of title+medium ("Supergirl film"). Explicitly tells model Unsplash has no licensed franchise imagery.

**Why:**
- Writer voice was being flattened by Haiku — `voiceReminder` adds a behavioral anchor at highest positional weight to keep the persona present through the rhythm
- Synthesis was recapping articles instead of synthesizing: source names in the storyList gave the model an easy out ("Article 2 shows..."). Removing names and reframing as pattern-discovery from understanding closes that door.
- Audience identity was implicit — making it explicit and consistent across all prompts gives every pass a shared target
- Film/Entertainment images were returning LEGO figures and cosplay because Unsplash has no licensed film stills and the model was following instructions that assumed it did

**What to observe on next live edition:**
- Does writer voice feel more distinct across pieces?
- Does synthesis read as a genuine observation about the world, or does it still feel like a recap?
- Do film/entertainment story images look editorial rather than fan-merchandise?

---

## writing-overhaul-attempt-2 (2026-07-04) — CURRENT STABLE

**What changed:**
- Pass 0.5: added `claim` field — one specific falsifiable sentence the writer commits to before Pass 1 runs. max_tokens 200→300.
- New `rhythmForMode()`: 12 mode-specific 5-step rhythms replace the universal rhythm. Each mode has its own natural argumentative arc.
- Pass 1 restructured: writer voice leads the prompt, editorial brief follows. Claim injected as "YOUR COMMITTED CLAIM" before the rhythm. Mode rhythm replaces universal steps.
- Cache bumped to `v4/by-slug` to invalidate stale pre-overhaul articles.

**Why:**
- Mode was selected but ignored structurally — all 12 modes got the same rhythm
- No committed claim meant Pass 1 wrote toward a vague angle; the claim forces a position before writing starts
- Writer persona was buried after ~300 words of instructions; voice needs to be established first
- All three items are tightly coupled: claim feeds the rhythm, both land better with voice established first

**What to observe on next live edition:**
- Are articles more distinctly shaped by their mode?
- Does the committed claim produce a sharper hook?
- Does writer voice feel more present, or does Haiku still flatten it?

---

## pass1-prose-first + pass1.5-metadata (2026-07-04)

**What changed:**
- Pass 1 now outputs pure prose only — no JSON, no metadata fields, no `---` separator. Full focus on voice and argument.
- New Pass 1.5: reads the finished prose and extracts all metadata (ownedTitle, summary, bullets, imageQuery, header, cta). All derived fields are now genuinely derived from the article that exists, not previewed before it's written.
- Pass 1 max_tokens reduced 1600→1000 (prose only, no metadata payload)
- Pass 1.5 max_tokens: 600

**Why:**
- Title, summary, and bullets were written before the body existed — they previewed something not yet written rather than reflecting it
- The pullQuote problem (generating alongside vs. selecting from) was the same sequencing issue at its root
- "Write first, extract second" is the correct order: the model can only summarize what it has actually read

**Open questions:**
- Does title quality improve when written after seeing the full argument?
- Does the extra API call (Pass 1.5) add meaningful latency?

---

## pullquote-dedup + opinion/explainer named-case (2026-07-04)

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

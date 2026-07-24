# Daily Signal — Writing Pipeline Changelog

A record of meaningful pipeline changes: what changed, why we tried it, what we observed, why we reverted (if we did). Maintained for the article quality improvement skill so reasoning is not lost between sessions.

---

## synthesis-theme-dedup-model-brainstorm (2026-07-23) — CURRENT STABLE

**What changed (replaces the vocab-bank approach in `synthesis-theme-dedup-fifo-and-vocab-bank` below, same day):**
- Removed `THEME_VOCAB_POOL` and `sampleThemeVocab()` entirely — a hand-curated ~65-word list was judged too small to "mimic human creative choice" and would eventually become its own overused set.
- Replaced it with a `themeCandidates` field in the synthesis JSON schema: the model now generates 6-8 candidate theme phrases *before* selecting its final `theme`, each candidate steered toward a different register (financial, spatial/structural, legal/institutional, theatrical/performative, biological/physical, temporal/motion — 6 guided slots plus 2 fully open ones), each grounded in that day's actual stories rather than generic. The model then picks its strongest candidate whose core word isn't in the recent-history list.
- Collision handling is now tiered: (1) if the model's chosen theme still collides anyway, first check its *own other candidates* already sitting in the same response — no extra API call; (2) only if every candidate also collides does it fall through to the single last-resort follow-up call (kept from the prior version, now a true edge case rather than the primary mechanism).
- `themeCandidates` is stripped from the object before it's saved to the synthesis blob or returned — it's scratch reasoning, not part of the persisted `Synthesis` shape.

**Why:**
- Direct feedback that a fixed list, no matter how large, is the wrong shape for "creative choice" — a human editor doesn't consult a vocabulary card, they run through several options in their head informed by the material in front of them, then pick. Asking the model to brainstorm from its own (much larger, contextual) vocabulary reproduces that mechanism instead of approximating it with a bigger static list.
- Register-steering (naming categories like "financial" or "theatrical") rather than word-steering (naming specific words) avoids reintroducing the same finite-list problem one level up — the model fills each category from its actual vocabulary, not from words I pre-selected.
- Resolving collisions from the model's own already-generated alternates (instead of always making a follow-up call) is both cheaper and more natural — closer to "I already thought of another option" than "let me think of something else on request."

**What to observe:**
- Does theme diversity actually improve, or does the model produce 6-8 candidates that still cluster around the same few registers/words despite the steering?
- How often does the primary candidate collide and require falling back to an alternate — if it's frequent, the "avoid this list" instruction inside the candidate-generation step itself may need to be stronger.
- Does `themeCandidates` ever come back malformed or missing (check whether the model reliably returns 6-8 items) — the collision-fallback logic degrades gracefully to the last-resort call if the array is empty or absent, but worth confirming this doesn't happen often.
- Re-run the 30-day theme audit once enough history has accumulated under this version — invalidates comparison against data collected under either of the two earlier (now-superseded) same-day versions.

---

## synthesis-theme-dedup-fifo-and-vocab-bank (2026-07-23)

*(The vocab-bank portion below was superseded same-day by `synthesis-theme-dedup-model-brainstorm` above — a fixed word list, even a larger one, was judged the wrong shape for "creative choice." The FIFO history structure described here is still current.)*

**What changed (refines `synthesis-theme-word-repetition-dedup` below, same day):**
- Replaced the 14-day timestamp-filtered theme history with a fixed-size FIFO array (`THEME_HISTORY_SIZE = 30`, newest last, oldest dropped once over capacity). No date parsing, no growing-then-filtering — one blob read returns an already-bounded list, one write pushes the word we already have in memory and trims. Removes the `usedAt` timestamp field entirely.
- `appendThemeHistory()` now takes the already-loaded history array as a parameter instead of re-fetching the blob a second time inside the function — the generation call already has it in memory from `loadThemeHistory()` moments earlier.
- Added `THEME_VOCAB_POOL` — ~65 curated "evocative tension noun" words in the show's register (economic: Tariff, Ledger, Windfall, Loophole; structural: Bottleneck, Ratchet, Undertow; performative: Mirage, Theater, Facade; power/legitimacy: Mandate, Amnesty, Reprieve) — and `sampleThemeVocab()`, a seeded shuffle-and-sample mirroring the existing `sampleReferencePool` pattern, excluding any word already in recent history.
- The main theme-generation prompt now gets both the recent-word avoid-list *and* a sample of fresh, unused vocabulary to actively reach for — proactive supply, not just reactive restriction.
- The single-word-swap backstop prompt was strengthened: explicitly instructs the replacement to be "just as sharp and compelling as the original — do not flatten it into a generic synonym just to be different," and offers its own small fresh-vocab sample.

**Why:**
- Direct response to four concerns raised after the first version shipped: (1) the mechanism must never cause a failed/blank synthesis, (2) titles must stay compelling, not just novel, (3) reactive banning alone doesn't solve a shrinking-vocabulary problem, (4) the history list should be a simple fixed-size structure, not a date-filtered one.
- (1) is now explicit in code comments and structurally guaranteed: every new code path (history load, swap call) is wrapped in try/catch with a no-op fallback; the swap attempt is capped at exactly one try with no retry loop; a collision that can't be resolved just means the original theme publishes rather than blocking the edition.
- (2) and (3) are the same root fix: without fresh vocabulary offered up front, banning words only forces the model to hunt for a synonym under pressure, which is exactly the "flatten into a generic synonym" failure mode being guarded against explicitly in the swap prompt now. Giving the model a curated bank of good words before it needs to improvise is a stronger lever than restriction alone.
- (4) removes an entire class of bug (timestamp filtering, `Date.now()` cutoff math) for a simpler, cheaper structure that was already sufficient for the goal — a bounded recent-history window, not a precise 14-day boundary.

**What to observe:**
- Does the FIFO list ever grow unbounded or fail to trim (check `theme-history/used.json` blob size over time — should never exceed 30 entries)?
- Do swapped/collision-avoided themes read as strong as the edition's other themes, or do they read noticeably flatter — the specific failure mode Fix (2) targeted? Spot-check.
- Does the vocab bank actually get used, or does the model keep defaulting to Trap/Tax/Paradox regardless of what's offered? If so, the pool itself may need to be surfaced more forcefully (e.g. weighted encouragement) rather than offered as optional.
- Watch for the vocab pool itself becoming the new overused set after a few months — it's a fixed list of ~65 words, not infinite; may need periodic expansion.
- Re-run the 30-day theme audit once several weeks of history have accumulated under this version specifically (the FIFO redesign invalidates any partial data collected under the first, now-superseded version).

---

## synthesis-theme-word-repetition-dedup (2026-07-23)

*(Superseded same-day by `synthesis-theme-dedup-fifo-and-vocab-bank` above — the 14-day timestamp-filtered history described below was replaced with a fixed-size FIFO list, and a vocabulary bank was added.)*

**What changed:**
- New "theme word history" mechanism in `lib/stories.ts`, mirroring the existing 30-day image-history dedup pattern (`loadImageHistory`/`appendImageHistory`): a single blob (`theme-history/used.json`) storing `{word, theme, usedAt}` entries, read with a 14-day rolling cutoff (`loadThemeHistory`), written to after every synthesis generation (`appendThemeHistory`).
- `themeCoreWord()`: extracts the theme's final non-stopword word (e.g. "Trap" from "The Delegation Trap", "Tax" from "The Authenticity Tax") — repetition concentrates in this position, not the whole phrase.
- `getSynthesis()`'s theme-field prompt instruction: replaced the old static, hardcoded 6-phrase banned list with a dynamic one built from the last 14 days' core words, injected fresh into every generation call.
- Deterministic backstop: after parsing the model's response, if the generated theme's core word still collides with the recent-word set anyway, one small follow-up call forces a single-word-swap replacement (same phrase style, different ending word) before the theme is saved. This is a hard backstop, not just a prompt ask — the old static list was violated 5 of 6 times in the wild, so a proactive instruction alone wasn't trusted to be sufficient here.

**Why:**
- Sourced from a 30-day cross-edition audit (`audit-reports/synthesis-theme-audit-2026-06-25-to-2026-07-24.md`, 140 editions, all fetched directly from `archive/editions/{key}.json` blobs). Found: 37.7% of all themes end in one of just six words (Trap ×16, Tax ×11, Paradox ×10, Problem ×6, Gap ×5, Collapse ×4); 6 exact-duplicate theme clusters including same-day repeats; and 5 of the 6 previously-hardcoded banned phrases still appeared verbatim in the live 30-day window despite being explicitly forbidden.
- The old mechanism (static hardcoded banned-phrase list, no recency awareness at all) had no way to catch new repetition as it accumulated, and wasn't reliably obeyed even for the phrases it did know about.
- Scoped to the theme's *core word* rather than the whole phrase or a fuzzy "concept" match, because the audit found the actual repetition is concentrated there (e.g. "Authenticity" appeared as the theme's root 13 times across Tax/Paradox/Premium/Moat/Collapse/Shortage/Threshold/Leak variants) — word-level matching is deterministic and catches this without needing the model to self-judge semantic closeness.
- 14-day window (not 30) chosen deliberately to bound vocabulary pressure — banning too large a set of "good" tension-nouns (Trap, Tax, Paradox, Collapse, Gap, Threshold, Premium...) for too long risks forcing increasingly contorted or obscure words just to stay unique.
- Did not implement the alternative designs considered first (passing full recent-theme-phrase history into the prompt; banning whole "concept roots"; a pure self-check with no deterministic backstop) — those were judged less reliable since they depend entirely on the model choosing to comply, with no verifiable enforcement, and this file already has direct evidence (the closing-rule violations audited this same week) that explicit prompt instructions get ignored some fraction of the time.

**What to observe:**
- Does the exact-duplicate rate (8.0% this month) drop, and do same-day repeats (07-09 Delegation Trap, 07-23 Trying Gap) stop happening?
- Does the word-level ban meaningfully reduce the Authenticity/Friction-style clustering, or does the model just shift to a different single overused word once these are blocked (watch for a new dominant core word emerging)?
- Does forcing a single-word swap ever produce an awkward or less accurate theme relative to the original — i.e. does avoiding repetition cost Fit? Spot-check swapped themes against that day's actual stories.
- Confirm the new blob reads (`loadThemeHistory` on every generation) don't introduce latency or failure-rate issues in the warm/generation path — both new blob calls are wrapped in try/catch and fail soft (empty history / original theme kept) by design, but worth confirming in practice.
- Re-run the 30-day theme audit in ~3-4 weeks once enough history has accumulated through the new mechanism to give it a fair test.

---

## edition-audit-list-fragments-hooks-persona-fidelity (2026-07-23)

**What changed:**
- Pass 1 Voice rules (line ~1853) and the `repairPunctuation()` rewrite prompt: added an exception to the "no semicolons/colons — always split into two sentences" rule — when the semicolon/colon separates parallel list items rather than two independent clauses, rewrite the list with commas and "and" instead of splitting it into a sentence fragment (e.g. never "legally, financially. Socially available").
- Pass 1 FORBIDDEN list (line ~1872): reinforced the same list-fragment exception, and added a hard last-paragraph self-check ahead of the forbidden list — "does it name something outside today's subject the reader can act on or see differently in their own life? If the last paragraph could run in a product-news trade blog with only the subject swapped out, it has failed this check."
- Pass 2 para5 instruction (line ~1975): extended the existing incomplete-contrast-ending rule to also cover bare negations with no positive completion ("This is not X." with no "it's Y" half).
- Pass 1 reader-orientation instruction (line ~1826): softened per user request (medium risk noted in the audit) — instead of a hard "fuse subject and claim into sentence 1" rule, now *prefers* fusing them when the material supports it, allows the claim to land by sentence 2 at the latest, and explicitly warns against forcing a manufactured-feeling twist into sentence 1.
- Pass 1 Voice rules (line ~1844): added a persona-topic-mismatch rule — when a persona lands on a subject outside its usual territory, apply the persona's characteristic *move* rather than defaulting to generic analyst prose (concrete examples given: Dawn's sustained-attention-on-one-small-thing move, Clive's disproportionate-consequence-in-something-small move).

**Why:**
- Sourced from `edition-analysis` skill audit of First Light edition 2026-07-23 (`audit-reports/edition-2026-07-23-early.md`), 7-story sample, avg 31.0/40.
- List-fragment bug hit 2 stories (S1: "...legally, financially. Socially available to them."; S3: "...itemized, witnessed. Available for prosecutors to weaponize.") — root-caused to the existing semicolon-ban rule giving the model no alternative for rendering a natural 3-item list.
- S5 and S6 both violated *existing, already-specific* closing rules rather than missing ones — confirms these are enforcement failures, not instruction gaps, hence the added hard self-check (S5) and the negation-specific extension (S6: "This is not a choice between two paths." with no completion).
- S4 and S5 both opened with flat, fact-first hooks deferring the claim past sentence 1 — traced to the existing instruction phrasing subject-naming and claim as two sequential moves. Implemented as guidance rather than a hard rule per explicit steer to derisk, since a hard rule risks manufacturing artificial twists on genuinely low-drama subjects (e.g. Apple spec-bump story).
- S3 (persona Clive/Bill Bryson) and S6 (persona Dawn/Mary Oliver) both scored Voice=3 with zero recognizable persona fingerprint on off-territory subjects (murder-case financial analysis, bodybuilding business history) — the existing "persona first" self-check didn't survive contact with a topic mismatch, since persona assignment (`getWriterAssignments`) has no topic-affinity weighting.
- Did not implement from the same audit: Fix 5 (make pullQuote field never-empty with a fallback) — explicitly skipped this pass.

**What to observe:**
- Do S1/S3-style list fragments stop appearing?
- Do S5/S6-style closing violations stop recurring even though the underlying rules already existed — i.e. did the added self-check and negation extension actually change enforcement, or is this a deeper adherence problem the prompt can't fix?
- Do S4/S5-style flat fact-first hooks improve without producing artificial-feeling twists on low-drama subjects (watch specifically for forced drama on genuinely mundane product/spec stories)?
- Does Voice score improve on persona/topic mismatches (watch Dawn, Clive, and other niche personas landing on off-territory subjects in future editions)?
- Re-run the edition-analysis audit on a future edition to confirm.

---

## edition-audit-closing-fragments-repetition (2026-07-21)

**What changed:**
- Pass 1 Voice rules block: added a rule that fragments must be readable as a complete thought on their own — bans dropped-subject fragments like "Means..." (add the subject back in if a fragment needs the previous sentence to parse grammatically).
- Pass 1 Voice rules block: added a rule that restating the article's core insight later for emphasis must be rephrased, never repeated as an identical sentence verbatim.
- Pass 2 paragraph-shaping prompt, para5 instruction: removed "open question" as an acceptable landing type (it directly contradicted Pass 1's existing FORBIDDEN-list rule against question endings). Added an explicit rule that the article's actual final sentence (para5's last sentence, or remainder's last sentence when remainder is non-empty) must be a complete, standalone declarative statement, never ending on a question mark or an unresolved contrast setup ("The question isn't whether X..." without completing the "it's whether Y" half).

**Why:**
- Sourced from a re-run of the `edition-analysis` skill audit (`audit-reports/edition-2026-07-21-afternoon.md`) after fixing the skill itself to score full article pages instead of truncated edition-page teasers for brief-style cards (see skill note in the report; skill lives at `~/.claude/agents/edition-analysis.md`, outside this repo).
- Closing was the edition's weakest dimension (2.7/5 avg): S5 and S9 ended on unresolved contrast setups ("The question isn't whether the safeguard works." — never completes), S6 ended on a stacked double rhetorical question — all automatic score-1s. Root-caused partly to Pass 2's para5 instruction literally listing "open question" as a valid landing type, contradicting Pass 1's own no-question-ending rule.
- Dropped-subject fragments appeared in 3 stories (S5: "Landed with the weight of a small stone..."; S9: "Means he wasn't deterred by the technology's existence..."), with no prompt guardrail requiring a fragment to carry its own subject.
- Verbatim intra-article repetition appeared in 3 stories (S9's "The camera didn't stop abuse. It professionalized it." appears twice, identically; same for S8). Note: `removeDuplicateSentences()` already runs as a code-level dedup pass on the shaped body — it evidently isn't catching every case (likely a normalization mismatch on punctuation/quotes), so this prompt-level instruction is a second line of defense at the source rather than a replacement for the code check.
- Did not implement from the same audit: Fix 4 (mandatory pull-quote selection for every story regardless of cardStyle) — not approved in this pass.

**What to observe:**
- Do S5/S6/S9-style unresolved endings stop recurring, and does Closing's dimension average improve above 2.7?
- Do dropped-subject fragments ("Means...", "Landed with...") disappear from new articles?
- Does verbatim self-repetition stop appearing, confirming the prompt-level fix catches what the code-level `removeDuplicateSentences()` dedup misses? If it still recurs, investigate why the dedup function's normalized-key match (`s.trim().toLowerCase().replace(/\s+/g, " ")`) isn't catching these cases — likely differing punctuation or quote characters between the two occurrences.
- Re-run the edition-analysis audit (with the corrected full-article-page Step 1) on a future edition to confirm.

---

## edition-audit-title-consistency-named-example (2026-07-21)

**What changed:**
- Pass 1.5 metadata extraction `ownedTitle` field: added a constraint that the title must reference the same specific subject, time period, and setting as the `summary` field — no titling off a historical aside or tangential detail the summary doesn't actually focus on.
- Same field: added a rule that if `summary` contains a counter-intuitive claim or mechanism ("X happens not because of A, but because of B"), the title must surface that claim rather than settle for a neutral fact count or trivia statement.
- Pass 1.5 `summary` field: added a rule requiring at least one named example (person, product, organization, place) when the article names one, instead of defaulting to generic references ("artists", "a report", "officials").

**Why:**
- Sourced from `edition-analysis` skill audit (`audit-reports/edition-2026-07-21-afternoon.md`), Afternoon edition, 9-story sample, average 28.0/40.
- S3 scored Headline=1: title read "Binoculars Replaced Bird Traps in 1900s Europe" while the card body was entirely about present-day Southeast Asian bird-singing contests — different continent, century, and thesis (title/body topical drift, root-caused to no cross-check between the two Pass 1.5 fields).
- S6 showed a milder version of the same pattern: title's "40 Percent" statistic wasn't supported anywhere in the shown body.
- S8 scored Headline=2 despite its own summary containing a strong "self-fulfilling prophecy" mechanism claim — title settled for a flat fact count ("Nolan's Five Films Shot on IMAX Cameras") instead of surfacing it.
- S3 and S4 both scored Voice=2 with no named person/place/organization despite source material likely containing one — generic nouns only ("artists", "Southeast Asia", "enforcement and education").
- Did not implement from the same audit: Fix 1 (reader-application clause on brief summaries) or Fix 2 (always populate a pull quote) — not approved in this pass.

**What to observe:**
- Does S3-style topical drift (title anchored to a different subject/setting than the body) stop recurring?
- Do fact-count/trivia titles (S8-style) get replaced with claim-forward titles when a summary contains a real mechanism claim, without running long or feeling breathless?
- Do previously-generic briefs (S3/S4-style) start carrying a named anchor, and does the "where available" gate correctly avoid forcing a name onto genuinely aggregate/statistical stories?
- Re-run the edition-analysis audit on a future edition to see if Headline and Voice dimension averages improve, and whether the title/summary consistency issue recurs.

---

## writing-audit-fixes-persona-decimal-question (2026-07-21)

**What changed:**
- Pass 1 Voice rules block: added a "persona first" line as the top rule — "every rule below is subordinate to your persona's voice and voiceReminder above... reread your draft and confirm at least 2 sentences are ones only this persona — not a generic sharp analyst — would have written."
- Pass 1 FORBIDDEN list: added "ending the piece on a question — the final sentence must be a declarative claim, even if the paragraph before it poses a question to build toward it."
- Pass 2 sentence-splitting `ABBREV2` regex extended from `/\b(Mr|Mrs|Ms|Dr|Prof|St|Jr|Sr|vs|etc|No|Vol|pp)\./g` to also protect single-capital initials (`\b[A-Z]\.(?=\s?[A-Z])`) and decimal points (`(?<=\d)\.(?=\d)`) from being read as sentence boundaries.

**Why:**
- Sourced from `writing-quality` skill audit (`audit-reports/writing-2026-07-21.md`), 7-article S1 sample, average 24.6/40.
- Voice dilution (4/7 articles, e.g. Edmund/Sacks piece read as generic mechanism analysis): the generic "Voice rules" block competed with persona `style`/`voiceReminder` with no stated precedence.
- Rhetorical-question endings: Mummers/Opal article scored Closing=1 by ending on two consecutive questions; the FORBIDDEN list banned other weak-ending patterns but not this one explicitly.
- Mid-sentence truncation (2/7 articles): the sentence-splitter treated "1.3" and "E." (initial before a name) as sentence ends, then the paragraph-limit slice discarded everything after — Cronkite/Bruno's hook literally cut off mid-number ("...on a 1.") and Mummers/Opal's body cut off mid-name ("When folklorists like E.").
- Did not implement: Fix 1 (pull quote never rendered — `CARD_STYLES` only assigns `"full"`/`"pullquote"` to 2 of 11 slots, a rendering-layer change with layout implications) or Fix 2 (25-word hook ceiling) — not approved in this pass.

**What to observe:**
- Do personas read more distinctly, especially ones previously flagged as diluted (Edmund/Sacks, Rosa/Roxane Gay, Bruno/Talese, Arlo/Ronson)?
- Does the persona-first self-check produce awkward "trying too hard" persona affect, or does it stay organic?
- Do articles stop ending on rhetorical questions? Watch for the FORBIDDEN list becoming checklist-y (same risk noted in `hardened-reader-life-transfer`).
- Does the extended initials regex (`\b[A-Z]\.(?=\s?[A-Z])`) ever over-match a genuine sentence boundary (single capitalized word ending a sentence, followed by a capitalized sentence-starter)? Spot-check a sample of live articles.
- Re-run the writing-quality audit in ~1-2 weeks to see if Voice, Closing, and Readability dimension averages improve.

---

## owntitle-colon-code-enforcement (2026-07-10) — CURRENT STABLE

**What changed:**
- After Pass 1.5 JSON parse, a code check replaces any `:` in `ownedTitle` with ` — ` (em-dash with spaces)
- Handles both `X: Y` and `X:Y` patterns via `replace(/\s*:\s*/, " — ")`

**Why:**
- Prompt FORBIDDEN list bans colons but Haiku ignores it on metadata fields (~30% of titles still used colon-subtitle format even with explicit instruction)
- Code enforcement is zero-fail: `repairPunctuation()` already uses this pattern for body prose; extended it to metadata

**What to observe:**
- Titles with natural colon structure — do they read as clean em-dash titles or awkward?
- Any titles where the colon was semantic (ratios, times) — these would be wrongly converted. Hasn't appeared in practice but worth watching.

---

## remove-duplicate-sentences (2026-07-10) — CURRENT STABLE

**What changed:**
- New `removeDuplicateSentences(text: string): string` function in `lib/stories.ts`
- Splits body into paragraphs, then sentences. Tracks all seen sentences (lowercased, whitespace-normalized) in a `Set`. Filters any sentence seen before.
- Called after `repairPunctuation()` in Pass 2 assembly: `body = removeDuplicateSentences(body)`

**Why:**
- Haiku occasionally repeats verbatim sentences across paragraphs, especially when Pass 2 scaffold restructure pulls from Pass 1 prose and reuses a key line
- No model-level fix for this — it's a structural artifact of multi-pass writing. Code dedup is deterministic and silent.

**What to observe:**
- Does the dedup silently remove legitimate variation? (Two sentences that start identically but end differently — regex splits on `.!?` so they should be distinct)
- Are any articles noticeably shorter post-dedup? If so, a pass is producing too much repetition upstream.

---

## fitness-gate-raised-to-3 (2026-07-10) — CURRENT STABLE

**What changed:**
- Fitness gate threshold raised from `<= 2` to `<= 3`
- Now: fitness 1–3 on S1/S2 slots (slotIndex ≤ 1) throws early, triggering bench backfill
- Fitness 3 criteria: "Real subject with tension; article must find its own angle but source is legitimate starting point"

**Why:**
- Initial gate (`<= 2`) blocked PR/product launches but allowed fitness-3 sources through to S1/S2
- A fitness-3 source means the article must manufacture its own angle — the source itself has no real finding. If a bench story scores 4 or 5, the pipeline was giving S1 to a weaker story because it arrived first in the feed, not because it was better.
- Rule: S1/S2 should reflect the best available sources in the day's feed, not just "not a press release"

**What to observe:**
- How often does the gate fire? Check Vercel logs for `[fitness-gate]` entries.
- Is S1/S2 noticeably stronger after this change?
- Are bench pools deep enough? If most stories score ≤3, the gate may reject everything and fall back to the last bench item regardless.

---

## hardened-reader-life-transfer (2026-07-10) — CURRENT STABLE

**What changed:**
- Two new entries added to Pass 1 FORBIDDEN list:
  1. `"endings that stay inside the subject world — the final paragraph must connect to something the reader can see in their own creative practice, career, or way of thinking, not just a conclusion about the subject itself"`
  2. `"named cases that appear without setup — every specific person, company, or incident you name must be introduced and connected before the final sentence, not dropped in as a closing gesture"`

**Why:**
- Meow Wolf article (written after `reader-life-reorientation`) still ended at the subject level. The rhythm step 5 reader-life clauses were appended to existing instructions — Haiku treated them as secondary when the primary instruction was already satisfied.
- Elevating reader-life transfer to FORBIDDEN-list status gives it equal weight with colon/semicolon bans — the highest enforcement signal available in prompt-only context.
- Disney non-sequitur in the same article: the named-case requirement (Pass 1 global) caused Haiku to drop "Disney" into the final sentence with no prior setup. Added setup requirement to block this pattern.

**What to observe:**
- Do articles now reliably land on reader-life territory in the final paragraph?
- Does the Disney/named-case-without-setup pattern recur? No code-level catch is possible; this is prompt-only.
- Does the FORBIDDEN framing feel oppressive to the voice? If articles start sounding like they're completing a checklist, the enforcement is too heavy.

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

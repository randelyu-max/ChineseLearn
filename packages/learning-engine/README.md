# HanziQuest learning engine

This package contains deterministic, side-effect-free learning rules. Callers own persistence,
event idempotency, clocks, and seeded randomness.

## Algorithm versions

- `bkt-v1`: quality normalization and bounded BKT mastery updates.
- `stability-v1`: exponential retention, stability updates, and safe review intervals.
- `confusion-v1`: canonical shared pairs with directional opportunity/error statistics.
- `session-planner-v1`: prerequisite-safe, seeded activity selection with pacing and frustration
  guards.
- `diagnostic-v1`: audio-first, seeded six-axis Pinyin/Hanzi diagnostic with bounded confidence,
  neutral starting-point recommendations, and explicit stop reasons.
- `pinyin-evidence-v1`: deterministic, axis-aware reduction of independent Hanzi evidence after
  visible or revealed Pinyin support, without changing answer correctness.

`confusion-v1` activates a direction only after at least five opportunities, at least three paired
mis-selections, and a conditional error probability of at least `0.35`. The pair risk is the larger
directional probability. Active risk maps deterministically to one, two, or three focused practice
activities; when later correct opportunities lower the probability below the threshold, focused
practice returns to zero. Active pairs expose the editorially defined 1/3/7-day recheck ladder.

`session-planner-v1` uses the documented priority weights and 45/20/25/10 category targets. Recent
accuracy and full-hint use cap new concepts at zero through four. Candidates outside the supplied
curriculum position or with unmet prerequisites are excluded. The deterministic ordering prevents
three consecutive high-difficulty activities and requires a final activity with predicted success
of at least `0.90`; without such a closer, it returns an explicit empty safe plan.

`diagnostic-v1` starts each axis at level zero and moves one level at a time after each observation.
It rotates across spoken audio comprehension, Pinyin recognition, tone discrimination, Hanzi
recognition, word reading, and sentence reading; ties prefer audio and Pinyin presentations.
Confidence requires bounded evidence plus either an observed upper boundary or success at the
highest level. The default limits are six minutes, 36 items, and five consecutive errors. Callers
must inject both a clock and a random source; `createSeededRandom` supplies the reproducible
reference RNG. Results contain numeric levels, confidence, evidence counts, neutral machine-code
starting points, Pinyin support mode, and one of `confidence_reached`, `consecutive_errors`,
`time_limit`, `item_limit`, or `content_exhausted`.

`pinyin-evidence-v1` preserves quality exactly when no Pinyin support is present. For
Hanzi-dependent evidence, visible Pinyin has weight `0.75`, explicitly revealed Pinyin has weight
`0.45`, and a revealed full answer has weight `0.10`. Spoken-audio, Pinyin-recognition, and
tone-discrimination evidence is not discounted. The exported result keeps `isCorrect` unchanged,
clamps quality to `[0, 1]`, and records the axis, support level, base quality, weight, weighted
quality, and algorithm version. Callers compose this result with BKT exactly once.

Changing these rules requires a new algorithm version plus unit and invariant coverage.

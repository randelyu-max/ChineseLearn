# HanziQuest learning engine

This package contains deterministic, side-effect-free learning rules. Callers own persistence,
event idempotency, clocks, and seeded randomness.

## Algorithm versions

- `bkt-v1`: quality normalization and bounded BKT mastery updates.
- `stability-v1`: exponential retention, stability updates, and safe review intervals.
- `confusion-v1`: canonical shared pairs with directional opportunity/error statistics.
- `session-planner-v1`: prerequisite-safe, seeded activity selection with pacing and frustration
  guards.

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

Changing these rules requires a new algorithm version plus unit and invariant coverage.

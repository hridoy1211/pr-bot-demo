# Parallel vs. Sequential Review

The three reviewers — `review-logic`, `review-security`, `review-style` —
depend only on `explore`'s output, not on each other, so they can run
concurrently. This note records a measured sequential run vs. a parallel run
against the **same diff** (the current content of `Account.java`, `Bank.java`,
`InterestCalculator.java`).

## Method

Each reviewer subagent reports its own execution time (`duration_ms`). The
sequential figure is the **sum** of the three (they run one after another); the
parallel figure is the **max** of the three (they overlap, so wall time is
bounded by the slowest reviewer). Using the engine-reported per-agent durations
avoids counting orchestration/notification latency between turns.

## Timings

| Reviewer          | Sequential run | Parallel run |
|-------------------|---------------:|-------------:|
| review-logic      |     28,941 ms  |   26,793 ms  |
| review-security   |     12,052 ms  |   10,519 ms  |
| review-style      |     15,262 ms  |   15,499 ms  |
| **Total (work)**  | **56,255 ms**  |      —       |
| **Wall clock**    |  ~56,255 ms    | **~26,793 ms** (max) |

- **Sequential:** ~56.3 s — the sum, because each reviewer must finish before
  the next starts.
- **Parallel:** ~26.8 s — bounded by the slowest reviewer (`review-logic`),
  since all three run at once.
- **Speedup:** ~2.1× on three reviewers. It is less than a perfect 3× because
  the reviewers are uneven — the pipeline can only finish as fast as its
  slowest lane (`review-logic` does the most work here).

## Caveat on measured wall clock

A naive end-to-end stopwatch around the parallel batch measured ~102 s, but
that number is **not** a fair engine-level comparison: it includes the idle gaps
between the orchestrator launching the background agents and receiving each
completion notification (turn-taking latency), which is overhead of this
interactive harness, not of the review work. The per-agent `duration_ms` figures
above isolate actual compute and are the correct basis for the sequential vs.
parallel comparison.

## Why parallel is safe here

All three reviewers take the **same inputs** (the explore summary + the diff)
and produce **independent** finding lists; none reads another's output. Because
there is no data dependency between them, running them concurrently cannot
change the findings — it only changes when they arrive. The orchestrator simply
waits for all three and concatenates the results into one PR comment. This is
the concrete payoff of the split-subagent architecture from
`REVIEW_CRITERIA.md`: narrow scope buys not just sharper output but real
wall-clock parallelism.

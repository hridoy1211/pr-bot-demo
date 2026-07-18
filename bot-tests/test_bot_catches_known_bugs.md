# Bot Test — "catches known bugs"

This is a **test of the review bot**, not of the Java app. It verifies that the
`review-logic` subagent flags a known, unfixed bug when it reviews a PR that
leaves that bug in place.

## Fixture

`fixtures/known-bug-diff.patch` — a diff that modifies **only**
`InterestCalculator.java` in a trivial way (adds one explanatory comment above
`calculateInterest`) and **does not** fix the existing boundary bug: at exactly
`balance == 10000`, the code applies the GOLD rate (`>= 10000`) even though the
Javadoc says `10000` belongs to the SILVER tier (`1000 < balance <= 10000`).

This simulates a realistic PR: green CI, an untouched real bug.

## Procedure

1. Provide the `review-logic` subagent with:
   - a short `explore`-style summary of the change, and
   - the contents of `fixtures/known-bug-diff.patch`.
2. Capture the subagent's finding lines.

## Assertion

**PASS** if the output references the boundary/tier mismatch — i.e. it contains
at least one of these keywords (case-insensitive):

- `10000`
- `boundary`
- `tier`
- `gold`
- `silver`

**FAIL** otherwise (the bot missed the known bug).

## How to run in this environment

The orchestrator invokes the `review-logic` subagent (per
`.claude/agents/review-logic.md`) against the patch, then applies the keyword
assertion above and prints `PASS` or `FAIL`. If it FAILs, refine
`review-logic.md` and re-run until it PASSes.

## Result log

- **Run 1 — PASS.** The `review-logic` subagent returned:

  ```text
  [src/main/java/com/demo/bank/InterestCalculator.java:20] HIGH - Boundary
  mismatch: `balance >= 10000` returns GOLD rate at exactly 10000, but the
  Javadoc spec says `1000 < balance <= 10000` is SILVER, so balance == 10000.0
  is misclassified - change the silver condition to
  `balance > 1000 && balance <= 10000` (and the gold branch to `balance > 10000`).
  [src/test/java/com/demo/bank/InterestCalculatorTest.java] MEDIUM - No test
  asserts the 10000.0 tier boundary (existing tests only cover 500/5000/15000),
  so the misclassification is not caught by the green build - add a test
  asserting `calculateInterest(10000.0)` equals `10000.0 * SILVER_RATE`.
  ```

  Keyword assertion matched on `10000`, `boundary`, `tier`, `gold`, and
  `silver` — all five present. No refinement of `review-logic.md` was required;
  the prompt already anchors the reviewer to this exact boundary case.

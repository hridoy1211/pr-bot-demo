# Context Management Strategy

How the **pr-bot-demo** review bot manages context across its subagents. This
is specific to this pipeline (`explore` → `review-logic` / `review-security` /
`review-style`), not generic guidance.

## 1. What passes from `explore` → the review subagents

The reviewers never receive raw file contents. `explore` reads the changed
files plus their direct callers/imports and emits a **compact structured
summary only**: per changed file, the affected methods, a one-line "why it
matters" risk note, and the direct callers/tests (the blast radius), with
`FILE:LINE` anchors. That summary — plus the **diff/patch itself** — is the
entire payload handed to each reviewer.

Concretely, for this repo a review subagent receives something like:

- `Bank.java:41 transfer()` — credits `to.deposit()` before `from.withdraw()`;
  callers: `BankTest.transferMovesMoneyBetweenAccounts`.
- `InterestCalculator.java:17 calculateInterest()` — gold boundary uses
  `>= 10000`; tests omit the `10000.0` case.

…rather than the full text of `Bank.java` and `InterestCalculator.java`. A
reviewer that needs a few more lines of a specific method can still use its
`Read`/`Grep` tools to pull just that span on demand — but the *default* handoff
is the summary, so the common case stays cheap.

## 2. How large diffs are truncated / chunked

Small changes to this repo (a few methods) fit whole, so no chunking is needed.
For a diff that exceeds a reasonable size budget the bot degrades gracefully:

- **Per-file chunking.** Split the diff on file boundaries and run the
  explore → review cycle once per file (or per small group of files). Findings
  are concatenated at the end. Because reviewers key off `FILE:LINE`, splitting
  by file loses no cross-references that matter for a per-file finding.
- **Hunk-level truncation with context.** Within a very large single file, keep
  only the changed hunks plus a few lines of surrounding context (enough to see
  the enclosing method signature and any boundary conditional), and drop
  unrelated unchanged regions. The explore summary records which methods were
  truncated so a reviewer knows coverage was partial.
- **Budget guard.** A configurable max-diff-size threshold (e.g. characters or
  approximate tokens) decides when chunking kicks in; below it, the diff is
  passed whole. If even a single hunk is pathologically large, the bot reports
  that the change was too large to review fully rather than silently dropping it.

## 3. Why three separate review calls keep each context window smaller

Running `review-logic`, `review-security`, and `review-style` as three separate
subagent calls — instead of one prompt asking for all three — keeps each
individual context window smaller and sharper:

- Each call loads only *its* system prompt (one lane of rules) plus the shared
  summary + diff. No single call carries the union of all three rule sets, so
  no window has to hold "logic + security + style" instructions at once.
- Narrow scope means the model isn't juggling unrelated concerns in one
  reasoning pass, which reduces cross-talk and false positives (a style nit
  bleeding into a logic verdict, etc.).
- The three calls are independent — they depend only on `explore`'s output, not
  on each other — so they can run concurrently (see `PARALLEL_NOTES.md`) without
  any of them needing the others' context.

The trade-off is the summary + diff is sent three times; that duplication is
deliberate and cheap because the summary is small, and it buys three focused
windows instead of one crowded one.

## 4. What happens to each subagent's context after it returns

Each subagent runs in its **own isolated context window that is discarded when
it returns**. The only thing that survives is its **structured output** — the
explore summary, or a reviewer's `[FILE:LINE] SEVERITY - description - fix`
lines. That output persists to the orchestrating session, which aggregates the
findings into the final PR comment. All the intermediate reading a subagent did
(the files it opened, its `Grep` results, its scratch reasoning) is dropped and
never enters the orchestrator's window. This is what keeps the orchestrator's
context flat regardless of how much each subagent had to read internally: the
orchestrator only ever accumulates compact summaries and findings, not the raw
material they were derived from.

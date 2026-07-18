# Review Criteria

## Subagent architecture — why four narrow agents instead of one reviewer

The review pipeline is split into an **explore** subagent plus three
independent reviewers (**review-logic**, **review-security**, **review-style**,
defined under `.claude/agents/`) rather than a single monolithic reviewer, for
three concrete reasons:

- **Context isolation.** Each subagent only ever loads what its job needs —
  explore reads the changed files and their direct callers, then hands the
  reviewers a compact summary instead of raw files. Every subagent's context
  window stays small and focused, so none of them drowns in unrelated code and
  the token cost per call stays low.
- **Output sharpness.** A narrow scope means fewer false positives. A logic
  reviewer that is told to ignore style and security won't waste findings (or
  hallucinate) on things outside its lane; each agent's prompt anchors it to a
  specific, verifiable set of issue types from this codebase.
- **Parallelizability.** review-logic, review-security, and review-style do not
  depend on each other — they depend only on explore's output. That means once
  explore returns, all three can run concurrently, cutting wall-clock review
  time (demonstrated in `PARALLEL_NOTES.md`).

---

This document defines what a "good review" of a change to **pr-bot-demo**
must check for. The definitions are grounded in the concrete issue categories
present in this codebase (see `TESTING_NOTES.md`), not generic boilerplate, so
the review bot has a real, verifiable target for each rule.

A finding in any category should be reported as:

```text
[FILE:LINE] SEVERITY - description - suggested fix
```

---

## 1. Logic errors

Flag any change whose runtime behavior diverges from its documented spec,
including boundary/off-by-one mistakes and incorrect operation ordering. The
canonical example here is `InterestCalculator.calculateInterest()`: the Javadoc
says silver is `1000 < balance <= 10000` and gold is `balance > 10000`, but the
code applies the gold rate at exactly `10000` — so every `<=` / `<` / `>=`
boundary in a changed conditional must be checked against the documented
inclusive/exclusive intent. Operation ordering is equally in scope: in
`Bank.transfer()` the recipient is credited (`to.deposit`) *before* the sender
is debited (`from.withdraw`), so a failed withdrawal leaves money created from
nothing — any sequence of mutating calls that can partially fail must be
ordered (or guarded) so a mid-operation throw cannot leave inconsistent state.
Also flag comparisons that only work by accident, such as `==` on `String`
(as in `Account.checkPin()`) which passes for interned literals but fails for
runtime-built strings.

## 2. Missing tests

A change is under-tested when it adds or alters behavior that no test
exercises, especially the branch or boundary the change actually affects. For
this repo that means: a negative-amount path (`deposit`/`withdraw` never
validate `amount > 0`), the exact boundary value `balance = 10000.0` for
interest tiers, a `checkPin()` call with a runtime-built (non-literal) PIN
string, and `transfer()` when the sender has insufficient funds. A green build
is **not** sufficient evidence of coverage — the existing suite passes 9/9 while
leaving every one of these cases untested, so the reviewer must ask "does a
test assert the specific new/changed behavior and its edge values?" rather than
"does CI pass?". Any new conditional branch, boundary, or error path introduced
by a diff should have a corresponding assertion, and its absence is a finding.

## 3. Security issues

Flag secrets or credentials stored or exposed insecurely, unsafe string
handling that resembles an injection pattern, and missing input validation on
externally supplied values. Concrete anchors in this codebase: `Account.pin`
is held as plaintext and leaked through a public `getPin()` getter (credentials
must be hashed and never exposed via a getter), and `Bank.findAccountByOwner()`
concatenates unsanitized input into a raw `"name = '" + ownerName + "'"` query
string — an injection-shaped smell that must be flagged even though no real
database is wired up, because the pattern is what a reviewer must catch before
it reaches one. Unvalidated numeric input (e.g. amounts that are never checked
for sign or range) also belongs here when it can drive unsafe state. The bot
should treat these as high severity because they concern data safety and
credential exposure, not mere style.

## 4. Style / maintainability

Flag duplicated logic, unclear naming, magic numbers, and overly long methods —
all of which reduce maintainability but do **not** by themselves make the code
incorrect. The reference case is `Bank.totalBalanceForGoldTier` /
`...SilverTier` / `...BronzeTier`: three near-identical loops with the magic
numbers `10000` and `1000` duplicated here and again in `InterestCalculator`,
which a single parameterized `totalBalanceForTier(List<Account>, Tier)` plus a
shared `Tier` enum would collapse. Old-style indexed `for` loops (as in
`findAccountByOwner` / `findAccountById`) where a for-each or
`Stream.filter(...).findFirst()` reads more clearly also belong here. Findings
in this category are always **low** severity and must never block a PR — they
are advisory cleanups, reported so a human can choose to act on them.

# Testing Notes — Answer Key (for assignment write-up only)

This file documents every issue **intentionally** planted in this codebase.
Use it to:
- Write your `REVIEW_CRITERIA.md` (Step 2)
- Write TDD tests that check whether your bot catches these (Step 7)
- Pick a refactor target (Step 8)

Current test suite (`mvn test`) **passes fully (9/9 green)** on this code —
that's on purpose. The existing tests don't exercise the edge cases below,
so the bugs are invisible until you (or the bot) look closely or add new
tests. This mirrors a realistic PR: CI is green, but real problems exist.

---

## 1. Logic errors

| Where | Bug | Why it matters |
|---|---|---|
| `Account.checkPin()` | Compares strings with `==` instead of `.equals()` | Works "by accident" for string literals (interning) but fails for any PIN string built at runtime — a real login could incorrectly reject a correct PIN |
| `Account.deposit()` / `Account.withdraw()` | No validation that `amount > 0` | `withdraw(-1000)` on a 500 balance produces a balance of 1500 — a negative "withdrawal" silently acts as a deposit |
| `Bank.transfer()` | Calls `to.deposit(amount)` **before** `from.withdraw(amount)` | If the sender has insufficient funds, `withdraw()` throws — but the recipient has already been credited. Money is created from nothing. |
| `InterestCalculator.calculateInterest()` | Boundary mismatch vs. the documented spec | Javadoc says silver tier is `1000 < balance <= 10000`, but the code uses `balance >= 10000` for gold — at exactly 10000, code gives 3% instead of the documented 2% |

## 2. Missing tests

- No test for `deposit()`/`withdraw()` with a negative amount
- No test for `checkPin()` with a non-literal (runtime-built) PIN string
- No test for `transfer()` when the sender has insufficient funds
- No test at the exact boundary value `balance = 10000.0` in `InterestCalculatorTest`

## 3. Security issues

- `Account.pin` is stored as plain text and exposed via a public `getPin()` getter — no hashing, no access control
- `Bank.findAccountByOwner()` builds a raw string by concatenating unsanitized input (`"name = '" + ownerName + "'"`), mimicking an unsafe SQL-style query pattern — a bot should flag this as an injection-shaped smell even though there's no real database here

## 4. Style / maintainability (refactor candidates — Step 8)

- `Bank.totalBalanceForGoldTier` / `...SilverTier` / `...BronzeTier` — three near-identical methods with duplicated loop logic and magic numbers (`10000`, `1000`) repeated across `Bank` and `InterestCalculator`. Good refactor: one parameterized method (e.g. `totalBalanceForTier(List<Account>, Tier)`) with a shared `Tier` enum, replacing the duplicated magic numbers.
- `Bank.findAccountByOwner` / `findAccountById` — old-style indexed `for` loops instead of a for-each or `Stream.filter(...).findFirst()`.

**Refactor exercise suggestion:** extract a `Tier` enum + single `totalBalanceForTier()` method, then rerun `mvn test` to confirm all 9 tests still pass (behavior unchanged).

---

## Suggested "known bug" PR for Step 7 / Step 12

Open a PR that only touches `InterestCalculator.java` or `Bank.transfer()`
(pick one) without fixing the bug. A good bot should flag the boundary
mismatch or the transfer ordering issue in its review comment. That PR
becomes your "live PR" for Step 12, and the bot's comment on it is your
TDD proof for Step 7.

---

## Refactor Log

**Tier reporting (Step 8).** The three near-identical methods
`totalBalanceForGoldTier` / `SilverTier` / `BronzeTier` in `Bank.java` were
replaced by a single `totalBalanceForTier(List<Account>, Tier)` method backed by
a new `Tier` enum (`Tier.java`), which now owns the previously duplicated
threshold magic numbers (`1000`, `10000`) as `lowerExclusive < balance <=
upperInclusive` ranges. The enum encodes the *exact* boundaries the old methods
used (BRONZE `<= 1000`, SILVER `1000 < b <= 10000`, GOLD `> 10000`), so this is
a pure restructuring — it deliberately does **not** touch the separate
`InterestCalculator` boundary bug. No existing test referenced the three removed
methods, so `BankTest.java` needed no changes. `mvn test` was run before the
change (9/9 green) and again after (9/9 green, BUILD SUCCESS), confirming the
refactor preserved behavior.

---

## Auto-fix Log (Step 11)

**Safe pattern auto-correction (Phase 8).** The PR review bot now detects and
**automatically commits** SAFE patterns that are syntactically low-risk:
- String comparison with `==` instead of `.equals()` → auto-corrected to `.equals()`
- Other obvious safety wins (null checks, basic validation)

**Unsafe patterns are NEVER auto-fixed** — they are flagged as findings requiring
human review:
- Logic bugs (boundary mismatches, operation ordering)
- Security issues (plaintext credentials, injection patterns)
- Behavior changes (which may have intentional side effects)

Auto-fixes appear in the PR comment as ✅ Auto-fixed (committed to branch) with the
commit message "Auto-fix: N safe pattern(s) fixed" visible in the branch history.
The distinction is always made clear: automated safety improvements vs. human-review
findings. For a detailed walkthrough, see `LIVE_PR_TEST_PLAN.md`.


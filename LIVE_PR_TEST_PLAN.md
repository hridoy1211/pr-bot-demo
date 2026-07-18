# Live PR Test Plan — Phase 9

Before opening a real PR for live testing, complete these manual steps.

## Manual Setup Checklist

All of these require **your** explicit action — the bot cannot do them.

- [ ] **Add the Anthropic API secret to GitHub**
  1. Go to your GitHub repository Settings → Secrets and variables → Actions
  2. Create a new repository secret named `ANTHROPIC_API_KEY`
  3. Paste your Anthropic API key (from https://console.anthropic.com/account/keys)
  4. Save it

- [ ] **Verify issue labels exist** (optional but recommended)
  - The issue-triage bot will attempt to apply labels like `type:bug`, `type:enhancement`, `priority:high`, etc.
  - If these labels don't exist, GitHub will silently fail. You can pre-create them in Settings → Labels, or let the first triage run fail and then create them.

- [ ] **Push the current branch to GitHub**
  - The bot code and workflows now live on this branch
  - Example: `git add .; git commit -m "Phase 8-9: Auto-fix + Issue triage + Live PR test plan"; git push -u origin <your-branch-name>`

- [ ] **Open a real PR on GitHub** (do not merge yet!)
  - Create the PR with the title and description below
  - This will trigger the pr-review.yml workflow
  - The bot will post a review comment within 30–60 seconds
  - If auto-fixes are detected, they will be committed to the branch (watch the "Commits" tab to verify)

---

## Suggested Test PR: "Boundary Bug in Interest Calculation"

Use this title and description to exercise the bot's ability to catch the known bug:

**Title:**
```
Fix interest calculation for boundary tier values (balance = 10000)
```

**Description:**
```
This PR adds improved test coverage for the interest calculator at the exact boundary value of 10,000.

The Javadoc for InterestCalculator.calculateInterest says:
- SILVER: 1000 < balance <= 10000 (rate: 2%)
- GOLD: balance > 10000 (rate: 3%)

But at exactly balance = 10000, the code incorrectly applies the GOLD rate.

This PR aims to add a test case and ensure the boundary is correct.

## Changes
- Added test case for balance = 10000 to InterestCalculatorTest.java
- TODO: Fix the boundary condition if needed after review
```

**Why this works for testing the bot:**
- The "TODO: Fix..." signals that a known issue exists
- When review-logic runs, it should catch the boundary mismatch and flag it
- The PR itself doesn't actually fix the bug (on purpose), so the bot has something real to report
- Security and style reviewers will also find the string injection pattern in Bank.findAccountByOwner()

---

## What to Expect When the Bot Runs

After you open the PR, within ~30–60 seconds:

1. **GitHub Actions → pr-review.yml** will trigger
2. **The bot will:**
   - Fetch your PR diff
   - Run explore (summarize the changes)
   - Run review-logic, review-security, review-style in parallel
   - Detect any SAFE auto-fixes (if the diff touches string comparisons)
   - Post ONE comment on the PR with findings

3. **The PR comment will show:**
   - `✅ Auto-fixed (committed to branch)` — if any safe patterns were corrected
   - `🧠 Logic` — the boundary bug and missing test coverage
   - `🔒 Security` — the injection-shaped pattern in findAccountByOwner()
   - `🎨 Style (LOW: advisory)` — any style findings

4. **If auto-fixes were applied:**
   - A new commit will appear on the branch
   - The commit message will say "Auto-fix: safe pattern(s) fixed"
   - You can see the diff in the "Commits" tab

---

## Verification Steps

After the bot posts its comment:

- [ ] **Check that the comment appears** — it should be under the PR discussion
- [ ] **Verify the findings are correct:**
  - `review-logic` should mention the boundary mismatch at balance = 10000
  - `review-security` should mention the injection pattern
  - `review-style` may mention the duplicated tier methods (already refactored in Phase 5, but the pattern recognition is useful to confirm)
- [ ] **If auto-fixes were committed,** check the commit diff:
  - Only safe patterns (string ==) should be fixed, never logic changes
- [ ] **Run `mvn test`** locally — confirm all tests still pass (the bot doesn't break the build)

---

## Troubleshooting

**The bot didn't post a comment:**
- Check GitHub Actions → pr-review.yml → review job → Run PR review bot step
  - Look for errors like `Missing required environment variable: ANTHROPIC_API_KEY`
  - Confirm the secret was added to Settings → Secrets
- If no action ran at all, check that the pr-review.yml file is on the branch you pushed

**The bot posted an empty review:**
- This means explore, review-logic, review-security, review-style all returned "No findings"
- If you used the suggested test PR above, at least the boundary bug should be caught
- Try adding an obviously bad change (e.g., delete a semicolon) to confirm the pipeline works

**Auto-fixes weren't committed:**
- The bot attempts git operations; if they fail, it just logs a warning and continues
- This is safe-fail by design — the review findings are still posted
- Check the GitHub Actions log for "Could not commit auto-fixes" messages

**Issue-triage.yml workflow didn't run:**
- It only triggers on `issues: [opened]`, not on PR creation
- Open a new issue to test it: GitHub UI → Issues → New Issue
- The bot should apply `type:bug` / `type:enhancement` / etc. labels within 30–60 seconds

---

## After Live Testing

Once you've confirmed the bot works on the live PR:

1. **Do NOT merge the test PR** yet — that's for your assignment submission
2. **Document the bot's output** as proof that it caught the known bug
3. **If the bot missed something,** refine the subagent prompts (`.claude/agents/*.md`) and re-run the workflow by pushing a new commit to the PR

---

## File Summary for Submission (Assignment Steps 2–11)

After Phase 9, your submission should include:

### Step 2: Review Criteria
- `REVIEW_CRITERIA.md` ✅ 4-category framework

### Step 3–5: Subagent Architecture
- `.claude/agents/explore.md` ✅
- `.claude/agents/review-logic.md` ✅
- `.claude/agents/review-security.md` ✅
- `.claude/agents/review-style.md` ✅
- Architecture explanation in `REVIEW_CRITERIA.md` ✅

### Step 6: Context Management
- `CONTEXT_STRATEGY.md` ✅ How context flows, truncation strategy, why separate agents

### Step 7: TDD for Bot
- `bot-tests/fixtures/known-bug-diff.patch` ✅ Diff that doesn't fix the 10000 boundary bug
- `bot-tests/test_bot_catches_known_bugs.md` ✅ Test report showing PASS

### Step 8: Refactoring
- `src/main/java/com/demo/bank/Tier.java` ✅ Enum for tiers
- `src/main/java/com/demo/bank/Bank.java` ✅ Refactored with `totalBalanceForTier()`
- Updated `TESTING_NOTES.md` with Refactor Log ✅

### Step 9: Parallel Review
- `PARALLEL_NOTES.md` ✅ Sequential vs. parallel timing (2.1× speedup)

### Step 10: GitHub Actions Workflow
- `.github/workflows/pr-review.yml` ✅ Triggers on PR open/sync
- `scripts/review-bot.js` ✅ Orchestrates explore → parallel reviewers → PR comment
- `package.json` ✅ Dependencies

### Step 11: Auto-fix + Issue Triage
- `scripts/review-bot.js` ✅ **Updated with auto-fix detection & application** (Phase 8)
- `.github/workflows/pr-review.yml` ✅ **Updated with `contents: write` permission** (Phase 8)
- `.github/workflows/issue-triage.yml` ✅ **New: labels issues on open** (Phase 8)
- `scripts/issue-triage.js` ✅ **New: Claude-powered triage logic** (Phase 8)

### Phase 9: Prep for Live PR
- `LIVE_PR_TEST_PLAN.md` ← You are here ✅ Checklist + suggested test PR title/description

---

**You are ready to open a live PR!**

Once you've completed the manual checklist above, open the PR and let the bot do its work.

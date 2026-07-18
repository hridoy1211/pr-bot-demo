# pr-bot-demo — Simple Bank Account System

A small Java/Maven project used as the **target repository** for a PR-review
bot assignment (Explore/Plan/Review subagents + GitHub Actions).

## What's here
- `Account` — deposit, withdraw, PIN check
- `Bank` — holds accounts, transfers money between them, tier reports
- `InterestCalculator` — annual interest by balance tier

## Build & test

```bash
mvn test
```

## Project purpose

This repo is intentionally small so a PR-review bot's output can be
verified at a glance. See `TESTING_NOTES.md` (not meant to ship to
"production", kept for the assignment write-up) for the specific issues
planted in this codebase and what a good reviewer/bot should catch.

#!/usr/bin/env node
// Issue triage bot for pr-bot-demo.
//
// Reads the issue title and body, uses Claude API to categorize the issue,
// and applies appropriate labels (type: bug/enhancement/question, priority).
//
// Never auto-closes or auto-assigns — labeling only.
//
// Env (provided by GitHub Actions):
//   ANTHROPIC_API_KEY  - from ${{ secrets.ANTHROPIC_API_KEY }}
//   GITHUB_TOKEN       - from ${{ secrets.GITHUB_TOKEN }}
//   GITHUB_REPOSITORY  - "owner/repo" (auto-set by Actions)
//   ISSUE_NUMBER       - issue number
//   ISSUE_TITLE        - issue title
//   ISSUE_BODY         - issue body (may be null if empty)

import Anthropic from "@anthropic-ai/sdk";
import { Octokit } from "@octokit/rest";

const MODEL = "claude-opus-4-8";

// --- helpers ---------------------------------------------------------------

function fail(message, err) {
  console.error(`::error::${message}`);
  if (err) console.error(err.stack || String(err));
  process.exit(1);
}

function requireEnv(name) {
  const v = process.env[name];
  if (!v) fail(`Missing required environment variable: ${name}`);
  return v;
}

// --- main ------------------------------------------------------------------

async function main() {
  requireEnv("ANTHROPIC_API_KEY");
  const githubToken = requireEnv("GITHUB_TOKEN");
  const [owner, repo] = requireEnv("GITHUB_REPOSITORY").split("/");
  const issueNumber = Number(requireEnv("ISSUE_NUMBER"));
  const issueTitle = requireEnv("ISSUE_TITLE");
  const issueBody = process.env.ISSUE_BODY || "";

  if (!Number.isInteger(issueNumber)) {
    fail(`ISSUE_NUMBER is not a number: ${process.env.ISSUE_NUMBER}`);
  }

  const anthropic = new Anthropic();
  const octokit = new Octokit({ auth: githubToken });

  // 1. Call Claude to categorize the issue.
  const triagePrompt = `You are an issue triage bot for a small Java/Maven bank account system (pr-bot-demo).

Analyze the following GitHub issue and categorize it. Respond ONLY with valid JSON (no markdown, no text before/after):

{
  "type": "<bug|enhancement|question>",
  "priority": "<critical|high|medium|low>",
  "reasoning": "<1-2 sentences>"
}

Issue Title: ${issueTitle}
Issue Body: ${issueBody || "(empty)"}

Rules for categorization:
- "bug": Reports a defect, error, or incorrect behavior.
- "enhancement": Requests a new feature, improvement, or refactor.
- "question": Asks how something works (not a bug report).
- "critical": Breaks core functionality (transfer, withdrawal, interest calc).
- "high": Affects security or correctness (boundary bugs, string comparison issues).
- "medium": Affects maintainability or minor correctness (duplication, naming).
- "low": Nice-to-have improvements or documentation.`;

  let triage;
  try {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 500,
      messages: [{ role: "user", content: triagePrompt }],
    });
    const responseText = message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    triage = JSON.parse(responseText);
  } catch (err) {
    fail("Failed to triage issue with Claude API or parse response", err);
  }

  if (!triage.type || !triage.priority) {
    fail(
      `Invalid triage response from Claude: missing type or priority. Got: ${JSON.stringify(triage)}`
    );
  }

  // 2. Build label list.
  const labels = [
    `type:${triage.type}`, // type:bug, type:enhancement, type:question
    `priority:${triage.priority}`, // priority:critical, etc.
  ];

  console.log(`Triaged issue #${issueNumber}: ${labels.join(", ")}`);
  console.log(`Reasoning: ${triage.reasoning}`);

  // 3. Apply labels to the issue (never auto-close, auto-assign, or edit).
  try {
    await octokit.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels,
    });
    console.log(`Applied labels to issue #${issueNumber}: ${labels.join(", ")}`);
  } catch (err) {
    // Labels might not exist; create them if they don't.
    // For now, just warn and continue — the labels will be created manually.
    console.warn(`Could not apply labels (they may not exist yet): ${err.message}`);
  }
}

main().catch((err) => fail("Unexpected error in issue triage", err));

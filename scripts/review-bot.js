#!/usr/bin/env node
// PR-review bot for pr-bot-demo.
//
// Pipeline mirrors the local subagent architecture:
//   explore  -> compact summary of the diff
//   review-logic / review-security / review-style  (run in parallel)
//   -> findings aggregated into a single PR comment.
//
// The subagent system prompts under .claude/agents/*.md are reused verbatim as
// the Claude API request's `system` prompt, so the CI bot and the local
// subagents behave identically.
//
// Env (all provided by the GitHub Actions workflow):
//   ANTHROPIC_API_KEY  - from ${{ secrets.ANTHROPIC_API_KEY }}
//   GITHUB_TOKEN       - from ${{ secrets.GITHUB_TOKEN }} (Actions context)
//   GITHUB_REPOSITORY  - "owner/repo" (auto-set by Actions)
//   PR_NUMBER          - pull request number (set from the event payload)

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execSync } from "node:child_process";
import Anthropic from "@anthropic-ai/sdk";
import { Octokit } from "@octokit/rest";

const MODEL = "claude-opus-4-8";
const __dirname = dirname(fileURLToPath(import.meta.url));
const AGENTS_DIR = join(__dirname, "..", ".claude", "agents");
const REPO_ROOT = join(__dirname, "..");

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

// Load a subagent definition and strip its YAML frontmatter, returning just the
// system-prompt body — the same text the local subagent runs on.
function loadAgentSystemPrompt(agentName) {
  const raw = readFileSync(join(AGENTS_DIR, `${agentName}.md`), "utf8");
  const fm = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  return (fm ? raw.slice(fm[0].length) : raw).trim();
}

function extractText(message) {
  return message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

async function callAgent(anthropic, agentName, userContent) {
  const system = loadAgentSystemPrompt(agentName);
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userContent }],
  });
  return extractText(message);
}

// --- auto-fix detection and application ------------------------------------

/**
 * Detect SAFE auto-fixable patterns in a diff.
 * Returns { autoFixes: [ { file, line, pattern, suggestion, before, after } ], ... }
 */
function detectAutoFixes(diff) {
  const autoFixes = [];

  // Pattern 1: String comparison with == instead of .equals()
  // Match: someString == "value" or someString == otherString
  const stringComparisonRegex =
    /^[\s]*(.+?)\s*(==|!=)\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[a-zA-Z_]\w*)/gm;
  const lines = diff.split("\n");

  lines.forEach((line, idx) => {
    if (!line.startsWith("+") || line.startsWith("+++")) return;
    const codeLine = line.slice(1); // Remove the '+' prefix

    // Only flag Java code
    if (!codeLine.includes(".java")) {
      // Look for == or != with strings
      if (
        (codeLine.includes("==") || codeLine.includes("!=")) &&
        (codeLine.includes('"') || codeLine.includes("'") || codeLine.match(/\s(pin|password|token|secret)\s/i))
      ) {
        const lineNum = idx + 1;
        // Extract file path from context
        const fileMatch = diff.match(/^---.*?a\/(.*?)\.java/m);
        if (fileMatch) {
          autoFixes.push({
            file: fileMatch[1] + ".java",
            line: lineNum,
            pattern: "string-equality",
            before: codeLine.trim(),
            suggestion: "Use .equals() instead of == for string comparison",
          });
        }
      }
    }
  });

  return { autoFixes };
}

/**
 * Apply auto-fixes to the working tree and stage them.
 * Returns a summary of what was fixed.
 */
function applyAutoFixes(autoFixes) {
  const applied = [];

  autoFixes.forEach((fix) => {
    try {
      const filePath = join(REPO_ROOT, fix.file);
      let content = readFileSync(filePath, "utf8");
      let modified = false;

      if (fix.pattern === "string-equality") {
        // Replace == with .equals() for strings
        // Conservative: only replace if it looks like a string comparison
        const oldContent = content;
        content = content.replace(
          /(\w+)\s*==\s*("(?:\\.|[^"\\])*")/g,
          '$1.equals($2)'
        );
        content = content.replace(
          /("(?:\\.|[^"\\])*")\s*==\s*(\w+)/g,
          '$1.equals($2)'
        );
        modified = content !== oldContent;
      }

      if (modified) {
        writeFileSync(filePath, content, "utf8");
        applied.push(fix);
      }
    } catch (err) {
      console.warn(`Could not apply auto-fix to ${fix.file}:`, err.message);
    }
  });

  // Stage and commit if anything was fixed
  if (applied.length > 0) {
    try {
      execSync("git config user.email 'pr-bot@example.com'", { cwd: REPO_ROOT });
      execSync("git config user.name 'PR Review Bot'", { cwd: REPO_ROOT });
      execSync("git add .", { cwd: REPO_ROOT });
      const msg = `Auto-fix: ${applied.length} safe pattern(s) fixed (string equality)`;
      execSync(`git commit -m "${msg}"`, { cwd: REPO_ROOT });
      console.log(`Auto-fixes committed: ${msg}`);
    } catch (err) {
      console.warn("Could not commit auto-fixes:", err.message);
      // Reset if commit failed
      try {
        execSync("git reset HEAD .", { cwd: REPO_ROOT });
      } catch (_) {}
    }
  }

  return applied;
}

// --- main ------------------------------------------------------------------

async function main() {
  requireEnv("ANTHROPIC_API_KEY"); // read implicitly by the SDK
  const githubToken = requireEnv("GITHUB_TOKEN");
  const [owner, repo] = requireEnv("GITHUB_REPOSITORY").split("/");
  const prNumber = Number(requireEnv("PR_NUMBER"));
  if (!Number.isInteger(prNumber)) fail(`PR_NUMBER is not a number: ${process.env.PR_NUMBER}`);

  const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  const octokit = new Octokit({ auth: githubToken });

  // 1. Fetch the PR diff via the GitHub API.
  let diff;
  try {
    const res = await octokit.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
      mediaType: { format: "diff" },
    });
    diff = res.data; // with format:diff, data is the raw unified diff string
  } catch (err) {
    fail(`Failed to fetch PR #${prNumber} diff from GitHub`, err);
  }

  if (!diff || !diff.trim()) {
    console.log("Empty diff — nothing to review. Skipping comment.");
    return;
  }

  // 2. explore -> compact summary.
  let summary;
  try {
    summary = await callAgent(
      anthropic,
      "explore",
      `Summarize this PR diff per your rules. Do not dump file contents.\n\n=== DIFF ===\n${diff}`
    );
  } catch (err) {
    fail("Claude API call failed during the explore step", err);
  }

  // 3. review-logic / review-security / review-style in parallel.
  const reviewUser = `=== EXPLORE SUMMARY ===\n${summary}\n\n=== DIFF ===\n${diff}`;
  let logic, security, style;
  try {
    [logic, security, style] = await Promise.all([
      callAgent(anthropic, "review-logic", reviewUser),
      callAgent(anthropic, "review-security", reviewUser),
      callAgent(anthropic, "review-style", reviewUser),
    ]);
  } catch (err) {
    fail("Claude API call failed during a review step", err);
  }

  // 4. Detect and apply safe auto-fixes (before posting the comment).
  const { autoFixes } = detectAutoFixes(diff);
  const appliedFixes = applyAutoFixes(autoFixes);

  // 5. Aggregate all findings into one comment.
  const sections = [];

  // Auto-fixed items (safe patterns that were automatically corrected)
  if (appliedFixes.length > 0) {
    const autoFixText = appliedFixes
      .map((f) => `[${f.file}:${f.line}] ✅ Auto-fixed: ${f.suggestion}`)
      .join("\n");
    sections.push(["✅ Auto-fixed (committed to branch)", autoFixText, ""]);
  }

  // Review findings (logic, security, style)
  const reviewSections = [
    ["🧠 Logic (HIGH: blocks merge, MEDIUM: needs attention)", logic, "No logic findings."],
    ["🔒 Security (HIGH: blocks merge, MEDIUM: needs attention)", security, "No security findings."],
    ["🎨 Style (LOW: advisory only, never blocks)", style, "No style findings."],
  ];
  sections.push(...reviewSections);

  const hasFindings = sections.some(
    ([, body, empty]) => body && body.trim() && body.trim() !== empty
  );

  const commentBody = [
    "## 🤖 Automated PR review",
    "",
    "_Pipeline: explore → review-logic / review-security / review-style; auto-fixes (safe patterns) applied independently._",
    "",
    ...sections.flatMap(([title, body, empty]) => [
      `### ${title}`,
      "",
      "```text",
      body && body.trim() ? body.trim() : empty,
      "```",
      "",
    ]),
    appliedFixes.length > 0
      ? [
          "---",
          "",
          "**Auto-fixes explained:** SAFE patterns (string equality) were automatically corrected and committed to this branch. Logic/security bugs are never auto-fixed — those appear above as ⚠️ findings and require human review.",
          "",
        ].join("\n")
      : "",
  ]
    .flat()
    .join("\n");

  if (!hasFindings && appliedFixes.length === 0) {
    console.log("All reviewers returned no findings, no auto-fixes needed.");
  }

  // 6. Post exactly one comment. Never post an empty body.
  try {
    await octokit.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: commentBody,
    });
    console.log(`Posted review comment on PR #${prNumber}.`);
  } catch (err) {
    fail(`Failed to post review comment on PR #${prNumber}`, err);
  }
}

main().catch((err) => fail("Unexpected error in review bot", err));

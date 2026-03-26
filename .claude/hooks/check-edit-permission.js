/**
 * PreToolUse hook — Branch Protection + Config Protection
 *
 * Branch check (hard block, no bypass):
 *   - staging or production branch → BLOCK all edits, no exceptions
 *
 * Config protection (approval override):
 *   1. Agent tries to edit a protected file → BLOCK, tell agent to ask user
 *   2. User approves → agent writes filename to .claude/approvals.json
 *   3. Agent retries → this hook finds the approval, allows it, clears entry
 */

const fs = require("fs")
const path = require("path")
const { execSync } = require("child_process")

const PROTECTED = [
  "tsconfig.json",
  "next.config.js",
  "next.config.ts",
  "tailwind.config.ts",
  "tailwind.config.js",
  "package.json",
  "package-lock.json",
  ".mcp.json",
  "components.json",
  "postcss.config.js",
  "postcss.config.mjs",
  "eslint.config.js",
  "eslint.config.mjs",
  ".eslintrc.json",
]

const APPROVAL_FILE = ".claude/approvals.json"

// ── Branch check (runs before anything else) ──────────────────────────────
let currentBranch = ""
try {
  currentBranch = execSync("git rev-parse --abbrev-ref HEAD", { stdio: ["pipe", "pipe", "pipe"] })
    .toString()
    .trim()
} catch (e) {
  currentBranch = ""
}

const LOCKED_BRANCHES = ["staging", "production"]

if (LOCKED_BRANCHES.includes(currentBranch)) {
  console.log(
    JSON.stringify({
      continue: false,
      reason: `🚫 BRANCH LOCK — You are on the '${currentBranch}' branch. AI is not allowed to edit any files on staging or production. No bypass, no exceptions. Switch to 'develop' or another feature branch before making changes:\n\n  git checkout develop\n\nThen retry.`,
    }),
  )
  process.exit(0)
}
// ──────────────────────────────────────────────────────────────────────────

let raw = ""
process.stdin.on("data", (chunk) => (raw += chunk))
process.stdin.on("end", () => {
  let args = {}
  try {
    args = JSON.parse(raw)
  } catch (e) {
    console.log(
      JSON.stringify({ continue: true, reason: "Hook parse error — defaulting to allow" }),
    )
    process.exit(0)
  }

  const filePath = args.file_path || ""
  const basename = path.basename(filePath)

  // Not protected — allow immediately
  if (!PROTECTED.includes(basename)) {
    console.log(
      JSON.stringify({ continue: true, reason: "Not a protected file — allowed" }),
    )
    process.exit(0)
  }

  // Check for user approval
  let approvals = []
  try {
    approvals = JSON.parse(fs.readFileSync(APPROVAL_FILE, "utf8"))
    if (!Array.isArray(approvals)) approvals = []
  } catch (e) {
    approvals = []
  }

  if (approvals.includes(basename)) {
    // Consume the approval (one-time use) and allow
    const remaining = approvals.filter((f) => f !== basename)
    try {
      fs.writeFileSync(APPROVAL_FILE, JSON.stringify(remaining, null, 2))
    } catch (e) {}

    console.log(
      JSON.stringify({
        continue: true,
        reason: `User approval found for '${basename}' — allowed and approval consumed`,
      }),
    )
    process.exit(0)
  }

  // No approval found — block and explain the override path
  console.log(
    JSON.stringify({
      continue: false,
      reason: `RULE VIOLATION — Config Protection Rule. '${basename}' is a protected configuration file. To override: ask the user for approval. Once approved, write the filename to '.claude/approvals.json' as a JSON array (e.g. [".mcp.json"]) then retry the edit.`,
    }),
  )
  process.exit(0)
})

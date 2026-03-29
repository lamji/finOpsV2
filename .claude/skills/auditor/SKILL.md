---
name: auditor
description: Audits the FinOps codebase against all rules in .claude/rules/. Evidence-based — every finding is backed by a specific file and line. Auto-fixes violations after reporting.
allowed-tools: Read, Grep, Glob, Edit, Write, Bash
---

# Skill: Rules Auditor

You are a **strict rules auditor** for the FinOps dashboard. Your job is to scan the codebase for violations of every rule defined in `.claude/rules/`, report each finding with hard evidence (file + line), then fix every violation found.

You never assume compliance — you verify it by reading actual files.

---

## Workflow

```
STEP 1 — Load rules context
STEP 2 — Run audit checks (one rule file at a time)
STEP 3 — Report findings with evidence
STEP 4 — Fix every violation
STEP 5 — Re-verify after fixes
STEP 6 — Final report
```

---

## STEP 1 — Load Rules Context

Read every rules file before doing anything else:

```
Read .claude\rules
```

Internalize all rules. Do not proceed until all four are read.

---

## STEP 2 — Audit Checks

Run every check below. For each check, use the exact tool and pattern specified. Record every violation as evidence.

---

### AUDIT A — structure.md checks

#### A1 · Types/interfaces defined outside `lib/types/`

**Tool:** Grep
**What:** Find any `interface` or `export type` declarations in source files that are NOT inside `lib/types/`
**Patterns to run:**
```
Grep pattern="^(export )?interface \w"  glob="**/*.{ts,tsx}"  output=content
Grep pattern="^export type \w+ ="       glob="**/*.{ts,tsx}"  output=content
```
**Exclude from results:** `lib/types/`, `node_modules`, `.next`, `.claude`
**Violation:** Any match outside `lib/types/`
**Fix:** Identify the feature the type belongs to → move it to `lib/types/[feature].ts` → update all import paths to `@/lib/types/[feature]`

---

#### A2 · Components not using folder/index structure

**Tool:** Glob
**What:** Find `.tsx` files directly inside `components/` that are NOT `index.tsx` and NOT inside `components/ui/`
**Pattern:**
```
Glob pattern="components/**/*.tsx"
```
**Violation:** Any file matching `components/[name].tsx` or `components/[folder]/[name].tsx` where `[name]` is not `index` and the folder is not `ui/`
**Rule:** Every feature component must live in `components/[ComponentName]/index.tsx`

---

#### A3 · `app/*/page.tsx` files contain logic beyond import + render

**Tool:** Glob + Read
**What:** Find all `page.tsx` files in `app/`, read each one
**Pattern:**
```
Glob pattern="app/**/page.tsx"
```
**For each file:** Read it and count meaningful lines (excluding blank lines and comments)
**Violation:** Any `page.tsx` with more than 5 non-blank lines, or containing hooks, JSX markup, or business logic
**Rule:** Page files must be one-liner shells: `import` + `export default function Page() { return <Component /> }`

---

#### A4 · Types imported from anywhere other than `@/lib/types`

**Tool:** Grep
**What:** Find imports of shared types from wrong locations
**Patterns:**
```
Grep pattern="from \"@/hooks/useGetData\""  glob="**/*.{ts,tsx}"  output=content
Grep pattern="import type.*from \"@/hooks"  glob="**/*.{ts,tsx}"  output=content
Grep pattern="from \"@/lib/types\""         glob="**/*.{ts,tsx}"  output=content
```
**Violation:** Any type import sourced from `@/hooks/` or from the old flat `@/lib/types` path (must be `@/lib/types/[feature]`)

---

#### A5 · Presentation layer missing for pages

**Tool:** Glob
**What:** For every `app/[name]/page.tsx` that exists, verify a matching `Presentation/[Name]/index.tsx` exists
**Pattern:**
```
Glob pattern="app/**/page.tsx"
Glob pattern="Presentation/**/index.tsx"
```
**Violation:** A page exists in `app/` with no corresponding folder in `Presentation/`

---

### AUDIT B — frontend.md checks

#### B1 · Inline styles used

**Tool:** Grep
**Pattern:**
```
Grep pattern="style=\{\{" glob="**/*.{ts,tsx}" output=content
```
**Violation:** Any `style={{` in component or page files
**Rule:** TailwindCSS only — no inline styles

---

#### B2 · Hardcoded color classes (breaks dark mode)

**Tool:** Grep
**Patterns:**
```
Grep pattern="className=\"[^\"]*bg-(white|black|gray-\d+|slate-\d+|zinc-\d+)[^\"]*\"" glob="**/*.{ts,tsx}" output=content
Grep pattern="className=\"[^\"]*text-(white|black)[^\"]*\""                            glob="**/*.{ts,tsx}" output=content
```
**Violation:** Hardcoded color classes without semantic token equivalent
**Rule:** Use `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground` etc.

---

#### B3 · Non-Lucide icons (emojis, unicode, other icon libs)

**Tool:** Grep
**Patterns:**
```
Grep pattern="import.*from \"react-icons"    glob="**/*.{ts,tsx}" output=content
Grep pattern="import.*from \"@heroicons"     glob="**/*.{ts,tsx}" output=content
Grep pattern="import.*from \"@phosphor-icons" glob="**/*.{ts,tsx}" output=content
```
**Violation:** Any icon import from a library that is not `lucide-react`

---

#### B4 · Relative imports (non-local)

**Tool:** Grep
**Pattern:**
```
Grep pattern="from \"\.\./\.\." glob="**/*.{ts,tsx}" output=content
```
**Violation:** Any `../../` import — all cross-directory imports must use `@/`
**Local relative imports (`./`) within the same folder are allowed**

---

#### B5 · `"use client"` missing on files that use hooks

**Tool:** Grep
**What:** Find files that use client-side hooks but are missing `"use client"` directive
**Pattern — find hook usage:**
```
Grep pattern="(useState|useEffect|useCallback|useRef|useQuery|useMutation|useTheme|useDashboard)\(" glob="**/*.{ts,tsx}" output=files_with_matches
```
**Then for each matched file:** Read the first line and check for `"use client"`
**Violation:** File uses hooks but first line is not `"use client"`

---

#### B6 · `process.env` accessed directly in client code

**Tool:** Grep
**Pattern:**
```
Grep pattern="process\.env\." glob="{components,Presentation,app/page}/**/*.{ts,tsx}" output=content
```
**Violation:** Any direct `process.env` in components or pages
**Rule:** Always access env vars through `lib/env.ts`

---

### AUDIT C — api.md checks

#### C1 · API route handlers missing try/catch

**Tool:** Glob + Read
**What:** Find all route handlers, read each one
**Pattern:**
```
Glob pattern="app/api/**/route.ts"
```
**For each file:** Read it and check that every `export async function GET/POST/PUT/DELETE` wraps its body in `try { ... } catch`
**Violation:** Route handler with no try/catch block

---

#### C2 · API routes missing error logging

**Tool:** Grep
**Pattern:**
```
Grep pattern="catch \(" glob="app/api/**/*.ts" output=content
```
**For each catch block found:** Read surrounding context (3 lines) and verify `logger.error(` is called
**Violation:** catch block that does not call `logger.error`

---

### AUDIT D — rules.md checks

#### D1 · Implicit `any` types

**Tool:** Grep
**Patterns:**
```
Grep pattern=": any[^A-Za-z]" glob="**/*.{ts,tsx}" output=content
Grep pattern="as any"          glob="**/*.{ts,tsx}" output=content
```
**Violation:** Any `: any` or `as any` in source files
**Exclude:** `.claude/`, `node_modules/`, `.next/`

---

#### D2 · TypeScript typecheck

**Tool:** Bash
**Command:**
```bash
npm run typecheck
```
**Violation:** Any TypeScript error in output

---

### AUDIT E — Dead Code (unused imports, functions, folders, files)

#### E1 · Unused imports

**Tool:** Bash
**What:** Use ESLint's `no-unused-vars` output and TypeScript's unused import detection to find imports that are declared but never referenced in the file
**Command:**
```bash
npm run lint -- --rule "@typescript-eslint/no-unused-vars: error" 2>&1
```
**Then also run:**
```bash
npm run typecheck 2>&1
```
**Look for:** Lines matching `'X' is defined but never used` or `'X' is declared but its value is never read`
**For each hit:** Read the file, confirm the import is genuinely unreferenced (not used in JSX, types, or runtime), then remove it
**Violation:** Any import that is declared but has zero references in the file body

---

#### E2 · Unused exported functions and variables

**Tool:** Grep + Read
**What:** Find named exports that are never imported anywhere else in the codebase
**Step 1 — collect all exports:**
```
Grep pattern="^export (function|const|class|async function) \w+" glob="**/*.{ts,tsx}" output=content
```
**Step 2 — for each exported name `Foo`:** Search for any import of it:
```
Grep pattern="import.*\bFoo\b" glob="**/*.{ts,tsx}" output=files_with_matches
```
**Violation:** An export exists with zero import references across the entire codebase
**Exceptions:**
- `export default` on page/layout files (`app/**/page.tsx`, `app/**/layout.tsx`) — consumed by Next.js router, not imported explicitly
- `export const runtime` / `export const metadata` / `export const dynamic` — Next.js reserved route segment config
- Anything explicitly marked `// auditor: keep` — intentional public API surface

---

#### E3 · Empty or orphaned folders

**Tool:** Bash
**What:** Find folders that exist but contain no `.ts` or `.tsx` files (i.e., became empty after restructuring)
**Command:**
```bash
find components app Presentation lib hooks -type d | while read dir; do
  count=$(find "$dir" -maxdepth 1 -name "*.ts" -o -name "*.tsx" | wc -l)
  if [ "$count" -eq 0 ]; then echo "EMPTY: $dir"; fi
done
```
**Violation:** Any folder with no source files inside it (may still have sub-folders — check recursively)
**Fix:** Remove the empty folder with `rm -rf`
**Exceptions:** `app/api/` sub-folders that intentionally group route handlers are fine even if temporarily empty

---

#### E4 · Dead files (source files never imported)

**Tool:** Glob + Grep
**What:** Find `.ts` / `.tsx` source files that are never imported by any other file
**Step 1 — collect all source files:**
```
Glob pattern="{components,hooks,lib,Presentation}/**/*.{ts,tsx}"
```
**Step 2 — for each file `path/to/file.tsx`:** Derive its importable path (e.g. `@/components/Foo/index` or `./Bar`) and search for it:
```
Grep pattern="from \"@/components/Foo\"" glob="**/*.{ts,tsx}" output=files_with_matches
Grep pattern="from \"@/components/Foo/index\"" glob="**/*.{ts,tsx}" output=files_with_matches
```
**Violation:** A file has zero import references from any other source file
**Exceptions:**
- `app/**/page.tsx`, `app/**/layout.tsx`, `app/**/route.ts` — entry points consumed by Next.js, not explicitly imported
- `lib/env.ts`, `lib/logger.ts`, `lib/redis.ts` — infrastructure singletons (may be imported at runtime only)
- Any file explicitly marked `// auditor: keep`

---

## STEP 3 — Report Findings

After all checks complete, produce an evidence table:

```
## Audit Report — [timestamp]

### Summary
| Rule File     | Checks Run | Violations | Status |
|---------------|------------|------------|--------|
| structure.md  | 5          | N          | ✅/❌  |
| frontend.md   | 6          | N          | ✅/❌  |
| api.md        | 2          | N          | ✅/❌  |
| rules.md      | 2          | N          | ✅/❌  |
| dead code     | 4          | N          | ✅/❌  |

### Violations Found

#### [CHECK ID] — [Rule name]
- **File:** `path/to/file.tsx`
- **Line:** 42
- **Evidence:** `[exact offending code snippet]`
- **Rule:** [what rule says]
- **Fix:** [what will be changed]
```

If no violations found for a check, mark it `✅ PASS` and move on.

---

## STEP 4 — Fix Every Violation

Fix violations in this order:
1. **Type location violations** (A1, A4) — move types to `lib/types.ts`, update imports
2. **Structure violations** (A2, A3, A5) — restructure files/folders
3. **Styling violations** (B1, B2) — replace inline styles / hardcoded colors
4. **Import violations** (B4) — replace relative with absolute `@/` imports
5. **Missing directives** (B5) — add `"use client"` where needed
6. **Type safety** (D1) — replace `any` with proper types
7. **API violations** (C1, C2) — wrap handlers in try/catch, add logger
8. **Dead code** (E1–E4) — remove unused imports, dead functions, empty folders, orphaned files

**For each fix:**
- Use `Edit` for targeted line changes
- Use `Write` only when restructuring a full file
- After each fix, note: `FIXED: [file] — [what changed]`

---

## STEP 5 — Re-Verify

After all fixes are applied, run:

```bash
npm run typecheck
npm run lint
```

If either fails — diagnose the error, fix it, run again. Do not proceed to Step 6 until both pass clean.

---

## STEP 6 — Final Report

Produce a concise closing summary:

```
## Audit Complete

- Checks run: N
- Violations found: N
- Violations fixed: N
- Typecheck: ✅ PASS
- Lint: ✅ PASS

### Fixed
- [file] — [what was fixed] (rule: X)
- ...

### No action needed
- [CHECK ID] ✅ — [why it passed]
```

---

## Rules for the Auditor

1. **Evidence first** — never flag a violation without quoting the exact file + line
2. **Read before fixing** — always read the current file state before editing it
3. **One fix at a time** — fix, then verify; do not batch-edit files blindly
4. **Exclude non-source paths** — skip `node_modules/`, `.next/`, `.claude/`, `public/`
5. **Do not break working code** — if a fix would cause a type error, investigate first
6. **Local `./` imports are allowed** — only flag `../../` and deeper relative imports
7. **`ui/` components are exempt from folder structure rule** — shadcn primitives live flat in `components/ui/`
8. **Verify before deleting** — for E2/E4, always grep the full codebase for the name before calling something unused; a single false negative means deleting live code
9. **Dead code order** — fix E1 (unused imports) first, then E2 (unused functions), then E3 (empty folders), then E4 (dead files); later steps may become no-ops once earlier ones are cleaned
10. **Never delete entry points** — `app/**/page.tsx`, `app/**/layout.tsx`, `app/**/route.ts` are consumed by Next.js and must never be treated as dead files

---

## Usage

```
/auditor
```

No arguments needed. The auditor always audits the full project against all rules.

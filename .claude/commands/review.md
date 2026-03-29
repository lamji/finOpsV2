---
description: Run a structured code review on recently changed files
---

Review the current working changes in this project:

1. Run `!git diff --name-only HEAD` to see changed files
2. Read each changed file
3. Check against `.claude/rules/` and `.claude/CLAUDE.md`
4. Report findings under these categories:

**Architectural violations**
- Types defined outside `lib/types/[feature].ts`
- Logic inside `app/[page]/page.tsx` (must be import-only shells)
- Parallel data sources (anything outside `useDashboard` / `useApiDashboard`)
- Hardcoded colors instead of semantic tokens (`bg-card`, `text-foreground`, etc.)
- Missing `dark:` prefix on color/background classes
- `process.env` accessed directly instead of via `lib/env.ts`

**Security issues**
- Secrets or credentials in source files
- Stack traces or internal details returned to the client
- Unhandled error paths in route handlers

**Performance concerns**
- Missing Redis cache usage in new API routes
- Client components that could be server components
- Missing `refetchIntervalInBackground: false` on polling queries

**Convention mismatches**
- Relative imports (`../../`) instead of absolute (`@/`)
- Emojis or non-Lucide icons used in UI
- Inline styles (`style={{}}`) instead of TailwindCSS classes
- Components not in `components/[Name]/index.tsx` structure
- `"use client"` added unnecessarily (no hooks, no events, no state)

**Missing items**
- Dark mode support on new components
- Responsive breakpoints (`sm:`, `md:`, `lg:`)
- TypeScript types for new data shapes

Be specific — reference `file:line` for each finding. Skip findings with no issues.

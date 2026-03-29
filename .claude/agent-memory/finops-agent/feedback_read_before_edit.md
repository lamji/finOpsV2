---
name: Read Before Edit Rule
description: Always read all related files before suggesting or making edits — mandatory to avoid hallucination
type: feedback
---

**HARD RULE — no exceptions.**

Before suggesting, writing, or editing anything — read every file directly related to the task first.

**Why:** Edited `env.md` to reference `api/.env.development` without checking that it didn't exist. User had to correct it. The fix was to create the missing file — wasted a round trip that reading first would have prevented.

**How to apply:**
- Editing a command file? Read it first AND read every directory/file it references
- Updating a config or script? `ls` the target directories to confirm files actually exist
- Never assume a file exists based on a pattern or convention — verify with `ls` or `Read`
- If a referenced file is missing, flag it and resolve it BEFORE writing the edit

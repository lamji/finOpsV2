---
name: Memory-First Rule
description: Always check agent memory before reading project files — violated 5+ times, hard rule
type: feedback
---

**HARD RULE — violated 5+ times. No exceptions.**

Before touching any project file, read MEMORY.md and relevant memory files first.

**Why:** User has repeatedly caught me jumping straight to reading components/hooks when the answer was already in memory (knowledge.md, project_status.md, etc.). This wastes time and defeats the purpose of the memory system.

**How to apply:**
1. Question received → read MEMORY.md FIRST
2. Read relevant memory files based on the index
3. If memory answers the question → respond immediately, do NOT open project files
4. Only open project files if memory is explicitly insufficient or needs verification

**What counts as a violation:**
- Reading any file in `components/`, `hooks/`, `app/`, `lib/` before checking memory
- Skipping memory because the question "seems simple"
- Reading files in parallel with memory (memory must come first, sequentially)

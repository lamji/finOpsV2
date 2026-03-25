---
name: Agent Tools — Web Search Fix
description: How to add WebSearch/WebFetch to an agent, and what NOT to do
type: feedback
---

To give an agent web search capability, add `WebSearch` and `WebFetch` to the `tools:` line in the agent's frontmatter (`.claude/agents/[name].md`). These are built-in Claude Code tools, not MCP servers.

**Why:** First attempt was wrong — added a Brave Search MCP entry to `.mcp.json`. User corrected: Claude already has WebSearch/WebFetch built-in, they just need to be listed in the agent's `tools:` field.

**How to apply:**
- Agent missing web search → edit agent's `tools:` frontmatter, add `WebSearch, WebFetch`
- Do NOT add MCP servers to fix this — that's the wrong layer
- MCP servers are for external tools (Playwright, etc.), not for built-in Claude tools

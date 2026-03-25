---
name: investigate-flow
description: Investigate user or code flows end-to-end from a concrete entry point to the last reachable call in the chain. Use when the user asks to trace login, signup, checkout, route handling, button clicks, API execution, component event handling, or any "what calls what" flow and needs a complete call map with file:line evidence, inputs, outputs, side effects, branches, async boundaries, and terminal endpoints.
---

# Investigate User Flow

## Overview

Trace a complete flow through the codebase from a page, component, route, handler, or function to the last confirmed downstream call or side effect.
Read the real code at each step, follow imports and branches, and produce a tree-style flow map with exact file references.

## Investigation Workflow

### Step 1: Find the entry point

Locate the file, route, component, or function the user named.
Read it fully before tracing.
Identify all relevant outgoing calls, imported functions that are actually used, event handlers, callbacks, hooks, middleware handoffs, and route or UI transitions.

If the user does not provide an entry point, ask: `What is the entry point of the flow you want to investigate?`

### Step 2: Trace each call

For every call reached from the current step:

1. Find the exact declaration or implementation.
2. Read the implementation before making any claim about what it does.
3. Identify what that function calls next.
4. Continue recursively until reaching a dead end, terminal side effect, native boundary, or unresolved dynamic boundary.

Handle all meaningful branches:

- Trace both sides of `if` or `else` branches when both are relevant.
- Trace `try`, `catch`, and early-return paths when they alter control flow.
- Mark circular references and stop once the loop is proven.

### Step 3: Track data and effects

At each step, record:

- Input: parameters, props, payloads, state, or context entering the function
- Output: return values, thrown errors, emitted values, or mutations
- Side effects: API calls, database work, redirects, state changes, storage writes, cookies, navigation, logging, or events

### Step 4: Build the flow map

Present the trace as a tree in execution order.
Include the file path and line number for each concrete step.
Use these labels when applicable:

- `[async]` for async handoffs
- `[external: API]`, `[external: DB]`, or `[external: service]` for external boundaries
- `[error path: ...]` for exceptional branches
- `[circular reference - stop here]` when a proven loop is reached
- `[END]` for the last confirmed reachable step

Example shape:

```text
[Entry Point]
  calls: handleSubmit() -> app/login/page.tsx:18
    calls: loginUser(email, password) -> components/auth/LoginForm.tsx:42
      calls: validateCredentials() -> lib/auth/login.ts:15
        calls: hashPassword() -> lib/auth/validators.ts:8
          calls: POST /api/auth/session -> app/api/auth/session/route.ts:10 [external: API]
            calls: createSession() -> lib/db/sessions.ts:34 [external: DB]
              [END]
```

### Step 5: Summarize the flow

After the map, include:

- Total depth
- Key decision points
- External dependencies touched
- Likely failure points
- Auth or security checkpoints
- Unresolved gaps or inferred edges, if any

## Rules

1. Never skip a function that materially participates in the flow.
2. Follow imports, aliases, wrappers, callbacks, hooks, middleware, and helper layers.
3. Read the real implementation before summarizing it.
4. Go as deep as the evidence allows until a true terminal call or boundary is reached.
5. Label inferred or unresolved edges instead of guessing.
6. Trace both success and error paths when they matter to the requested flow.
7. Stop only at a proven terminal point, external boundary, or circular reference.

## Output Requirements

Produce:

- a tree-style flow map
- exact `file:line` citations for each concrete step
- inputs, outputs, and side effects for important transitions
- branch labels, async labels, and external boundary labels where applicable

## Example Prompts

- `Use $investigate-flow to trace the login flow from the page to session creation.`
- `Trace checkout from button click to payment API response.`
- `Investigate app/api/auth/session/route.ts end-to-end.`
- `Trace components/auth/LoginForm.tsx::handleSubmit through every downstream function call.`

---
description: Investigates user flows in the codebase. Traces every function call from an entry point (e.g. login page) to the last function in the chain. Maps the complete call graph with file locations, inputs, and outputs.
allowed-tools: Read, Grep, Glob
---

# Skill: Investigate User Flow

You are a **code flow investigator**. Your job is to trace a complete user flow through the codebase — from the entry point (e.g. a login page, route handler, or component) to the very last function call in the chain.

## What you produce

A full flow map like this:

```
[Entry Point]
  └─ Component/Page: app/login/page.tsx
       └─ calls: handleSubmit() → components/auth/LoginForm.tsx:42
            └─ calls: loginUser(email, password) → lib/auth/login.ts:15
                 └─ calls: validateCredentials() → lib/auth/validators.ts:8
                      └─ calls: hashPassword() → lib/utils/crypto.ts:22
                           └─ calls: POST /api/auth/session → app/api/auth/session/route.ts:10
                                └─ calls: createSession() → lib/db/sessions.ts:34
                                     └─ [END — no further calls]
```

## How to investigate

### Step 1 — Find the entry point
- Locate the file the user specified (page, component, route, function)
- Read it fully to understand its structure
- Identify ALL outgoing function calls, imports used, and event handlers

### Step 2 — Trace each call
For every function called from the entry point:
1. Use **Grep** to find where that function is defined (search by name across the codebase)
2. Use **Read** to open and read the function implementation
3. Identify what THAT function calls next
4. Repeat recursively until you hit a dead end (no more outgoing calls, a native API, or an external service)

### Step 3 — Track state and data
At each step, note:
- **Input:** what data/params flow in
- **Output:** what returns or mutates
- **Side effects:** API calls, DB writes, redirects, state changes, localStorage, cookies

### Step 4 — Build the flow map
Assemble a clear, readable chain:
- Use tree-style indentation (└─ calls:)
- Include file path + line number for each function
- Flag async operations with `[async]`
- Flag external calls with `[external: API/DB/service]`
- Flag error branches with `[error path: ...]`
- Mark the final function with `[END]`

### Step 5 — Summarize
After the flow map, provide:
- **Total depth:** how many layers deep
- **Key decision points:** where branching happens (if/else, try/catch)
- **External dependencies:** APIs, databases, 3rd party services touched
- **Potential failure points:** where errors are most likely
- **Auth/security checkpoints:** where validation or auth checks occur

---

## Usage

Run this skill with:
```
/investigate-flow <entry point>
```

**Examples:**
```
/investigate-flow app/login/page.tsx
/investigate-flow components/auth/LoginForm.tsx
/investigate-flow lib/auth/login.ts::loginUser
/investigate-flow app/api/auth/session/route.ts
```

If no entry point is given, ask: **"What is the entry point of the flow you want to investigate?"**

---

## Rules for investigation

1. **Never skip a function** — if it's called, trace it
2. **Follow imports** — if a function is imported, find the source file and read it
3. **Go deep** — keep tracing until you hit a truly terminal call (browser API, DB query, fetch, console.log, return with no calls)
4. **Handle branches** — if a function has if/else or try/catch, trace BOTH paths and label them
5. **Don't summarize from memory** — always READ the actual file at each step
6. **Mark loops** — if you detect a circular call (A calls B calls A), mark it as `[circular reference — stop here]`

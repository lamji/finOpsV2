# BigQuery API Flow - Function-by-Function Trace

## Overview
This document traces the complete execution flow when a GET request is made to `/api/bigquery`.

---

## Step 1: Entry Point - Request Arrives
**File**: `app/api/bigquery/route.ts`
**Line**: 117
**Function**: `export async function GET(request: NextRequest)`

```typescript
export async function GET(request: NextRequest) {
  try {
    // ... execution continues below
```

- **Input**: HTTP GET request to `/api/bigquery`
- **Request object**: NextRequest (Next.js wrapper around native Request)
- **Next action**: Extract query parameters

---

## Step 2: Extract Query Parameter
**Line**: 119

```typescript
const query = request.nextUrl.searchParams.get('query') ?? `SELECT * FROM \`${env.GCP_PROJECT_ID}.${env.BQ_DATASET}.${env.BQ_TABLE}\` LIMIT 10`;
```

**Operations**:
1. `request.nextUrl.searchParams.get('query')` - Check for URL parameter
2. If present: Use provided query (e.g., `?query=SELECT%20*%20FROM%20...`)
3. If absent: Use default query template

**Default Query Expansion**:
```sql
SELECT * FROM `lithe-sonar-431106-j2.finopsDS.gcp_billing_export_resource_v1_01F185_0AA423_C9BA8A` LIMIT 10
```

**Variables Created**:
- `query` (string) - SQL query to execute

---

## Step 3: Extract Project ID Parameter
**Line**: 120

```typescript
const projectId = request.nextUrl.searchParams.get('projectId') ?? env.GCP_PROJECT_ID;
```

**Env Variable Resolution**:
- Reads from: `.env` file
- Value: `lithe-sonar-431106-j2`

**Variables Created**:
- `projectId` (string) - GCP project identifier

---

## Step 4: Validate Query
**Lines**: 122-124

```typescript
if (!query?.trim()) {
  return NextResponse.json({ error: "The query parameter is required." }, { status: 400 });
}
```

- If invalid → HTTP 400 **FLOW ENDS**
- If valid → Continue

---

## Step 5: Build Credentials Object
**Lines**: 126-132

```typescript
const credentials = {
  type: "service_account" as const,
  project_id: env.GCP_PROJECT_ID,
  private_key: env.GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
  client_email: env.GCP_CLIENT_EMAIL,
  token_uri: "https://oauth2.googleapis.com/token",
};
```

**Env Variables Read**:

| Variable | Value |
|----------|-------|
| `GCP_PROJECT_ID` | `lithe-sonar-431106-j2` |
| `GCP_PRIVATE_KEY` | `-----BEGIN PRIVATE KEY-----\n...` (RSA private key) |
| `GCP_CLIENT_EMAIL` | `finops-assignment@lithe-sonar-431106-j2.iam.gserviceaccount.com` |

**Key Processing**: `private_key.replace(/\\n/g, "\n")` — convert escaped newlines to actual newlines

---

## Step 6: Initialize Google Auth
**Lines**: 134-137

```typescript
const auth = new GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/bigquery"],
});
```

- `GoogleAuth` from `google-auth-library`
- Scope: `https://www.googleapis.com/auth/bigquery`

---

## Step 7: Get Access Token
**Lines**: 139-140

```typescript
let token: string | null | undefined;
try {
  const authClient = await auth.getClient();
  ({ token } = await authClient.getAccessToken());
} catch (authError) {
  const message = authError instanceof Error ? authError.message : "Unknown auth error";
  logger.error({ authError: message, projectId }, "BigQuery credential error");
  return NextResponse.json(
    { error: `Invalid or missing GCP credentials: ${message}` },
    { status: 401 }
  );
}
```

- Signs a JWT using the private key
- POSTs to `https://oauth2.googleapis.com/token`
- JWT includes: `iss`, `sub`, `aud`, `iat`, `exp`, `scope`
- **SUCCESS** → `token = "ya29.a0..."`
- **FAILURE** → HTTP 401 ✗ (bad key, wrong/disabled service account, network failure to oauth2.googleapis.com)

---

## Step 8: Log Request
**Line**: 142

```typescript
logger.info({ projectId, query: query.slice(0, 50) }, "BigQuery API request");
```

---

## Step 9: Make BigQuery API Call
**Lines**: 144-160

```typescript
let response: Response;
try {
  response = await fetch(
    `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query,
        maxResults: 100,
        timeoutMs: 10000,
        useLegacySql: false,
        useQueryCache: true,
        dryRun: false,
        location: null,
      }),
      cache: "no-store",
    }
  );
} catch (fetchError) {
  const message = fetchError instanceof Error ? fetchError.message : "Network error";
  logger.error({ fetchError: message, projectId }, "BigQuery unreachable");
  return NextResponse.json(
    { error: `BigQuery API unreachable: ${message}` },
    { status: 503 }
  );
}
```

**Request Body Parameters**:
| Param | Value | Reason |
|-------|-------|--------|
| `maxResults` | 100 | Row cap |
| `timeoutMs` | 10000 | 10s timeout |
| `useLegacySql` | false | Standard SQL |
| `useQueryCache` | true | Use cached results |
| `dryRun` | false | Actually execute |
| `location` | null | Default US |

- **SUCCESS** → `response` object with BigQuery HTTP status
- **FAILURE** → HTTP 503 ✗ (fetch throws: DNS failure, connection refused, OS-level timeout — BigQuery unreachable)

---

## Step 10: Parse Response
**Line**: 162

```typescript
const payload = (await response.json()) as BigQueryQueryResponse & { error?: { message?: string } };
```

**Example Success Payload**:
```json
{
  "rows": [{ "f": [{ "v": "value1" }, { "v": "123" }] }],
  "schema": { "fields": [{ "name": "col1", "type": "STRING" }] },
  "totalRows": "1",
  "jobComplete": true,
  "cacheHit": true,
  "totalBytesProcessed": "0",
  "totalBytesBilled": "0",
  "jobReference": { "projectId": "lithe-sonar-431106-j2", "jobId": "job_...", "location": "US" }
}
```

---

## Step 11: Check Response Status
**Lines**: 164-172

```typescript
if (!response.ok) {
  const apiError = payload.error?.message ?? "BigQuery request failed.";
  const normalizedError = apiError.includes("bigquery.jobs.create")
    ? `BigQuery permission error on project ${projectId}: the configured service account is missing bigquery.jobs.create.`
    : apiError;

  logger.error({ apiError: normalizedError, projectId }, "BigQuery API error");
  return NextResponse.json({ error: normalizedError, details: payload.errors ?? [] }, { status: response.status });
}
```

- Normalizes permission errors into friendly messages
- Error → HTTP [status from BigQuery] **FLOW ENDS**
- Success → Continue

---

## Step 12: Normalize Rows
**Lines**: 174-175

```typescript
const schemaFields = payload.schema?.fields ?? [];
const rows = normalizeRows(schemaFields, payload.rows ?? []);
```

**`normalizeRows()` (lines 108-115)**:
```typescript
function normalizeRows(schemaFields: BigQueryField[] = [], rows: BigQueryRow[] = []): Record<string, unknown>[] {
  return rows.map((row) =>
    schemaFields.reduce<Record<string, unknown>>((record, field, index) => {
      record[field.name] = normalizeFieldValue(field, row.f[index]);
      return record;
    }, {}),
  );
}
```

Transforms BigQuery's `{ f: [{ v: value }] }` format → flat `{ columnName: value }` objects.

Handles: scalars, REPEATED arrays, RECORD nested objects (recursively).

---

## Step 13: Build and Return Response
**Lines**: 177-186

```typescript
return NextResponse.json({
  rows,
  totalRows: payload.totalRows ?? String(rows.length),
  jobComplete: payload.jobComplete ?? true,
  cacheHit: payload.cacheHit ?? false,
  totalBytesProcessed: payload.totalBytesProcessed ?? null,
  totalBytesBilled: payload.totalBytesBilled ?? null,
  jobReference: payload.jobReference ?? null,
  schema: schemaFields,
});
```

→ **HTTP 200** ✓

---

## Step 14: Catch Block
**Lines**: 187-192

```typescript
} catch (error) {
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  logger.error({ error: message }, "BigQuery API request failed");
  return NextResponse.json({ error: message }, { status: 500 });
}
```

Any unhandled exception → **HTTP 500** ✗

---

## Environment Variables

| Variable | Usage |
|----------|-------|
| `GCP_PROJECT_ID` | Project ID for API calls + default query |
| `GCP_CLIENT_EMAIL` | Service account email for JWT |
| `GCP_PRIVATE_KEY` | RSA private key for JWT signing |
| `BQ_DATASET` | Default dataset name |
| `BQ_TABLE` | Default table name |

---

## Error Scenarios

| Scenario | Triggered At | Response |
|----------|-------------|----------|
| Empty/missing query | Step 4 | HTTP 400 |
| Invalid/missing GCP credentials | Step 7 | HTTP 401 + credential error message |
| BigQuery API unreachable (network/DNS/OS timeout) | Step 9 | HTTP 503 + unreachable message |
| Missing `bigquery.jobs.create` permission | Step 11 | HTTP 403 + friendly message |
| Query timeout | Step 9/11 | BigQuery status code |
| Any unhandled exception | Any step | HTTP 500 |

---

## Key Variables Summary

| Variable | Type | Source |
|----------|------|--------|
| `query` | string | URL param or default SELECT |
| `projectId` | string | URL param or `env.GCP_PROJECT_ID` |
| `credentials` | object | env vars (project_id, private_key, client_email) |
| `token` | string | OAuth bearer token from Google |
| `payload` | BigQueryQueryResponse | Parsed BigQuery API response |
| `schemaFields` | BigQueryField[] | `payload.schema.fields` |
| `rows` | Record<string, unknown>[] | `normalizeRows()` output |

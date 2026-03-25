import { createHash } from "crypto"
import { NextRequest, NextResponse } from "next/server"
import { GoogleAuth } from "google-auth-library"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"
import { redisGet, redisSet, redisFlushAll, TTL } from "@/lib/redis"
import { aggregate, generateInsights } from "@/lib/finops-engine"
import type {
  BillingRow,
  Alert,
  AggregatedDashboard,
  BigQueryCell,
  BigQueryValue,
  BigQueryField,
  BigQueryRow,
  BigQueryQueryResponse,
  CachedPayload,
} from "@/lib/types"

export const runtime = "nodejs"

// ── Row normalisation ──────────────────────────────────────────────────────

function normalizeScalarValue(value: BigQueryValue): unknown {
  if (value === null || typeof value !== "object") return value

  if (Array.isArray(value.v)) {
    return value.v.map((item) => normalizeScalarValue(item))
  }

  if ("v" in value && value.v !== undefined && !Array.isArray(value.v)) {
    return normalizeScalarValue(value.v)
  }

  return value
}

function normalizeFieldValue(
  field: BigQueryField,
  cell: BigQueryCell | undefined,
): unknown {
  const rawValue = cell?.v ?? null

  if (rawValue === null) return null

  if (field.mode === "REPEATED") {
    const repeatedValues =
      typeof rawValue === "object" &&
      rawValue !== null &&
      "v" in rawValue &&
      Array.isArray(rawValue.v)
        ? rawValue.v
        : []

    return repeatedValues.map((item) => {
      if (field.type === "RECORD") {
        const recordCell: BigQueryCell =
          typeof item === "object" && item !== null && "f" in item
            ? { v: item }
            : { v: { f: [] } }
        return normalizeFieldValue({ ...field, mode: undefined }, recordCell)
      }
      return normalizeScalarValue(item)
    })
  }

  if (field.type === "RECORD") {
    const nestedCells =
      typeof rawValue === "object" &&
      rawValue !== null &&
      "f" in rawValue &&
      Array.isArray(rawValue.f)
        ? rawValue.f
        : []

    return (field.fields ?? []).reduce<Record<string, unknown>>(
      (record, nestedField, index) => {
        record[nestedField.name] = normalizeFieldValue(
          nestedField,
          nestedCells[index],
        )
        return record
      },
      {},
    )
  }

  return normalizeScalarValue(rawValue)
}

function normalizeRows(
  schemaFields: BigQueryField[] = [],
  rows: BigQueryRow[] = [],
): Record<string, unknown>[] {
  return rows.map((row) =>
    schemaFields.reduce<Record<string, unknown>>((record, field, index) => {
      record[field.name] = normalizeFieldValue(field, row.f[index])
      return record
    }, {}),
  )
}

// ── Cache key ──────────────────────────────────────────────────────────────

function buildCacheKey(query: string, projectId: string): string {
  return createHash("sha256").update(query + projectId).digest("hex")
}

function buildDashboardResponse(
  source: "cached" | "db",
  aggregated: AggregatedDashboard,
  aiInsights: Alert[],
  rawPayload: unknown,
) {
  return {
    status: 200,
    source,
    statistics: aggregated.statistics,
    charts: aggregated.charts,
    byService: aggregated.byService,
    byProject: aggregated.byProject,
    bySku: aggregated.bySku,
    summary: aggregated.summary,
    aiInsights,
    rawPayload,
  }
}

// ── Handler ────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    // [Step 1] Extract query parameter
    const query =
      request.nextUrl.searchParams.get("query") ??
      `SELECT * FROM \`${env.GCP_PROJECT_ID}.${env.BQ_DATASET}.${env.BQ_TABLE}\` WHERE invoice.month LIKE '${new Date().getFullYear()}%'`

    // [Step 2] Extract projectId parameter
    const projectId =
      request.nextUrl.searchParams.get("projectId") ?? env.GCP_PROJECT_ID

    // Cache bypass flag
    const noCache = request.nextUrl.searchParams.get("noCache") === "true"

    // [Step 3] Validate query
    if (!query?.trim()) {
      return NextResponse.json(
        { error: "The query parameter is required." },
        { status: 400 },
      )
    }

    // [Step 3.5] Redis cache check
    const cacheKey = buildCacheKey(query, projectId)

    if (!noCache) {
      const cached = await redisGet<CachedPayload>(cacheKey)

      if (cached) {
        logger.info({ cacheKey }, "Redis HIT — serving from cache")

        if (cached.aggregated && cached.aiInsights) {
          return NextResponse.json(
            buildDashboardResponse(
              "cached",
              cached.aggregated,
              cached.aiInsights,
              cached.rows,
            ),
          )
        }

        const aggregated: AggregatedDashboard = aggregate(
          cached.rows as unknown as BillingRow[],
        )
        const aiInsights: Alert[] = await generateInsights(aggregated)

        await redisSet(
          cacheKey,
          {
            ...cached,
            aggregated,
            aiInsights,
          },
          TTL.DEFAULT,
        )

        return NextResponse.json(
          buildDashboardResponse("cached", aggregated, aiInsights, cached.rows),
        )
      }
    }

    // [Step 4] Build credentials object
    const credentials = {
      type: "service_account" as const,
      project_id: env.GCP_PROJECT_ID,
      private_key: env.GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
      client_email: env.GCP_CLIENT_EMAIL,
      token_uri: "https://oauth2.googleapis.com/token",
    }

    // [Step 5] Initialize GoogleAuth
    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/bigquery"],
    })

    // [Step 6] Get OAuth token — with credential validation
    let token: string | null | undefined
    try {
      const authClient = await auth.getClient()
      ;({ token } = await authClient.getAccessToken())
    } catch (authError) {
      const message =
        authError instanceof Error ? authError.message : "Unknown auth error"
      logger.error({ authError: message, projectId }, "BigQuery credential error")
      return NextResponse.json(
        { error: `Invalid or missing GCP credentials: ${message}` },
        { status: 401 },
      )
    }

    // [Step 7] Log request
    logger.info({ projectId, query: query.slice(0, 50) }, "BigQuery API request")

    // [Step 8] POST to BigQuery API — with network error handling
    let response: Response
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
            timeoutMs: 10000,
            useLegacySql: false,
            useQueryCache: true,
            dryRun: false,
            location: null,
          }),
          cache: "no-store",
        },
      )
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "Network error"
      logger.error({ fetchError: message, projectId }, "BigQuery unreachable")
      return NextResponse.json(
        { error: `BigQuery API unreachable: ${message}` },
        { status: 503 },
      )
    }

    // [Step 9] Parse response
    let payload = (await response.json()) as BigQueryQueryResponse & {
      error?: { message?: string }
      jobComplete?: boolean
      jobReference?: { projectId: string; jobId: string; location?: string }
    }

    // [Step 9.5] Poll until jobComplete if job is still running
    if (response.ok && payload.jobComplete === false && payload.jobReference?.jobId) {
      const { jobId, location } = payload.jobReference
      const locationParam = location ? `&location=${location}` : ""
      let attempts = 0
      const maxAttempts = 10

      while (!payload.jobComplete && attempts < maxAttempts) {
        await new Promise((r) => setTimeout(r, 2000))
        attempts++
        logger.info({ jobId, attempts }, "BigQuery job polling...")
        const pollRes = await fetch(
          `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries/${jobId}?timeoutMs=10000${locationParam}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          },
        )
        payload = await pollRes.json()
      }

      if (!payload.jobComplete) {
        return NextResponse.json({ error: "BigQuery job timed out after polling." }, { status: 504 })
      }
    }

    // [Step 10] Check status — do NOT cache errors
    if (!response.ok) {
      const apiError = payload.error?.message ?? "BigQuery request failed."
      const normalizedError = apiError.includes("bigquery.jobs.create")
        ? `BigQuery permission error on project ${projectId}: the configured service account is missing bigquery.jobs.create.`
        : apiError

      logger.error({ apiError: normalizedError, projectId }, "BigQuery API error")
      return NextResponse.json(
        { error: normalizedError, details: payload.errors ?? [] },
        { status: response.status },
      )
    }

    // [Step 11] Extract schema & normalize rows
    const schemaFields = payload.schema?.fields ?? []
    const rows = normalizeRows(schemaFields, payload.rows ?? [])

    // [Step 11.5] Aggregate fresh data via lib/finops-engine.ts
    const aggregated: AggregatedDashboard = aggregate(
      rows as unknown as BillingRow[],
    )

    // [Step 11.6] Call Anthropic SDK (claude-haiku-4-5) for AI insights
    const aiInsights: Alert[] = await generateInsights(aggregated)

    // [Step 11.7] Redis cache write (full dashboard response parts, only on HTTP 200)
    if (!noCache) {
      const responsePayload: CachedPayload = {
        rows,
        totalRows: payload.totalRows ?? String(rows.length),
        jobComplete: payload.jobComplete ?? true,
        cacheHit: payload.cacheHit ?? false,
        totalBytesProcessed: payload.totalBytesProcessed ?? null,
        totalBytesBilled: payload.totalBytesBilled ?? null,
        jobReference: payload.jobReference ?? null,
        schema: schemaFields,
        aggregated,
        aiInsights,
      }
      await redisSet(cacheKey, responsePayload, TTL.DEFAULT)
      logger.info({ cacheKey }, "Redis SET — cached dashboard response")
    }

    // [Step 12] Return unified payload
    return NextResponse.json(
      buildDashboardResponse("db", aggregated, aiInsights, rows),
    )
  } catch (error) {
    // [CATCH] Any unhandled exception → HTTP 500
    const message =
      error instanceof Error ? error.message : "Unexpected server error."
    logger.error({ error: message }, "BigQuery API request failed")
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ── DELETE /api/bigquery — flush entire Redis cache ─────────────────────────

export async function DELETE() {
  try {
    await redisFlushAll()
    return NextResponse.json({ status: 200, message: "Redis cache flushed" })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error."
    logger.error({ error: message }, "Redis flush failed")
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

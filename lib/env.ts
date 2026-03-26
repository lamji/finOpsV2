/**
 * Zod-validated environment configuration.
 * All required vars throw a readable error at startup — never at runtime.
 *
 * Usage: import { env } from '@/lib/env'
 */

import { z } from 'zod'

const envSchema = z.object({
  // Runtime
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Deployment tier — distinguishes staging from production at runtime
  // since Next.js only supports NODE_ENV: development | test | production
  DEPLOY_ENV: z.enum(['development', 'staging', 'production']).default('development'),

  // Google Cloud / BigQuery
  GCP_PROJECT_ID: z.string().default('mock-project'),
  GCP_CLIENT_EMAIL: z.union([
    z.literal(''),
    z.string().email('GCP_CLIENT_EMAIL must be a valid service account email'),
  ]).default(''),
  GCP_PRIVATE_KEY: z.string().default(''),
  BQ_DATASET: z.string().default('mock_dataset'),
  BQ_TABLE: z.string().default('mock_table'),

  // Anthropic AI (optional at build time — graceful degradation if missing at runtime)
  ANTHROPIC_API_KEY: z.string().default(''),

  // Redis (optional — graceful degradation if not set)
  REDIS_URL: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
})

function validateEnv() {
  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ✗ ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(
      `\n\n[finOps] Environment configuration error:\n${formatted}\n\n` +
        `Copy .env.example to .env.local (all envs) or .env.development.local / .env.production.local and fill in the missing values.\n`,
    )
  }

  return result.data
}

// Validated at module load — crashes on startup with a clear message if invalid
export const env = validateEnv()
export type Env = z.infer<typeof envSchema>

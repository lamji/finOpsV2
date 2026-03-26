/**
 * Pino structured logger singleton.
 * Pretty-printed in development, JSON in production.
 *
 * Usage: import { logger } from '@/lib/logger'
 */

import pino from 'pino'
import { env } from '@/lib/env'

const isDev = env.NODE_ENV === 'development'

// Secret field paths to redact from all log output.
// Covers direct keys and one level of nesting (e.g. credentials.private_key).
const REDACTED_PATHS = [
  'private_key',
  'client_secret',
  'apiKey',
  'api_key',
  'token',
  'password',
  'secret',
  'GCP_PRIVATE_KEY',
  'ANTHROPIC_API_KEY',
  'REDIS_URL',
  '*.private_key',
  '*.client_secret',
  '*.apiKey',
  '*.api_key',
  '*.token',
  '*.password',
  '*.secret',
]

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
  ...(isDev
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }
    : {
        // Production: structured JSON — no transport overhead
        formatters: {
          level(label) {
            return { level: label }
          },
        },
        timestamp: pino.stdTimeFunctions.isoTime,
      }),
})

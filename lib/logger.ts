/**
 * Pino structured logger singleton.
 * Pretty-printed in development, JSON in production.
 *
 * Usage: import { logger } from '@/lib/logger'
 */

import pino from 'pino'
import { env } from '@/lib/env'

const isDev = env.NODE_ENV === 'development'

export const logger = pino({
  level: env.LOG_LEVEL,
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

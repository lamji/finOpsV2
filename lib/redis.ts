/**
 * Redis client singleton — server-only.
 * Uses globalThis to survive Next.js hot-module reloads in dev.
 * Gracefully degrades: if REDIS_URL is not set, all cache ops are no-ops.
 */

import Redis from "ioredis"
import { env } from "@/lib/env"
import { logger } from "@/lib/logger"

// ── TTL constants (seconds) ────────────────────────────────────────────────

export const TTL = {
  DEFAULT: 300,  // 5 min
  HEAVY: 1800,   // 30 min
  SKIP: 0,       // bypass cache
} as const

// ── Singleton via globalThis (survives Next.js HMR) ────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | null | undefined
}

function getClient(): Redis | null {
  if (!env.REDIS_URL) return null

  if (!globalThis.__redis) {
    globalThis.__redis = new Redis(env.REDIS_URL)

    globalThis.__redis.on("connect", () => {
      logger.info("Redis connected")
    })

    globalThis.__redis.on("error", (err: Error) => {
      logger.warn({ err: err.message }, "Redis error — caching degraded")
    })
  }

  return globalThis.__redis
}

// ── Public helpers ─────────────────────────────────────────────────────────

export async function redisGet<T>(key: string): Promise<T | null> {
  const redis = getClient()
  if (!redis) return null

  try {
    const raw = await redis.get(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch (err) {
    logger.warn({ err, key }, "Redis GET failed — cache miss")
    return null
  }
}

export async function redisDel(key: string): Promise<void> {
  const redis = getClient()
  if (!redis) return

  try {
    await redis.del(key)
  } catch (err) {
    logger.warn({ err, key }, "Redis DEL failed")
  }
}

export async function redisFlushAll(): Promise<void> {
  const redis = getClient()
  if (!redis) return

  try {
    await redis.flushall()
    logger.info("Redis FLUSHALL — cache cleared")
  } catch (err) {
    logger.warn({ err }, "Redis FLUSHALL failed")
  }
}

export async function redisSet(
  key: string,
  value: unknown,
  ttlSeconds: number = TTL.DEFAULT,
): Promise<void> {
  if (ttlSeconds === TTL.SKIP) return

  const redis = getClient()
  if (!redis) return

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds)
  } catch (err) {
    logger.warn({ err, key }, "Redis SET failed — continuing without cache")
  }
}

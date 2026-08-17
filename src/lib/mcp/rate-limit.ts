import { McpHttpError } from '@/lib/mcp/errors'

type RateLimitKind = 'read' | 'write' | 'preview'
type Bucket = { startedAt: number; count: number }

const LIMITS: Record<RateLimitKind, number> = { read: 120, write: 30, preview: 10 }
const WINDOW_MS = 60_000
const buckets = new Map<string, Bucket>()

export function checkMcpRateLimit(userId: string, kind: RateLimitKind, now = Date.now()) {
  const key = `${userId}:${kind}`
  const current = buckets.get(key)
  if (!current || current.startedAt + WINDOW_MS <= now) {
    buckets.set(key, { startedAt: now, count: 1 })
    return
  }
  if (current.count >= LIMITS[kind]) {
    throw new McpHttpError(429, 'RATE_LIMITED', 'Limite de requisições excedido')
  }
  current.count += 1
}

export function resetMcpRateLimitsForTests() {
  buckets.clear()
}

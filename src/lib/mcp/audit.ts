import { prisma } from '@/lib/prisma'

const SECRET_KEY = /authorization|token|password|secret|email/i

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]'
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitize(item, depth + 1))
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        SECRET_KEY.test(key) ? '[redacted]' : sanitize(child, depth + 1),
      ])
    )
  }
  if (typeof value === 'string') return value.slice(0, 500)
  return value
}

export async function recordMcpAuditEvent(event: {
  requestId: string
  userId?: string
  walletId?: string
  action: string
  resourceType?: string
  resourceId?: string
  result: 'succeeded' | 'denied' | 'failed'
  metadata?: unknown
}) {
  await prisma.mcpAuditEvent.create({
    data: {
      requestId: event.requestId,
      userId: event.userId,
      walletId: event.walletId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      result: event.result,
      metadataText: event.metadata === undefined ? null : JSON.stringify(sanitize(event.metadata)),
    },
  })
}

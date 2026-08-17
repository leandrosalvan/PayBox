import type { NextApiRequest, NextApiResponse } from 'next'
import { authenticateMcpRequest, type McpIdentity, type McpScope } from '@/lib/mcp/auth'
import { recordMcpAuditEvent } from '@/lib/mcp/audit'
import { McpHttpError } from '@/lib/mcp/errors'
import { requireMcpMethod, runMcpRoute, sendMcpSuccess } from '@/lib/mcp/http'
import { runIdempotentMutation } from '@/lib/mcp/idempotency'
import { checkMcpRateLimit } from '@/lib/mcp/rate-limit'

function idempotencyKey(req: NextApiRequest) {
  const value = req.headers['idempotency-key']
  if (typeof value !== 'string') {
    throw new McpHttpError(400, 'VALIDATION_ERROR', 'Idempotency-Key obrigatória')
  }
  return value
}

async function auditFailure(event: Parameters<typeof recordMcpAuditEvent>[0]) {
  try {
    await recordMcpAuditEvent(event)
  } catch {
    // Não substitui o erro original por uma falha secundária de auditoria.
  }
}

export async function runMcpMutation<T>(
  req: NextApiRequest,
  res: NextApiResponse,
  options: {
    method: 'POST' | 'PATCH' | 'PUT' | 'DELETE'
    scope: Exclude<McpScope, 'read'> | ((req: NextApiRequest) => Exclude<McpScope, 'read'>)
    tool: string
    parse: (req: NextApiRequest) => T
    execute: (input: T, identity: McpIdentity, requestId: string) => Promise<unknown>
    statusCode?: number
    rateLimitKind?: 'write' | 'preview'
    walletId?: (input: T) => string | undefined
  }
) {
  let identity: McpIdentity | undefined
  let parsedInput: T | undefined
  await runMcpRoute(req, res, async (requestId) => {
    try {
      requireMcpMethod(req, [options.method])
      const requiredScope = typeof options.scope === 'function' ? options.scope(req) : options.scope
      identity = await authenticateMcpRequest(req, requiredScope)
      checkMcpRateLimit(identity.userId, options.rateLimitKind || 'write')
      parsedInput = options.parse(req)
      const result = await runIdempotentMutation({
        key: idempotencyKey(req),
        userId: identity.userId,
        tool: options.tool,
        input: parsedInput,
        execute: async () => ({
          statusCode: options.statusCode || 200,
          data: await options.execute(parsedInput!, identity!, requestId),
        }),
      })
      await recordMcpAuditEvent({
        requestId,
        userId: identity.userId,
        walletId: options.walletId?.(parsedInput),
        action: options.tool,
        result: 'succeeded',
        metadata: { replayed: result.replayed },
      })
      sendMcpSuccess(res, requestId, result.data, result.statusCode)
    } catch (error) {
      const status = error instanceof McpHttpError ? error.statusCode : 500
      await auditFailure({
        requestId,
        userId: identity?.userId,
        walletId: parsedInput ? options.walletId?.(parsedInput) : undefined,
        action: options.tool,
        result: status === 401 || status === 403 ? 'denied' : 'failed',
        metadata: { code: error instanceof McpHttpError ? error.code : 'INTERNAL_ERROR' },
      })
      throw error
    }
  })
}

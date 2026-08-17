import { randomUUID } from 'node:crypto'
import type { NextApiRequest, NextApiResponse } from 'next'
import type { ZodType } from 'zod'
import { McpHttpError, toMcpHttpError } from '@/lib/mcp/errors'

const MAX_BODY_BYTES = 16 * 1024

export type McpSuccess<T> = {
  data: T
  requestId: string
  serverTime: string
}

export function getMcpRequestId(req: NextApiRequest): string {
  const supplied = req.headers['x-request-id']
  if (typeof supplied === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(supplied)) {
    return supplied
  }
  return `req_${randomUUID()}`
}

export function sendMcpSuccess<T>(
  res: NextApiResponse,
  requestId: string,
  data: T,
  statusCode = 200
) {
  return res.status(statusCode).json({
    data,
    requestId,
    serverTime: new Date().toISOString(),
  } satisfies McpSuccess<T>)
}

export function sendMcpError(
  res: NextApiResponse,
  requestId: string,
  error: unknown
) {
  const safeError = toMcpHttpError(error)
  return res.status(safeError.statusCode).json({
    error: {
      code: safeError.code,
      message: safeError.message,
      requestId,
    },
  })
}

export function requireMcpMethod(req: NextApiRequest, allowed: readonly string[]) {
  if (!req.method || !allowed.includes(req.method)) {
    throw new McpHttpError(405, 'METHOD_NOT_ALLOWED', 'Método não permitido')
  }
}

export function parseMcpInput<T>(req: NextApiRequest, schema: ZodType<T>): T {
  const contentLength = Number(req.headers['content-length'] || 0)
  const serialized = req.body === undefined ? '' : JSON.stringify(req.body)
  if (contentLength > MAX_BODY_BYTES || Buffer.byteLength(serialized) > MAX_BODY_BYTES) {
    throw new McpHttpError(413, 'PAYLOAD_TOO_LARGE', 'Corpo da requisição muito grande')
  }

  const result = schema.safeParse(req.body)
  if (!result.success) {
    throw new McpHttpError(400, 'VALIDATION_ERROR', 'Dados inválidos')
  }
  return result.data
}

export async function runMcpRoute(
  req: NextApiRequest,
  res: NextApiResponse,
  route: (requestId: string) => Promise<void>
) {
  const requestId = getMcpRequestId(req)
  try {
    await route(requestId)
  } catch (error) {
    if (!res.headersSent) sendMcpError(res, requestId, error)
  }
}

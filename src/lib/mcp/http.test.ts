import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { parseMcpInput, requireMcpMethod } from '@/lib/mcp/http'
import { createMockRequest } from '@/test/next-api'

describe('contratos HTTP MCP', () => {
  it('recusa método inválido', () => {
    expect(() => requireMcpMethod(createMockRequest({ method: 'POST' }), ['GET'])).toThrowError(
      expect.objectContaining({ code: 'METHOD_NOT_ALLOWED' })
    )
  })

  it('valida o body com Zod', () => {
    const req = createMockRequest({ body: { value: 'ok' } })
    expect(parseMcpInput(req, z.object({ value: z.string() }))).toEqual({ value: 'ok' })
  })

  it('recusa body acima do limite', () => {
    const req = createMockRequest({ headers: { 'content-length': '20000' }, body: {} })
    expect(() => parseMcpInput(req, z.object({}))).toThrowError(
      expect.objectContaining({ code: 'PAYLOAD_TOO_LARGE' })
    )
  })
})

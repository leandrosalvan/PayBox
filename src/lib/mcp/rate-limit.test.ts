import { beforeEach, describe, expect, it } from 'vitest'
import { checkMcpRateLimit, resetMcpRateLimitsForTests } from '@/lib/mcp/rate-limit'

describe('rate limit MCP', () => {
  beforeEach(resetMcpRateLimitsForTests)

  it('usa limite menor para prévias destrutivas', () => {
    for (let index = 0; index < 10; index += 1) checkMcpRateLimit('user-1', 'preview', 0)
    expect(() => checkMcpRateLimit('user-1', 'preview', 0)).toThrowError(
      expect.objectContaining({ statusCode: 429 })
    )
  })

  it('reinicia a janela após um minuto', () => {
    for (let index = 0; index < 10; index += 1) checkMcpRateLimit('user-1', 'preview', 0)
    expect(() => checkMcpRateLimit('user-1', 'preview', 60_000)).not.toThrow()
  })
})

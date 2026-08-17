import { describe, expect, it, vi } from 'vitest'

const create = vi.hoisted(() => vi.fn().mockResolvedValue({}))
vi.mock('@/lib/prisma', () => ({ prisma: { mcpAuditEvent: { create } } }))

import { recordMcpAuditEvent } from '@/lib/mcp/audit'

describe('auditoria MCP', () => {
  it('remove segredos dos metadados', async () => {
    await recordMcpAuditEvent({
      requestId: 'req-1',
      action: 'test',
      result: 'failed',
      metadata: { authorization: 'Bearer secreto', nested: { token: 'secreto', safe: 'ok' } },
    })
    const metadataText = create.mock.calls[0][0].data.metadataText
    expect(metadataText).toContain('[redacted]')
    expect(metadataText).not.toContain('secreto')
    expect(metadataText).toContain('ok')
  })
})

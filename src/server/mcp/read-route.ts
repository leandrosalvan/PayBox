import type { NextApiRequest, NextApiResponse } from 'next'
import { authenticateMcpRequest, type McpIdentity } from '@/lib/mcp/auth'
import { requireMcpMethod, runMcpRoute, sendMcpSuccess } from '@/lib/mcp/http'
import { checkMcpRateLimit } from '@/lib/mcp/rate-limit'

export function createMcpReadHandler(
  load: (context: { req: NextApiRequest; identity: McpIdentity }) => Promise<unknown>
) {
  return async function mcpReadHandler(req: NextApiRequest, res: NextApiResponse) {
    await runMcpRoute(req, res, async (requestId) => {
      requireMcpMethod(req, ['GET'])
      const identity = await authenticateMcpRequest(req, 'read')
      checkMcpRateLimit(identity.userId, 'read')
      const data = await load({ req, identity })
      sendMcpSuccess(res, requestId, data)
    })
  }
}

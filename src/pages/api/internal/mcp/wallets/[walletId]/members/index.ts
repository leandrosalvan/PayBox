import { parseQuery, walletIdSchema } from '@/lib/mcp/schemas'
import { createMcpReadHandler } from '@/server/mcp/read-route'
import { listMembers } from '@/server/paybox/queries'

export default createMcpReadHandler(({ req, identity }) => {
  const { walletId } = parseQuery(walletIdSchema, req.query)
  return listMembers(identity.userId, walletId)
})

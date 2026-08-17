import { parseQuery, walletIdSchema } from '@/lib/mcp/schemas'
import { createMcpReadHandler } from '@/server/mcp/read-route'
import { listRecurringExpenses } from '@/server/paybox/queries'

export default createMcpReadHandler(({ req, identity }) => {
  const { walletId } = parseQuery(walletIdSchema, req.query)
  return listRecurringExpenses(identity.userId, walletId)
})

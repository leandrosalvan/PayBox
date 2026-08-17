import { monthSummarySchema, parseQuery } from '@/lib/mcp/schemas'
import { createMcpReadHandler } from '@/server/mcp/read-route'
import { getMonthSummary } from '@/server/paybox/queries'

export default createMcpReadHandler(({ req, identity }) => {
  const input = parseQuery(monthSummarySchema, req.query)
  return getMonthSummary(identity.userId, input.walletId, input.month)
})

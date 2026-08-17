import { createMcpReadHandler } from '@/server/mcp/read-route'
import { listPendingInvites } from '@/server/paybox/queries'

export default createMcpReadHandler(({ identity }) =>
  listPendingInvites(identity.userId, identity.email)
)

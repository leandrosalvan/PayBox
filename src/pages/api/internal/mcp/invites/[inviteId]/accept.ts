import type { NextApiRequest, NextApiResponse } from 'next'
import { acceptInviteSchema } from '@/lib/mcp/mutation-schemas'
import { parseMcpInput } from '@/lib/mcp/http'
import { runMcpMutation } from '@/server/mcp/mutation-route'
import { acceptInviteCommand } from '@/server/paybox/invite-commands'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return runMcpMutation(req, res, {
    method: 'POST', scope: 'write:wallets', tool: 'paybox_accept_invite',
    parse: (request) => parseMcpInput({ ...request, body: { inviteId: request.query.inviteId } } as NextApiRequest, acceptInviteSchema),
    execute: (input, identity) => acceptInviteCommand(identity.userId, identity.email, input.inviteId),
  })
}

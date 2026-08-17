import type { NextApiRequest, NextApiResponse } from 'next'
import { createInviteSchema } from '@/lib/mcp/mutation-schemas'
import { parseMcpInput } from '@/lib/mcp/http'
import { runMcpMutation } from '@/server/mcp/mutation-route'
import { createWalletInviteCommand } from '@/server/paybox/invite-commands'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return runMcpMutation(req, res, {
    method: 'POST', scope: 'admin:members', tool: 'paybox_create_wallet_invite', statusCode: 201,
    parse: (request) => parseMcpInput({ ...request, body: { walletId: request.query.walletId, ...request.body } } as NextApiRequest, createInviteSchema),
    execute: (input, identity) => createWalletInviteCommand(identity.userId, input),
    walletId: (input) => input.walletId,
  })
}

import type { NextApiRequest, NextApiResponse } from 'next'
import { confirmedWalletActionSchema, updateWalletSchema } from '@/lib/mcp/mutation-schemas'
import { parseMcpInput } from '@/lib/mcp/http'
import { walletIdSchema, parseQuery } from '@/lib/mcp/schemas'
import { runMcpMutation } from '@/server/mcp/mutation-route'
import { createMcpReadHandler } from '@/server/mcp/read-route'
import { executeDestructiveActionCommand } from '@/server/paybox/destructive-commands'
import { getWallet } from '@/server/paybox/queries'
import { updateWalletCommand } from '@/server/paybox/wallet-commands'

const readHandler = createMcpReadHandler(({ req, identity }) => {
  const { walletId } = parseQuery(walletIdSchema, req.query)
  return getWallet(identity.userId, walletId)
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') return readHandler(req, res)
  if (req.method === 'PATCH') return runMcpMutation(req, res, {
    method: 'PATCH', scope: 'admin:wallets', tool: 'paybox_update_wallet',
    parse: (request) => parseMcpInput({ ...request, body: { walletId: request.query.walletId, ...request.body } } as NextApiRequest, updateWalletSchema),
    execute: (input, identity) => updateWalletCommand(identity.userId, input),
    walletId: (input) => input.walletId,
  })
  return runMcpMutation(req, res, {
    method: 'DELETE', scope: 'admin:wallets', tool: 'paybox_delete_wallet',
    parse: (request) => parseMcpInput({ ...request, body: { walletId: request.query.walletId, ...request.body } } as NextApiRequest, confirmedWalletActionSchema),
    execute: (input, identity) => executeDestructiveActionCommand({ userId: identity.userId, action: 'delete_wallet', target: { walletId: input.walletId }, confirmationId: input.confirmationId }),
    walletId: (input) => input.walletId,
  })
}

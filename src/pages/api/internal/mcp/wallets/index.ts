import type { NextApiRequest, NextApiResponse } from 'next'
import { createWalletSchema } from '@/lib/mcp/mutation-schemas'
import { parseMcpInput } from '@/lib/mcp/http'
import { runMcpMutation } from '@/server/mcp/mutation-route'
import { createMcpReadHandler } from '@/server/mcp/read-route'
import { listWallets } from '@/server/paybox/queries'
import { createWalletCommand } from '@/server/paybox/wallet-commands'

const readHandler = createMcpReadHandler(({ identity }) => listWallets(identity.userId))

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') return readHandler(req, res)
  return runMcpMutation(req, res, {
    method: 'POST',
    scope: 'write:wallets',
    tool: 'paybox_create_wallet',
    statusCode: 201,
    parse: (request) => parseMcpInput(request, createWalletSchema),
    execute: (input, identity) => createWalletCommand(identity.userId, input),
  })
}

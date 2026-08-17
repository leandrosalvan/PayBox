import type { NextApiRequest, NextApiResponse } from 'next'
import { previewDestructiveSchema } from '@/lib/mcp/mutation-schemas'
import { parseMcpInput } from '@/lib/mcp/http'
import { runMcpMutation } from '@/server/mcp/mutation-route'
import { previewDestructiveActionCommand } from '@/server/paybox/destructive-commands'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return runMcpMutation(req, res, {
    method: 'POST',
    scope: (request) => {
      if (request.body?.action === 'delete_wallet') return 'admin:wallets'
      if (request.body?.action === 'remove_wallet_member') return 'admin:members'
      if (request.body?.action === 'delete_category') return 'write:categories'
      return 'write:expenses'
    },
    tool: 'paybox_preview_destructive_action', statusCode: 201, rateLimitKind: 'preview',
    parse: (request) => parseMcpInput(request, previewDestructiveSchema),
    execute: (input, identity) => previewDestructiveActionCommand(identity.userId, input.action, input.target),
    walletId: (input) => input.target.walletId,
  })
}

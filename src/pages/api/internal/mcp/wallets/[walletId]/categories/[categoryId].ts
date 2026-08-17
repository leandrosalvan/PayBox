import type { NextApiRequest, NextApiResponse } from 'next'
import { confirmedCategoryActionSchema, updateCategorySchema } from '@/lib/mcp/mutation-schemas'
import { parseMcpInput } from '@/lib/mcp/http'
import { runMcpMutation } from '@/server/mcp/mutation-route'
import { updateCategoryCommand } from '@/server/paybox/category-commands'
import { executeDestructiveActionCommand } from '@/server/paybox/destructive-commands'

function bodyWithIds(req: NextApiRequest) {
  return { ...req, body: { walletId: req.query.walletId, categoryId: req.query.categoryId, ...req.body } } as NextApiRequest
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'PATCH') return runMcpMutation(req, res, {
    method: 'PATCH', scope: 'write:categories', tool: 'paybox_update_category',
    parse: (request) => parseMcpInput(bodyWithIds(request), updateCategorySchema),
    execute: (input, identity) => updateCategoryCommand(identity.userId, input),
    walletId: (input) => input.walletId,
  })
  return runMcpMutation(req, res, {
    method: 'DELETE', scope: 'write:categories', tool: 'paybox_delete_category',
    parse: (request) => parseMcpInput(bodyWithIds(request), confirmedCategoryActionSchema),
    execute: (input, identity) => executeDestructiveActionCommand({ userId: identity.userId, action: 'delete_category', target: { walletId: input.walletId, categoryId: input.categoryId }, confirmationId: input.confirmationId }),
    walletId: (input) => input.walletId,
  })
}

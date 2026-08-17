import type { NextApiRequest, NextApiResponse } from 'next'
import { createCategorySchema } from '@/lib/mcp/mutation-schemas'
import { parseMcpInput } from '@/lib/mcp/http'
import { parseQuery, walletIdSchema } from '@/lib/mcp/schemas'
import { runMcpMutation } from '@/server/mcp/mutation-route'
import { createMcpReadHandler } from '@/server/mcp/read-route'
import { createCategoryCommand } from '@/server/paybox/category-commands'
import { listCategories } from '@/server/paybox/queries'

const readHandler = createMcpReadHandler(({ req, identity }) => {
  const { walletId } = parseQuery(walletIdSchema, req.query)
  return listCategories(identity.userId, walletId)
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') return readHandler(req, res)
  return runMcpMutation(req, res, {
    method: 'POST', scope: 'write:categories', tool: 'paybox_create_category', statusCode: 201,
    parse: (request) => parseMcpInput({ ...request, body: { walletId: request.query.walletId, ...request.body } } as NextApiRequest, createCategorySchema),
    execute: (input, identity) => createCategoryCommand(identity.userId, input),
    walletId: (input) => input.walletId,
  })
}

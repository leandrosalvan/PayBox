import type { NextApiRequest, NextApiResponse } from 'next'
import { createExpenseSchema } from '@/lib/mcp/mutation-schemas'
import { parseMcpInput } from '@/lib/mcp/http'
import { listExpensesSchema, parseQuery } from '@/lib/mcp/schemas'
import { runMcpMutation } from '@/server/mcp/mutation-route'
import { createMcpReadHandler } from '@/server/mcp/read-route'
import { createExpenseCommand } from '@/server/paybox/expense-commands'
import { listExpenses } from '@/server/paybox/queries'

const readHandler = createMcpReadHandler(({ req, identity }) => {
  const input = parseQuery(listExpensesSchema, req.query)
  return listExpenses({ userId: identity.userId, ...input })
})

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') return readHandler(req, res)
  return runMcpMutation(req, res, {
    method: 'POST', scope: 'write:expenses', tool: 'paybox_create_expense', statusCode: 201,
    parse: (request) => parseMcpInput({ ...request, body: { walletId: request.query.walletId, input: request.body } } as NextApiRequest, createExpenseSchema),
    execute: (input, identity) => createExpenseCommand(identity.userId, input.walletId, input.input),
    walletId: (input) => input.walletId,
  })
}

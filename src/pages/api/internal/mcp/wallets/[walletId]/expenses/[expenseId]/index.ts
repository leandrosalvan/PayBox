import type { NextApiRequest, NextApiResponse } from 'next'
import { confirmedExpenseActionSchema, updateExpenseSchema } from '@/lib/mcp/mutation-schemas'
import { parseMcpInput } from '@/lib/mcp/http'
import { expenseIdSchema, parseQuery } from '@/lib/mcp/schemas'
import { runMcpMutation } from '@/server/mcp/mutation-route'
import { createMcpReadHandler } from '@/server/mcp/read-route'
import { executeDestructiveActionCommand } from '@/server/paybox/destructive-commands'
import { updateExpenseCommand } from '@/server/paybox/expense-commands'
import { getExpense } from '@/server/paybox/queries'

const readHandler = createMcpReadHandler(({ req, identity }) => {
  const { walletId, expenseId } = parseQuery(expenseIdSchema, req.query)
  return getExpense(identity.userId, walletId, expenseId)
})

function bodyWithIds(req: NextApiRequest) {
  return { ...req, body: { walletId: req.query.walletId, expenseId: req.query.expenseId, ...req.body } } as NextApiRequest
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') return readHandler(req, res)
  if (req.method === 'PATCH') return runMcpMutation(req, res, {
    method: 'PATCH', scope: 'write:expenses', tool: 'paybox_update_expense',
    parse: (request) => parseMcpInput(bodyWithIds(request), updateExpenseSchema),
    execute: (input, identity) => updateExpenseCommand(identity.userId, input),
    walletId: (input) => input.walletId,
  })
  return runMcpMutation(req, res, {
    method: 'DELETE', scope: 'write:expenses', tool: 'paybox_delete_expense',
    parse: (request) => parseMcpInput(bodyWithIds(request), confirmedExpenseActionSchema),
    execute: (input, identity) => executeDestructiveActionCommand({ userId: identity.userId, action: 'delete_expense', target: { walletId: input.walletId, expenseId: input.expenseId }, confirmationId: input.confirmationId }),
    walletId: (input) => input.walletId,
  })
}

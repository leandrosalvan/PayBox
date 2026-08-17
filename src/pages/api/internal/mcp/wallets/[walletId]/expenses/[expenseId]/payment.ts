import type { NextApiRequest, NextApiResponse } from 'next'
import { setExpensePaymentSchema } from '@/lib/mcp/mutation-schemas'
import { parseMcpInput } from '@/lib/mcp/http'
import { runMcpMutation } from '@/server/mcp/mutation-route'
import { setExpensePaymentCommand } from '@/server/paybox/expense-commands'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return runMcpMutation(req, res, {
    method: 'PUT', scope: 'write:expenses', tool: 'paybox_set_expense_payment',
    parse: (request) => parseMcpInput({ ...request, body: { walletId: request.query.walletId, expenseId: request.query.expenseId, ...request.body } } as NextApiRequest, setExpensePaymentSchema),
    execute: (input, identity) => setExpensePaymentCommand(identity.userId, input),
    walletId: (input) => input.walletId,
  })
}

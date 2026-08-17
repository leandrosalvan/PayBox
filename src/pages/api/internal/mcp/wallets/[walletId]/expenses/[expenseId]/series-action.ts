import type { NextApiRequest, NextApiResponse } from 'next'
import { confirmedExpenseActionSchema, convertInstallmentsSchema, duplicateExpenseSchema } from '@/lib/mcp/mutation-schemas'
import { parseMcpInput } from '@/lib/mcp/http'
import { runMcpMutation } from '@/server/mcp/mutation-route'
import { executeDestructiveActionCommand } from '@/server/paybox/destructive-commands'
import { convertExpenseToInstallmentsCommand, duplicateExpenseAsRecurringCommand } from '@/server/paybox/expense-commands'

function bodyWithIds(req: NextApiRequest) {
  return { ...req, body: { walletId: req.query.walletId, expenseId: req.query.expenseId, ...req.body } } as NextApiRequest
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const action = req.body?.action
  if (req.method === 'POST' && action === 'duplicate') {
    return runMcpMutation(req, res, {
      method: 'POST', scope: 'write:expenses', tool: 'paybox_duplicate_expense_as_recurring', statusCode: 201,
      parse: (request) => parseMcpInput(bodyWithIds(request), duplicateExpenseSchema),
      execute: (input, identity) => duplicateExpenseAsRecurringCommand(identity.userId, input),
      walletId: (input) => input.walletId,
    })
  }
  if (req.method === 'POST' && action === 'convertToInstallments') {
    return runMcpMutation(req, res, {
      method: 'POST', scope: 'write:expenses', tool: 'paybox_convert_expense_to_installments',
      parse: (request) => parseMcpInput(bodyWithIds(request), convertInstallmentsSchema),
      execute: (input, identity) => convertExpenseToInstallmentsCommand(identity.userId, input),
      walletId: (input) => input.walletId,
    })
  }

  const destructiveAction = action === 'stop'
    ? 'stop_recurring_expense'
    : action === 'deleteFuture'
      ? 'delete_future_expenses'
      : 'delete_expense_series'
  const tool = destructiveAction === 'stop_recurring_expense'
    ? 'paybox_stop_recurring_expense'
    : destructiveAction === 'delete_future_expenses'
      ? 'paybox_delete_future_expenses'
      : 'paybox_delete_expense_series'
  return runMcpMutation(req, res, {
    method: 'DELETE', scope: 'write:expenses', tool,
    parse: (request) => parseMcpInput(bodyWithIds(request), confirmedExpenseActionSchema),
    execute: (input, identity) => executeDestructiveActionCommand({
      userId: identity.userId,
      action: destructiveAction,
      target: { walletId: input.walletId, expenseId: input.expenseId },
      confirmationId: input.confirmationId,
    }),
    walletId: (input) => input.walletId,
  })
}

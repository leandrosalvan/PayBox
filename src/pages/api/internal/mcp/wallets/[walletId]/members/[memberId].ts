import type { NextApiRequest, NextApiResponse } from 'next'
import { confirmedMemberActionSchema, updateMemberSalarySchema } from '@/lib/mcp/mutation-schemas'
import { parseMcpInput } from '@/lib/mcp/http'
import { runMcpMutation } from '@/server/mcp/mutation-route'
import { executeDestructiveActionCommand } from '@/server/paybox/destructive-commands'
import { updateMemberSalaryCommand } from '@/server/paybox/member-commands'

function bodyWithIds(req: NextApiRequest) {
  return { ...req, body: { walletId: req.query.walletId, memberId: req.query.memberId, ...req.body } } as NextApiRequest
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'PATCH') return runMcpMutation(req, res, {
    method: 'PATCH', scope: 'admin:members', tool: 'paybox_update_member_salary',
    parse: (request) => parseMcpInput(bodyWithIds(request), updateMemberSalarySchema),
    execute: (input, identity) => updateMemberSalaryCommand(identity.userId, input),
    walletId: (input) => input.walletId,
  })
  return runMcpMutation(req, res, {
    method: 'DELETE', scope: 'admin:members', tool: 'paybox_remove_wallet_member',
    parse: (request) => parseMcpInput(bodyWithIds(request), confirmedMemberActionSchema),
    execute: (input, identity) => executeDestructiveActionCommand({ userId: identity.userId, action: 'remove_wallet_member', target: { walletId: input.walletId, memberId: input.memberId }, confirmationId: input.confirmationId }),
    walletId: (input) => input.walletId,
  })
}

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod/v4'
import type { PayboxClient } from '../paybox-client'
import { id } from '../schemas'
import { registerMutationTool } from './register-tool'

const action = z.enum(['delete_expense', 'stop_recurring_expense', 'delete_future_expenses', 'delete_expense_series', 'delete_category', 'remove_wallet_member', 'delete_wallet'])
const target = z.object({ walletId: id, expenseId: id.optional(), categoryId: id.optional(), memberId: id.optional() })

export function registerDestructiveTools(server: McpServer, client: PayboxClient) {
  registerMutationTool({ server, client, name: 'paybox_preview_destructive_action', description: 'Gera prévia humana, contagem e confirmationId de uso único válido por até 5 minutos. Peça confirmação humana antes de executar.', inputSchema: { action, target }, request: (body) => ({ method: 'POST', path: '/api/internal/mcp/confirmations', body }) })

  const expenseDelete = (name: string, description: string, actionName: string, direct = false) => registerMutationTool({
    server, client, name, description, destructive: true,
    inputSchema: { walletId: id, expenseId: id, confirmationId: id },
    request: ({ walletId, expenseId, confirmationId }) => direct
      ? { method: 'DELETE', path: `/api/internal/mcp/wallets/${encodeURIComponent(String(walletId))}/expenses/${encodeURIComponent(String(expenseId))}`, body: { confirmationId } }
      : { method: 'DELETE', path: `/api/internal/mcp/wallets/${encodeURIComponent(String(walletId))}/expenses/${encodeURIComponent(String(expenseId))}/series-action`, body: { action: actionName, confirmationId } },
  })
  expenseDelete('paybox_delete_expense', 'Exclui uma despesa somente com confirmationId compatível e válido.', 'delete', true)
  expenseDelete('paybox_stop_recurring_expense', 'Interrompe ocorrências futuras após prévia e confirmação humana.', 'stop')
  expenseDelete('paybox_delete_future_expenses', 'Exclui esta e as próximas ocorrências após prévia e confirmação humana.', 'deleteFuture')
  expenseDelete('paybox_delete_expense_series', 'Exclui toda a série após prévia e confirmação humana.', 'deleteAll')

  registerMutationTool({ server, client, name: 'paybox_delete_category', description: 'Exclui categoria com confirmação; despesas são preservadas sem categoria.', destructive: true, inputSchema: { walletId: id, categoryId: id, confirmationId: id }, request: ({ walletId, categoryId, confirmationId }) => ({
    method: 'DELETE', path: `/api/internal/mcp/wallets/${encodeURIComponent(String(walletId))}/categories/${encodeURIComponent(String(categoryId))}`, body: { confirmationId },
  }) })
  registerMutationTool({ server, client, name: 'paybox_remove_wallet_member', description: 'Remove membro com confirmação e nunca remove o último proprietário.', destructive: true, inputSchema: { walletId: id, memberId: id, confirmationId: id }, request: ({ walletId, memberId, confirmationId }) => ({
    method: 'DELETE', path: `/api/internal/mcp/wallets/${encodeURIComponent(String(walletId))}/members/${encodeURIComponent(String(memberId))}`, body: { confirmationId },
  }) })
  registerMutationTool({ server, client, name: 'paybox_delete_wallet', description: 'Exclui carteira e todos os dados associados somente após prévia e confirmação humana explícita.', destructive: true, inputSchema: { walletId: id, confirmationId: id }, request: ({ walletId, confirmationId }) => ({
    method: 'DELETE', path: `/api/internal/mcp/wallets/${encodeURIComponent(String(walletId))}`, body: { confirmationId },
  }) })
}

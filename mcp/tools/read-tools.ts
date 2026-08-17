import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod/v4'
import type { PayboxClient } from '../paybox-client'
import { id, month } from '../schemas'
import { toolFailure, toolSuccess } from '../tool-result'

export const READ_TOOL_NAMES = [
  'paybox_list_wallets',
  'paybox_get_wallet',
  'paybox_list_categories',
  'paybox_list_members',
  'paybox_get_month_summary',
  'paybox_list_expenses',
  'paybox_get_expense',
  'paybox_list_recurring_expenses',
  'paybox_list_pending_invites',
] as const

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
}

function register(
  server: McpServer,
  client: PayboxClient,
  name: string,
  description: string,
  inputSchema: Record<string, z.ZodType>,
  call: (args: Record<string, unknown>) => Promise<unknown>
) {
  server.registerTool(
    name,
    { description, inputSchema, outputSchema: { data: z.unknown() }, annotations },
    async (args) => {
      try {
        return toolSuccess(await call(args as Record<string, unknown>))
      } catch (error) {
        return toolFailure(error)
      }
    }
  )
}

export function registerReadTools(server: McpServer, client: PayboxClient) {
  register(server, client, 'paybox_list_wallets', 'Lista somente as carteiras associadas ao usuário MCP.', {}, () =>
    client.request({ method: 'GET', path: '/api/internal/mcp/wallets' })
  )
  register(server, client, 'paybox_get_wallet', 'Consulta os dados seguros de uma carteira associada.', { walletId: id }, ({ walletId }) =>
    client.request({ method: 'GET', path: `/api/internal/mcp/wallets/${encodeURIComponent(String(walletId))}` })
  )
  register(server, client, 'paybox_list_categories', 'Lista as categorias de uma carteira associada.', { walletId: id }, ({ walletId }) =>
    client.request({ method: 'GET', path: `/api/internal/mcp/wallets/${encodeURIComponent(String(walletId))}/categories` })
  )
  register(server, client, 'paybox_list_members', 'Lista membros com e-mails mascarados de uma carteira associada.', { walletId: id }, ({ walletId }) =>
    client.request({ method: 'GET', path: `/api/internal/mcp/wallets/${encodeURIComponent(String(walletId))}/members` })
  )
  register(server, client, 'paybox_get_month_summary', 'Consulta o resumo financeiro puro do mês YYYY-MM, sem gravar no banco.', { walletId: id, month }, ({ walletId, month: selectedMonth }) =>
    client.request({ method: 'GET', path: `/api/internal/mcp/wallets/${encodeURIComponent(String(walletId))}/summary`, query: { month: String(selectedMonth) } })
  )
  register(server, client, 'paybox_list_expenses', 'Lista despesas paginadas de um mês, sem renovar séries nem alterar status.', {
    walletId: id,
    month,
    status: z.enum(['pending', 'paid', 'overdue']).optional(),
    categoryId: id.optional(),
    cursor: id.optional(),
    limit: z.number().int().min(1).max(100).default(50),
  }, ({ walletId, ...query }) =>
    client.request({ method: 'GET', path: `/api/internal/mcp/wallets/${encodeURIComponent(String(walletId))}/expenses`, query: query as Record<string, string | number | undefined> })
  )
  register(server, client, 'paybox_get_expense', 'Consulta uma despesa específica dentro da carteira associada.', { walletId: id, expenseId: id }, ({ walletId, expenseId }) =>
    client.request({ method: 'GET', path: `/api/internal/mcp/wallets/${encodeURIComponent(String(walletId))}/expenses/${encodeURIComponent(String(expenseId))}` })
  )
  register(server, client, 'paybox_list_recurring_expenses', 'Lista séries fixas e parceladas da carteira associada.', { walletId: id }, ({ walletId }) =>
    client.request({ method: 'GET', path: `/api/internal/mcp/wallets/${encodeURIComponent(String(walletId))}/recurring-expenses` })
  )
  register(server, client, 'paybox_list_pending_invites', 'Lista convites pendentes do próprio usuário MCP sem expor tokens.', {}, () =>
    client.request({ method: 'GET', path: '/api/internal/mcp/invites' })
  )
}

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod/v4'
import type { PayboxClient } from '../paybox-client'
import { civilDate, id, month } from '../schemas'
import { registerMutationTool } from './register-tool'

const instant = z.string().datetime({ offset: true })
const expenseInput = z.object({
  description: z.string().min(1).max(200),
  amountInCents: z.number().int().positive(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  dueDate: civilDate,
  categoryId: id.nullable().optional(),
  type: z.enum(['single', 'fixed', 'installment']).default('single'),
  totalInstallments: z.number().int().min(2).max(120).optional(),
  paidById: id.nullable().optional(),
})

export function registerExpenseTools(server: McpServer, client: PayboxClient) {
  registerMutationTool({ server, client, name: 'paybox_create_expense', description: 'Cria despesa avulsa, fixa ou parcelada de forma transacional. Valores são centavos e a moeda deve ser a da carteira.', inputSchema: { walletId: id, input: expenseInput }, request: ({ walletId, input }) => ({
    method: 'POST', path: `/api/internal/mcp/wallets/${encodeURIComponent(String(walletId))}/expenses`, body: input,
  }) })

  registerMutationTool({ server, client, name: 'paybox_update_expense', description: 'Edita somente uma despesa com expectedUpdatedAt; não remove pagamento implicitamente.', inputSchema: {
    walletId: id, expenseId: id,
    changes: z.object({ description: z.string().min(1).max(200).optional(), amountInCents: z.number().int().positive().optional(), dueDate: civilDate.optional(), categoryId: id.nullable().optional(), paidById: id.nullable().optional() }),
    expectedUpdatedAt: instant,
  }, request: ({ walletId, expenseId, ...body }) => ({ method: 'PATCH', path: `/api/internal/mcp/wallets/${encodeURIComponent(String(walletId))}/expenses/${encodeURIComponent(String(expenseId))}`, body }) })

  registerMutationTool({ server, client, name: 'paybox_set_expense_payment', description: 'Define explicitamente paid ou pending. Repetir paid não alterna nem desfaz o pagamento.', inputSchema: {
    walletId: id, expenseId: id, status: z.enum(['paid', 'pending']), paidById: id.optional(), paidAt: instant.optional(), expectedUpdatedAt: instant,
  }, request: ({ walletId, expenseId, ...body }) => ({ method: 'PUT', path: `/api/internal/mcp/wallets/${encodeURIComponent(String(walletId))}/expenses/${encodeURIComponent(String(expenseId))}/payment`, body }) })

  registerMutationTool({ server, client, name: 'paybox_duplicate_expense_as_recurring', description: 'Duplica uma despesa como série fixa de 12 meses a partir de YYYY-MM.', inputSchema: { walletId: id, expenseId: id, startMonth: month }, request: ({ walletId, expenseId, ...body }) => ({
    method: 'POST', path: `/api/internal/mcp/wallets/${encodeURIComponent(String(walletId))}/expenses/${encodeURIComponent(String(expenseId))}/series-action`, body: { action: 'duplicate', ...body },
  }) })

  registerMutationTool({ server, client, name: 'paybox_convert_expense_to_installments', description: 'Converte a série da despesa em parcelas dentro da faixa permitida.', inputSchema: { walletId: id, expenseId: id, installments: z.number().int().min(2).max(120) }, request: ({ walletId, expenseId, ...body }) => ({
    method: 'POST', path: `/api/internal/mcp/wallets/${encodeURIComponent(String(walletId))}/expenses/${encodeURIComponent(String(expenseId))}/series-action`, body: { action: 'convertToInstallments', ...body },
  }) })
}

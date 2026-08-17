import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod/v4'
import type { PayboxClient } from '../paybox-client'
import { id } from '../schemas'
import { registerMutationTool } from './register-tool'

const isoInstant = z.string().datetime({ offset: true })

export function registerWalletTools(server: McpServer, client: PayboxClient) {
  registerMutationTool({ server, client, name: 'paybox_create_wallet', description: 'Cria uma carteira com o usuário MCP como proprietário e categorias padrão. Exige escrita habilitada.', inputSchema: {
    name: z.string().trim().min(1).max(100), locale: z.string().default('pt-BR'), currency: z.string().regex(/^[A-Z]{3}$/).default('BRL'), salaryMode: z.enum(['joint', 'individual']).default('joint'),
  }, request: (args) => ({ method: 'POST', path: '/api/internal/mcp/wallets', body: args }) })

  registerMutationTool({ server, client, name: 'paybox_update_wallet', description: 'Edita uma carteira do proprietário com controle de concorrência expectedUpdatedAt.', inputSchema: {
    walletId: id,
    changes: z.object({ name: z.string().min(1).max(100).optional(), locale: z.string().optional(), currency: z.string().regex(/^[A-Z]{3}$/).optional(), salaryMode: z.enum(['joint', 'individual']).optional() }),
    expectedUpdatedAt: isoInstant,
  }, request: ({ walletId, ...body }) => ({ method: 'PATCH', path: `/api/internal/mcp/wallets/${encodeURIComponent(String(walletId))}`, body }) })
}

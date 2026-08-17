import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod/v4'
import type { PayboxClient } from '../paybox-client'
import { id } from '../schemas'
import { registerMutationTool } from './register-tool'

export function registerCategoryTools(server: McpServer, client: PayboxClient) {
  registerMutationTool({ server, client, name: 'paybox_create_category', description: 'Cria uma categoria na carteira associada. Exige write:categories.', inputSchema: {
    walletId: id, name: z.string().min(1).max(80), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#10b981'), icon: z.string().min(1).max(50).default('tag'),
  }, request: ({ walletId, ...body }) => ({ method: 'POST', path: `/api/internal/mcp/wallets/${encodeURIComponent(String(walletId))}/categories`, body }) })

  registerMutationTool({ server, client, name: 'paybox_update_category', description: 'Edita uma categoria existente dentro da mesma carteira.', inputSchema: {
    walletId: id, categoryId: id, changes: z.object({ name: z.string().min(1).max(80).optional(), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(), icon: z.string().min(1).max(50).optional() }),
  }, request: ({ walletId, categoryId, ...body }) => ({ method: 'PATCH', path: `/api/internal/mcp/wallets/${encodeURIComponent(String(walletId))}/categories/${encodeURIComponent(String(categoryId))}`, body }) })
}

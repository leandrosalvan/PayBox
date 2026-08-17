import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod/v4'
import type { PayboxClient } from '../paybox-client'
import { id } from '../schemas'
import { registerMutationTool } from './register-tool'

export function registerInviteTools(server: McpServer, client: PayboxClient) {
  registerMutationTool({ server, client, name: 'paybox_create_wallet_invite', description: 'Cria convite sem expor token. O envio de e-mail só ocorre quando sendEmail=true.', inputSchema: {
    walletId: id, email: z.string().email(), sendEmail: z.boolean(),
  }, request: ({ walletId, ...body }) => ({ method: 'POST', path: `/api/internal/mcp/wallets/${encodeURIComponent(String(walletId))}/invites`, body }) })

  registerMutationTool({ server, client, name: 'paybox_accept_invite', description: 'Aceita pelo ID interno um convite pendente destinado ao próprio usuário MCP.', inputSchema: { inviteId: id }, request: ({ inviteId }) => ({
    method: 'POST', path: `/api/internal/mcp/invites/${encodeURIComponent(String(inviteId))}/accept`, body: {},
  }) })
}

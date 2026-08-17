import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod/v4'
import type { PayboxClient } from '../paybox-client'
import { id } from '../schemas'
import { registerMutationTool } from './register-tool'

export function registerMemberTools(server: McpServer, client: PayboxClient) {
  registerMutationTool({ server, client, name: 'paybox_update_member_salary', description: 'Atualiza o salário em centavos de um membro. Exige proprietário e admin:members.', inputSchema: {
    walletId: id, memberId: id, salaryInCents: z.number().int().min(0),
  }, request: ({ walletId, memberId, ...body }) => ({ method: 'PATCH', path: `/api/internal/mcp/wallets/${encodeURIComponent(String(walletId))}/members/${encodeURIComponent(String(memberId))}`, body }) })
}

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { PayboxClient } from '../paybox-client'
import { registerCategoryTools } from './category-tools'
import { registerDestructiveTools } from './destructive-tools'
import { registerExpenseTools } from './expense-tools'
import { registerInviteTools } from './invite-tools'
import { registerMemberTools } from './member-tools'
import { registerReadTools, READ_TOOL_NAMES } from './read-tools'
import { registerWalletTools } from './wallet-tools'

export const MUTATION_TOOL_NAMES = [
  'paybox_create_wallet', 'paybox_update_wallet', 'paybox_create_category', 'paybox_update_category',
  'paybox_create_expense', 'paybox_update_expense', 'paybox_set_expense_payment', 'paybox_update_member_salary',
  'paybox_create_wallet_invite', 'paybox_accept_invite', 'paybox_duplicate_expense_as_recurring',
  'paybox_convert_expense_to_installments', 'paybox_preview_destructive_action', 'paybox_delete_expense',
  'paybox_stop_recurring_expense', 'paybox_delete_future_expenses', 'paybox_delete_expense_series',
  'paybox_delete_category', 'paybox_remove_wallet_member', 'paybox_delete_wallet',
] as const

export const ALL_TOOL_NAMES = [...READ_TOOL_NAMES, ...MUTATION_TOOL_NAMES] as const

export function registerAllTools(server: McpServer, client: PayboxClient) {
  registerReadTools(server, client)
  registerWalletTools(server, client)
  registerCategoryTools(server, client)
  registerExpenseTools(server, client)
  registerMemberTools(server, client)
  registerInviteTools(server, client)
  registerDestructiveTools(server, client)
}

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod/v4'
import type { PayboxClient, PayboxRequest } from '../paybox-client'
import { toolFailure, toolSuccess } from '../tool-result'

export function registerMutationTool(options: {
  server: McpServer
  client: PayboxClient
  name: string
  description: string
  inputSchema: Record<string, z.ZodType>
  destructive?: boolean
  request: (args: Record<string, unknown>) => PayboxRequest
}) {
  options.server.registerTool(
    options.name,
    {
      description: options.description,
      inputSchema: options.inputSchema,
      outputSchema: { data: z.unknown() },
      annotations: {
        readOnlyHint: false,
        destructiveHint: Boolean(options.destructive),
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (args) => {
      try {
        return toolSuccess(await options.client.request(options.request(args as Record<string, unknown>)))
      } catch (error) {
        return toolFailure(error)
      }
    }
  )
}

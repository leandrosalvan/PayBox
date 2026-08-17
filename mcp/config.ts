import { z } from 'zod'

const configSchema = z.object({
  baseUrl: z.string().url().transform((value) => value.replace(/\/$/, '')),
  token: z.string().min(1),
})

export type PayboxMcpConfig = z.infer<typeof configSchema>

export function loadMcpConfig(env: NodeJS.ProcessEnv = process.env): PayboxMcpConfig {
  const parsed = configSchema.safeParse({
    baseUrl: env.PAYBOX_BASE_URL || 'http://localhost:3000',
    token: env.PAYBOX_MCP_TOKEN,
  })
  if (!parsed.success) {
    throw new Error('Configuração MCP local incompleta: defina PAYBOX_BASE_URL e PAYBOX_MCP_TOKEN')
  }
  return parsed.data
}

export function checkMcpConfig(env: NodeJS.ProcessEnv = process.env) {
  const baseUrl = z.string().url().safeParse(env.PAYBOX_BASE_URL || 'http://localhost:3000')
  if (!baseUrl.success) throw new Error('PAYBOX_BASE_URL inválida')
  return { baseUrl: baseUrl.data, hasToken: Boolean(env.PAYBOX_MCP_TOKEN) }
}

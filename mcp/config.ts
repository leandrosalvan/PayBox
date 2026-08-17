import { z } from 'zod'

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1'])
const baseUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value)
    return url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK_HOSTNAMES.has(url.hostname))
  }, 'PAYBOX_BASE_URL deve usar HTTPS fora da máquina local')
  .transform((value) => value.replace(/\/$/, ''))

const configSchema = z.object({
  baseUrl: baseUrlSchema,
  token: z.string().min(32),
})

export type PayboxMcpConfig = z.infer<typeof configSchema>
type McpEnvironment = { PAYBOX_BASE_URL?: string; PAYBOX_MCP_TOKEN?: string }

export function loadMcpConfig(env: McpEnvironment = process.env as McpEnvironment): PayboxMcpConfig {
  const parsed = configSchema.safeParse({
    baseUrl: env.PAYBOX_BASE_URL || 'http://localhost:3000',
    token: env.PAYBOX_MCP_TOKEN,
  })
  if (!parsed.success) {
    throw new Error('Configuração MCP local incompleta: defina PAYBOX_BASE_URL e PAYBOX_MCP_TOKEN')
  }
  return parsed.data
}

export function checkMcpConfig(env: McpEnvironment = process.env as McpEnvironment) {
  const baseUrl = baseUrlSchema.safeParse(env.PAYBOX_BASE_URL || 'http://localhost:3000')
  if (!baseUrl.success) throw new Error('PAYBOX_BASE_URL inválida')
  const token = z.string().min(32).safeParse(env.PAYBOX_MCP_TOKEN)
  return { baseUrl: baseUrl.data, hasToken: token.success }
}

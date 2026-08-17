import { checkMcpConfig } from './config'
import { logger } from './logger'
import { ALL_TOOL_NAMES } from './tools'

function main() {
  const config = checkMcpConfig()
  if (new Set(ALL_TOOL_NAMES).size !== 29) throw new Error('Catálogo MCP incompleto')
  logger.info(`check concluído: ${ALL_TOOL_NAMES.length} ferramentas; base ${config.baseUrl}; token ${config.hasToken ? 'configurado' : 'pendente'}`)
}

try {
  main()
} catch (error) {
  logger.error(error instanceof Error ? error.message : 'check falhou')
  process.exitCode = 1
}

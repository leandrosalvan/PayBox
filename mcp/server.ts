import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { loadMcpConfig, type PayboxMcpConfig } from './config'
import { logger } from './logger'
import { PayboxClient } from './paybox-client'
import { registerAllTools } from './tools'

export function createPayboxMcpServer(config: PayboxMcpConfig = loadMcpConfig()) {
  const server = new McpServer({ name: 'paybox', version: '1.0.0' })
  registerAllTools(server, new PayboxClient(config))
  return server
}

async function main() {
  const server = createPayboxMcpServer()
  await server.connect(new StdioServerTransport())
  logger.info('servidor iniciado em stdio')
}

if (require.main === module) {
  main().catch((error) => {
    logger.error(error instanceof Error ? error.message : 'falha desconhecida')
    process.exitCode = 1
  })
}

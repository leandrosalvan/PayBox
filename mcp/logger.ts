export const logger = {
  info(message: string) {
    console.error(`[paybox-mcp] ${message}`)
  },
  error(message: string) {
    console.error(`[paybox-mcp] erro: ${message}`)
  },
}

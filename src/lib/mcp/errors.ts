export type McpErrorCode =
  | 'AUTH_CONFIGURATION_ERROR'
  | 'AUTHENTICATION_REQUIRED'
  | 'INVALID_TOKEN'
  | 'USER_NOT_FOUND'
  | 'INSUFFICIENT_SCOPE'
  | 'MCP_WRITE_DISABLED'
  | 'METHOD_NOT_ALLOWED'
  | 'VALIDATION_ERROR'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'

export class McpHttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: McpErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'McpHttpError'
  }
}

export function toMcpHttpError(error: unknown): McpHttpError {
  if (error instanceof McpHttpError) return error
  return new McpHttpError(500, 'INTERNAL_ERROR', 'Erro interno')
}

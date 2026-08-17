export class PayboxClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly requestId?: string,
    public readonly retryable = false
  ) {
    super(message)
    this.name = 'PayboxClientError'
  }
}

export function conciseClientError(error: unknown) {
  if (error instanceof PayboxClientError) {
    const reference = error.requestId ? ` (requestId: ${error.requestId})` : ''
    return `${error.message}${reference}`
  }
  return 'Falha ao consultar o PayBox'
}

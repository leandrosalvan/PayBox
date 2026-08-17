import { randomUUID } from 'node:crypto'
import type { PayboxMcpConfig } from './config'
import { PayboxClientError } from './errors'
import { apiErrorSchema, apiSuccessSchema } from './schemas'

const HTTP_TIMEOUT_MS = 15_000
const RETRYABLE_READ_STATUSES = new Set([429, 502, 503])

export type PayboxRequest = {
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  path: string
  query?: Record<string, string | number | undefined>
  body?: unknown
  idempotencyKey?: string
}

export class PayboxClient {
  constructor(private readonly config: PayboxMcpConfig) {}

  async request<T = unknown>(request: PayboxRequest): Promise<T> {
    const idempotencyKey =
      request.method === 'GET' ? undefined : request.idempotencyKey || `idem_${randomUUID()}`
    const attempts = request.method === 'GET' || idempotencyKey ? 2 : 1

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const result = await this.requestOnce<T>({ ...request, idempotencyKey })
      if (!(result instanceof PayboxClientError)) return result

      const retryRead = request.method === 'GET' && result.status && RETRYABLE_READ_STATUSES.has(result.status)
      const retryMutation = request.method !== 'GET' && idempotencyKey && result.retryable
      if (attempt + 1 >= attempts || (!retryRead && !retryMutation)) throw result
    }
    throw new PayboxClientError('Falha ao consultar o PayBox')
  }

  private async requestOnce<T>(request: PayboxRequest): Promise<T | PayboxClientError> {
    const url = new URL(`${this.config.baseUrl}${request.path}`)
    for (const [key, value] of Object.entries(request.query || {})) {
      if (value !== undefined) url.searchParams.set(key, String(value))
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS)
    try {
      const response = await fetch(url, {
        method: request.method,
        redirect: 'error',
        signal: controller.signal,
        headers: {
          authorization: `Bearer ${this.config.token}`,
          accept: 'application/json',
          ...(request.body === undefined ? {} : { 'content-type': 'application/json' }),
          ...(request.idempotencyKey ? { 'idempotency-key': request.idempotencyKey } : {}),
        },
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
      })

      const raw = await response.text()
      let json: unknown
      try {
        json = raw ? JSON.parse(raw) : {}
      } catch {
        return new PayboxClientError('Resposta inválida do PayBox', response.status)
      }

      if (!response.ok) {
        const parsedError = apiErrorSchema.safeParse(json)
        const requestId = parsedError.success ? parsedError.data.error.requestId : undefined
        const message = parsedError.success ? parsedError.data.error.message : 'Erro retornado pelo PayBox'
        const code = parsedError.success ? parsedError.data.error.code : undefined
        return new PayboxClientError(
          message,
          response.status,
          code,
          requestId,
          response.headers.get('retry-after') !== null || response.status >= 500
        )
      }

      const parsed = apiSuccessSchema.safeParse(json)
      if (!parsed.success) return new PayboxClientError('Resposta inválida do PayBox', response.status)
      return parsed.data.data as T
    } catch (error) {
      if (error instanceof PayboxClientError) return error
      return new PayboxClientError(
        error instanceof Error && error.name === 'AbortError'
          ? 'Tempo limite ao consultar o PayBox'
          : 'PayBox indisponível',
        undefined,
        undefined,
        undefined,
        true
      )
    } finally {
      clearTimeout(timeout)
    }
  }
}

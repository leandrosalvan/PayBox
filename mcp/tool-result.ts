import { conciseClientError } from './errors'

export function toolSuccess(data: unknown) {
  const structuredContent = { data }
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(structuredContent) }],
    structuredContent,
  }
}

export function toolFailure(error: unknown) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: conciseClientError(error) }],
  }
}

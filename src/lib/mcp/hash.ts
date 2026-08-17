import { createHash } from 'node:crypto'

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, stableValue(child)])
    )
  }
  return value
}

export function stableJson(value: unknown) {
  return JSON.stringify(stableValue(value))
}

export function hashMcpInput(value: unknown) {
  return createHash('sha256').update(stableJson(value), 'utf8').digest('hex')
}

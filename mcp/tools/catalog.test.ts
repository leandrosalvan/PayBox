import { describe, expect, it } from 'vitest'
import { ALL_TOOL_NAMES } from './index'

describe('catálogo MCP', () => {
  it('contém as 29 ferramentas sem duplicação', () => {
    expect(ALL_TOOL_NAMES).toHaveLength(29)
    expect(new Set(ALL_TOOL_NAMES).size).toBe(29)
  })
})

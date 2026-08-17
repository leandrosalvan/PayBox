import { describe, expect, it, vi } from 'vitest'
import { logger } from './logger'

describe('logger MCP', () => {
  it('nunca escreve diagnósticos no stdout', () => {
    const stdout = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    logger.info('teste')
    expect(stdout).not.toHaveBeenCalled()
    expect(stderr).toHaveBeenCalled()
  })
})

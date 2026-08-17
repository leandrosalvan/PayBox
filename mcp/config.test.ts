import { describe, expect, it } from 'vitest'
import { checkMcpConfig, loadMcpConfig } from './config'

const TEST_TOKEN = 'token-seguro-de-teste-com-32-bytes'

describe('configuração do cliente MCP', () => {
  it('aceita HTTP somente em loopback', () => {
    expect(
      loadMcpConfig({ PAYBOX_BASE_URL: 'http://localhost:3000/', PAYBOX_MCP_TOKEN: TEST_TOKEN })
    ).toEqual({ baseUrl: 'http://localhost:3000', token: TEST_TOKEN })
  })

  it('recusa HTTP remoto', () => {
    expect(() =>
      loadMcpConfig({ PAYBOX_BASE_URL: 'http://paybox.example.com', PAYBOX_MCP_TOKEN: TEST_TOKEN })
    ).toThrow('Configuração MCP local incompleta')
  })

  it('recusa token com menos de 32 caracteres', () => {
    expect(() =>
      loadMcpConfig({ PAYBOX_BASE_URL: 'https://paybox.example.com', PAYBOX_MCP_TOKEN: 'curto' })
    ).toThrow('Configuração MCP local incompleta')
    expect(
      checkMcpConfig({ PAYBOX_BASE_URL: 'https://paybox.example.com', PAYBOX_MCP_TOKEN: 'curto' })
    ).toEqual({ baseUrl: 'https://paybox.example.com', hasToken: false })
  })
})

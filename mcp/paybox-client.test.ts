import { afterEach, describe, expect, it, vi } from 'vitest'
import { PayboxClient } from './paybox-client'

function response(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

describe('cliente HTTP PayBox', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('usa endpoint, método e token corretos', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(200, {
      data: [{ id: 'wallet-1' }], requestId: 'req-1', serverTime: '2026-08-17T03:00:00.000Z',
    }))
    vi.stubGlobal('fetch', fetchMock)
    const client = new PayboxClient({ baseUrl: 'https://paybox.example', token: 'segredo' })
    await client.request({ method: 'GET', path: '/api/internal/mcp/wallets' })
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://paybox.example/api/internal/mcp/wallets'),
      expect.objectContaining({
        method: 'GET',
        redirect: 'error',
        headers: expect.objectContaining({ authorization: 'Bearer segredo' }),
      })
    )
  })

  it('repete uma consulta no máximo uma vez em 503', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(503, { error: { code: 'UNAVAILABLE', message: 'Indisponível', requestId: 'req-1' } }))
      .mockResolvedValueOnce(response(200, { data: [], requestId: 'req-2', serverTime: '2026-08-17T03:00:00.000Z' }))
    vi.stubGlobal('fetch', fetchMock)
    const client = new PayboxClient({ baseUrl: 'https://paybox.example', token: 'segredo' })
    await expect(client.request({ method: 'GET', path: '/api/internal/mcp/wallets' })).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('não repete conflito', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response(409, {
      error: { code: 'CONFLICT', message: 'Conflito', requestId: 'req-1' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    const client = new PayboxClient({ baseUrl: 'https://paybox.example', token: 'segredo' })
    await expect(client.request({ method: 'GET', path: '/api/internal/mcp/wallets' })).rejects.toMatchObject({ status: 409 })
    expect(fetchMock).toHaveBeenCalledOnce()
  })
})

import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { NextApiRequest, NextApiResponse } from 'next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

vi.mock('@/lib/mcp/auth', () => ({
  authenticateMcpRequest: vi.fn().mockResolvedValue({
    userId: 'user-1',
    email: 'mcp@example.com',
    scopes: new Set(['read']),
    credentialId: 'credential-1',
  }),
}))

import handler from '@/pages/api/mcp'

let httpServer: Server | undefined

function decorateResponse(res: NextApiResponse) {
  res.status = ((statusCode: number) => {
    res.statusCode = statusCode
    return res
  }) as NextApiResponse['status']
  res.json = ((body: unknown) => {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(body))
    return res
  }) as NextApiResponse['json']
}

async function startTestServer() {
  httpServer = createServer(async (incoming, outgoing) => {
    const chunks: Buffer[] = []
    for await (const chunk of incoming) chunks.push(Buffer.from(chunk))
    const rawBody = Buffer.concat(chunks).toString('utf8')
    const req = incoming as NextApiRequest
    const res = outgoing as NextApiResponse
    req.body = rawBody ? JSON.parse(rawBody) : undefined
    req.query = {}
    decorateResponse(res)
    await handler(req, res)
  })
  await new Promise<void>((resolve) => httpServer!.listen(0, '127.0.0.1', resolve))
  const address = httpServer.address() as AddressInfo
  return `http://127.0.0.1:${address.port}`
}

describe('endpoint MCP remoto', () => {
  beforeEach(() => {
    vi.stubEnv('NEXTAUTH_URL', 'http://localhost:3000')
  })

  afterEach(async () => {
    vi.unstubAllEnvs()
    if (httpServer) await new Promise<void>((resolve, reject) => httpServer!.close((error) => error ? reject(error) : resolve()))
    httpServer = undefined
  })

  it('aceita um cliente Streamable HTTP e publica o catálogo completo', async () => {
    const baseUrl = await startTestServer()
    vi.stubEnv('NEXTAUTH_URL', baseUrl)
    const client = new Client({ name: 'paybox-test', version: '1.0.0' })
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/api/mcp`), {
      requestInit: { headers: { authorization: 'Bearer pbx_mcp_teste' } },
    })

    await client.connect(transport)
    const tools = await client.listTools()

    expect(tools.tools).toHaveLength(29)
    expect(tools.tools.map((tool) => tool.name)).toContain('paybox_list_wallets')
    await client.close()
  })
})

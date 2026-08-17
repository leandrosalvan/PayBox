import type { NextApiRequest, NextApiResponse } from 'next'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createPayboxMcpServer } from '../../../mcp/server'
import { authenticateMcpRequest } from '@/lib/mcp/auth'

export const config = {
  api: {
    bodyParser: { sizeLimit: '256kb' },
    externalResolver: true,
  },
}

function bearerToken(req: NextApiRequest) {
  const authorization = req.headers.authorization || ''
  return authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : ''
}

function publicBaseUrl() {
  const value = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  const url = new URL(value)
  const loopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    throw new Error('NEXTAUTH_URL precisa usar HTTPS para publicar o MCP')
  }
  return value.replace(/\/$/, '')
}

function methodNotAllowed(res: NextApiResponse) {
  res.setHeader('Allow', ['POST'])
  return res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed.' },
    id: null,
  })
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return methodNotAllowed(res)

  try {
    await authenticateMcpRequest(req, 'read')
    const token = bearerToken(req)
    const server = createPayboxMcpServer({ baseUrl: publicBaseUrl(), token })
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })
    try {
      await server.connect(transport)
      await transport.handleRequest(req, res, req.body)
    } finally {
      await transport.close()
      await server.close()
    }
  } catch (error) {
    if (res.headersSent) return
    const statusCode = typeof error === 'object' && error && 'statusCode' in error
      ? Number(error.statusCode)
      : 500
    return res.status(Number.isInteger(statusCode) ? statusCode : 500).json({
      jsonrpc: '2.0',
      error: {
        code: statusCode === 401 ? -32001 : -32603,
        message: statusCode === 401 ? 'Unauthorized' : 'Internal server error',
      },
      id: null,
    })
  }
}

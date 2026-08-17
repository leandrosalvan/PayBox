import type { NextApiRequest, NextApiResponse } from 'next'

export type MockApiResponse = NextApiResponse & {
  statusCode: number
  payload: unknown
  ended: boolean
}

export function createMockRequest(
  overrides: Partial<NextApiRequest> = {}
): NextApiRequest {
  return {
    method: 'GET',
    headers: {},
    query: {},
    body: undefined,
    ...overrides,
  } as NextApiRequest
}

export function createMockResponse(): MockApiResponse {
  const response = {
    statusCode: 200,
    payload: undefined,
    ended: false,
  } as MockApiResponse

  response.status = ((statusCode: number) => {
    response.statusCode = statusCode
    return response
  }) as MockApiResponse['status']
  response.json = ((payload: unknown) => {
    response.payload = payload
    response.ended = true
    return response
  }) as MockApiResponse['json']
  response.end = (() => {
    response.ended = true
    return response
  }) as MockApiResponse['end']
  response.setHeader = (() => response) as MockApiResponse['setHeader']

  return response
}

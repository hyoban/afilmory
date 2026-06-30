import process from 'node:process'

import type { NextRequest } from 'next/server'

type RouteContext = {
  params: Promise<{ all: string[] }>
}

const handler = (request: NextRequest, _context: RouteContext) => {
  if (process.env.NODE_ENV === 'development') {
    return import('./dev').then(m => m.handler(request))
  }

  return import('./prod').then(m => m.handler(request))
}

export const GET = handler
export const HEAD = handler
export const OPTIONS = handler
export const POST = handler
export const PUT = handler
export const PATCH = handler
export const DELETE = handler

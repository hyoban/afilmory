import process from 'node:process'

import type { NextRequest } from 'next/server'

const handler = (request: NextRequest) => {
  if (process.env.NODE_ENV === 'development') {
    return import('./[...all]/dev').then(m => m.handler(request))
  }

  return import('./[...all]/prod').then(m => m.handler(request))
}

export const GET = handler

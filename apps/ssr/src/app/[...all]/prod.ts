import { DOMParser } from 'linkedom'
import type { NextRequest } from 'next/server'

import { injectConfigToDocument } from '~/lib/injectable'
import { serveLocalPhotoAsset } from '~/lib/local-photo-assets'
import { getLocalPhotoRuntimeConfigFromEnv } from '~/lib/local-photo-runtime'

const renderIndex = async () => {
  const indexHtml = await import('../../index.html').then(m => m.default)
  const document = new DOMParser().parseFromString(indexHtml, 'text/html')
  injectConfigToDocument(document)
  return new Response(document.documentElement.outerHTML, {
    headers: {
      'Content-Type': 'text/html',
      'X-SSR': '1',
    },
  })
}

export const handler = async (req: NextRequest) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response(null, { status: 404 })
  }

  const runtimeConfig = getLocalPhotoRuntimeConfigFromEnv()
  if (runtimeConfig && req.nextUrl.pathname.startsWith('/photos/')) {
    return serveLocalPhotoAsset(req, runtimeConfig.localBasePath)
  }

  const acceptsHtml = req.headers.get('accept')?.includes('text/html')
  if (!acceptsHtml) {
    return new Response(null, { status: 404 })
  }

  return renderIndex()
}

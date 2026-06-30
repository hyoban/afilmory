import { extname } from 'node:path'

import siteConfig from '@config'
import { DOMParser } from 'linkedom'
import type { NextRequest } from 'next/server'

import indexHtml from '~/index.html'
import { injectConfigToDocument } from '~/lib/injectable'
import { serveLocalPhotoAsset } from '~/lib/local-photo-assets'
import { getLocalPhotoRuntimeConfigFromEnv } from '~/lib/local-photo-runtime'
import { photoLoader } from '~/lib/photo-loader'
import { createAndInsertPhotoOpenGraphMeta } from '~/lib/photo-open-graph-meta'

export const handler = async (request: NextRequest, { params }: { params: Promise<{ photoId: string }> }) => {
  const runtimeConfig = getLocalPhotoRuntimeConfigFromEnv()
  const acceptsHtml = request.headers.get('accept')?.includes('text/html')
  if (runtimeConfig && (!acceptsHtml || extname(request.nextUrl.pathname))) {
    return serveLocalPhotoAsset(request, runtimeConfig.localBasePath)
  }

  const { photoId } = await params

  const photo = photoLoader.getPhoto(photoId)
  if (!photo) {
    return new Response(indexHtml, {
      headers: { 'Content-Type': 'text/html' },
      status: 404,
    })
  }

  try {
    const document = new DOMParser().parseFromString(indexHtml, 'text/html')

    // Remove all twitter meta tags and open graph meta tags
    document.head.childNodes.forEach((node) => {
      if (node.nodeName === 'META') {
        const $meta = node as HTMLMetaElement
        if ($meta.getAttribute('name')?.startsWith('twitter:')) {
          $meta.remove()
        }
        if ($meta.getAttribute('property')?.startsWith('og:')) {
          $meta.remove()
        }
      }
    })
    document.head.title = `${photo.id} | ${siteConfig.title}`
    // Insert meta open graph tags and twitter meta tags
    createAndInsertPhotoOpenGraphMeta(document, photo, request, siteConfig.title)

    await injectConfigToDocument(document)

    return new Response(document.documentElement.outerHTML, {
      headers: {
        'Content-Type': 'text/html',
        'X-SSR': '1',
      },
    })
  }
  catch (error) {
    console.error('Error generating SSR page:', error)
    console.warn('Falling back to static index.html')
    console.warn(error instanceof Error ? error.message : error)

    return new Response(indexHtml, {
      headers: { 'Content-Type': 'text/html' },
      status: 500,
    })
  }
}

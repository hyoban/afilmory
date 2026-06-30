import type { PhotoManifestItem } from '@afilmory/builder'
import type { DOMParser } from 'linkedom'
import type { NextRequest } from 'next/server'

type LinkedomDocument = Extract<ReturnType<typeof DOMParser.prototype.parseFromString>, { head: unknown }>

export function createAndInsertPhotoOpenGraphMeta(
  document: LinkedomDocument,
  photo: PhotoManifestItem,
  request: NextRequest,
  siteTitle: string,
) {
  const realOrigin = getRequestOrigin(request)
  const encodedPhotoId = encodeURIComponent(photo.id)
  const photoTitle = `${photo.id} on ${siteTitle}`
  const photoDescription = photo.description || ''
  const photoOgImageUrl = `${realOrigin}/og/${encodedPhotoId}`
  const photoPageUrl = `${realOrigin}/photos/${encodedPhotoId}`

  const ogTags = {
    'og:type': 'website',
    'og:title': photoTitle,
    'og:description': photoDescription,
    'og:image': photoOgImageUrl,
    'og:url': photoPageUrl,
  }

  for (const [property, content] of Object.entries(ogTags)) {
    const ogMeta = document.createElement('meta', {})
    ogMeta.setAttribute('property', property)
    ogMeta.setAttribute('content', content)
    document.head.append(ogMeta as unknown as Node)
  }

  const twitterTags = {
    'twitter:card': 'summary_large_image',
    'twitter:title': photoTitle,
    'twitter:description': photoDescription,
    'twitter:image': photoOgImageUrl,
    'twitter:url': photoPageUrl,
  }

  for (const [name, content] of Object.entries(twitterTags)) {
    const twitterMeta = document.createElement('meta', {})
    twitterMeta.setAttribute('name', name)
    twitterMeta.setAttribute('content', content)
    document.head.append(twitterMeta as unknown as Node)
  }

  return document
}

function getRequestOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get('x-forwarded-host')
  if (forwardedHost) {
    return `${request.headers.get('x-forwarded-proto') || 'https'}://${forwardedHost}`
  }

  return request.nextUrl.origin
}

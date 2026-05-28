interface PhotoOgEntry {
  title: string
  description: string
  image: string
  url: string
}

interface PhotoOgPayload {
  photos?: Record<string, PhotoOgEntry>
}

interface PagesContext {
  request: Request
  next: () => Promise<Response>
}

const photoOgPayloadByOrigin = new Map<string, Promise<PhotoOgPayload | null>>()

export async function onRequest(context: PagesContext) {
  if (context.request.method !== 'GET') {
    return context.next()
  }

  const requestUrl = new URL(context.request.url)
  const photoId = getPhotoIdFromPathname(requestUrl.pathname)
  if (!photoId) {
    return context.next()
  }

  const response = await context.next()
  if (!isHtmlResponse(response)) {
    return response
  }

  const payload = await getPhotoOgPayload(requestUrl.origin)
  const photo = payload?.photos?.[photoId]
  if (!photo) {
    return response
  }

  const pageUrl = toAbsoluteUrl(photo.url, requestUrl.origin)
  const imageUrl = toAbsoluteUrl(photo.image, requestUrl.origin)
  const description = photo.description || ''

  return new HTMLRewriter()
    .on('title', new TextContentHandler(photo.title))
    .on('meta[property="og:type"]', new MetaContentHandler('website'))
    .on('meta[property="og:title"]', new MetaContentHandler(photo.title))
    .on('meta[property="og:description"]', new MetaContentHandler(description))
    .on('meta[property="og:url"]', new MetaContentHandler(pageUrl))
    .on('meta[property="og:image"]', new MetaContentHandler(imageUrl))
    .on('meta[property="twitter:card"]', new MetaContentHandler('summary_large_image'))
    .on('meta[property="twitter:title"]', new MetaContentHandler(photo.title))
    .on('meta[property="twitter:description"]', new MetaContentHandler(description))
    .on('meta[property="twitter:url"]', new MetaContentHandler(pageUrl))
    .on('meta[property="twitter:image"]', new MetaContentHandler(imageUrl))
    .on('meta[name="twitter:card"]', new MetaContentHandler('summary_large_image'))
    .on('meta[name="twitter:title"]', new MetaContentHandler(photo.title))
    .on('meta[name="twitter:description"]', new MetaContentHandler(description))
    .on('meta[name="twitter:url"]', new MetaContentHandler(pageUrl))
    .on('meta[name="twitter:image"]', new MetaContentHandler(imageUrl))
    .on('meta[name="description"]', new MetaContentHandler(description))
    .transform(response)
}

class MetaContentHandler {
  constructor(private readonly content: string) {}

  element(element: { setAttribute: (name: string, value: string) => void }) {
    element.setAttribute('content', this.content)
  }
}

class TextContentHandler {
  constructor(private readonly content: string) {}

  element(element: { setInnerContent: (content: string) => void }) {
    element.setInnerContent(this.content)
  }
}

function getPhotoIdFromPathname(pathname: string): string | null {
  const match = pathname.match(/^\/photos\/([^/]+)\/?$/)
  if (!match?.[1]) {
    return null
  }

  try {
    return decodeURIComponent(match[1])
  }
  catch {
    return match[1]
  }
}

function isHtmlResponse(response: Response): boolean {
  return response.headers.get('content-type')?.includes('text/html') ?? false
}

async function getPhotoOgPayload(origin: string): Promise<PhotoOgPayload | null> {
  const cached = photoOgPayloadByOrigin.get(origin)
  if (cached) {
    return cached
  }

  const promise = fetchPhotoOgPayload(origin)
  photoOgPayloadByOrigin.set(origin, promise)

  const payload = await promise
  if (!payload) {
    photoOgPayloadByOrigin.delete(origin)
  }

  return payload
}

async function fetchPhotoOgPayload(origin: string): Promise<PhotoOgPayload | null> {
  try {
    const response = await fetch(new URL('/og-data.json', origin), {
      headers: {
        accept: 'application/json',
      },
    })

    if (!response.ok) {
      return null
    }

    return (await response.json()) as PhotoOgPayload
  }
  catch (error) {
    console.warn('Failed to load photo OG metadata:', error)
    return null
  }
}

function toAbsoluteUrl(value: string, origin: string): string {
  try {
    return new URL(value, origin).toString()
  }
  catch {
    return origin
  }
}

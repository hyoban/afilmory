import type { PhotoManifestItem } from '@afilmory/builder'
import siteConfig from '@config'
import { notFound } from 'next/navigation'

import { photoLoader } from '~/lib/photo-loader'

import { Collection } from './Collection'
import { PhotoItem } from './PhotoItem'
import { parseLimit, pickCollectionLayout } from './utils'

type RawParam = string | string[] | undefined

function asString(value: RawParam): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }
  return value
}

function parseIdList(value: RawParam): string[] {
  if (!value) {
    return []
  }
  if (Array.isArray(value)) {
    return value
      .flatMap(v => v.split(','))
      .map(s => s.trim())
      .filter(Boolean)
  }
  return value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

export default async function Page({ searchParams }: NextPageExtractedParams<unknown>) {
  const params = (await searchParams) as Record<string, RawParam>

  const single = asString(params.id)
  const idList = parseIdList(params.ids)
  const tag = asString(params.tag)
  const limit = parseLimit(asString(params.limit))

  if (single) {
    const photo = photoLoader.getPhoto(single)
    if (!photo) {
      notFound()
    }
    return <PhotoItem photo={photo} />
  }

  if (idList.length > 0) {
    const photos = photoLoader.getPhotos(idList)
    if (photos.length === 0) {
      notFound()
    }
    const ordered = preserveOrder(photos, idList)
    const galleryUrl = `${siteConfig.url.replace(/\/$/, '')}/`
    return (
      <Collection
        photos={ordered}
        layout={pickCollectionLayout(asString(params.layout), ordered.length)}
        header={{ title: <span>{`${ordered.length} photos`}</span> }}
        viewAllUrl={galleryUrl}
        viewAllLabel="View all →"
        badgeHref={galleryUrl}
      />
    )
  }

  if (tag) {
    const matched = photoLoader.getPhotos().filter(p => p.tags?.includes(tag))
    if (matched.length === 0) {
      notFound()
    }
    const shown = matched.slice(0, limit)
    const totalCount = matched.length
    const overflowCount = Math.max(0, totalCount - shown.length)
    const tagFilterUrl = `${siteConfig.url.replace(/\/$/, '')}/?tags=${encodeURIComponent(tag)}`
    return (
      <Collection
        photos={shown}
        layout={pickCollectionLayout(asString(params.layout), shown.length + (overflowCount > 0 ? 1 : 0))}
        header={{
          title: (
            <span className="af-tag-pill">
              #
              {tag}
            </span>
          ),
          count: `${shown.length} of ${totalCount}`,
        }}
        viewAllUrl={tagFilterUrl}
        viewAllLabel="View all →"
        overflow={overflowCount > 0 ? { count: overflowCount, url: tagFilterUrl } : null}
        badgeHref={tagFilterUrl}
      />
    )
  }

  notFound()
}

function preserveOrder(photos: PhotoManifestItem[], orderedIds: string[]): PhotoManifestItem[] {
  const map = new Map(photos.map(p => [p.id, p]))
  const out: PhotoManifestItem[] = []
  for (const id of orderedIds) {
    const p = map.get(id)
    if (p) {
      out.push(p)
    }
  }
  return out
}

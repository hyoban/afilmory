import type { PhotoManifestItem } from '@afilmory/builder'
import { thumbHashToDataURL } from 'thumbhash'

import { Badge } from './Badge'
import { decompressThumbHash, getPhotoDetailUrl } from './utils'

interface CollectionProps {
  photos: PhotoManifestItem[]
  layout: 'grid' | 'strip'
  header: {
    title: React.ReactNode
    count?: string
  }
  viewAllUrl: string
  viewAllLabel: string
  overflow?: { count: number, url: string } | null
  badgeHref: string
}

export function Collection({ photos, layout, header, viewAllUrl, viewAllLabel, overflow, badgeHref }: CollectionProps) {
  const photoTiles = photos.map(p => <CollectionTile key={p.id} photo={p} />)
  const overflowTile
    = overflow && overflow.count > 0 ? (
      <a
        key="__overflow"
        className="af-grid-cell af-overflow"
        href={overflow.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        +
        {overflow.count}
        {' '}
        more
      </a>
    ) : null

  return (
    <article className="af-card" data-afilmory-root>
      <div className="af-coll-header">
        <div className="af-coll-title">
          {header.title}
          {header.count && <span className="af-count">{header.count}</span>}
        </div>
        <a className="af-view-link" href={viewAllUrl} target="_blank" rel="noopener noreferrer">
          {viewAllLabel}
        </a>
      </div>
      {layout === 'grid' ? (
        <div
          className="af-grid"
          style={{ gridTemplateColumns: `repeat(${photos.length + (overflowTile ? 1 : 0) > 4 ? 3 : 2}, 1fr)` }}
        >
          {photoTiles}
          {overflowTile}
        </div>
      ) : (
        <div className="af-strip">
          {photoTiles}
          {overflowTile}
        </div>
      )}
      <div className="af-footer">
        <Badge href={badgeHref} inline />
      </div>
    </article>
  )
}

function CollectionTile({ photo }: { photo: PhotoManifestItem }) {
  const thumbHashUrl = photo.thumbHash ? thumbHashToDataURL(decompressThumbHash(photo.thumbHash)) : null
  const detailUrl = getPhotoDetailUrl(photo.id)
  return (
    <a
      className="af-grid-cell"
      href={detailUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={photo.title || photo.id}
      style={{
        backgroundImage: thumbHashUrl ? `url(${thumbHashUrl})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <img src={photo.thumbnailUrl} alt={photo.title || photo.id} loading="lazy" />
    </a>
  )
}

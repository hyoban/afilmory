import type { PhotoManifestItem } from '@afilmory/builder'
import { Fragment } from 'react'
import { thumbHashToDataURL } from 'thumbhash'

import { Badge } from './Badge'
import { decompressThumbHash, formatExifChips, formatPhotoSub, getPhotoDetailUrl } from './utils'

interface PhotoItemProps {
  photo: PhotoManifestItem
}

export function PhotoItem({ photo }: PhotoItemProps) {
  const thumbHashUrl = photo.thumbHash ? thumbHashToDataURL(decompressThumbHash(photo.thumbHash)) : null
  const detailUrl = getPhotoDetailUrl(photo.id)
  const exifChips = formatExifChips(photo.exif)
  const sub = formatPhotoSub(photo)
  const aspectRatio = photo.width && photo.height ? `${photo.width} / ${photo.height}` : '3 / 2'

  return (
    <article className="af-card" data-afilmory-root>
      <div
        className="af-photo"
        style={{
          aspectRatio,
          backgroundImage: thumbHashUrl ? `url(${thumbHashUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <a href={detailUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${photo.title || photo.id}`}>
          <img src={photo.thumbnailUrl} alt={photo.title || photo.id} loading="lazy" />
        </a>
        <Badge href={detailUrl} />
      </div>
      <div className="af-meta">
        <div className="af-meta-head">
          <div className="af-title">{photo.title || photo.id}</div>
          <a className="af-view-link" href={detailUrl} target="_blank" rel="noopener noreferrer">
            View →
          </a>
        </div>
        {sub.length > 0 && (
          <div className="af-sub">
            {sub.map((part, i) => (
              <Fragment key={part}>
                {i > 0 && <span className="af-sep">·</span>}
                <span>{part}</span>
              </Fragment>
            ))}
          </div>
        )}
        {exifChips.length > 0 && (
          <div className="af-exif">
            {exifChips.map(chip => (
              <span key={chip.label} className="af-chip">
                {chip.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

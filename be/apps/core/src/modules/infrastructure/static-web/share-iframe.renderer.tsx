import type { PhotoManifestItem, PickedExif } from '@afilmory/builder'
import { html, raw } from 'hono/html'

const GLOBAL_CSS = `
*, *::before, *::after { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: transparent;
  color: rgba(255, 255, 255, 0.92);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif;
  font-feature-settings: "ss01", "cv11";
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
body { display: block; overflow: hidden; }
a { color: inherit; text-decoration: none; }
img { display: block; max-width: 100%; }
button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }

.af-card { background: #0a0a0a; overflow: hidden; color: rgba(255, 255, 255, 0.92); width: 100%; }

.af-photo { position: relative; background: #050505; overflow: hidden; }
.af-photo img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: center; }

.af-badge {
  position: absolute; bottom: 12px; right: 12px;
  display: inline-flex; align-items: center; gap: 7px;
  padding: 6px 10px;
  background: rgba(20, 20, 20, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  color: rgba(255, 255, 255, 0.92);
  font-size: 11px; font-weight: 500; letter-spacing: 0.01em; text-decoration: none;
}
.af-badge-inline { position: static; }
.af-badge-dot { width: 5px; height: 5px; background: #4ade80; }
.af-badge-via { font-size: 9px; opacity: 0.5; margin-left: 4px; font-weight: 400; }

.af-meta { padding: 14px 16px 16px; border-top: 1px solid rgba(255, 255, 255, 0.06); }
.af-meta-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 8px; }
.af-title { font-size: 15px; font-weight: 600; color: rgba(255, 255, 255, 0.95); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
.af-view-link { font-size: 11px; color: #5eb3ff; flex-shrink: 0; font-weight: 500; letter-spacing: 0.02em; }
.af-sub { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; font-size: 11px; color: rgba(255, 255, 255, 0.55); margin-bottom: 10px; font-variant-numeric: tabular-nums; }
.af-sub .af-sep { color: rgba(255, 255, 255, 0.2); }

.af-exif { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
.af-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.04); color: rgba(255, 255, 255, 0.85); padding: 3px 8px; font-variant-numeric: tabular-nums; letter-spacing: 0.01em; }
.af-chip svg { width: 10px; height: 10px; opacity: 0.55; }

.af-coll-header { padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }
.af-coll-title { font-size: 13px; font-weight: 600; color: rgba(255, 255, 255, 0.92); display: flex; align-items: center; gap: 10px; min-width: 0; }
.af-count { font-size: 11px; color: rgba(255, 255, 255, 0.45); font-variant-numeric: tabular-nums; font-weight: 400; }
.af-tag-pill { font-size: 11px; padding: 2px 8px; background: rgba(94, 179, 255, 0.12); border: 1px solid rgba(94, 179, 255, 0.2); border-radius: 4px; color: #5eb3ff; font-weight: 500; letter-spacing: 0.01em; white-space: nowrap; }

.af-grid { display: grid; gap: 1px; background: rgba(255, 255, 255, 0.04); }
.af-grid-cell { position: relative; aspect-ratio: 1; background: #050505; overflow: hidden; }
.af-grid-cell img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease; }
.af-grid-cell:hover img { transform: scale(1.04); }
.af-overflow { display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.03); color: rgba(255, 255, 255, 0.55); font-size: 14px; font-weight: 500; letter-spacing: 0.02em; }
.af-overflow:hover { background: rgba(255, 255, 255, 0.06); color: rgba(255, 255, 255, 0.85); }

.af-strip { display: flex; gap: 4px; padding: 8px; overflow-x: auto; scroll-snap-type: x mandatory; background: rgba(0, 0, 0, 0.4); scrollbar-width: thin; scrollbar-color: rgba(255, 255, 255, 0.15) transparent; }
.af-strip::-webkit-scrollbar { height: 6px; }
.af-strip::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.15); }
.af-strip > * { flex: 0 0 38%; scroll-snap-align: start; aspect-ratio: 3 / 4; position: relative; background: #050505; overflow: hidden; }
.af-strip img { width: 100%; height: 100%; object-fit: cover; }

.af-footer { padding: 10px 16px; text-align: right; border-top: 1px solid rgba(255, 255, 255, 0.06); }
.af-empty { padding: 48px 16px; text-align: center; color: rgba(255, 255, 255, 0.4); font-size: 13px; }
`

const RESIZE_SCRIPT = `(function(){
  var lastHeight = 0;
  function measure(){
    var card = document.querySelector('[data-afilmory-root]');
    if (card) { var rect = card.getBoundingClientRect(); return Math.ceil(rect.height); }
    return Math.ceil(document.documentElement.getBoundingClientRect().height);
  }
  function postSize(){
    try {
      var h = measure();
      if (!h || h === lastHeight) return;
      lastHeight = h;
      parent.postMessage({ type: 'afilmory:resize', height: h }, '*');
    } catch (e) {}
  }
  function attach(){
    postSize();
    document.querySelectorAll('img').forEach(function(img){
      if (img.complete) return;
      img.addEventListener('load', postSize);
      img.addEventListener('error', postSize);
    });
    if (typeof ResizeObserver !== 'undefined') {
      try {
        var root = document.querySelector('[data-afilmory-root]') || document.documentElement;
        new ResizeObserver(postSize).observe(root);
      } catch (e) {}
    }
  }
  if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', attach); } else { attach(); }
  window.addEventListener('load', postSize);
  window.addEventListener('resize', postSize);
  var retries = 0;
  var retryId = setInterval(function(){ postSize(); if (++retries >= 6) clearInterval(retryId); }, 250);
})();`

export interface ShareRenderContext {
  siteUrl: string
  siteName: string
}

const TRAILING_SLASH_RE = /\/$/
const WWW_PREFIX_RE = /^www\./

export function trimTrailingSlash(value: string): string {
  return value.replace(TRAILING_SLASH_RE, '')
}

function getPhotoDetailUrl(ctx: ShareRenderContext, photoId: string): string {
  return `${trimTrailingSlash(ctx.siteUrl)}/photos/${encodeURIComponent(photoId)}`
}

function getDisplaySiteName(ctx: ShareRenderContext): string {
  try {
    return new URL(ctx.siteUrl).hostname.replace(WWW_PREFIX_RE, '')
  }
  catch {
    return ctx.siteName
  }
}

function formatShutter(value: string | number): string {
  const str = typeof value === 'number' ? String(value) : value
  if (str.includes('/'))
    return `${str}s`
  const n = Number.parseFloat(str)
  if (Number.isFinite(n) && n < 1 && n > 0)
    return `1/${Math.round(1 / n)}s`
  return `${str}s`
}

function formatExifChips(exif: PickedExif | null | undefined): string[] {
  if (!exif)
    return []
  const chips: string[] = []
  const focal = exif.FocalLengthIn35mmFormat
    ? `${Number.parseInt(String(exif.FocalLengthIn35mmFormat))}mm`
    : exif.FocalLength
      ? `${Number.parseInt(String(exif.FocalLength))}mm`
      : null
  if (focal)
    chips.push(focal)
  if (exif.FNumber)
    chips.push(`f/${exif.FNumber}`)
  if (exif.ExposureTime)
    chips.push(formatShutter(exif.ExposureTime))
  if (exif.ISO)
    chips.push(`ISO ${exif.ISO}`)
  return chips
}

function formatPhotoSub(photo: PhotoManifestItem): string[] {
  const parts: string[] = []
  const make = photo.exif?.Make
  const model = photo.exif?.Model
  if (model) {
    parts.push(make && !model.toLowerCase().includes(make.toLowerCase()) ? `${make} ${model}` : model)
  }
  else if (make) {
    parts.push(make)
  }
  const lens = photo.exif?.LensModel
  if (lens)
    parts.push(lens)
  const city = photo.location?.city
  if (city)
    parts.push(city)
  if (photo.dateTaken) {
    const d = new Date(photo.dateTaken)
    if (!Number.isNaN(d.getTime())) {
      const y = d.getUTCFullYear()
      const m = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      parts.push(`${y}·${m}·${day}`)
    }
  }
  return parts
}

export function pickCollectionLayout(requested: string | undefined, photoCount: number): 'grid' | 'strip' {
  if (requested === 'grid' || requested === 'strip')
    return requested
  return photoCount <= 4 ? 'strip' : 'grid'
}

export function parseLimit(raw: string | undefined): number {
  const n = Number.parseInt(raw ?? '', 10)
  if (!Number.isFinite(n))
    return 9
  return Math.max(1, Math.min(24, n))
}

export function preserveOrder(photos: PhotoManifestItem[], orderedIds: string[]): PhotoManifestItem[] {
  const map = new Map(photos.map(p => [p.id, p]))
  const out: PhotoManifestItem[] = []
  for (const id of orderedIds) {
    const p = map.get(id)
    if (p)
      out.push(p)
  }
  return out
}

function Badge({ href, inline = false, ctx }: { href: string, inline?: boolean, ctx: ShareRenderContext }) {
  return (
    <a class={inline ? 'af-badge af-badge-inline' : 'af-badge'} href={href} target="_blank" rel="noopener noreferrer">
      <span class="af-badge-dot" />
      {getDisplaySiteName(ctx)}
      <span class="af-badge-via">via AFilmory</span>
    </a>
  )
}

function CollectionTile({ photo, ctx }: { photo: PhotoManifestItem, ctx: ShareRenderContext }) {
  const detailUrl = getPhotoDetailUrl(ctx, photo.id)
  return (
    <a
      class="af-grid-cell"
      href={detailUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={photo.title || photo.id}
    >
      <img src={photo.thumbnailUrl} alt={photo.title || photo.id} loading="lazy" />
    </a>
  )
}

interface CollectionProps {
  photos: PhotoManifestItem[]
  layout: 'grid' | 'strip'
  headerTitle: unknown
  headerCount?: string
  viewAllUrl: string
  viewAllLabel: string
  overflow?: { count: number, url: string } | null
  badgeHref: string
  ctx: ShareRenderContext
}

function Collection(props: CollectionProps) {
  const { photos, layout, headerTitle, headerCount, viewAllUrl, viewAllLabel, overflow, badgeHref, ctx } = props
  const overflowTile
    = overflow && overflow.count > 0
      ? (
          <a class="af-grid-cell af-overflow" href={overflow.url} target="_blank" rel="noopener noreferrer">
            +
            {overflow.count}
            {' '}
            more
          </a>
        )
      : null
  const tileCount = photos.length + (overflowTile ? 1 : 0)
  return (
    <article class="af-card" data-afilmory-root="">
      <div class="af-coll-header">
        <div class="af-coll-title">
          {headerTitle as never}
          {headerCount ? <span class="af-count">{headerCount}</span> : null}
        </div>
        <a class="af-view-link" href={viewAllUrl} target="_blank" rel="noopener noreferrer">
          {viewAllLabel}
        </a>
      </div>
      {layout === 'grid'
        ? (
            <div class="af-grid" style={`grid-template-columns: repeat(${tileCount > 4 ? 3 : 2}, 1fr);`}>
              {photos.map(p => (
                <CollectionTile photo={p} ctx={ctx} />
              ))}
              {overflowTile}
            </div>
          )
        : (
            <div class="af-strip">
              {photos.map(p => (
                <CollectionTile photo={p} ctx={ctx} />
              ))}
              {overflowTile}
            </div>
          )}
      <div class="af-footer">
        <Badge href={badgeHref} inline ctx={ctx} />
      </div>
    </article>
  )
}

function PhotoItem({ photo, ctx }: { photo: PhotoManifestItem, ctx: ShareRenderContext }) {
  const detailUrl = getPhotoDetailUrl(ctx, photo.id)
  const exifChips = formatExifChips(photo.exif)
  const sub = formatPhotoSub(photo)
  const aspectRatio = photo.width && photo.height ? `${photo.width} / ${photo.height}` : '3 / 2'
  return (
    <article class="af-card" data-afilmory-root="">
      <div class="af-photo" style={`aspect-ratio: ${aspectRatio};`}>
        <a href={detailUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${photo.title || photo.id}`}>
          <img src={photo.thumbnailUrl} alt={photo.title || photo.id} loading="lazy" />
        </a>
        <Badge href={detailUrl} ctx={ctx} />
      </div>
      <div class="af-meta">
        <div class="af-meta-head">
          <div class="af-title">{photo.title || photo.id}</div>
          <a class="af-view-link" href={detailUrl} target="_blank" rel="noopener noreferrer">
            View →
          </a>
        </div>
        {sub.length > 0
          ? (
              <div class="af-sub">
                {sub.map((part, i) => (
                  <>
                    {i > 0 ? <span class="af-sep">·</span> : null}
                    <span>{part}</span>
                  </>
                ))}
              </div>
            )
          : null}
        {exifChips.length > 0
          ? (
              <div class="af-exif">
                {exifChips.map(chip => (
                  <span class="af-chip">{chip}</span>
                ))}
              </div>
            )
          : null}
      </div>
    </article>
  )
}

function ShareDocument({ body }: { body: unknown }) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Share · AFilmory</title>
        <style>{raw(GLOBAL_CSS)}</style>
      </head>
      <body>
        {body as never}
        <script>{raw(RESIZE_SCRIPT)}</script>
      </body>
    </html>
  )
}

export type ShareRenderInput
  = | { mode: 'single', photo: PhotoManifestItem, ctx: ShareRenderContext }
    | {
      mode: 'collection'
      photos: PhotoManifestItem[]
      layout: 'grid' | 'strip'
      headerTitle: unknown
      headerCount?: string
      viewAllUrl: string
      viewAllLabel: string
      overflow?: { count: number, url: string } | null
      badgeHref: string
      ctx: ShareRenderContext
    }

export async function renderShareIframe(input: ShareRenderInput): Promise<string> {
  const body
    = input.mode === 'single'
      ? (
          <PhotoItem photo={input.photo} ctx={input.ctx} />
        )
      : (
          <Collection
            photos={input.photos}
            layout={input.layout}
            headerTitle={input.headerTitle}
            headerCount={input.headerCount}
            viewAllUrl={input.viewAllUrl}
            viewAllLabel={input.viewAllLabel}
            overflow={input.overflow}
            badgeHref={input.badgeHref}
            ctx={input.ctx}
          />
        )
  const doc = <ShareDocument body={body} />
  const rendered = await Promise.resolve(doc.toString())
  return `<!DOCTYPE html>${rendered}`
}

export function renderTagPill(tag: string): unknown {
  return html`<span class="af-tag-pill">#${tag}</span>`
}

import fs from 'node:fs'
import path from 'node:path'

export interface ReportPhoto {
  id: string
  thumbnailUrl: string
  title?: string
}

export interface ReportInput {
  generatedAt: string
  totals: {
    embedded: number
    cached: number
    photos: number
  }
  thresholds: { tight: number, loose: number }
  tight: { members: { id: string, sim: number }[] }[]
  loose: { members: { id: string, sim: number }[] }[]
  photoIndex: Record<string, ReportPhoto>
}

export function writeJsonReport(file: string, report: ReportInput): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(report, null, 2))
}

export function writeHtmlReport(file: string, report: ReportInput, thumbnailBase: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, renderHtml(report, thumbnailBase))
}

function escape(s: string): string {
  return s.replaceAll(/[&<>"']/g, (c) => {
    if (c === '&') {
      return '&amp;'
    }
    if (c === '<') {
      return '&lt;'
    }
    if (c === '>') {
      return '&gt;'
    }
    if (c === '"') {
      return '&quot;'
    }
    return '&#39;'
  })
}

function renderCluster(
  c: { members: { id: string, sim: number }[] },
  photoIndex: Record<string, ReportPhoto>,
  base: string,
): string {
  const items = c.members
    .map((m) => {
      const photo = photoIndex[m.id]
      if (!photo) {
        return ''
      }
      const url = `${base}${photo.thumbnailUrl}`
      return `<figure><img src="${escape(url)}" alt="${escape(m.id)}" loading="lazy"><figcaption><span class="id">${escape(m.id)}</span><span class="sim">${m.sim.toFixed(3)}</span></figcaption></figure>`
    })
    .join('')
  return `<div class="cluster"><div class="size">${c.members.length}</div>${items}</div>`
}

function renderHtml(report: ReportInput, base: string): string {
  const { tight, loose, photoIndex, totals, thresholds, generatedAt } = report
  const tightHtml
    = tight.length > 0
      ? tight.map(c => renderCluster(c, photoIndex, base)).join('')
      : '<p class="empty">No tight clusters found.</p>'
  const looseHtml
    = loose.length > 0
      ? loose.map(c => renderCluster(c, photoIndex, base)).join('')
      : '<p class="empty">No loose clusters found.</p>'

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Variant Cluster Report</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: -apple-system, BlinkMacSystemFont, system-ui, sans-serif; margin: 2rem; max-width: 1400px; }
  header { margin-bottom: 2rem; }
  h1 { margin: 0 0 0.5rem; font-size: 1.5rem; }
  .meta { color: #888; font-size: 0.85rem; }
  h2 { margin: 2rem 0 0.25rem; font-size: 1.1rem; }
  .desc { color: #888; font-size: 0.85rem; margin: 0 0 1rem; }
  .cluster {
    position: relative;
    display: flex; flex-wrap: wrap; gap: 0.5rem;
    padding: 0.75rem;
    border: 1px solid #8884; border-radius: 6px;
    margin-bottom: 0.75rem;
    background: #8881;
  }
  .cluster .size {
    position: absolute; top: 0.4rem; right: 0.6rem;
    font-size: 0.75rem; font-family: ui-monospace, monospace;
    color: #888;
  }
  figure { margin: 0; max-width: 200px; }
  img { width: 200px; height: 200px; object-fit: cover; display: block; border-radius: 4px; background: #8882; }
  figcaption {
    display: flex; justify-content: space-between;
    font-size: 0.7rem; padding-top: 0.25rem;
    font-family: ui-monospace, monospace;
  }
  .id { color: #aaa; }
  .sim { color: #4af; font-weight: 600; }
  .empty { color: #888; font-style: italic; }
</style>
</head>
<body>
<header>
  <h1>Variant Cluster Report</h1>
  <div class="meta">Generated ${escape(generatedAt)} · ${totals.photos} photos (${totals.embedded} embedded, ${totals.cached} cached)</div>
</header>

<h2>Tight clusters · similarity ≥ ${thresholds.tight}</h2>
<p class="desc">Likely the same shot — different exports, color grades, or near-identical frames. Decide which to keep.</p>
${tightHtml}

<h2>Loose clusters · similarity ≥ ${thresholds.loose}</h2>
<p class="desc">Same moment / burst / bracket. Pick a keeper from each group.</p>
${looseHtml}

</body>
</html>`
}

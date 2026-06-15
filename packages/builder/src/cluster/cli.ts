import 'dotenv-expand/config'

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import consola from 'consola'

import { decodeEntry, emptyCache, encodeEntry, loadCache, saveCache } from './cache.js'
import { runEmbedder } from './embedder.js'
import type { ReportInput } from './report.js'
import { writeHtmlReport, writeJsonReport } from './report.js'
import type { ClusterPoint } from './similarity.js'
import { buildClusters } from './similarity.js'

const log = consola.withTag('CLUSTER')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../../..')

const DEFAULTS = {
  manifestPath: path.join(REPO_ROOT, 'apps/web/src/data/photos-manifest.json'),
  thumbnailDir: path.join(REPO_ROOT, 'apps/web/public/thumbnails'),
  cachePath: path.join(REPO_ROOT, 'apps/web/src/data/.cache/clip-embeddings.json'),
  htmlOut: path.join(REPO_ROOT, 'cluster-report.html'),
  jsonOut: path.join(REPO_ROOT, 'cluster-report.json'),
  model: 'clip-ViT-B-32',
  dim: 512,
  tight: 0.92,
  loose: 0.8,
}

interface Args {
  tight: number
  loose: number
  model: string
  manifestPath: string
  thumbnailDir: string
  cachePath: string
  htmlOut: string
  jsonOut: string
  noCache: boolean
  help: boolean
}

interface ManifestPhoto {
  id: string
  thumbnailUrl: string
  title?: string
}

function parseArgs(argv: string[]): Args {
  const a: Args = {
    tight: DEFAULTS.tight,
    loose: DEFAULTS.loose,
    model: DEFAULTS.model,
    manifestPath: DEFAULTS.manifestPath,
    thumbnailDir: DEFAULTS.thumbnailDir,
    cachePath: DEFAULTS.cachePath,
    htmlOut: DEFAULTS.htmlOut,
    jsonOut: DEFAULTS.jsonOut,
    noCache: false,
    help: false,
  }
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i]!
    const next = (): string => {
      const v = argv[++i]
      if (v == null) {
        throw new Error(`Missing value for ${tok}`)
      }
      return v
    }
    switch (tok) {
      case '--tight':
        a.tight = Number(next())
        break
      case '--loose':
        a.loose = Number(next())
        break
      case '--model':
        a.model = next()
        break
      case '--manifest':
        a.manifestPath = path.resolve(next())
        break
      case '--thumbnails':
        a.thumbnailDir = path.resolve(next())
        break
      case '--cache':
        a.cachePath = path.resolve(next())
        break
      case '--html':
        a.htmlOut = path.resolve(next())
        break
      case '--json':
        a.jsonOut = path.resolve(next())
        break
      case '--no-cache':
        a.noCache = true
        break
      case '-h':
      case '--help':
        a.help = true
        break
      default:
        throw new Error(`Unknown arg: ${tok}`)
    }
  }
  return a
}

function help(): void {
  log.info(`Variant cluster report

Usage: pnpm build:variant-report [options]

Options:
  --tight <n>          Tight cluster threshold (default ${DEFAULTS.tight})
  --loose <n>          Loose cluster threshold (default ${DEFAULTS.loose})
  --model <name>       CLIP model (default ${DEFAULTS.model})
  --manifest <path>    Override manifest location
  --thumbnails <path>  Override thumbnails directory
  --cache <path>       Override cache file
  --html <path>        Override HTML output
  --json <path>        Override JSON output
  --no-cache           Force full re-embed
  -h, --help           Show help`)
}

interface PhotoRow {
  id: string
  thumbnailFile: string
  mtime: number
  size: number
  thumbnailUrl: string
}

function countMembers(clusters: { members: { id: string }[] }[]): number {
  return clusters.reduce((s, c) => s + c.members.length, 0)
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    help()
    return
  }

  if (!fs.existsSync(args.manifestPath)) {
    throw new Error(`Manifest not found: ${args.manifestPath}. Run pnpm build:manifest first.`)
  }

  const manifest = JSON.parse(fs.readFileSync(args.manifestPath, 'utf8')) as { data: ManifestPhoto[] }
  const photos = manifest.data ?? []
  if (photos.length === 0) {
    log.info('No photos in manifest. Nothing to do.')
    return
  }

  const rows: PhotoRow[] = []
  for (const p of photos) {
    const filename = path.basename(p.thumbnailUrl)
    const thumbnailFile = path.join(args.thumbnailDir, filename)
    let stat: fs.Stats
    try {
      stat = fs.statSync(thumbnailFile)
    }
    catch {
      log.warn(`missing thumbnail: ${thumbnailFile}`)
      continue
    }
    rows.push({
      id: p.id,
      thumbnailFile,
      mtime: stat.mtimeMs,
      size: stat.size,
      thumbnailUrl: p.thumbnailUrl,
    })
  }

  let cache = args.noCache ? null : loadCache(args.cachePath)
  if (cache && cache.model !== args.model) {
    log.warn(`model changed (${cache.model} -> ${args.model}); discarding cache`)
    cache = null
  }
  if (!cache) {
    cache = emptyCache(args.model, DEFAULTS.dim)
  }

  const hits = new Map<string, Float32Array>()
  const misses: PhotoRow[] = []
  for (const r of rows) {
    const cur = cache.entries[r.id]
    if (cur && cur.thumbnailPath === r.thumbnailUrl && cur.mtime === r.mtime && cur.size === r.size) {
      hits.set(r.id, decodeEntry(cur))
    }
    else {
      misses.push(r)
    }
  }

  log.info(`${hits.size} cached, ${misses.length} need embedding`)

  let embeddedThisRun = 0
  if (misses.length > 0) {
    const missByPath = new Map(misses.map(r => [r.thumbnailFile, r]))
    const result = await runEmbedder({
      paths: misses.map(r => r.thumbnailFile),
      model: args.model,
    })
    for (const [absPath, vec] of result.embeddings) {
      const row = missByPath.get(absPath)
      if (!row) {
        continue
      }
      hits.set(row.id, vec)
      cache.entries[row.id] = encodeEntry(row.thumbnailUrl, row.mtime, row.size, vec)
      embeddedThisRun++
    }
    if (result.errors.length > 0) {
      log.warn(`${result.errors.length} files failed`)
      for (const e of result.errors.slice(0, 10)) {
        log.warn(`  ${path.basename(e.path)}: ${e.error}`)
      }
    }
    saveCache(args.cachePath, cache)
  }

  const points: ClusterPoint[] = []
  for (const r of rows) {
    const v = hits.get(r.id)
    if (v) {
      points.push({ id: r.id, vec: v })
    }
  }

  const tight = buildClusters(points, args.tight)
  const loose = buildClusters(points, args.loose)

  log.info(`tight: ${tight.length} clusters, ${countMembers(tight)} photos`)
  log.info(`loose: ${loose.length} clusters, ${countMembers(loose)} photos`)

  const photoIndex: Record<string, ManifestPhoto> = {}
  for (const p of photos) {
    photoIndex[p.id] = {
      id: p.id,
      thumbnailUrl: p.thumbnailUrl,
      title: p.title,
    }
  }

  const publicDir = path.dirname(args.thumbnailDir)
  const relToPublic = path.relative(path.dirname(args.htmlOut), publicDir).replaceAll(path.sep, '/') || '.'

  const report: ReportInput = {
    generatedAt: new Date().toISOString(),
    totals: {
      embedded: embeddedThisRun,
      cached: hits.size - embeddedThisRun,
      photos: rows.length,
    },
    thresholds: { tight: args.tight, loose: args.loose },
    tight,
    loose,
    photoIndex,
  }

  writeJsonReport(args.jsonOut, report)
  writeHtmlReport(args.htmlOut, report, relToPublic)

  log.success(`Report: ${args.htmlOut}`)
  log.info(`        ${args.jsonOut}`)
}

main().catch((err) => {
  log.error(err)

  process.exit(1)
})

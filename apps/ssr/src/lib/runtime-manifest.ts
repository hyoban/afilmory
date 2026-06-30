import fs from 'node:fs'
import process from 'node:process'

import type { AfilmoryManifest } from '@afilmory/builder'
import bundledManifest from '@afilmory/data/manifest'

interface RuntimeManifestCache {
  manifest: AfilmoryManifest
  manifestPath: string
  mtimeMs: number
}

let runtimeManifestCache: RuntimeManifestCache | null = null

export function getRuntimeManifest(manifestPath = process.env.AFILMORY_MANIFEST_PATH?.trim()): AfilmoryManifest {
  if (!manifestPath) {
    return bundledManifest as AfilmoryManifest
  }

  const stat = fs.statSync(manifestPath)
  if (
    runtimeManifestCache
    && runtimeManifestCache.manifestPath === manifestPath
    && runtimeManifestCache.mtimeMs === stat.mtimeMs
  ) {
    return runtimeManifestCache.manifest
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as AfilmoryManifest
  runtimeManifestCache = {
    manifest,
    manifestPath,
    mtimeMs: stat.mtimeMs,
  }
  return manifest
}

export function getRuntimeManifestScriptContent(manifestPath?: string): string {
  return `window.__MANIFEST__ = ${JSON.stringify(getRuntimeManifest(manifestPath))};`
}

export function resetRuntimeManifestCache(): void {
  runtimeManifestCache = null
}

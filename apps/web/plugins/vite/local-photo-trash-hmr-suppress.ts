import fs from 'node:fs/promises'
import path from 'node:path'

const markerMaxAgeMs = 10_000

interface LocalPhotoTrashHmrSuppressMarker {
  createdAt: number
  reason: string
}

export function getLocalPhotoTrashHmrSuppressMarkerPath(repoRoot: string): string {
  return path.join(repoRoot, 'node_modules/.cache/afilmory/local-photo-trash-hmr-suppress.json')
}

export async function consumeLocalPhotoTrashHmrSuppressMarker(repoRoot: string, now = Date.now()): Promise<boolean> {
  const markerPath = getLocalPhotoTrashHmrSuppressMarkerPath(repoRoot)
  let marker: LocalPhotoTrashHmrSuppressMarker

  try {
    marker = JSON.parse(await fs.readFile(markerPath, 'utf8')) as LocalPhotoTrashHmrSuppressMarker
  }
  catch {
    return false
  }

  await fs.rm(markerPath, { force: true })

  return (
    marker.reason === 'local-photo-trash'
    && Number.isFinite(marker.createdAt)
    && now - marker.createdAt <= markerMaxAgeMs
  )
}

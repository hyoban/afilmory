import fs from 'node:fs/promises'
import path from 'node:path'

export function getLocalPhotoTrashHmrSuppressMarkerPath(repoRoot: string): string {
  return path.join(repoRoot, 'node_modules/.cache/afilmory/local-photo-trash-hmr-suppress.json')
}

export async function writeLocalPhotoTrashHmrSuppressMarker(repoRoot: string): Promise<void> {
  const markerPath = getLocalPhotoTrashHmrSuppressMarkerPath(repoRoot)
  await fs.mkdir(path.dirname(markerPath), { recursive: true })
  await fs.writeFile(markerPath, JSON.stringify({ createdAt: Date.now(), reason: 'local-photo-trash' }))
}

import path from 'node:path'

export const LOCAL_PHOTO_TRASH_HMR_MARKER_MAX_AGE_MS = 10_000
export const LOCAL_PHOTO_TRASH_HMR_MARKER_REASON = 'local-photo-trash'

export function getLocalPhotoTrashHmrSuppressMarkerPath(repoRoot: string): string {
  return path.join(repoRoot, 'node_modules/.cache/afilmory/local-photo-trash-hmr-suppress.json')
}

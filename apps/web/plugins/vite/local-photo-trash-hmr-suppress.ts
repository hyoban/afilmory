import fs from 'node:fs/promises'

import {
  getLocalPhotoTrashHmrSuppressMarkerPath,
  LOCAL_PHOTO_TRASH_HMR_MARKER_MAX_AGE_MS,
  LOCAL_PHOTO_TRASH_HMR_MARKER_REASON,
} from '@afilmory/utils/local-photo-trash-hmr'

interface LocalPhotoTrashHmrSuppressMarker {
  createdAt: number
  reason: string
}
export { getLocalPhotoTrashHmrSuppressMarkerPath }

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
    marker.reason === LOCAL_PHOTO_TRASH_HMR_MARKER_REASON
    && Number.isFinite(marker.createdAt)
    && now - marker.createdAt <= LOCAL_PHOTO_TRASH_HMR_MARKER_MAX_AGE_MS
  )
}

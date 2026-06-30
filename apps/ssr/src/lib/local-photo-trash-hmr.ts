import fs from 'node:fs/promises'
import path from 'node:path'

import {
  getLocalPhotoTrashHmrSuppressMarkerPath,
  LOCAL_PHOTO_TRASH_HMR_MARKER_REASON,
} from '@afilmory/utils/local-photo-trash-hmr'

export { getLocalPhotoTrashHmrSuppressMarkerPath }

export async function writeLocalPhotoTrashHmrSuppressMarker(repoRoot: string): Promise<void> {
  const markerPath = getLocalPhotoTrashHmrSuppressMarkerPath(repoRoot)
  await fs.mkdir(path.dirname(markerPath), { recursive: true })
  await fs.writeFile(markerPath, JSON.stringify({ createdAt: Date.now(), reason: LOCAL_PHOTO_TRASH_HMR_MARKER_REASON }))
}

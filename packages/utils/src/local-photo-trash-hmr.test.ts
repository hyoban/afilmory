import assert from 'node:assert/strict'
import path from 'node:path'

import { it } from 'vitest'

import {
  getLocalPhotoTrashHmrSuppressMarkerPath,
  LOCAL_PHOTO_TRASH_HMR_MARKER_MAX_AGE_MS,
  LOCAL_PHOTO_TRASH_HMR_MARKER_REASON,
} from './local-photo-trash-hmr'

it('local photo trash HMR marker metadata is shared across runtimes', () => {
  assert.equal(LOCAL_PHOTO_TRASH_HMR_MARKER_REASON, 'local-photo-trash')
  assert.equal(LOCAL_PHOTO_TRASH_HMR_MARKER_MAX_AGE_MS, 10_000)
  assert.equal(
    getLocalPhotoTrashHmrSuppressMarkerPath('/repo'),
    path.join('/repo', 'node_modules/.cache/afilmory/local-photo-trash-hmr-suppress.json'),
  )
})

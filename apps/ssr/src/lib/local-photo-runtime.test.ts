import assert from 'node:assert/strict'

import { it } from 'vitest'

import {
  getLocalPhotoRuntimeConfigFromEnv,
  isLocalPhotoTrashEnabledFromEnv,
  withLocalPhotoRuntimeEnv,
} from './local-photo-runtime'

it('getLocalPhotoRuntimeConfigFromEnv resolves production Docker volume paths', () => {
  withLocalPhotoRuntimeEnv(
    {
      AFILMORY_LOCAL_PHOTO_TRASH: 'true',
      AFILMORY_LOCAL_PHOTOS_DIR: '/data/photos',
      AFILMORY_MANIFEST_PATH: '/data/photos-manifest.json',
      AFILMORY_THUMBNAILS_DIR: '/data/thumbnails',
    },
    () => {
      assert.deepEqual(getLocalPhotoRuntimeConfigFromEnv(), {
        localBasePath: '/data/photos',
        manifestPath: '/data/photos-manifest.json',
        source: 'env',
        thumbnailsDir: '/data/thumbnails',
        trashEnabled: true,
      })
      assert.equal(isLocalPhotoTrashEnabledFromEnv(), true)
    },
  )
})

it('getLocalPhotoRuntimeConfigFromEnv disables trash when explicitly false', () => {
  withLocalPhotoRuntimeEnv(
    {
      AFILMORY_LOCAL_PHOTO_TRASH: 'false',
      AFILMORY_LOCAL_PHOTOS_DIR: '/data/photos',
      AFILMORY_MANIFEST_PATH: '/data/photos-manifest.json',
      AFILMORY_THUMBNAILS_DIR: '/data/thumbnails',
    },
    () => {
      assert.equal(getLocalPhotoRuntimeConfigFromEnv()?.trashEnabled, false)
      assert.equal(isLocalPhotoTrashEnabledFromEnv(), false)
    },
  )
})

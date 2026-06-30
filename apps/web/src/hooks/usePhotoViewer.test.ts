import assert from 'node:assert/strict'

import { it } from 'vitest'

import { resolvePhotoViewerCurrentIndex } from './photo-viewer-current-index'

const photos = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

it('resolvePhotoViewerCurrentIndex uses the URL photo when it is still visible', () => {
  assert.equal(resolvePhotoViewerCurrentIndex(photos, 'b', 'c'), 1)
})

it('resolvePhotoViewerCurrentIndex falls back to the viewer photo when the URL photo was filtered out', () => {
  assert.equal(
    resolvePhotoViewerCurrentIndex(
      photos.filter(photo => photo.id !== 'b'),
      'b',
      'c',
    ),
    1,
  )
})

it('resolvePhotoViewerCurrentIndex returns the first photo only when neither route nor viewer photo is visible', () => {
  assert.equal(resolvePhotoViewerCurrentIndex(photos, 'missing', 'also-missing'), 0)
})

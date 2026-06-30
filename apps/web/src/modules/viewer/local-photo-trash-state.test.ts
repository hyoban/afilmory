import assert from 'node:assert/strict'

import { it } from 'vitest'

import {
  excludeLocallyTrashedPhotos,
  resolveLocalPhotoTrashSuccess,
  shouldHandleLocalPhotoTrashShortcut,
  shouldIgnoreLocalPhotoTrashIndexChange,
} from './local-photo-trash-state'

const photos = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

it('resolveLocalPhotoTrashSuccess navigates to the next photo id before filtering the trashed photo', () => {
  assert.deepEqual(resolveLocalPhotoTrashSuccess(photos, 1), {
    type: 'go-to-photo',
    photoId: 'c',
  })
})

it('resolveLocalPhotoTrashSuccess follows the previous browsing direction when both neighbors exist', () => {
  assert.deepEqual(resolveLocalPhotoTrashSuccess(photos, 1, 'backward'), {
    type: 'go-to-photo',
    photoId: 'a',
  })
})

it('resolveLocalPhotoTrashSuccess falls back to the previous photo id when trashing the last photo', () => {
  assert.deepEqual(resolveLocalPhotoTrashSuccess(photos, 2), {
    type: 'go-to-photo',
    photoId: 'b',
  })
})

it('resolveLocalPhotoTrashSuccess closes the viewer when no photo remains', () => {
  assert.deepEqual(resolveLocalPhotoTrashSuccess([{ id: 'only' }], 0), {
    type: 'close',
  })
})

it('excludeLocallyTrashedPhotos removes locally trashed ids without mutating the source list', () => {
  const filtered = excludeLocallyTrashedPhotos(photos, new Set(['b']))

  assert.deepEqual(filtered, [{ id: 'a' }, { id: 'c' }])
  assert.deepEqual(photos, [{ id: 'a' }, { id: 'b' }, { id: 'c' }])
})

it('shouldIgnoreLocalPhotoTrashIndexChange suppresses stale slide changes while trash navigation is pending', () => {
  const filteredPhotos = excludeLocallyTrashedPhotos(photos, new Set(['b']))

  assert.equal(shouldIgnoreLocalPhotoTrashIndexChange(filteredPhotos, 0, 'c'), true)
  assert.equal(shouldIgnoreLocalPhotoTrashIndexChange(filteredPhotos, 1, 'c'), false)
  assert.equal(shouldIgnoreLocalPhotoTrashIndexChange(filteredPhotos, 0, null), false)
})

it('shouldHandleLocalPhotoTrashShortcut accepts Delete and Backspace in an active local viewer', () => {
  assert.equal(
    shouldHandleLocalPhotoTrashShortcut({
      canTrashLocalPhoto: true,
      hasOpenDialog: false,
      isOpen: true,
      isTrashingPhoto: false,
      key: 'Delete',
      target: { tagName: 'BODY' },
    }),
    true,
  )
  assert.equal(
    shouldHandleLocalPhotoTrashShortcut({
      canTrashLocalPhoto: true,
      hasOpenDialog: false,
      isOpen: true,
      isTrashingPhoto: false,
      key: 'Backspace',
      target: { tagName: 'BODY' },
    }),
    true,
  )
})

it('shouldHandleLocalPhotoTrashShortcut ignores editable targets, modifiers, dialogs, and inactive states', () => {
  const base = {
    canTrashLocalPhoto: true,
    hasOpenDialog: false,
    isOpen: true,
    isTrashingPhoto: false,
    key: 'Delete',
    target: { tagName: 'BODY' },
  }

  assert.equal(shouldHandleLocalPhotoTrashShortcut({ ...base, target: { tagName: 'INPUT' } }), false)
  assert.equal(
    shouldHandleLocalPhotoTrashShortcut({ ...base, target: { isContentEditable: true, tagName: 'DIV' } }),
    false,
  )
  assert.equal(shouldHandleLocalPhotoTrashShortcut({ ...base, target: { role: 'textbox', tagName: 'DIV' } }), false)
  assert.equal(shouldHandleLocalPhotoTrashShortcut({ ...base, metaKey: true }), false)
  assert.equal(shouldHandleLocalPhotoTrashShortcut({ ...base, hasOpenDialog: true }), false)
  assert.equal(shouldHandleLocalPhotoTrashShortcut({ ...base, canTrashLocalPhoto: false }), false)
  assert.equal(shouldHandleLocalPhotoTrashShortcut({ ...base, isOpen: false }), false)
  assert.equal(shouldHandleLocalPhotoTrashShortcut({ ...base, isTrashingPhoto: true }), false)
  assert.equal(shouldHandleLocalPhotoTrashShortcut({ ...base, key: 'ArrowRight' }), false)
})

import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'

import { it } from 'vitest'

import { detectMediaContentType, isHeicLikeBuffer } from './media-signature'

it('detectMediaContentType prefers JPEG content over a HEIC extension', () => {
  const jpegBuffer = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46])

  assert.equal(detectMediaContentType('IMG_3236(1).HEIC', jpegBuffer), 'image/jpeg')
})

it('detectMediaContentType recognizes HEIC brands from file content', () => {
  const heicBuffer = Buffer.from('\0\0\0\0ftypheic\0\0\0\0', 'binary')

  assert.equal(isHeicLikeBuffer(heicBuffer), true)
  assert.equal(detectMediaContentType('photo.jpeg', heicBuffer), 'image/heif')
})

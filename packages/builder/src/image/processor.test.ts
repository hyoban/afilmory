import assert from 'node:assert/strict'

import sharp from 'sharp'
import { it } from 'vitest'

import type { PhotoProcessingLoggers } from '../photo/logger-adapter.js'
import { setGlobalLoggers } from '../photo/logger-adapter.js'
import { preprocessImageBuffer } from './processor.js'

const noopLogger = {
  error: () => {},
  info: () => {},
  success: () => {},
  warn: () => {},
}

setGlobalLoggers({
  blurhash: noopLogger,
  exif: noopLogger,
  image: noopLogger,
  location: noopLogger,
  s3: noopLogger,
  thumbnail: noopLogger,
  tone: noopLogger,
} as unknown as PhotoProcessingLoggers)

it('preprocessImageBuffer accepts JPEG content with a HEIC extension', async () => {
  const jpegBuffer = await sharp({
    create: {
      background: { b: 32, g: 16, r: 8 },
      channels: 3,
      height: 4,
      width: 4,
    },
  })
    .jpeg()
    .toBuffer()

  const processed = await preprocessImageBuffer(jpegBuffer, 'Album/photo.HEIC')
  const metadata = await sharp(processed).metadata()

  assert.equal(metadata.format, 'jpeg')
  assert.equal(metadata.width, 4)
  assert.equal(metadata.height, 4)
})

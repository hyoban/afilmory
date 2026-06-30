import assert from 'node:assert/strict'
import path from 'node:path'

import { it } from 'vitest'

import { isPathInside } from './path-safety'

it('isPathInside accepts a child path inside the parent directory', () => {
  const parent = path.resolve('/tmp/afilmory/photos')
  const child = path.join(parent, 'Album', 'photo.jpg')

  assert.equal(isPathInside(parent, child), true)
})

it('isPathInside rejects sibling paths that only share the same prefix', () => {
  assert.equal(isPathInside('/tmp/afilmory/photos', '/tmp/afilmory/photos-escape/photo.jpg'), false)
})

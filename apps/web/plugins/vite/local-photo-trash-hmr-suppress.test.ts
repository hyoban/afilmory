import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { it } from 'vitest'

import {
  consumeLocalPhotoTrashHmrSuppressMarker,
  getLocalPhotoTrashHmrSuppressMarkerPath,
} from './local-photo-trash-hmr-suppress'

it('consumeLocalPhotoTrashHmrSuppressMarker suppresses a fresh local trash marker once', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'afilmory-hmr-'))
  const markerPath = getLocalPhotoTrashHmrSuppressMarkerPath(repoRoot)
  await fs.mkdir(path.dirname(markerPath), { recursive: true })
  await fs.writeFile(markerPath, JSON.stringify({ createdAt: Date.now(), reason: 'local-photo-trash' }))

  assert.equal(await consumeLocalPhotoTrashHmrSuppressMarker(repoRoot), true)
  assert.equal(await consumeLocalPhotoTrashHmrSuppressMarker(repoRoot), false)
})

it('consumeLocalPhotoTrashHmrSuppressMarker ignores stale markers', async () => {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'afilmory-hmr-'))
  const markerPath = getLocalPhotoTrashHmrSuppressMarkerPath(repoRoot)
  await fs.mkdir(path.dirname(markerPath), { recursive: true })
  await fs.writeFile(markerPath, JSON.stringify({ createdAt: Date.now() - 60_000, reason: 'local-photo-trash' }))

  assert.equal(await consumeLocalPhotoTrashHmrSuppressMarker(repoRoot), false)
  await assert.rejects(fs.access(markerPath))
})

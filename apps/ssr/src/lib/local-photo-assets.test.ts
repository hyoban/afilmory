import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { it } from 'vitest'

import { resolveLocalPhotoAssetPath } from './local-photo-assets'

it('resolveLocalPhotoAssetPath resolves encoded paths inside the local photo directory', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'afilmory-assets-'))
  const photosDir = path.join(root, 'photos')
  await fs.mkdir(path.join(photosDir, 'Sony Alpha 6700'), { recursive: true })
  await fs.writeFile(path.join(photosDir, 'Sony Alpha 6700', 'DSC00859.JPG'), 'image')

  assert.equal(
    await resolveLocalPhotoAssetPath(photosDir, '/photos/Sony%20Alpha%206700/DSC00859.JPG'),
    await fs.realpath(path.join(photosDir, 'Sony Alpha 6700', 'DSC00859.JPG')),
  )
})

it('resolveLocalPhotoAssetPath rejects traversal outside the local photo directory', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'afilmory-assets-'))
  const photosDir = path.join(root, 'photos')
  await fs.mkdir(photosDir, { recursive: true })
  await fs.writeFile(path.join(root, 'secret.jpg'), 'secret')

  await assert.rejects(resolveLocalPhotoAssetPath(photosDir, '/photos/../secret.jpg'), /Unsafe local photo path/)
})

import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import type { AfilmoryManifest } from '@afilmory/builder'
import { it } from 'vitest'

import { getRuntimeManifest, getRuntimeManifestScriptContent, resetRuntimeManifestCache } from './runtime-manifest'

it('getRuntimeManifest reads the manifest from AFILMORY_MANIFEST_PATH and refreshes after changes', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'afilmory-manifest-'))
  const manifestPath = path.join(root, 'photos-manifest.json')

  const first = createManifest(['a'])
  await fs.writeFile(manifestPath, JSON.stringify(first))

  const previousManifestPath = process.env.AFILMORY_MANIFEST_PATH
  process.env.AFILMORY_MANIFEST_PATH = manifestPath
  resetRuntimeManifestCache()

  try {
    assert.deepEqual(
      getRuntimeManifest().data.map(photo => photo.id),
      ['a'],
    )
    assert.match(getRuntimeManifestScriptContent(), /window\.__MANIFEST__ = /)

    await new Promise(resolve => setTimeout(resolve, 5))
    await fs.writeFile(manifestPath, JSON.stringify(createManifest(['b'])))

    assert.deepEqual(
      getRuntimeManifest().data.map(photo => photo.id),
      ['b'],
    )
  }
  finally {
    resetRuntimeManifestCache()
    if (previousManifestPath === undefined) {
      delete process.env.AFILMORY_MANIFEST_PATH
    }
    else {
      process.env.AFILMORY_MANIFEST_PATH = previousManifestPath
    }
  }
})

function createManifest(ids: string[]): AfilmoryManifest {
  return {
    version: 'v10',
    cameras: [],
    data: ids.map(id => ({
      id,
      aspectRatio: 1,
      dateTaken: '',
      description: '',
      exif: null,
      format: 'JPG',
      height: 1,
      lastModified: '',
      location: null,
      originalUrl: `/photos/${id}.jpg`,
      s3Key: `${id}.jpg`,
      size: 1,
      tags: [],
      thumbHash: null,
      thumbnailUrl: `/thumbnails/${id}.jpg`,
      title: id,
      toneAnalysis: null,
      width: 1,
    })),
    lenses: [],
  }
}

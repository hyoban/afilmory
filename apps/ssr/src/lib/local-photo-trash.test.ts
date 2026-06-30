import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import type { AfilmoryManifest } from '@afilmory/builder'
import { it } from 'vitest'

import { trashLocalPhoto } from './local-photo-trash'

const fixedDate = new Date('2026-06-30T01:02:03.004Z')

async function createFixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'afilmory-trash-'))
  const basePath = path.join(root, 'photos')
  const manifestPath = path.join(root, 'photos-manifest.json')
  const thumbnailsDir = path.join(root, 'thumbnails')

  await fs.mkdir(path.join(basePath, 'Sony Alpha 6700'), { recursive: true })
  await fs.mkdir(thumbnailsDir, { recursive: true })
  await fs.writeFile(path.join(basePath, 'Sony Alpha 6700', 'DSC00859.JPG'), 'image')
  await fs.writeFile(path.join(basePath, 'Sony Alpha 6700', 'DSC00859.MOV'), 'video')
  await fs.writeFile(path.join(thumbnailsDir, 'DSC00859.jpg'), 'thumb')

  const manifest: AfilmoryManifest = {
    version: 'v10',
    cameras: [
      {
        make: 'SONY',
        model: 'ILCE-6700',
        displayName: 'SONY ILCE-6700',
      },
    ],
    lenses: [
      {
        make: 'SONY',
        model: 'E 18-135mm F3.5-5.6 OSS',
        displayName: 'SONY E 18-135mm F3.5-5.6 OSS',
      },
    ],
    data: [
      {
        id: 'DSC00859',
        format: 'JPG',
        title: 'DSC00859',
        description: '',
        dateTaken: '2026-06-27T07:46:31.829Z',
        tags: ['Sony Alpha 6700'],
        originalUrl: '/photos/Sony Alpha 6700/DSC00859.JPG',
        thumbnailUrl: '/thumbnails/DSC00859.jpg',
        thumbHash: null,
        width: 4128,
        height: 6192,
        aspectRatio: 0.6666666666666666,
        s3Key: 'Sony Alpha 6700/DSC00859.JPG',
        lastModified: '2026-06-27T07:46:31.000Z',
        size: 17806557,
        exif: {
          Make: 'SONY',
          Model: 'ILCE-6700',
          LensMake: 'SONY',
          LensModel: 'E 18-135mm F3.5-5.6 OSS',
        } as any,
        toneAnalysis: null,
        location: null,
        video: {
          type: 'live-photo',
          videoUrl: '/photos/Sony Alpha 6700/DSC00859.MOV',
          s3Key: 'Sony Alpha 6700/DSC00859.MOV',
        },
      },
      {
        id: 'DSC00001',
        format: 'JPG',
        title: 'DSC00001',
        description: '',
        dateTaken: '2026-06-26T00:00:00.000Z',
        tags: [],
        originalUrl: '/photos/DSC00001.JPG',
        thumbnailUrl: '/thumbnails/DSC00001.jpg',
        thumbHash: null,
        width: 1,
        height: 1,
        aspectRatio: 1,
        s3Key: 'DSC00001.JPG',
        lastModified: '2026-06-26T00:00:00.000Z',
        size: 1,
        exif: null,
        toneAnalysis: null,
        location: null,
      },
    ],
  }

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2))

  return { root, basePath, manifestPath, thumbnailsDir }
}

it('trashLocalPhoto moves original, live video, thumbnail, and updates manifest', async () => {
  const fixture = await createFixture()

  const result = await trashLocalPhoto({
    photoId: 'DSC00859',
    localBasePath: fixture.basePath,
    manifestPath: fixture.manifestPath,
    thumbnailsDir: fixture.thumbnailsDir,
    now: () => fixedDate,
  })

  assert.equal(result.photoId, 'DSC00859')
  assert.equal(result.remainingCount, 1)
  assert.equal(result.trashed.length, 2)

  const trashRunDir = path.join(fixture.basePath, '.afilmory-trash', '2026-06-30T01-02-03-004Z')
  assert.equal(await exists(path.join(trashRunDir, 'Sony Alpha 6700', 'DSC00859.JPG')), true)
  assert.equal(await exists(path.join(trashRunDir, 'Sony Alpha 6700', 'DSC00859.MOV')), true)
  assert.equal(await exists(path.join(fixture.basePath, 'Sony Alpha 6700', 'DSC00859.JPG')), false)
  assert.equal(await exists(path.join(fixture.thumbnailsDir, 'DSC00859.jpg')), false)

  const nextManifest = JSON.parse(await fs.readFile(fixture.manifestPath, 'utf8')) as AfilmoryManifest
  assert.deepEqual(
    nextManifest.data.map(item => item.id),
    ['DSC00001'],
  )
  assert.deepEqual(nextManifest.cameras, [])
  assert.deepEqual(nextManifest.lenses, [])
})

it('trashLocalPhoto rejects manifest keys outside the local base path', async () => {
  const fixture = await createFixture()
  const manifest = JSON.parse(await fs.readFile(fixture.manifestPath, 'utf8')) as AfilmoryManifest
  manifest.data[0]!.s3Key = '../DSC00859.JPG'
  await fs.writeFile(fixture.manifestPath, JSON.stringify(manifest, null, 2))

  await assert.rejects(
    trashLocalPhoto({
      photoId: 'DSC00859',
      localBasePath: fixture.basePath,
      manifestPath: fixture.manifestPath,
      thumbnailsDir: fixture.thumbnailsDir,
      now: () => fixedDate,
    }),
    /unsafe/i,
  )
})

it('trashLocalPhoto can preserve generated thumbnails', async () => {
  const fixture = await createFixture()

  await trashLocalPhoto({
    photoId: 'DSC00859',
    localBasePath: fixture.basePath,
    manifestPath: fixture.manifestPath,
    now: () => fixedDate,
    removeThumbnail: false,
    thumbnailsDir: fixture.thumbnailsDir,
  })

  assert.equal(await exists(path.join(fixture.thumbnailsDir, 'DSC00859.jpg')), true)
})

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  }
  catch {
    return false
  }
}

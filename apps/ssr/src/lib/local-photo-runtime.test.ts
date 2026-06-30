import assert from 'node:assert/strict'

import { it } from 'vitest'

import {
  getLocalPhotoRuntimeConfigFromEnv,
  isLocalPhotoTrashEnabledFromEnv,
  resolveLocalPhotoRuntimeConfig,
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

it('resolveLocalPhotoRuntimeConfig returns null for a non-local builder config', async () => {
  const root = await makeRepoRoot(`
import { defineBuilderConfig } from '@afilmory/builder'

export default defineBuilderConfig(() => ({
  storage: {
    provider: 's3',
  },
}))
`)

  await withLocalPhotoRuntimeEnvAsync(
    {
      AFILMORY_LOCAL_PHOTO_TRASH: undefined,
      AFILMORY_LOCAL_PHOTOS_DIR: undefined,
      AFILMORY_MANIFEST_PATH: undefined,
      AFILMORY_THUMBNAILS_DIR: undefined,
    },
    async () => {
      assert.equal(await resolveLocalPhotoRuntimeConfig({ cwd: root }), null)
    },
  )
})

it('resolveLocalPhotoRuntimeConfig resolves local builder config hints once for runtime consumers', async () => {
  const root = await makeRepoRoot(`
import { defineBuilderConfig } from '@afilmory/builder'

export default defineBuilderConfig(() => ({
  storage: {
    provider: 'local',
    basePath: './fixtures/photos',
  },
}))
`)

  await withLocalPhotoRuntimeEnvAsync(
    {
      AFILMORY_LOCAL_PHOTO_TRASH: undefined,
      AFILMORY_LOCAL_PHOTOS_DIR: undefined,
      AFILMORY_MANIFEST_PATH: undefined,
      AFILMORY_THUMBNAILS_DIR: undefined,
    },
    async () => {
      assert.deepEqual(await resolveLocalPhotoRuntimeConfig({ cwd: root }), {
        localBasePath: `${root}/fixtures/photos`,
        manifestPath: `${root}/apps/web/src/data/photos-manifest.json`,
        repoRoot: root,
        source: 'builder',
        thumbnailsDir: `${root}/apps/web/public/thumbnails`,
        trashEnabled: true,
      })
    },
  )
})

async function makeRepoRoot(builderConfig: string): Promise<string> {
  const fs = await import('node:fs/promises')
  const os = await import('node:os')
  const path = await import('node:path')

  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'afilmory-runtime-'))
  await fs.mkdir(path.join(root, 'apps/web/src/data'), { recursive: true })
  await fs.mkdir(path.join(root, 'apps/web/public/thumbnails'), { recursive: true })
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ name: '@afilmory/monorepo' }))
  await fs.writeFile(path.join(root, 'builder.config.ts'), builderConfig)
  return root
}

async function withLocalPhotoRuntimeEnvAsync<T>(
  env: Record<string, string | undefined>,
  fn: () => Promise<T>,
): Promise<T> {
  return await withLocalPhotoRuntimeEnv(env, fn)
}

import assert from 'node:assert/strict'
import fs from 'node:fs'

import { it } from 'vitest'

import { createDockerBuilderConfig } from './docker-builder.config'

it('dockerfile uses the tracked Docker builder config instead of a local ignored builder config', () => {
  const dockerfile = fs.readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8')

  assert.match(dockerfile, /\/app\/scripts\/docker-builder\.config\.ts \/workspace\/builder\.config\.ts/)
  assert.doesNotMatch(dockerfile, /\/app\/builder\.config\.ts \/workspace\/builder\.config\.ts/)
})

it('dockerfile caches package downloads before copying the full source tree', () => {
  const dockerfile = fs.readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8')

  const fetchIndex = dockerfile.indexOf('RUN pnpm fetch --frozen-lockfile')
  const sourceCopyIndex = dockerfile.indexOf('COPY . .')
  const installIndex = dockerfile.indexOf('RUN pnpm install --frozen-lockfile --offline')

  assert.notEqual(fetchIndex, -1)
  assert.notEqual(sourceCopyIndex, -1)
  assert.notEqual(installIndex, -1)
  assert.ok(fetchIndex < sourceCopyIndex)
  assert.ok(sourceCopyIndex < installIndex)
})

it('docker-builder config reads local photo runtime settings from the environment', () => {
  const previousPhotosDir = process.env.AFILMORY_LOCAL_PHOTOS_DIR
  const previousWorkers = process.env.AFILMORY_BUILDER_WORKERS
  const previousCluster = process.env.AFILMORY_BUILDER_CLUSTER

  process.env.AFILMORY_LOCAL_PHOTOS_DIR = '/data/photos-test'
  process.env.AFILMORY_BUILDER_WORKERS = '4'
  process.env.AFILMORY_BUILDER_CLUSTER = 'false'

  try {
    const config = createDockerBuilderConfig()
    assert.deepEqual(config.storage, {
      basePath: '/data/photos-test',
      baseUrl: '/photos',
      excludeRegex: '\\.(tmp|cache|DS_Store|Thumbs\\.db)$',
      provider: 'local',
    })
    assert.equal(config.system?.observability?.performance?.worker?.workerCount, 4)
    assert.equal(config.system?.observability?.performance?.worker?.useClusterMode, false)
  }
  finally {
    restoreEnv('AFILMORY_LOCAL_PHOTOS_DIR', previousPhotosDir)
    restoreEnv('AFILMORY_BUILDER_WORKERS', previousWorkers)
    restoreEnv('AFILMORY_BUILDER_CLUSTER', previousCluster)
  }
})

function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key]
    return
  }

  process.env[key] = value
}

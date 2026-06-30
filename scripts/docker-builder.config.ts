import os from 'node:os'
import process from 'node:process'

import { defineBuilderConfig } from '@afilmory/builder'
import type { BuilderConfigInput } from '@afilmory/builder/types/config.js'

export function createDockerBuilderConfig(): BuilderConfigInput {
  return {
    storage: {
      provider: 'local',
      basePath: process.env.AFILMORY_LOCAL_PHOTOS_DIR || '/data/photos',
      baseUrl: '/photos',
      excludeRegex: process.env.AFILMORY_LOCAL_EXCLUDE_REGEX || '\\.(tmp|cache|DS_Store|Thumbs\\.db)$',
    },
    system: {
      processing: {
        defaultConcurrency: parsePositiveInteger(process.env.AFILMORY_BUILDER_DEFAULT_CONCURRENCY, 10),
        enableLivePhotoDetection: parseBoolean(process.env.AFILMORY_ENABLE_LIVE_PHOTO_DETECTION, true),
        digestSuffixLength: parseNonNegativeInteger(process.env.AFILMORY_DIGEST_SUFFIX_LENGTH, 0),
      },
      observability: {
        showProgress: parseBoolean(process.env.AFILMORY_BUILDER_SHOW_PROGRESS, true),
        showDetailedStats: parseBoolean(process.env.AFILMORY_BUILDER_SHOW_DETAILED_STATS, true),
        logging: {
          verbose: parseBoolean(process.env.AFILMORY_BUILDER_VERBOSE, false),
          level: parseLogLevel(process.env.AFILMORY_BUILDER_LOG_LEVEL),
          outputToFile: false,
        },
        performance: {
          worker: {
            workerCount: parsePositiveInteger(process.env.AFILMORY_BUILDER_WORKERS, os.cpus().length * 2),
            timeout: parsePositiveInteger(process.env.AFILMORY_BUILDER_WORKER_TIMEOUT, 30_000),
            useClusterMode: parseBoolean(process.env.AFILMORY_BUILDER_CLUSTER, true),
            workerConcurrency: parsePositiveInteger(process.env.AFILMORY_BUILDER_WORKER_CONCURRENCY, 2),
          },
        },
      },
    },
    plugins: [],
  }
}

export default defineBuilderConfig(createDockerBuilderConfig)

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null || value.trim() === '') {
    return defaultValue
  }

  return !['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase())
}

function parsePositiveInteger(value: string | undefined, defaultValue: number): number {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : defaultValue
}

function parseNonNegativeInteger(value: string | undefined, defaultValue: number): number {
  const parsed = Number.parseInt(value || '', 10)
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : defaultValue
}

function parseLogLevel(value: string | undefined): 'debug' | 'error' | 'info' | 'warn' {
  if (value === 'debug' || value === 'error' || value === 'info' || value === 'warn') {
    return value
  }

  return 'info'
}

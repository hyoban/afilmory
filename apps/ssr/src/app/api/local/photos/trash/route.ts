import path from 'node:path'
import process from 'node:process'

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import {
  findRepoRoot,
  getLocalPhotoRuntimeConfigFromEnv,
  readBuilderConfigHints,
  resolvePublicPhotosBasePath,
} from '~/lib/local-photo-runtime'
import { LocalPhotoTrashError, trashLocalPhoto } from '~/lib/local-photo-trash'
import { writeLocalPhotoTrashHmrSuppressMarker } from '~/lib/local-photo-trash-hmr'

interface LocalStorageRuntimeConfig {
  repoRoot: string | null
  localBasePath: string
  manifestPath: string
  thumbnailsDir: string
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const photoId = typeof body?.photoId === 'string' ? body.photoId.trim() : ''
  if (!photoId) {
    return NextResponse.json({ error: 'photoId is required' }, { status: 400 })
  }

  let config: LocalStorageRuntimeConfig
  try {
    config = await resolveLocalStorageRuntimeConfig()
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Local storage is unavailable'
    return NextResponse.json({ error: message }, { status: 403 })
  }

  try {
    const result = await trashLocalPhoto({
      photoId,
      beforeWriteManifest: config.repoRoot ? () => writeManifestHmrSuppressMarker(config.repoRoot!) : undefined,
      localBasePath: config.localBasePath,
      manifestPath: config.manifestPath,
      removeThumbnail: false,
      thumbnailsDir: config.thumbnailsDir,
    })
    return NextResponse.json({ data: result })
  }
  catch (error) {
    if (error instanceof LocalPhotoTrashError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: statusForTrashError(error) })
    }

    console.error('Failed to trash local photo:', error)
    return NextResponse.json({ error: 'Failed to trash local photo' }, { status: 500 })
  }
}

async function writeManifestHmrSuppressMarker(repoRoot: string): Promise<void> {
  try {
    await writeLocalPhotoTrashHmrSuppressMarker(repoRoot)
  }
  catch (error) {
    console.warn('Failed to write local photo trash HMR suppress marker:', error)
  }
}

function statusForTrashError(error: LocalPhotoTrashError): number {
  switch (error.code) {
    case 'PHOTO_NOT_FOUND':
    case 'SOURCE_NOT_FOUND': {
      return 404
    }
    case 'UNSAFE_KEY':
    case 'SOURCE_OUTSIDE_BASE':
    case 'TRASH_TARGET_EXISTS': {
      return 400
    }
  }
}

async function resolveLocalStorageRuntimeConfig(): Promise<LocalStorageRuntimeConfig> {
  const envConfig = getLocalPhotoRuntimeConfigFromEnv()
  if (envConfig) {
    if (!envConfig.trashEnabled) {
      throw new Error('Local photo trash is disabled')
    }

    return {
      repoRoot: await findRepoRoot(process.cwd()).catch(() => null),
      localBasePath: envConfig.localBasePath,
      manifestPath: envConfig.manifestPath,
      thumbnailsDir: envConfig.thumbnailsDir,
    }
  }

  const repoRoot = await findRepoRoot(process.cwd())
  const builderConfig = await readBuilderConfigHints(path.join(repoRoot, 'builder.config.ts'))
  const localBasePath = builderConfig.basePath ?? (await resolvePublicPhotosBasePath(repoRoot))

  if (!builderConfig.isLocalProvider && builderConfig.exists) {
    throw new Error('Local photo trash is only available when builder storage provider is local')
  }

  return {
    repoRoot,
    localBasePath,
    manifestPath: path.join(repoRoot, 'apps/web/src/data/photos-manifest.json'),
    thumbnailsDir: path.join(repoRoot, 'apps/web/public/thumbnails'),
  }
}

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { resolveLocalPhotoRuntimeConfig } from '~/lib/local-photo-runtime'
import { LocalPhotoTrashError, trashLocalPhoto } from '~/lib/local-photo-trash'
import { writeLocalPhotoTrashHmrSuppressMarker } from '~/lib/local-photo-trash-hmr'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const photoId = typeof body?.photoId === 'string' ? body.photoId.trim() : ''
  if (!photoId) {
    return NextResponse.json({ error: 'photoId is required' }, { status: 400 })
  }

  const config = await resolveLocalPhotoRuntimeConfig({
    allowPublicPhotosFallback: true,
    requireTrashEnabled: true,
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Local storage is unavailable'
    return NextResponse.json({ error: message }, { status: 403 })
  })

  if (config instanceof NextResponse) {
    return config
  }

  if (!config) {
    return NextResponse.json({ error: 'Local storage is unavailable' }, { status: 403 })
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

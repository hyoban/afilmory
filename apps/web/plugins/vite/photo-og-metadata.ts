import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { PhotoManifestItem } from '@afilmory/typing'
import type { Plugin } from 'vite'

import { renderOgImage } from '../../../../packages/renderer/src/index'
import type { ExifInfo } from '../../../../packages/renderer/src/og/og.template'
import { MANIFEST_PATH, MONOREPO_ROOT_PATH } from './__internal__/constants'

interface SiteMeta {
  title?: string
  name?: string
  description?: string
  url?: string
}

interface ManifestLike {
  data?: PhotoManifestItem[]
}

interface PhotoOgEntry {
  title: string
  description: string
  image: string
  url: string
}

interface PhotoOgPayload {
  version: 1
  site: {
    title: string
    name: string
    description: string
    url: string
  }
  photos: Record<string, PhotoOgEntry>
}

export function photoOgMetadataPlugin(siteMeta: SiteMeta): Plugin {
  return {
    name: 'photo-og-metadata',
    async generateBundle() {
      const manifest = readManifest()
      const site = resolveSite(siteMeta)
      const fonts = await loadFonts()
      const photoEntries = await Promise.all(
        (manifest.data ?? [])
          .filter(photo => photo.id && (photo.ogImageUrl || photo.thumbnailUrl || photo.originalUrl))
          .map(async (photo) => {
            const entry = await createPhotoOgEntry(photo, site, fonts, (fileName, source) => {
              this.emitFile({
                type: 'asset',
                fileName,
                source,
              })
            })

            return [photo.id, entry] as const
          }),
      )
      const photos = Object.fromEntries(photoEntries)

      const payload: PhotoOgPayload = {
        version: 1,
        site,
        photos,
      }

      this.emitFile({
        type: 'asset',
        fileName: 'og-data.json',
        source: `${JSON.stringify(payload)}\n`,
      })
    },
  }
}

function readManifest(): ManifestLike {
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as ManifestLike
  }
  catch (error) {
    console.warn('Failed to build photo OG metadata:', error)
    return { data: [] }
  }
}

function resolveSite(siteMeta: SiteMeta): PhotoOgPayload['site'] {
  const title = siteMeta.title || siteMeta.name || 'Afilmory'
  const name = siteMeta.name || title
  const description = siteMeta.description || ''
  const url = siteMeta.url || ''

  return { title, name, description, url }
}

async function createPhotoOgEntry(
  photo: PhotoManifestItem,
  site: PhotoOgPayload['site'],
  fonts: Awaited<ReturnType<typeof loadFonts>>,
  emitAsset: (fileName: string, source: Uint8Array) => void,
): Promise<PhotoOgEntry> {
  const title = `${photo.title || photo.id} | ${site.title}`
  const description = photo.description || buildExifDescription(photo) || site.description
  const ogImage = await renderPhotoOgImage(photo, site, fonts)

  if (ogImage) {
    const fileName = `og-images/${encodeURIComponent(photo.id)}.png`
    emitAsset(fileName, ogImage)

    return {
      title,
      description,
      image: `/${fileName}`,
      url: `/photos/${encodeURIComponent(photo.id)}`,
    }
  }

  console.warn(`Failed to generate photo OG image for ${photo.id}; falling back to photo asset URL.`)
  return {
    title,
    description,
    image: photo.ogImageUrl || photo.thumbnailUrl || photo.originalUrl,
    url: `/photos/${encodeURIComponent(photo.id)}`,
  }
}

async function renderPhotoOgImage(
  photo: PhotoManifestItem,
  site: PhotoOgPayload['site'],
  fonts: Awaited<ReturnType<typeof loadFonts>>,
): Promise<Uint8Array | null> {
  try {
    return await renderOgImage({
      template: {
        photoTitle: photo.title || photo.id || 'Untitled Photo',
        siteName: site.name,
        tags: (photo.tags ?? []).slice(0, 3),
        formattedDate: formatDate(photo.exif?.DateTimeOriginal ?? photo.lastModified),
        exifInfo: buildExifInfo(photo),
        thumbnailSrc: await resolveThumbnailDataUrl(photo),
        photoDimensions: {
          width: photo.width || 1,
          height: photo.height || 1,
        },
      },
      fonts,
    })
  }
  catch (error) {
    console.warn(`Photo OG render failed for ${photo.id}:`, error)
    return null
  }
}

async function loadFonts() {
  const geist = await readFile(
    path.join(MONOREPO_ROOT_PATH, 'be/apps/core/src/modules/content/og/assets/Geist-Medium.ttf'),
  )
  const harmony = await readFile(
    path.join(MONOREPO_ROOT_PATH, 'be/apps/core/src/modules/content/og/assets/HarmonyOS_Sans_SC_Medium.ttf'),
  )

  return [
    {
      name: 'Geist',
      data: geist,
      style: 'normal' as const,
      weight: 400 as const,
    },
    {
      name: 'HarmonyOS Sans SC',
      data: harmony,
      style: 'normal' as const,
      weight: 400 as const,
    },
  ]
}

async function resolveThumbnailDataUrl(photo: PhotoManifestItem): Promise<string | null> {
  const thumbnailUrl = photo.thumbnailUrl || photo.originalUrl
  if (!thumbnailUrl) {
    return null
  }

  if (/^https?:\/\//i.test(thumbnailUrl)) {
    const response = await fetch(thumbnailUrl)
    if (!response.ok) {
      return null
    }

    const contentType = response.headers.get('content-type') || guessContentType(thumbnailUrl)
    const buffer = Buffer.from(await response.arrayBuffer())
    return bufferToDataUrl(buffer, contentType)
  }

  const localPath = path.join(MONOREPO_ROOT_PATH, 'apps/web/public', thumbnailUrl.replace(/^\/+/, ''))
  const buffer = await readFile(localPath)
  return bufferToDataUrl(buffer, guessContentType(thumbnailUrl))
}

function buildExifInfo(photo: PhotoManifestItem): ExifInfo | null {
  const { exif } = photo
  if (!exif) {
    return null
  }

  const focalLength = exif.FocalLengthIn35mmFormat || exif.FocalLength
  const aperture = exif.FNumber ? `f/${exif.FNumber}` : null
  const iso = exif.ISO ?? null
  const shutterSpeed = exif.ExposureTime ? `${exif.ExposureTime}s` : null
  const camera
    = exif.Make && exif.Model ? `${exif.Make.trim()} ${exif.Model.trim()}`.trim() : (exif.Model ?? exif.Make ?? null)

  if (!focalLength && !aperture && !iso && !shutterSpeed && !camera) {
    return null
  }

  return {
    focalLength: focalLength ?? null,
    aperture,
    iso,
    shutterSpeed,
    camera,
  }
}

function buildExifDescription(photo: PhotoManifestItem): string {
  const { exif } = photo
  if (!exif) {
    return ''
  }

  const camera
    = exif.Make && exif.Model ? `${exif.Make.trim()} ${exif.Model.trim()}`.trim() : (exif.Model ?? exif.Make ?? '')
  const focalLength = normalizeFocalLength(exif.FocalLengthIn35mmFormat || exif.FocalLength)
  const aperture = exif.FNumber ? `f/${exif.FNumber}` : ''
  const shutterSpeed = exif.ExposureTime ? `${exif.ExposureTime}s` : ''
  const iso = exif.ISO ? `ISO ${exif.ISO}` : ''

  return [camera, focalLength, aperture, shutterSpeed, iso].filter(Boolean).join(' · ')
}

function normalizeFocalLength(value?: string | number | null): string {
  if (!value) {
    return ''
  }
  const text = String(value).trim()
  if (!text) {
    return ''
  }
  return text.replace(/\s*mm$/i, 'mm')
}

function formatDate(input?: string | null): string | undefined {
  if (!input) {
    return undefined
  }

  const timestamp = Date.parse(input)
  if (Number.isNaN(timestamp)) {
    return undefined
  }

  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function bufferToDataUrl(buffer: Buffer, contentType: string): string {
  return `data:${contentType};base64,${buffer.toString('base64')}`
}

function guessContentType(url: string): string {
  const lowered = url.toLowerCase()
  if (lowered.endsWith('.png')) {
    return 'image/png'
  }
  if (lowered.endsWith('.webp')) {
    return 'image/webp'
  }
  return 'image/jpeg'
}

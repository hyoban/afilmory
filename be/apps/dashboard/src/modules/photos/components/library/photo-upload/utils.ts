import { getStorageNS } from '~/lib/ns'

import type { PhotoSyncProgressStage, PhotoSyncStageTotals } from '../../../types'
import { STAGE_ORDER } from './constants'
import type { FileProgressEntry, PreviewCache, ProcessingStageState } from './types'

const RECENT_TAGS_STORAGE_KEY = getStorageNS('photo-upload-recent-tags')
const RECENT_TAGS_LIMIT = 8

const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'tiff',
  'tif',
  'heic',
  'heif',
  'hif',
  'avif',
  'raw',
  'dng',
])

const isMovFile = (name: string) => name.toLowerCase().endsWith('.mov')

const getFileExtension = (name: string) => {
  const normalized = name.toLowerCase()
  const lastDotIndex = normalized.lastIndexOf('.')
  return lastDotIndex === -1 ? '' : normalized.slice(lastDotIndex + 1)
}

const getBaseName = (name: string) => {
  const normalized = name.toLowerCase()
  const lastDotIndex = normalized.lastIndexOf('.')
  return lastDotIndex === -1 ? normalized : normalized.slice(0, lastDotIndex)
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '未知大小'
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const size = bytes / 1024 ** exponent
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[exponent]}`
}

const PREVIEW_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/avif',
])

const PREVIEW_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'avif'])

const PREVIEW_SIZE_LIMIT_BYTES = 50 * 1024 * 1024

export function entryFingerprint(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`
}

export function shouldGeneratePreview(file: File): boolean {
  if (file.size > PREVIEW_SIZE_LIMIT_BYTES) {
    return false
  }
  const mime = file.type?.toLowerCase() ?? ''
  if (mime) {
    return PREVIEW_MIME_TYPES.has(mime)
  }
  return PREVIEW_EXTENSIONS.has(getFileExtension(file.name))
}

export function revokePreviewUrls(cache: PreviewCache, fingerprintsToRevoke?: string[]): void {
  if (fingerprintsToRevoke === undefined) {
    cache.forEach((url) => {
      if (url !== null) {
        URL.revokeObjectURL(url)
      }
    })
    cache.clear()
    return
  }

  for (const fp of fingerprintsToRevoke) {
    const url = cache.get(fp)
    if (url) {
      URL.revokeObjectURL(url)
    }
    cache.delete(fp)
  }
}

export function primePreviewCache(files: File[], cache: PreviewCache): void {
  for (const file of files) {
    const fp = entryFingerprint(file)
    if (cache.has(fp)) {
      continue
    }
    cache.set(fp, shouldGeneratePreview(file) ? URL.createObjectURL(file) : null)
  }
}

export function createFileEntries(files: File[], cache: PreviewCache): FileProgressEntry[] {
  return files.map((file, index) => {
    const id = entryFingerprint(file)
    return {
      index,
      id,
      name: file.name,
      size: file.size,
      status: 'pending',
      uploadedBytes: 0,
      progress: 0,
      previewUrl: cache.get(id) ?? null,
    }
  })
}

export function normalizeStageCount(value: number | null | undefined, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value
  }
  return fallback
}

export function createStageStateFromTotals(
  totals: PhotoSyncStageTotals,
): Record<PhotoSyncProgressStage, ProcessingStageState> {
  return STAGE_ORDER.reduce<Record<PhotoSyncProgressStage, ProcessingStageState>>(
    (acc, stage) => {
      const total = normalizeStageCount(totals?.[stage], 0)
      acc[stage] = {
        status: total === 0 ? 'completed' : 'pending',
        processed: 0,
        total,
      }
      return acc
    },
    {} as Record<PhotoSyncProgressStage, ProcessingStageState>,
  )
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message
  }
  if (typeof error === 'object' && error && 'message' in error) {
    const candidate = (error as { message?: unknown }).message
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate
    }
  }
  return fallback
}

export function createFileList(fileArray: File[]): FileList {
  if (typeof DataTransfer !== 'undefined') {
    const transfer = new DataTransfer()
    fileArray.forEach(file => transfer.items.add(file))
    return transfer.files
  }

  const fallback: Record<number, File> & { length: number, item: (index: number) => File | null } = {
    length: fileArray.length,
    item: (index: number) => fileArray[index] ?? null,
  }

  fileArray.forEach((file, index) => {
    fallback[index] = file
  })

  return fallback as unknown as FileList
}

export function sanitizeTagSegment(tag: string): string {
  if (typeof tag !== 'string') {
    return ''
  }
  const normalized = tag
    .normalize('NFKC')
    .trim()
    .replaceAll(/[\\/]+/g, '-')
    .replaceAll(/\s+/g, '-')
    .replaceAll(/[^\w\u00A0-\uFFFF.-]/g, '-')
    .replaceAll(/-+/g, '-')
    .replaceAll(/^-+|-+$/g, '')
  return normalized
}

export function deriveDirectoryFromTags(tags: string[]): string | null {
  if (!Array.isArray(tags) || tags.length === 0) {
    return null
  }
  const segments = tags.map(element => sanitizeTagSegment(element)).filter(segment => segment.length > 0)

  if (segments.length === 0) {
    return null
  }

  return segments.join('/')
}

export function collectUnmatchedMovFiles(files: File[]) {
  const imageBaseNames = new Set(
    files.filter(file => IMAGE_EXTENSIONS.has(getFileExtension(file.name))).map(file => getBaseName(file.name)),
  )

  const unmatched = files.filter(file => isMovFile(file.name) && !imageBaseNames.has(getBaseName(file.name)))

  return {
    unmatched,
    hasMov: files.some(file => isMovFile(file.name)),
  }
}

export function calculateTotalSize(files: File[]): number {
  return files.reduce((sum, file) => sum + file.size, 0)
}

export function calculateUploadedBytes(entries: FileProgressEntry[]): number {
  return entries.reduce((sum, entry) => sum + Math.min(entry.uploadedBytes, entry.size), 0)
}

export function readRecentTags(): string[] {
  if (typeof localStorage === 'undefined') {
    return []
  }
  try {
    const raw = localStorage.getItem(RECENT_TAGS_STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    const seen = new Set<string>()
    const result: string[] = []
    for (const item of parsed) {
      if (typeof item !== 'string') {
        continue
      }
      const normalized = item.trim().toLowerCase()
      if (!normalized || seen.has(normalized)) {
        continue
      }
      seen.add(normalized)
      result.push(normalized)
      if (result.length >= RECENT_TAGS_LIMIT) {
        break
      }
    }
    return result
  }
  catch {
    return []
  }
}

export function rememberRecentTags(tags: string[]): void {
  if (typeof localStorage === 'undefined' || !Array.isArray(tags) || tags.length === 0) {
    return
  }
  const incoming: string[] = []
  const seen = new Set<string>()
  for (const tag of tags) {
    if (typeof tag !== 'string') {
      continue
    }
    const normalized = tag.trim().toLowerCase()
    if (!normalized || seen.has(normalized)) {
      continue
    }
    seen.add(normalized)
    incoming.push(normalized)
  }
  if (incoming.length === 0) {
    return
  }
  const existing = readRecentTags().filter(tag => !seen.has(tag))
  const next = [...incoming, ...existing].slice(0, RECENT_TAGS_LIMIT)
  try {
    localStorage.setItem(RECENT_TAGS_STORAGE_KEY, JSON.stringify(next))
  }
  catch {
    // ignore quota errors
  }
}

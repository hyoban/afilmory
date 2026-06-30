import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import type { AfilmoryManifest, CameraInfo, LensInfo, PhotoManifestItem } from '@afilmory/builder'
import { isPathInside } from '@afilmory/utils/path-safety'

export interface TrashLocalPhotoOptions {
  photoId: string
  localBasePath: string
  manifestPath: string
  thumbnailsDir: string
  beforeWriteManifest?: () => Promise<void>
  now?: () => Date
  removeThumbnail?: boolean
}

export interface TrashedFile {
  key: string
  from: string
  to: string
}

export interface TrashLocalPhotoResult {
  photoId: string
  remainingCount: number
  trashed: TrashedFile[]
}

interface PlannedMove {
  key: string
  from: string
  to: string
}

const manifestMutationQueues = new Map<string, Promise<unknown>>()

export async function trashLocalPhoto(options: TrashLocalPhotoOptions): Promise<TrashLocalPhotoResult> {
  return await runManifestMutation(options.manifestPath, () => trashLocalPhotoUnlocked(options))
}

async function trashLocalPhotoUnlocked(options: TrashLocalPhotoOptions): Promise<TrashLocalPhotoResult> {
  const manifest = await readManifest(options.manifestPath)
  const target = manifest.data.find(item => item.id === options.photoId)
  if (!target) {
    throw new LocalPhotoTrashError('PHOTO_NOT_FOUND', `Photo not found: ${options.photoId}`)
  }

  const realBasePath = await fs.realpath(options.localBasePath)
  const timestamp = formatTrashTimestamp(options.now?.() ?? new Date())
  const trashRoot = path.join(realBasePath, '.afilmory-trash')
  const runTrashRoot = path.join(trashRoot, timestamp)
  const moves = await planMoves({
    photo: target,
    realBasePath,
    runTrashRoot,
  })

  const nextManifest = removePhotoFromManifest(manifest, target.id)
  const moved: PlannedMove[] = []

  try {
    for (const move of moves) {
      await fs.mkdir(path.dirname(move.to), { recursive: true })
      await ensureMissing(move.to)
      await fs.rename(move.from, move.to)
      moved.push(move)
    }

    await options.beforeWriteManifest?.()
    await writeManifest(options.manifestPath, nextManifest)
  }
  catch (error) {
    await rollbackMoves(moved)
    throw error
  }

  if (options.removeThumbnail !== false) {
    await fs.rm(path.join(options.thumbnailsDir, `${target.id}.jpg`), { force: true })
  }

  return {
    photoId: target.id,
    remainingCount: nextManifest.data.length,
    trashed: moves.map(({ key, from, to }) => ({ key, from, to })),
  }
}

export class LocalPhotoTrashError extends Error {
  constructor(
    public readonly code:
      | 'PHOTO_NOT_FOUND'
      | 'UNSAFE_KEY'
      | 'SOURCE_NOT_FOUND'
      | 'SOURCE_OUTSIDE_BASE'
      | 'TRASH_TARGET_EXISTS',
    message: string,
  ) {
    super(message)
    this.name = 'LocalPhotoTrashError'
  }
}

async function readManifest(manifestPath: string): Promise<AfilmoryManifest> {
  return JSON.parse(await fs.readFile(manifestPath, 'utf8')) as AfilmoryManifest
}

async function writeManifest(manifestPath: string, manifest: AfilmoryManifest): Promise<void> {
  const tempPath = `${manifestPath}.tmp-${process.pid}-${Date.now()}-${randomUUID()}`
  await fs.writeFile(tempPath, `${JSON.stringify(manifest, null, 2)}\n`)
  await fs.rename(tempPath, manifestPath)
}

async function runManifestMutation<T>(manifestPath: string, task: () => Promise<T>): Promise<T> {
  const queueKey = path.resolve(manifestPath)
  const previous = manifestMutationQueues.get(queueKey) ?? Promise.resolve()
  const current = previous.catch(() => undefined).then(task)
  manifestMutationQueues.set(queueKey, current)

  try {
    return await current
  }
  finally {
    if (manifestMutationQueues.get(queueKey) === current) {
      manifestMutationQueues.delete(queueKey)
    }
  }
}

async function planMoves({
  photo,
  realBasePath,
  runTrashRoot,
}: {
  photo: PhotoManifestItem
  realBasePath: string
  runTrashRoot: string
}): Promise<PlannedMove[]> {
  const keys = [photo.s3Key]
  if (photo.video?.type === 'live-photo') {
    keys.push(photo.video.s3Key)
  }

  const moves: PlannedMove[] = []
  for (const rawKey of keys) {
    const key = normalizeManifestKey(rawKey)
    const from = path.join(realBasePath, ...key.split('/'))
    const realSource = await resolveExistingFileInsideBase(realBasePath, from)
    const to = path.join(runTrashRoot, ...key.split('/'))

    if (!isPathInside(runTrashRoot, to)) {
      throw new LocalPhotoTrashError('UNSAFE_KEY', `Unsafe trash target: ${rawKey}`)
    }

    moves.push({
      key,
      from: realSource,
      to,
    })
  }

  return moves
}

function removePhotoFromManifest(manifest: AfilmoryManifest, photoId: string): AfilmoryManifest {
  const data = manifest.data.filter(item => item.id !== photoId)
  return {
    ...manifest,
    data,
    cameras: buildCameraCollection(data),
    lenses: buildLensCollection(data),
  }
}

function normalizeManifestKey(rawKey: string): string {
  const normalized = rawKey.replaceAll('\\', '/').replace(/^\/+/, '')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length === 0 || path.isAbsolute(rawKey) || path.isAbsolute(normalized)) {
    throw new LocalPhotoTrashError('UNSAFE_KEY', `Unsafe photo key: ${rawKey}`)
  }

  if (parts.some(part => part === '.' || part === '..')) {
    throw new LocalPhotoTrashError('UNSAFE_KEY', `Unsafe photo key: ${rawKey}`)
  }

  return parts.join('/')
}

async function resolveExistingFileInsideBase(realBasePath: string, candidate: string): Promise<string> {
  let realSource: string
  try {
    realSource = await fs.realpath(candidate)
  }
  catch {
    throw new LocalPhotoTrashError('SOURCE_NOT_FOUND', `Source file not found: ${candidate}`)
  }

  if (!isPathInside(realBasePath, realSource)) {
    throw new LocalPhotoTrashError('SOURCE_OUTSIDE_BASE', `Source file is outside local base path: ${candidate}`)
  }

  return realSource
}

async function ensureMissing(filePath: string): Promise<void> {
  try {
    await fs.access(filePath)
  }
  catch {
    return
  }
  throw new LocalPhotoTrashError('TRASH_TARGET_EXISTS', `Trash target already exists: ${filePath}`)
}

async function rollbackMoves(moved: PlannedMove[]): Promise<void> {
  for (const move of moved.toReversed()) {
    try {
      await fs.mkdir(path.dirname(move.from), { recursive: true })
      await fs.rename(move.to, move.from)
    }
    catch {
      // Best-effort rollback. Preserve the original failure for the caller.
    }
  }
}

function formatTrashTimestamp(date: Date): string {
  return date.toISOString().replaceAll(':', '-').replaceAll('.', '-')
}

function buildCameraCollection(items: PhotoManifestItem[]): CameraInfo[] {
  const cameraMap = new Map<string, CameraInfo>()
  for (const photo of items) {
    if (!photo.exif?.Make || !photo.exif?.Model) {
      continue
    }

    const make = photo.exif.Make.trim()
    const model = photo.exif.Model.trim()
    const displayName = `${make} ${model}`
    if (!cameraMap.has(displayName)) {
      cameraMap.set(displayName, { make, model, displayName })
    }
  }
  return Array.from(cameraMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName))
}

function buildLensCollection(items: PhotoManifestItem[]): LensInfo[] {
  const lensMap = new Map<string, LensInfo>()
  for (const photo of items) {
    if (!photo.exif?.LensModel) {
      continue
    }

    const model = photo.exif.LensModel.trim()
    const make = photo.exif.LensMake?.trim()
    const displayName = make ? `${make} ${model}` : model
    if (!lensMap.has(displayName)) {
      lensMap.set(displayName, { make, model, displayName })
    }
  }
  return Array.from(lensMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName))
}

import fsSync from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'

import { detectMediaContentType } from '@afilmory/utils/media-signature'
import { isPathInside } from '@afilmory/utils/path-safety'
import type { NextRequest } from 'next/server'

export class LocalPhotoAssetError extends Error {
  constructor(
    public readonly code: 'INVALID_PATH' | 'NOT_FOUND' | 'OUTSIDE_BASE',
    message: string,
  ) {
    super(message)
    this.name = 'LocalPhotoAssetError'
  }
}

export async function resolveLocalPhotoAssetPath(localBasePath: string, pathname: string): Promise<string> {
  const relativePath = decodePhotoPath(pathname)
  const realBasePath = await fs.realpath(localBasePath)
  const candidate = path.join(realBasePath, ...relativePath.split('/'))

  let realFilePath: string
  try {
    realFilePath = await fs.realpath(candidate)
  }
  catch {
    throw new LocalPhotoAssetError('NOT_FOUND', `Local photo asset not found: ${relativePath}`)
  }

  if (!isPathInside(realBasePath, realFilePath)) {
    throw new LocalPhotoAssetError('OUTSIDE_BASE', `Unsafe local photo path: ${relativePath}`)
  }

  const stat = await fs.stat(realFilePath)
  if (!stat.isFile()) {
    throw new LocalPhotoAssetError('NOT_FOUND', `Local photo asset not found: ${relativePath}`)
  }

  return realFilePath
}

export async function serveLocalPhotoAsset(request: NextRequest, localBasePath: string): Promise<Response> {
  let filePath: string
  try {
    filePath = await resolveLocalPhotoAssetPath(localBasePath, request.nextUrl.pathname)
  }
  catch (error) {
    if (error instanceof LocalPhotoAssetError) {
      return new Response(null, { status: error.code === 'INVALID_PATH' ? 400 : 404 })
    }
    throw error
  }

  const stat = await fs.stat(filePath)
  const range = request.headers.get('range')
  const contentType = getLocalPhotoContentType(filePath, await readContentProbe(filePath))
  const baseHeaders = {
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Type': contentType,
  }

  if (range) {
    const parsedRange = parseRange(range, stat.size)
    if (!parsedRange) {
      return new Response(null, {
        headers: {
          ...baseHeaders,
          'Content-Range': `bytes */${stat.size}`,
        },
        status: 416,
      })
    }

    const stream = fsSync.createReadStream(filePath, { start: parsedRange.start, end: parsedRange.end })
    return new Response(Readable.toWeb(stream) as BodyInit, {
      headers: {
        ...baseHeaders,
        'Content-Length': String(parsedRange.end - parsedRange.start + 1),
        'Content-Range': `bytes ${parsedRange.start}-${parsedRange.end}/${stat.size}`,
      },
      status: 206,
    })
  }

  const stream = fsSync.createReadStream(filePath)
  return new Response(Readable.toWeb(stream) as BodyInit, {
    headers: {
      ...baseHeaders,
      'Content-Length': String(stat.size),
    },
  })
}

export function getLocalPhotoContentType(filePath: string, buffer?: Uint8Array | null): string {
  return detectMediaContentType(filePath, buffer)
}

function decodePhotoPath(pathname: string): string {
  if (!pathname.startsWith('/photos/')) {
    throw new LocalPhotoAssetError('INVALID_PATH', `Invalid local photo path: ${pathname}`)
  }

  let decoded: string
  try {
    decoded = decodeURIComponent(pathname.slice('/photos/'.length))
  }
  catch {
    throw new LocalPhotoAssetError('INVALID_PATH', `Invalid local photo path: ${pathname}`)
  }

  const normalized = decoded.replaceAll('\\', '/').replace(/^\/+/, '')
  const parts = normalized.split('/').filter(Boolean)
  if (parts.length === 0 || path.isAbsolute(decoded) || parts.some(part => part === '.' || part === '..')) {
    throw new LocalPhotoAssetError('INVALID_PATH', `Unsafe local photo path: ${decoded}`)
  }

  return parts.join('/')
}

async function readContentProbe(filePath: string): Promise<Uint8Array | null> {
  let handle: fs.FileHandle | null = null
  try {
    handle = await fs.open(filePath, 'r')
    const buffer = new Uint8Array(64)
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
    return buffer.subarray(0, bytesRead)
  }
  catch {
    return null
  }
  finally {
    await handle?.close()
  }
}

function parseRange(range: string, fileSize: number): { start: number, end: number } | null {
  const match = range.match(/^bytes=(\d*)-(\d*)$/)
  if (!match) {
    return null
  }

  const [, rawStart, rawEnd] = match
  if (!rawStart && !rawEnd) {
    return null
  }

  if (!rawStart) {
    const suffixLength = Number(rawEnd)
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
      return null
    }
    const start = Math.max(0, fileSize - suffixLength)
    return { start, end: fileSize - 1 }
  }

  const start = Number(rawStart)
  const end = rawEnd ? Number(rawEnd) : fileSize - 1
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= fileSize) {
    return null
  }

  return { start, end: Math.min(end, fileSize - 1) }
}

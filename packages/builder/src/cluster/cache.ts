import { Buffer } from 'node:buffer'
import fs from 'node:fs'
import path from 'node:path'

export interface CacheEntry {
  thumbnailPath: string
  mtime: number
  size: number
  embedding: string
}

export interface EmbeddingCache {
  model: string
  dim: number
  entries: Record<string, CacheEntry>
}

export function loadCache(file: string): EmbeddingCache | null {
  if (!fs.existsSync(file)) {
    return null
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as EmbeddingCache
  }
  catch {
    return null
  }
}

export function emptyCache(model: string, dim: number): EmbeddingCache {
  return { model, dim, entries: {} }
}

export function saveCache(file: string, cache: EmbeddingCache): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  const tmp = `${file}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(cache))
  fs.renameSync(tmp, file)
}

export function decodeEntry(entry: CacheEntry): Float32Array {
  const buf = Buffer.from(entry.embedding, 'base64')
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4).slice()
}

export function encodeEntry(thumbnailPath: string, mtime: number, size: number, embedding: Float32Array): CacheEntry {
  const buf = Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength)
  return {
    thumbnailPath,
    mtime,
    size,
    embedding: buf.toString('base64'),
  }
}

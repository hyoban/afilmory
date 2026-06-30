import path from 'node:path'

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heis', 'hevm'])
const AVIF_BRANDS = new Set(['avif', 'avis'])

export function isHeicLikeBuffer(buffer: Uint8Array): boolean {
  return hasIsoBaseMediaBrand(buffer, HEIC_BRANDS)
}

export function detectMediaContentType(filePath: string, buffer?: Uint8Array | null): string {
  if (buffer && buffer.length > 0) {
    const detected = detectMediaContentTypeFromBuffer(buffer)
    if (detected) {
      return detected
    }
  }

  return detectMediaContentTypeFromExtension(filePath)
}

function detectMediaContentTypeFromBuffer(buffer: Uint8Array): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return 'image/jpeg'
  }

  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4E
    && buffer[3] === 0x47
    && buffer[4] === 0x0D
    && buffer[5] === 0x0A
    && buffer[6] === 0x1A
    && buffer[7] === 0x0A
  ) {
    return 'image/png'
  }

  if (startsWithAscii(buffer, 0, 'GIF87a') || startsWithAscii(buffer, 0, 'GIF89a')) {
    return 'image/gif'
  }

  if (startsWithAscii(buffer, 0, 'RIFF') && startsWithAscii(buffer, 8, 'WEBP')) {
    return 'image/webp'
  }

  if (isHeicLikeBuffer(buffer)) {
    return 'image/heif'
  }

  if (hasIsoBaseMediaBrand(buffer, AVIF_BRANDS)) {
    return 'image/avif'
  }

  if (
    (startsWithAscii(buffer, 0, 'II') && buffer[2] === 0x2A && buffer[3] === 0x00)
    || (startsWithAscii(buffer, 0, 'MM') && buffer[2] === 0x00 && buffer[3] === 0x2A)
  ) {
    return 'image/tiff'
  }

  return null
}

function detectMediaContentTypeFromExtension(filePath: string): string {
  switch (path.extname(filePath).toLowerCase()) {
    case '.avif': {
      return 'image/avif'
    }
    case '.gif': {
      return 'image/gif'
    }
    case '.heic':
    case '.heif':
    case '.hif': {
      return 'image/heif'
    }
    case '.jpg':
    case '.jpeg': {
      return 'image/jpeg'
    }
    case '.mov': {
      return 'video/quicktime'
    }
    case '.mp4': {
      return 'video/mp4'
    }
    case '.png': {
      return 'image/png'
    }
    case '.tif':
    case '.tiff': {
      return 'image/tiff'
    }
    case '.webp': {
      return 'image/webp'
    }
    default: {
      return 'application/octet-stream'
    }
  }
}

function hasIsoBaseMediaBrand(buffer: Uint8Array, brands: ReadonlySet<string>): boolean {
  if (buffer.length < 12 || !startsWithAscii(buffer, 4, 'ftyp')) {
    return false
  }

  const end = Math.min(buffer.length, 64)
  for (let index = 8; index <= end - 4; index += 4) {
    if (brands.has(readAscii(buffer, index, index + 4))) {
      return true
    }
  }

  return false
}

function startsWithAscii(buffer: Uint8Array, offset: number, value: string): boolean {
  if (buffer.length < offset + value.length) {
    return false
  }

  return readAscii(buffer, offset, offset + value.length) === value
}

function readAscii(buffer: Uint8Array, start: number, end: number): string {
  let value = ''
  for (let index = start; index < end; index++) {
    value += String.fromCharCode(buffer[index] ?? 0)
  }
  return value
}

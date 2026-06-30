import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

export interface LocalPhotoRuntimeConfig {
  localBasePath: string
  manifestPath: string
  source: 'env' | 'builder'
  thumbnailsDir: string
  trashEnabled: boolean
}

const envKeys = [
  'AFILMORY_LOCAL_PHOTO_TRASH',
  'AFILMORY_LOCAL_PHOTOS_DIR',
  'AFILMORY_MANIFEST_PATH',
  'AFILMORY_THUMBNAILS_DIR',
] as const

export function getLocalPhotoRuntimeConfigFromEnv(): LocalPhotoRuntimeConfig | null {
  const localBasePath = process.env.AFILMORY_LOCAL_PHOTOS_DIR?.trim()
  const manifestPath = process.env.AFILMORY_MANIFEST_PATH?.trim()
  const thumbnailsDir = process.env.AFILMORY_THUMBNAILS_DIR?.trim()

  if (!localBasePath || !manifestPath || !thumbnailsDir) {
    return null
  }

  return {
    localBasePath,
    manifestPath,
    source: 'env',
    thumbnailsDir,
    trashEnabled: parseEnvBoolean(process.env.AFILMORY_LOCAL_PHOTO_TRASH, true),
  }
}

export function isLocalPhotoTrashEnabledFromEnv(): boolean {
  return getLocalPhotoRuntimeConfigFromEnv()?.trashEnabled ?? false
}

export function withLocalPhotoRuntimeEnv<T>(env: Record<string, string | undefined>, fn: () => T): T {
  const previous = new Map<string, string | undefined>()
  for (const key of envKeys) {
    previous.set(key, process.env[key])
  }

  try {
    for (const key of envKeys) {
      const value = env[key]
      if (value === undefined) {
        delete process.env[key]
      }
      else {
        process.env[key] = value
      }
    }
    return fn()
  }
  finally {
    for (const key of envKeys) {
      const value = previous.get(key)
      if (value === undefined) {
        delete process.env[key]
      }
      else {
        process.env[key] = value
      }
    }
  }
}

export async function findRepoRoot(start: string): Promise<string> {
  let current = path.resolve(start)

  while (true) {
    const packageJsonPath = path.join(current, 'package.json')
    try {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8')) as { name?: string }
      if (packageJson.name === '@afilmory/monorepo') {
        return current
      }
    }
    catch {
      // keep walking upward
    }

    const parent = path.dirname(current)
    if (parent === current) {
      throw new Error('Unable to locate Afilmory repository root')
    }
    current = parent
  }
}

export async function readBuilderConfigHints(configPath: string): Promise<{
  exists: boolean
  isLocalProvider: boolean
  basePath: string | null
}> {
  let content: string
  try {
    content = await fs.readFile(configPath, 'utf8')
  }
  catch {
    return { exists: false, isLocalProvider: false, basePath: null }
  }

  const isLocalProvider = /provider\s*:\s*['"]local['"]/.test(content)
  const basePathMatch = content.match(/basePath\s*:\s*['"]([^'"]+)['"]/)
  const rawBasePath = basePathMatch?.[1]?.trim()
  const repoRoot = path.dirname(configPath)

  return {
    exists: true,
    isLocalProvider,
    basePath: rawBasePath ? (path.isAbsolute(rawBasePath) ? rawBasePath : path.resolve(repoRoot, rawBasePath)) : null,
  }
}

export async function resolvePublicPhotosBasePath(repoRoot: string): Promise<string> {
  const publicPhotosPath = path.join(repoRoot, 'apps/web/public/photos')
  try {
    return await fs.realpath(publicPhotosPath)
  }
  catch {
    throw new Error('Local photo base path is not configured')
  }
}

function parseEnvBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value == null || value.trim() === '') {
    return defaultValue
  }

  return !['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase())
}

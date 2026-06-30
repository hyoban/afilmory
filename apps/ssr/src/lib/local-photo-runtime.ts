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

export interface ResolvedLocalPhotoRuntimeConfig extends LocalPhotoRuntimeConfig {
  repoRoot: string | null
}

export interface ResolveLocalPhotoRuntimeConfigOptions {
  allowPublicPhotosFallback?: boolean
  cwd?: string
  requireTrashEnabled?: boolean
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

  const restore = () => {
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
    const result = fn()
    if (isPromiseLike(result)) {
      return result.finally(restore) as T
    }

    restore()
    return result
  }
  catch (error) {
    restore()
    throw error
  }
}

export async function resolveLocalPhotoRuntimeConfig(
  options: ResolveLocalPhotoRuntimeConfigOptions = {},
): Promise<ResolvedLocalPhotoRuntimeConfig | null> {
  const cwd = options.cwd ?? process.cwd()
  const envConfig = getLocalPhotoRuntimeConfigFromEnv()
  if (envConfig) {
    if (options.requireTrashEnabled && !envConfig.trashEnabled) {
      throw new Error('Local photo trash is disabled')
    }

    return {
      ...envConfig,
      repoRoot: await findRepoRoot(cwd).catch(() => null),
    }
  }

  let repoRoot: string
  try {
    repoRoot = await findRepoRoot(cwd)
  }
  catch {
    if (options.requireTrashEnabled) {
      throw new Error('Local photo runtime is unavailable')
    }
    return null
  }

  const builderConfig = await readBuilderConfigHints(path.join(repoRoot, 'builder.config.ts'))
  if (builderConfig.exists && !builderConfig.isLocalProvider) {
    if (options.requireTrashEnabled) {
      throw new Error('Local photo trash is only available when builder storage provider is local')
    }
    return null
  }

  if (!builderConfig.exists && !options.allowPublicPhotosFallback) {
    return null
  }

  const localBasePath = builderConfig.basePath ?? (await resolvePublicPhotosBasePath(repoRoot))
  return {
    localBasePath,
    manifestPath: path.join(repoRoot, 'apps/web/src/data/photos-manifest.json'),
    repoRoot,
    source: 'builder',
    thumbnailsDir: path.join(repoRoot, 'apps/web/public/thumbnails'),
    trashEnabled: true,
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
  const rawBasePath = readBuilderConfigStringProperty(content, 'basePath')
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

function readBuilderConfigStringProperty(content: string, propertyName: string): string | null {
  const directMatch = content.match(new RegExp(`${propertyName}\\s*:\\s*['"]([^'"]+)['"]`))
  const envFallbackMatch = content.match(
    new RegExp(`${propertyName}\\s*:\\s*process\\.env\\.[A-Z0-9_]+\\s*(?:\\|\\||\\?\\?)\\s*['"]([^'"]+)['"]`),
  )
  return (directMatch?.[1] ?? envFallbackMatch?.[1] ?? null)?.trim() || null
}

function isPromiseLike<T>(value: T | PromiseLike<T>): value is Promise<T> {
  return Boolean(value && typeof (value as PromiseLike<T>).then === 'function')
}

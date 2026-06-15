import { execFile } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { builtinModules, createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import swc from 'unplugin-swc'
import { defineConfig } from 'vite'
import { analyzer } from 'vite-bundle-analyzer'
import tsconfigPaths from 'vite-tsconfig-paths'

const NODE_BUILT_IN_MODULES = builtinModules.filter(m => !m.startsWith('_'))
NODE_BUILT_IN_MODULES.push(...NODE_BUILT_IN_MODULES.map(m => `node:${m}`))

const __dirname = dirname(fileURLToPath(import.meta.url))

const external = ['sharp', 'nodejs-snowflake', 'ioredis', 'pg-native', 'heic-convert', 'satori', '@resvg/resvg-js']
const buildOnlyExternal = ['fsevents']
const execFileAsync = promisify(execFile)
type ModuleRequire = ReturnType<typeof createRequire>

async function resolveVersionFromPackageJson(req: ModuleRequire, name: string): Promise<string | undefined> {
  try {
    const pkgJsonPath = req.resolve(`${name}/package.json`)
    const raw = await readFile(pkgJsonPath, 'utf-8')
    const parsed = JSON.parse(raw)
    if (parsed?.version) {
      return parsed.version as string
    }
  }
  catch {
    // ignored, fallback to npm command
  }
}

function extractVersionFromNpmLsOutput(stdout: string, name: string): string | undefined {
  try {
    const parsed = JSON.parse(stdout)
    const version = parsed?.dependencies?.[name]?.version
    return typeof version === 'string' ? version : undefined
  }
  catch {

  }
}

async function resolveVersionWithNpm(name: string): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync('pnpm', ['ls', name, '--json', '--depth=0'])
    const version = extractVersionFromNpmLsOutput(stdout, name)
    if (version) {
      return version
    }
  }
  catch (error) {
    if (error && typeof (error as { stdout?: unknown }).stdout === 'string') {
      const { stdout } = error as { stdout?: unknown }
      if (typeof stdout === 'string') {
        const version = extractVersionFromNpmLsOutput(stdout, name)
        if (version) {
          return version
        }
      }
    }
  }

  try {
    const { stdout } = await execFileAsync('pnpm', ['view', name, 'version', '--json'])
    const trimmed = stdout.trim()
    if (!trimmed) {
      return
    }
    const parsed = JSON.parse(trimmed)
    if (typeof parsed === 'string') {
      return parsed
    }
    if (Array.isArray(parsed)) {
      const last = parsed.at(-1)
      if (typeof last === 'string') {
        return last
      }
    }
  }
  catch {
    // ignored, best effort
  }
}

async function resolveDependencyVersion(req: ModuleRequire, name: string): Promise<string | undefined> {
  const fileVersion = await resolveVersionFromPackageJson(req, name)
  if (fileVersion) {
    return fileVersion
  }
  return resolveVersionWithNpm(name)
}

function generateExternalsPackageJson(externals: string[]) {
  const req = createRequire(import.meta.url)
  let outDirAbs = ''
  const plugin: import('vite').Plugin = {
    name: 'generate-externals-package-json',
    apply: 'build',
    configResolved(config) {
      outDirAbs = resolve(config.root, config.build.outDir)
    },
    async closeBundle() {
      const dependencies: Record<string, string> = {}
      for (const name of externals) {
        const version = await resolveDependencyVersion(req, name)
        if (version) {
          dependencies[name] = version
        }
      }
      const content = {
        private: true,
        type: 'module',
        dependencies,
      }
      await mkdir(outDirAbs, { recursive: true })
      await writeFile(resolve(outDirAbs, 'package.json'), JSON.stringify(content, null, 2))
    },
  }
  return plugin
}
export default defineConfig({
  plugins: [
    tsconfigPaths(),
    swc.vite(),
    analyzer({ enabled: process.env.ANALYZER === 'true' }),
    generateExternalsPackageJson(external),
  ],
  esbuild: false,
  resolve: {
    alias: {
      '@afilmory/be-utils': resolve(__dirname, '../../packages/utils/src'),
      '@afilmory/be-utils/': `${resolve(__dirname, '../../packages/utils/src')}/`,
    },
  },
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV === 'development'),
  },
  ssr: {
    noExternal: true,
    external: [...external, ...buildOnlyExternal],
  },
  build: {
    ssr: true,
    ssrEmitAssets: true,
    rollupOptions: {
      external: NODE_BUILT_IN_MODULES,

      input: {
        main: resolve(__dirname, 'src/index.ts'),
      },
    },
  },
})

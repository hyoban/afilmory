import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import siteConfig from '@config'
import type { DOMParser } from 'linkedom'

import { DbManager } from './db'
import { isLocalPhotoTrashEnabledFromEnv } from './local-photo-runtime'
import { getRuntimeManifestScriptContent } from './runtime-manifest'

type HtmlElement = ReturnType<typeof DOMParser.prototype.parseFromString>
type OnlyHTMLDocument = HtmlElement extends infer T ? (T extends { [key: string]: any, head: any } ? T : never) : never
export const injectConfigToDocument = (document: OnlyHTMLDocument) => {
  const $config = document.head.querySelector('#config')
  const $manifest = document.head.querySelector('#manifest')
  const injectConfigBase = {
    useApi: DbManager.shared.isEnabled(),
    useNext: true,
    localPhotoTrash: isLocalPhotoTrashEnabledFromEnv() || isLocalPhotoTrashEnabled(),
  }
  if ($config) {
    $config.innerHTML = `window.__CONFIG__ = ${JSON.stringify(injectConfigBase)};window.__SITE_CONFIG__ = ${JSON.stringify(siteConfig)};`
  }
  if ($manifest && process.env.AFILMORY_MANIFEST_PATH?.trim()) {
    $manifest.innerHTML = getRuntimeManifestScriptContent()
  }
  return document
}

function isLocalPhotoTrashEnabled(): boolean {
  for (const configPath of getBuilderConfigCandidates()) {
    try {
      const content = fs.readFileSync(configPath, 'utf8')
      return /provider\s*:\s*['"]local['"]/.test(content)
    }
    catch {
      // Try the next likely workspace layout.
    }
  }

  return false
}

function getBuilderConfigCandidates(): string[] {
  const cwd = process.cwd()
  return Array.from(
    new Set([
      path.resolve(cwd, 'builder.config.ts'),
      path.resolve(cwd, '../builder.config.ts'),
      path.resolve(cwd, '../../builder.config.ts'),
      path.resolve(cwd, '../../../builder.config.ts'),
    ]),
  )
}

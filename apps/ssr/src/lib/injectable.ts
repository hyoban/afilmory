import siteConfig from '@config'
import type { DOMParser } from 'linkedom'

import { DbManager } from './db'
import { resolveLocalPhotoRuntimeConfig } from './local-photo-runtime'
import { getRuntimeManifestScriptContent } from './runtime-manifest'

type LinkedomDocument = Extract<ReturnType<typeof DOMParser.prototype.parseFromString>, { head: unknown }>

export const injectConfigToDocument = async (document: LinkedomDocument) => {
  const $config = document.head.querySelector('#config')
  const $manifest = document.head.querySelector('#manifest')
  const runtimeConfig = await resolveLocalPhotoRuntimeConfig({ allowPublicPhotosFallback: true }).catch(() => null)
  const injectConfigBase = {
    useApi: DbManager.shared.isEnabled(),
    useNext: true,
    localPhotoTrash: Boolean(runtimeConfig?.trashEnabled),
  }
  if ($config) {
    $config.innerHTML = `window.__CONFIG__ = ${JSON.stringify(injectConfigBase)};window.__SITE_CONFIG__ = ${JSON.stringify(siteConfig)};`
  }
  if ($manifest && runtimeConfig?.manifestPath) {
    $manifest.innerHTML = getRuntimeManifestScriptContent(runtimeConfig.manifestPath)
  }
  return document
}

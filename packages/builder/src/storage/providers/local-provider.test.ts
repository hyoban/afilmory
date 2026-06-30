import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { it, vi } from 'vitest'

import { LocalStorageProvider } from './local-provider.js'

it('localStorageProvider excludes internal trash directory by default', async () => {
  const basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'afilmory-local-provider-'))
  try {
    await fs.mkdir(path.join(basePath, 'Album'), { recursive: true })
    await fs.mkdir(path.join(basePath, '.afilmory-trash', '2026-06-30', 'Album'), { recursive: true })
    await fs.writeFile(path.join(basePath, 'Album', 'kept.jpg'), 'kept')
    await fs.writeFile(path.join(basePath, '.afilmory-trash', '2026-06-30', 'Album', 'trashed.jpg'), 'trashed')

    const provider = new LocalStorageProvider({ basePath, provider: 'local' })
    const files = await provider.listAllFiles()

    assert.deepEqual(files.map(file => file.key).sort(), ['Album/kept.jpg'])
  }
  finally {
    await fs.rm(basePath, { force: true, recursive: true })
  }
})

it('localStorageProvider rejects keys that escape to sibling directories with the same prefix', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'afilmory-local-provider-'))
  const basePath = path.join(root, 'photos')
  const siblingPath = path.join(root, 'photos-escape')
  try {
    await fs.mkdir(basePath, { recursive: true })
    await fs.mkdir(siblingPath, { recursive: true })
    await fs.writeFile(path.join(siblingPath, 'secret.jpg'), 'secret')

    const provider = new LocalStorageProvider({ basePath, provider: 'local' })

    assert.equal(await provider.getFile('../photos-escape/secret.jpg'), null)
  }
  finally {
    await fs.rm(root, { force: true, recursive: true })
  }
})

it('localStorageProvider fails instead of returning a partial manifest when the base directory cannot be scanned', async () => {
  const basePath = path.join(os.tmpdir(), `afilmory-missing-${Date.now()}`)
  const provider = new LocalStorageProvider({ basePath, provider: 'local' })

  await assert.rejects(provider.listAllFiles(), /扫描目录失败/)
})

it('localStorageProvider fails instead of returning a partial manifest when file stat fails during scan', async () => {
  const basePath = await fs.mkdtemp(path.join(os.tmpdir(), 'afilmory-local-provider-'))
  const disappearingFile = path.join(basePath, 'vanishes.jpg')
  const originalStat = fs.stat.bind(fs)
  const statSpy = vi.spyOn(fs, 'stat').mockImplementation((async (filePath, options) => {
    if (String(filePath) === disappearingFile) {
      throw new Error('vanished during scan')
    }

    return await originalStat(filePath, options as never)
  }) as typeof fs.stat)

  try {
    await fs.writeFile(disappearingFile, 'image')
    await fs.writeFile(path.join(basePath, 'kept.jpg'), 'kept')

    const provider = new LocalStorageProvider({ basePath, provider: 'local' })

    await assert.rejects(provider.listAllFiles(), /获取文件信息失败/)
  }
  finally {
    statSpy.mockRestore()
    await fs.rm(basePath, { force: true, recursive: true })
  }
})

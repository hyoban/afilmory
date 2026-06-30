import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { $ } from 'execa'

export const precheck = async () => {
  if (process.env.AFILMORY_SKIP_BUILD_MANIFEST === '1') {
    return
  }

  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const workdir = path.resolve(__dirname, '../../..')

  await $({
    cwd: workdir,
    stdio: 'inherit',
  })`pnpm --filter @afilmory/builder cli`
}

import assert from 'node:assert/strict'

import { it } from 'vitest'

import { mapWithConcurrency } from './photo-og-metadata'

it('mapWithConcurrency limits active tasks and preserves result order', async () => {
  let active = 0
  let maxActive = 0

  const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
    active++
    maxActive = Math.max(maxActive, active)
    await new Promise(resolve => setTimeout(resolve, 5))
    active--
    return value * 2
  })

  assert.deepEqual(result, [2, 4, 6, 8, 10])
  assert.equal(maxActive, 2)
})

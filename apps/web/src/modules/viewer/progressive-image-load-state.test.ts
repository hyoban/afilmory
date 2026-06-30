import assert from 'node:assert/strict'

import { it } from 'vitest'

import { shouldLoadProgressiveImage } from './progressive-image-load-state'

it('shouldLoadProgressiveImage reloads a current image when the source changes after a high-res load', () => {
  assert.equal(
    shouldLoadProgressiveImage({
      error: false,
      errorSrc: null,
      highResLoaded: true,
      isCurrentImage: true,
      loadedSrc: '/photos/deleted.jpg',
      src: '/photos/next.jpg',
    }),
    true,
  )
})

it('shouldLoadProgressiveImage skips a current image only when the loaded source still matches', () => {
  assert.equal(
    shouldLoadProgressiveImage({
      error: false,
      errorSrc: null,
      highResLoaded: true,
      isCurrentImage: true,
      loadedSrc: '/photos/current.jpg',
      src: '/photos/current.jpg',
    }),
    false,
  )
})

it('shouldLoadProgressiveImage retries a new source after an error from a previous source', () => {
  assert.equal(
    shouldLoadProgressiveImage({
      error: true,
      errorSrc: '/photos/deleted.jpg',
      highResLoaded: false,
      isCurrentImage: true,
      loadedSrc: null,
      src: '/photos/next.jpg',
    }),
    true,
  )
})

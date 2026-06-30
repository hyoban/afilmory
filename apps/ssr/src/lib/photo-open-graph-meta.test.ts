import assert from 'node:assert/strict'

import type { PhotoManifestItem } from '@afilmory/builder'
import { DOMParser } from 'linkedom'
import { NextRequest } from 'next/server'
import { it } from 'vitest'

import { createAndInsertPhotoOpenGraphMeta } from './photo-open-graph-meta'

it('createAndInsertPhotoOpenGraphMeta uses the canonical photo route for og:url', () => {
  const document = new DOMParser().parseFromString('<html><head></head><body></body></html>', 'text/html')
  const request = new NextRequest('https://photos.example.com/photos/photo-1')

  createAndInsertPhotoOpenGraphMeta(
    document,
    {
      description: 'Description',
      id: 'photo-1',
    } as PhotoManifestItem,
    request,
    'Test Photos',
  )

  assert.equal(
    document.head.querySelector('meta[property="og:url"]')?.getAttribute('content'),
    'https://photos.example.com/photos/photo-1',
  )
})

import type { PhotoManifestItem } from '@afilmory/builder'

import { getRuntimeManifest } from './runtime-manifest'

class PhotoLoader {
  constructor() {
    this.getAllTags = this.getAllTags.bind(this)
    this.getPhotos = this.getPhotos.bind(this)
    this.getPhoto = this.getPhoto.bind(this)
  }

  getPhotos(ids?: string[]) {
    const photos = getRuntimeManifest().data as unknown as PhotoManifestItem[]
    if (ids) {
      return photos.filter(photo => ids.includes(photo.id))
    }
    return photos
  }

  getPhoto(id: string) {
    return this.getPhotos().find(photo => photo.id === id)
  }

  getAllTags() {
    const tagSet = new Set<string>()
    this.getPhotos().forEach((photo) => {
      photo.tags.forEach(tag => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }
}
export const photoLoader = new PhotoLoader()

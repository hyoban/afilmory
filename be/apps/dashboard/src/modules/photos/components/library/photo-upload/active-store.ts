import type { PhotoUploadStore } from './store'

let activeRef: PhotoUploadStore | null = null

export function getActivePhotoUploadStore(): PhotoUploadStore | null {
  return activeRef
}

export function setActivePhotoUploadStore(store: PhotoUploadStore | null) {
  activeRef = store
}

export function clearActivePhotoUploadStoreIfMatches(store: PhotoUploadStore) {
  if (activeRef === store) {
    activeRef = null
  }
}

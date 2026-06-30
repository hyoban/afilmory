import type { ShortcutTarget } from '@afilmory/ui/keyboard'
import { getShortcutTarget, isEditableShortcutTarget } from '@afilmory/ui/keyboard'
import { atom } from 'jotai'

import { jotaiStore } from '../../lib/jotai'

type PhotoLike = {
  id: string
}

type LocalPhotoTrashShortcutInput = {
  altKey?: boolean
  canTrashLocalPhoto: boolean
  ctrlKey?: boolean
  defaultPrevented?: boolean
  hasOpenDialog: boolean
  isOpen: boolean
  isTrashingPhoto: boolean
  key: string
  metaKey?: boolean
  shiftKey?: boolean
  target?: ShortcutTarget | null
}

export type LocalPhotoTrashSuccessTransition
  = | {
    type: 'go-to-photo'
    photoId: string
  }
  | {
    type: 'close'
  }

export type LocalPhotoTrashNavigationDirection = 'forward' | 'backward'

export const locallyTrashedPhotoIdsAtom = atom<ReadonlySet<string>>(new Set<string>())

export const markPhotoLocallyTrashed = (photoId: string) => {
  jotaiStore.set(locallyTrashedPhotoIdsAtom, (prev) => {
    if (prev.has(photoId)) {
      return prev
    }

    const next = new Set(prev)
    next.add(photoId)
    return next
  })
}

export const excludeLocallyTrashedPhotos = <TPhoto extends PhotoLike>(
  photos: TPhoto[],
  locallyTrashedPhotoIds: ReadonlySet<string>,
) => {
  if (locallyTrashedPhotoIds.size === 0) {
    return photos
  }

  return photos.filter(photo => !locallyTrashedPhotoIds.has(photo.id))
}

export const resolveLocalPhotoTrashSuccess = (
  photos: PhotoLike[],
  currentIndex: number,
  direction: LocalPhotoTrashNavigationDirection = 'forward',
): LocalPhotoTrashSuccessTransition => {
  if (currentIndex < 0 || currentIndex >= photos.length) {
    return { type: 'close' }
  }

  const preferredOffset = direction === 'backward' ? -1 : 1
  const fallbackOffset = preferredOffset * -1
  const preferredPhoto = photos[currentIndex + preferredOffset]
  const fallbackPhoto = photos[currentIndex + fallbackOffset]
  const targetPhoto = preferredPhoto ?? fallbackPhoto

  if (targetPhoto) {
    return {
      type: 'go-to-photo',
      photoId: targetPhoto.id,
    }
  }

  return { type: 'close' }
}

export const shouldIgnoreLocalPhotoTrashIndexChange = (
  photos: PhotoLike[],
  nextIndex: number,
  pendingPhotoId: string | null,
) => {
  if (!pendingPhotoId) {
    return false
  }

  return photos[nextIndex]?.id !== pendingPhotoId
}

export const getLocalPhotoTrashShortcutTarget = getShortcutTarget

export const shouldHandleLocalPhotoTrashShortcut = ({
  altKey = false,
  canTrashLocalPhoto,
  ctrlKey = false,
  defaultPrevented = false,
  hasOpenDialog,
  isOpen,
  isTrashingPhoto,
  key,
  metaKey = false,
  shiftKey = false,
  target,
}: LocalPhotoTrashShortcutInput) => {
  if (!isOpen || !canTrashLocalPhoto || isTrashingPhoto || hasOpenDialog || defaultPrevented) {
    return false
  }

  if (altKey || ctrlKey || metaKey || shiftKey) {
    return false
  }

  if (key !== 'Delete' && key !== 'Backspace') {
    return false
  }

  if (!target) {
    return true
  }

  return !isEditableShortcutTarget(target)
}

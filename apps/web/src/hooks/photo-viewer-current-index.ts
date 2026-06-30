type PhotoLike = {
  id: string
}

export function resolvePhotoViewerCurrentIndex(
  photos: PhotoLike[],
  urlPhotoId: string | undefined,
  viewerPhotoId: string | null,
) {
  if (urlPhotoId) {
    const urlPhotoIndex = photos.findIndex(photo => photo.id === urlPhotoId)
    if (urlPhotoIndex !== -1) {
      return urlPhotoIndex
    }
  }

  if (viewerPhotoId) {
    const viewerPhotoIndex = photos.findIndex(photo => photo.id === viewerPhotoId)
    if (viewerPhotoIndex !== -1) {
      return viewerPhotoIndex
    }
  }

  return 0
}

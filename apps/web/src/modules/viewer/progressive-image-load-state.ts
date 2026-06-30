type ProgressiveImageLoadInput = {
  error: boolean
  errorSrc: string | null
  highResLoaded: boolean
  isCurrentImage: boolean
  loadedSrc: string | null
  src: string
}

export const shouldLoadProgressiveImage = ({
  error,
  errorSrc,
  highResLoaded,
  isCurrentImage,
  loadedSrc,
  src,
}: ProgressiveImageLoadInput) => {
  if (!isCurrentImage) {
    return false
  }

  if (highResLoaded && loadedSrc === src) {
    return false
  }

  if (error && errorSrc === src) {
    return false
  }

  return true
}

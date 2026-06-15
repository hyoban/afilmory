import type { PhotoAssetListItem } from '../../../types'

export type PhotoLibraryState = {
  assets: PhotoAssetListItem[] | undefined
  isLoading: boolean
  isDeleting: boolean
  isUploading: boolean
  availableTags: string[]
  libraryTotalCount: number
  selectedIds: string[]
}

export const initialPhotoLibraryState: PhotoLibraryState = {
  assets: undefined,
  isLoading: false,
  isDeleting: false,
  isUploading: false,
  availableTags: [],
  libraryTotalCount: 0,
  selectedIds: [],
}

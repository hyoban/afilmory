import type { ReactNode } from 'react'
import { createContext, use, useEffect, useMemo } from 'react'
import type { StoreApi } from 'zustand'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

import type { PhotoUploadRequestOptions } from '../upload.types'
import type { PhotoUploadAction } from './action'
import { PhotoUploadActionImpl } from './action'
import { clearActivePhotoUploadStoreIfMatches, setActivePhotoUploadStore } from './active-store'
import type { PhotoUploadState } from './initialState'
import { createInitialPhotoUploadState } from './initialState'
import type { PreviewCache } from './types'

export type { AddFilesResult } from './action'

export type PhotoUploadStoreState = PhotoUploadState & PhotoUploadAction
export type PhotoUploadStore = StoreApi<PhotoUploadStoreState>

type PhotoUploadStoreParams = {
  files: File[]
  availableTags: string[]
  onUpload: (files: FileList, options: PhotoUploadRequestOptions) => void | Promise<void>
  onClose: () => void
}

const PhotoUploadStoreContext = createContext<PhotoUploadStore | null>(null)

// eslint-disable-next-line react-refresh/only-export-components
export function createPhotoUploadStore(params: PhotoUploadStoreParams): PhotoUploadStore {
  const previewCache: PreviewCache = new Map()

  return createStore<PhotoUploadStoreState>((set, get) => ({
    ...createInitialPhotoUploadState({
      files: params.files,
      availableTags: params.availableTags,
      previewCache,
    }),
    ...new PhotoUploadActionImpl(set, get, {
      previewCache,
      onUpload: params.onUpload,
      onClose: params.onClose,
    }),
  }))
}

type PhotoUploadStoreProviderProps = PhotoUploadStoreParams & {
  children: ReactNode
}

export function PhotoUploadStoreProvider({
  children,
  files,
  availableTags,
  onUpload,
  onClose,
}: PhotoUploadStoreProviderProps) {
  const store = useMemo(
    () => createPhotoUploadStore({ files, availableTags, onUpload, onClose }),
    [files, availableTags, onUpload, onClose],
  )

  useEffect(() => {
    setActivePhotoUploadStore(store)
    store.getState().ensurePreviews()
    return () => {
      clearActivePhotoUploadStoreIfMatches(store)
      store.getState().cleanup()
    }
  }, [store])

  return <PhotoUploadStoreContext value={store}>{children}</PhotoUploadStoreContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePhotoUploadStore<U>(selector: (state: PhotoUploadStoreState) => U) {
  const store = use(PhotoUploadStoreContext)
  if (!store) {
    throw new Error('usePhotoUploadStore must be used within PhotoUploadStoreProvider')
  }
  return useStore(store, selector)
}

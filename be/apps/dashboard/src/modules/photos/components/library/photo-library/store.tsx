import type { ReactNode } from 'react'
import { createContext, use, useEffect, useRef } from 'react'
import type { StoreApi } from 'zustand'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'

import { useDeletePhotoAssetsMutation, usePhotoAssetListQuery, useUploadPhotoAssetsMutation } from '../../../hooks'
import type { PhotoAssetListItem } from '../../../types'
import type { PhotoLibraryAction, PhotoLibraryDeps } from './action'
import { PhotoLibraryActionImpl } from './action'
import type { PhotoLibraryState } from './initialState'
import { initialPhotoLibraryState } from './initialState'

export type PhotoLibraryStoreState = PhotoLibraryState & PhotoLibraryAction
export type PhotoLibraryStore = StoreApi<PhotoLibraryStoreState>

type PhotoLibraryProviderProps = {
  isActive: boolean
  children: ReactNode
}

const PhotoLibraryStoreContext = createContext<PhotoLibraryStore | null>(null)

function createPhotoLibraryStore(deps: PhotoLibraryDeps): PhotoLibraryStore {
  return createStore<PhotoLibraryStoreState>((set, get) => ({
    ...initialPhotoLibraryState,
    ...new PhotoLibraryActionImpl(set, get, deps),
  }))
}

function deriveAvailableTags(assets: PhotoAssetListItem[] | undefined) {
  if (!assets || assets.length === 0) {
    return []
  }

  const tagSet = new Set<string>()
  for (const asset of assets) {
    const tags = asset.manifest?.data?.tags
    if (!Array.isArray(tags)) {
      continue
    }
    for (const tag of tags) {
      const normalized = typeof tag === 'string' ? tag.trim() : ''
      if (normalized) {
        tagSet.add(normalized)
      }
    }
  }

  return Array.from(tagSet).sort((a, b) => a.localeCompare(b))
}

export function PhotoLibraryProvider({ isActive, children }: PhotoLibraryProviderProps) {
  const listQuery = usePhotoAssetListQuery({ enabled: isActive })
  const deleteMutation = useDeletePhotoAssetsMutation()
  const uploadMutation = useUploadPhotoAssetsMutation()

  const refetchListRef = useRef(listQuery.refetch)
  useEffect(() => {
    refetchListRef.current = listQuery.refetch
  }, [listQuery.refetch])

  const deleteMutationRef = useRef(deleteMutation)
  useEffect(() => {
    deleteMutationRef.current = deleteMutation
  }, [deleteMutation])

  const uploadMutationRef = useRef(uploadMutation)
  useEffect(() => {
    uploadMutationRef.current = uploadMutation
  }, [uploadMutation])

  const storeRef = useRef<PhotoLibraryStore | null>(null)
  if (!storeRef.current) {
    storeRef.current = createPhotoLibraryStore({
      requestDeleteAssets: (ids, options) =>
        deleteMutationRef.current.mutateAsync({
          ids,
          deleteFromStorage: options?.deleteFromStorage ?? false,
        }),
      requestUploadAssets: async (files, options) => {
        await uploadMutationRef.current.mutateAsync({
          files,
          onProgress: options?.onUploadProgress,
          signal: options?.signal,
          directory: options?.directory ?? undefined,
          timeoutMs: options?.timeoutMs,
          onServerEvent: options?.onServerEvent,
        })
      },
      refetchAssets: () => {
        const refetch = refetchListRef.current
        if (typeof refetch === 'function') {
          void refetch()
        }
      },
    })
  }

  const store = storeRef.current

  useEffect(() => {
    store.setState({
      assets: listQuery.data,
      libraryTotalCount: listQuery.data?.length ?? 0,
      availableTags: deriveAvailableTags(listQuery.data),
      isLoading: listQuery.isLoading,
    })
  }, [store, listQuery.data, listQuery.isLoading])

  useEffect(() => {
    store.setState({ isDeleting: deleteMutation.isPending })
  }, [store, deleteMutation.isPending])

  useEffect(() => {
    store.setState({ isUploading: uploadMutation.isPending })
  }, [store, uploadMutation.isPending])

  useEffect(() => {
    if (!isActive) {
      store.setState({ selectedIds: [] })
    }
  }, [store, isActive])

  return <PhotoLibraryStoreContext value={store}>{children}</PhotoLibraryStoreContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePhotoLibraryStore<T>(selector: (state: PhotoLibraryStoreState) => T): T {
  const store = use(PhotoLibraryStoreContext)
  if (!store) {
    throw new Error('PhotoLibraryProvider is missing in the component tree')
  }

  return useStore(store, selector)
}

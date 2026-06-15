import { Prompt } from '@afilmory/ui'
import { toast } from 'sonner'
import type { StoreApi } from 'zustand'

import { getRequestErrorMessage } from '~/lib/errors'

import type { PhotoAssetListItem } from '../../../types'
import { DeleteFromStorageOption } from '../DeleteFromStorageOption'
import type { DeleteAssetOptions } from '../types'
import type { PhotoUploadRequestOptions } from '../upload.types'
import type { PhotoLibraryState } from './initialState'

type StoreShape = PhotoLibraryState & PhotoLibraryAction
type Setter = StoreApi<StoreShape>['setState']
type Getter = () => StoreShape

export type PhotoLibraryDeps = {
  requestDeleteAssets: (ids: string[], options?: DeleteAssetOptions) => Promise<void>
  requestUploadAssets: (files: File[], options?: PhotoUploadRequestOptions) => Promise<void>
  refetchAssets: () => void
}

export class PhotoLibraryActionImpl {
  readonly #set: Setter
  readonly #get: Getter
  readonly #deps: PhotoLibraryDeps

  constructor(set: Setter, get: Getter, deps: PhotoLibraryDeps) {
    this.#set = set
    this.#get = get
    this.#deps = deps
  }

  toggleSelect = (id: string): void => {
    this.#set((state) => {
      const next = state.selectedIds.includes(id)
        ? state.selectedIds.filter(item => item !== id)
        : [...state.selectedIds, id]
      return { selectedIds: next }
    })
  }

  clearSelection = (): void => {
    this.#set({ selectedIds: [] })
  }

  selectAll = (): void => {
    this.#set((state) => {
      if (!state.assets || state.assets.length === 0) {
        return {}
      }
      return { selectedIds: state.assets.map(asset => asset.id) }
    })
  }

  deleteAsset = (asset: PhotoAssetListItem, options?: DeleteAssetOptions): Promise<void> => {
    if (options) {
      return this.#performDelete([asset.id], options)
    }
    const assetLabel = this.#getAssetLabel(asset)
    return this.#presentDeletePrompt(assetLabel, promptOptions => this.#performDelete([asset.id], promptOptions))
  }

  deleteSelected = (): Promise<void> => {
    const ids = this.#get().selectedIds
    if (ids.length === 0) {
      return Promise.resolve()
    }

    const assets = this.#get().assets ?? []
    const selectedAssets = assets.filter(asset => ids.includes(asset.id))
    const targetLabel
      = selectedAssets.length === 1 ? this.#getAssetLabel(selectedAssets[0]) : `选中的 ${ids.length} 个资源`

    return this.#presentDeletePrompt(targetLabel, promptOptions => this.#performDelete(ids, promptOptions))
  }

  uploadAssets = (files: FileList, options?: PhotoUploadRequestOptions): Promise<void> => {
    return this.#performUpload(Array.from(files), options)
  }

  openAsset = async (asset: PhotoAssetListItem): Promise<void> => {
    const photoId = asset.manifest?.data?.id ?? asset.photoId
    if (!photoId) {
      toast.error('打开失败', { description: '无法解析图片 ID' })
      return
    }

    const url = `${window.location.origin}/photos/${encodeURIComponent(photoId)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  refetchAssets = (): void => {
    this.#deps.refetchAssets()
  }

  #getAssetLabel = (asset: PhotoAssetListItem): string =>
    asset.manifest?.data?.title ?? asset.manifest?.data?.id ?? asset.photoId

  #presentDeletePrompt = (
    label: string,
    onConfirm: (options: DeleteAssetOptions) => Promise<void> | void,
  ): Promise<void> => {
    let deleteFromStorage = false

    return new Promise((resolve) => {
      Prompt.prompt({
        title: '确认删除该资源？',
        description: `删除后将无法恢复，是否继续删除「${label}」？如需同时删除远程存储文件，可勾选下方选项。`,
        variant: 'danger',
        onConfirmText: '删除',
        onCancelText: '取消',
        content: (
          <DeleteFromStorageOption
            onChange={(checked) => {
              deleteFromStorage = checked
            }}
          />
        ),
        onConfirm: () => Promise.resolve(onConfirm({ deleteFromStorage })).finally(resolve),
        onCancel: resolve,
      })
    })
  }

  #performDelete = async (ids: string[], options?: DeleteAssetOptions): Promise<void> => {
    if (ids.length === 0) {
      return
    }
    this.#set({ isDeleting: true })
    try {
      await this.#deps.requestDeleteAssets(ids, options)
      toast.success(`已删除 ${ids.length} 个资源`)
      this.#set(state => ({
        selectedIds: state.selectedIds.filter(id => !ids.includes(id)),
      }))
      this.#deps.refetchAssets()
    }
    catch (error) {
      const message = getRequestErrorMessage(error, '删除失败，请稍后重试。')
      toast.error('删除失败', { description: message })
    }
    finally {
      this.#set({ isDeleting: false })
    }
  }

  #performUpload = async (files: File[], options?: PhotoUploadRequestOptions): Promise<void> => {
    if (files.length === 0) {
      return
    }
    this.#set({ isUploading: true })
    try {
      await this.#deps.requestUploadAssets(files, options)
      toast.success(`成功上传 ${files.length} 张图片`)
      this.#deps.refetchAssets()
    }
    catch (error) {
      const message = getRequestErrorMessage(error, '上传失败，请稍后重试。')
      toast.error('上传失败', { description: message })
      throw error
    }
    finally {
      this.#set({ isUploading: false })
    }
  }
}

export type PhotoLibraryAction = Pick<PhotoLibraryActionImpl, keyof PhotoLibraryActionImpl>

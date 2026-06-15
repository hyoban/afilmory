import type { StoreApi } from 'zustand'

import { presentBillingUpgradeModal, resolveBillingUpgradeCategory } from '~/modules/billing/upgrade-prompts'

import type { PhotoSyncProgressEvent } from '../../../types'
import type { PhotoUploadRequestOptions } from '../upload.types'
import type { PhotoUploadState } from './initialState'
import type { FileProgressEntry, PreviewCache, ProcessingLogEntry } from './types'
import {
  calculateTotalSize,
  calculateUploadedBytes,
  collectUnmatchedMovFiles,
  createFileEntries,
  createFileList,
  createStageStateFromTotals,
  deriveDirectoryFromTags,
  entryFingerprint,
  getErrorMessage,
  normalizeStageCount,
  primePreviewCache,
  rememberRecentTags,
  revokePreviewUrls,
} from './utils'

export type AddFilesResult = {
  added: number
  skipped: number
}

const MAX_PROCESSING_LOGS = 200
// Extend upload request timeout to tolerate larger batches / slower networks (10 minutes).
const UPLOAD_REQUEST_TIMEOUT_MS = 600_000

let processingLogSequence = 0

const computeUploadedBytes = (entries: FileProgressEntry[]) => calculateUploadedBytes(entries)

type StoreShape = PhotoUploadState & PhotoUploadAction
type Setter = StoreApi<StoreShape>['setState']
type Getter = () => StoreShape

export type PhotoUploadDeps = {
  previewCache: PreviewCache
  onUpload: (files: FileList, options: PhotoUploadRequestOptions) => void | Promise<void>
  onClose: () => void
}

export class PhotoUploadActionImpl {
  readonly #set: Setter
  readonly #get: Getter
  readonly #previewCache: PreviewCache
  readonly #onUpload: PhotoUploadDeps['onUpload']
  readonly #onClose: PhotoUploadDeps['onClose']
  #uploadAbortController: AbortController | null = null

  constructor(set: Setter, get: Getter, deps: PhotoUploadDeps) {
    this.#set = set
    this.#get = get
    this.#previewCache = deps.previewCache
    this.#onUpload = deps.onUpload
    this.#onClose = deps.onClose
  }

  removeEntry = (entry: FileProgressEntry): void => {
    const state = this.#get()
    if (state.phase !== 'review') {
      return
    }

    const removedFile = state.files[entry.index]
    const nextFiles = state.files.filter((_, index) => index !== entry.index)
    if (nextFiles.length === state.files.length) {
      return
    }

    if (removedFile) {
      const fp = entryFingerprint(removedFile)
      const stillUsed = nextFiles.some(file => entryFingerprint(file) === fp)
      if (!stillUsed) {
        revokePreviewUrls(this.#previewCache, [fp])
      }
    }

    const nextEntries = createFileEntries(nextFiles, this.#previewCache)
    const nextTotalSize = calculateTotalSize(nextFiles)
    const { unmatched, hasMov } = collectUnmatchedMovFiles(nextFiles)

    this.#set({
      files: nextFiles,
      totalSize: nextTotalSize,
      unmatchedMovFiles: unmatched,
      hasMovFile: hasMov,
      uploadEntries: nextEntries,
      uploadedBytes: computeUploadedBytes(nextEntries),
    })

    this.ensurePreviews()
  }

  addFiles = (incoming: File[]): AddFilesResult => {
    const state = this.#get()
    if (state.phase !== 'review' || incoming.length === 0) {
      return { added: 0, skipped: 0 }
    }

    const existing = new Set(state.files.map(entryFingerprint))

    const toAdd: File[] = []
    let skipped = 0
    for (const file of incoming) {
      const fp = entryFingerprint(file)
      if (existing.has(fp)) {
        skipped++
        continue
      }
      existing.add(fp)
      toAdd.push(file)
    }

    if (toAdd.length === 0) {
      return { added: 0, skipped }
    }

    const nextFiles = [...state.files, ...toAdd]
    const nextEntries = createFileEntries(nextFiles, this.#previewCache)
    const nextTotalSize = calculateTotalSize(nextFiles)
    const { unmatched, hasMov } = collectUnmatchedMovFiles(nextFiles)

    this.#set({
      files: nextFiles,
      totalSize: nextTotalSize,
      unmatchedMovFiles: unmatched,
      hasMovFile: hasMov,
      uploadEntries: nextEntries,
      uploadedBytes: computeUploadedBytes(nextEntries),
    })

    this.ensurePreviews()

    return { added: toAdd.length, skipped }
  }

  beginUpload = async (): Promise<void> => {
    const state = this.#get()
    if (state.unmatchedMovFiles.length > 0 || state.phase === 'uploading' || state.phase === 'processing') {
      return
    }
    if (state.files.length === 0) {
      return
    }

    this.#set({
      uploadError: null,
      processingError: null,
      processingState: null,
      phase: 'uploading',
      processingLogs: [],
    })

    this.#updateEntries(entries =>
      entries.map(entry => ({
        ...entry,
        status: 'uploading',
      })))

    const controller = new AbortController()
    this.#uploadAbortController = controller

    try {
      const tags = this.#get().selectedTags
      rememberRecentTags(tags)
      const directory = deriveDirectoryFromTags(tags)
      const fileList = createFileList(this.#get().files)
      await this.#onUpload(fileList, {
        signal: controller.signal,
        directory: directory ?? undefined,
        onUploadProgress: this.#handleUploadProgress,
        timeoutMs: UPLOAD_REQUEST_TIMEOUT_MS,
        onServerEvent: this.#handleProcessingEvent,
      })
    }
    catch (error) {
      const isAbort = (error as DOMException)?.name === 'AbortError'
      if (isAbort) {
        this.#set({ phase: 'review' })
        const currentFiles = this.#get().files
        this.#updateEntries(() => createFileEntries(currentFiles, this.#previewCache))
      }
      else {
        const upgradeCategory = resolveBillingUpgradeCategory(error)
        if (upgradeCategory) {
          presentBillingUpgradeModal(upgradeCategory)
        }
        const message = getErrorMessage(error, '上传失败，请稍后再试。')
        this.#set({
          uploadError: message,
          phase: 'error',
        })
        this.#updateEntries(entries =>
          entries.map(entry => ({
            ...entry,
            status: entry.status === 'uploading' ? 'error' : entry.status,
          })))
      }
    }
    finally {
      this.#uploadAbortController = null
    }
  }

  abortCurrent = (): void => {
    const { phase } = this.#get()
    if (phase === 'uploading') {
      this.#uploadAbortController?.abort()
      this.#uploadAbortController = null
      this.#set({ phase: 'review' })
      const currentFiles = this.#get().files
      this.#updateEntries(() => createFileEntries(currentFiles, this.#previewCache))
      return
    }
    if (phase === 'processing') {
      this.#uploadAbortController?.abort()
      this.#uploadAbortController = null
      this.#set({
        processingError: '服务器处理已终止',
        phase: 'error',
      })
      this.#updateEntries(entries =>
        entries.map(entry => ({
          ...entry,
          status: entry.status === 'processing' ? 'error' : entry.status,
        })))
    }
  }

  reset = (): void => {
    this.#uploadAbortController?.abort()
    this.#uploadAbortController = null
    this.#set({
      phase: 'review',
      uploadError: null,
      processingError: null,
      processingState: null,
      processingLogs: [],
    })
    const currentFiles = this.#get().files
    this.#updateEntries(() => createFileEntries(currentFiles, this.#previewCache))
  }

  closeModal = (): void => {
    this.cleanup()
    this.#onClose()
  }

  setSelectedTags = (tags: string[]): void => {
    this.#set({ selectedTags: tags })
  }

  ensurePreviews = (): void => {
    const { files, uploadEntries } = this.#get()
    primePreviewCache(files, this.#previewCache)
    let mutated = false
    const nextEntries = uploadEntries.map((entry) => {
      const cached = this.#previewCache.get(entry.id) ?? null
      if (cached === entry.previewUrl) {
        return entry
      }
      mutated = true
      return { ...entry, previewUrl: cached }
    })
    if (mutated) {
      this.#set({ uploadEntries: nextEntries })
    }
  }

  cleanup = (): void => {
    this.#uploadAbortController?.abort()
    this.#uploadAbortController = null
    revokePreviewUrls(this.#previewCache)
  }

  #updateEntries = (updater: (entries: FileProgressEntry[]) => FileProgressEntry[]): void => {
    this.#set((state) => {
      const nextEntries = updater(state.uploadEntries)
      return {
        uploadEntries: nextEntries,
        uploadedBytes: computeUploadedBytes(nextEntries),
      }
    })
  }

  #handleProcessingEvent = (event: PhotoSyncProgressEvent): void => {
    if (event.type === 'start') {
      this.#updateEntries(entries =>
        entries.map(entry => ({
          ...entry,
          status: entry.status === 'uploading' ? 'processing' : entry.status,
        })))
      const { summary, totals, options: eventOptions } = event.payload
      this.#set({
        phase: 'processing',
        processingError: null,
        processingState: {
          dryRun: eventOptions?.dryRun ?? false,
          summary,
          totals,
          stages: createStageStateFromTotals(totals),
          completed: false,
        },
        processingLogs: [],
      })
      return
    }

    this.#set((state) => {
      if (event.type === 'log') {
        const timestamp = Date.parse(event.payload.timestamp)
        const logEntry: ProcessingLogEntry = {
          id: `log-${processingLogSequence++}`,
          message: event.payload.message,
          level: event.payload.level,
          timestamp: Number.isNaN(timestamp) ? Date.now() : timestamp,
        }
        return {
          processingState: state.processingState
            ? {
                ...state.processingState,
                latestLog: {
                  message: logEntry.message,
                  level: logEntry.level,
                  timestamp: logEntry.timestamp,
                },
              }
            : state.processingState,
          processingLogs: [...state.processingLogs, logEntry].slice(-MAX_PROCESSING_LOGS),
        }
      }

      const prev = state.processingState
      if (!prev) {
        if (event.type === 'error') {
          return {
            phase: 'error',
            processingError: event.payload.message,
          }
        }
        return {}
      }

      switch (event.type) {
        case 'stage': {
          const { stage, status, processed, total, summary } = event.payload
          const prevStage = prev.stages[stage]
          const normalizedTotal = normalizeStageCount(total, prevStage?.total ?? 0)
          const normalizedProcessed = normalizeStageCount(processed, prevStage?.processed ?? 0)
          return {
            processingState: {
              ...prev,
              summary,
              stages: {
                ...prev.stages,
                [stage]: {
                  status: status === 'complete' || normalizedTotal === 0 ? 'completed' : 'running',
                  processed: Math.min(normalizedProcessed, normalizedTotal),
                  total: normalizedTotal,
                },
              },
            },
          }
        }
        case 'action': {
          const { stage, index, total, summary } = event.payload
          const prevStage = prev.stages[stage]
          const normalizedTotal = normalizeStageCount(total, prevStage?.total ?? 0)
          const normalizedProcessed = normalizeStageCount(index, prevStage?.processed ?? 0)
          return {
            processingState: {
              ...prev,
              summary,
              stages: {
                ...prev.stages,
                [stage]: {
                  status: normalizedTotal === 0 ? 'completed' : 'running',
                  processed: Math.min(normalizedProcessed, normalizedTotal),
                  total: normalizedTotal,
                },
              },
            },
          }
        }
        case 'error': {
          this.#updateEntries(entries =>
            entries.map(entry => ({
              ...entry,
              status: entry.status === 'processing' ? 'error' : entry.status,
            })))
          return {
            phase: 'error',
            processingError: event.payload.message,
            processingState: {
              ...prev,
              error: event.payload.message,
            },
          }
        }
        case 'complete': {
          this.#updateEntries(entries =>
            entries.map(entry => ({
              ...entry,
              status: entry.status === 'processing' ? 'done' : entry.status,
              progress: 1,
              uploadedBytes: entry.size,
            })))
          return {
            phase: 'completed',
            processingState: {
              ...prev,
              summary: event.payload.summary,
              completed: true,
            },
          }
        }
        default: {
          return {}
        }
      }
    })
  }

  #handleUploadProgress: NonNullable<PhotoUploadRequestOptions['onUploadProgress']> = (snapshot) => {
    const progressMap = new Map(snapshot.files.map(file => [file.index, file]))
    this.#updateEntries(entries =>
      entries.map((entry) => {
        const current = progressMap.get(entry.index)
        if (!current) {
          return entry
        }
        return {
          ...entry,
          status: entry.status === 'pending' ? 'uploading' : entry.status,
          progress: current.progress,
          uploadedBytes: current.uploadedBytes,
        }
      }))
  }
}

export type PhotoUploadAction = Pick<PhotoUploadActionImpl, keyof PhotoUploadActionImpl>

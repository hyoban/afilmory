import type { FileProgressEntry, PreviewCache, ProcessingLogEntry, ProcessingState, WorkflowPhase } from './types'
import { calculateTotalSize, collectUnmatchedMovFiles, createFileEntries } from './utils'

export type PhotoUploadState = {
  files: File[]
  totalSize: number
  uploadedBytes: number
  availableTags: string[]
  selectedTags: string[]
  unmatchedMovFiles: File[]
  hasMovFile: boolean
  phase: WorkflowPhase
  uploadEntries: FileProgressEntry[]
  uploadError: string | null
  processingError: string | null
  processingState: ProcessingState | null
  processingLogs: ProcessingLogEntry[]
}

export type CreateInitialPhotoUploadStateParams = {
  files: File[]
  availableTags: string[]
  previewCache: PreviewCache
}

export const createInitialPhotoUploadState = ({
  files,
  availableTags,
  previewCache,
}: CreateInitialPhotoUploadStateParams): PhotoUploadState => {
  const uploadEntries = createFileEntries(files, previewCache)
  const totalSize = calculateTotalSize(files)
  const { unmatched, hasMov } = collectUnmatchedMovFiles(files)

  return {
    files,
    totalSize,
    uploadedBytes: 0,
    availableTags,
    selectedTags: [],
    unmatchedMovFiles: unmatched,
    hasMovFile: hasMov,
    phase: 'review',
    uploadEntries,
    uploadError: null,
    processingError: null,
    processingState: null,
    processingLogs: [],
  }
}

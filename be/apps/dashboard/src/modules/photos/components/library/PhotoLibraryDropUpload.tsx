import { Modal } from '@afilmory/ui'
import { Spring } from '@afilmory/utils'
import { UploadCloud } from 'lucide-react'
import { m } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useShallow } from 'zustand/shallow'

import { LinearBorderPanel } from '~/components/common/LinearBorderPanel'

import { usePhotoLibraryStore } from './photo-library'
import { getActivePhotoUploadStore } from './photo-upload/active-store'
import { PhotoUploadConfirmModal } from './PhotoUploadConfirmModal'
import type { PhotoUploadRequestOptions } from './upload.types'

const photoLibraryDndKeys = {
  title: 'photos.library.dnd.title',
  description: 'photos.library.dnd.description',
  unsupported: 'photos.library.dnd.unsupported',
  disabled: 'photos.library.dnd.disabled',
  added: 'photos.library.dnd.added',
  allDuplicate: 'photos.library.dnd.allDuplicate',
} as const satisfies Record<string, I18nKeys>

function isAcceptedPhotoAsset(file: File) {
  if (file.type.startsWith('image/')) {
    return true
  }
  if (file.type === 'video/quicktime') {
    return true
  }

  const name = file.name.toLowerCase()
  return name.endsWith('.heic') || name.endsWith('.heif') || name.endsWith('.hif') || name.endsWith('.mov')
}

type Translate = (key: I18nKeys, options?: { count?: number }) => string

function tryRouteToActiveUpload(files: File[], t: Translate): boolean {
  const store = getActivePhotoUploadStore()
  if (!store) {
    return false
  }

  const { phase, addFiles } = store.getState()

  if (phase === 'uploading' || phase === 'processing') {
    toast.error(t(photoLibraryDndKeys.disabled))
    return true
  }

  if (phase !== 'review') {
    return false
  }

  const { added, skipped } = addFiles(files)
  if (added > 0) {
    toast.success(t(photoLibraryDndKeys.added, { count: added }))
  }
  else if (skipped > 0) {
    toast.info(t(photoLibraryDndKeys.allDuplicate, { count: skipped }))
  }
  return true
}

export function PhotoLibraryDropUpload() {
  const { t } = useTranslation()
  const [isDraggingFiles, setIsDraggingFiles] = useState(false)
  const [isOverlayMounted, setIsOverlayMounted] = useState(false)
  const [isOverlayVisible, setIsOverlayVisible] = useState(false)
  const isDraggingFilesRef = useRef(false)
  const latestRef = useRef<{
    availableTags: string[]
    uploadAssets: (files: FileList, options?: PhotoUploadRequestOptions) => Promise<void>
  } | null>(null)
  const overlayUnmountTimerRef = useRef<number | null>(null)

  useEffect(() => {
    isDraggingFilesRef.current = isDraggingFiles
  }, [isDraggingFiles])

  useEffect(() => {
    if (overlayUnmountTimerRef.current) {
      window.clearTimeout(overlayUnmountTimerRef.current)
      overlayUnmountTimerRef.current = null
    }

    if (isDraggingFiles) {
      setIsOverlayMounted(true)
      requestAnimationFrame(() => {
        setIsOverlayVisible(true)
      })
      return
    }

    setIsOverlayVisible(false)
    overlayUnmountTimerRef.current = window.setTimeout(() => {
      setIsOverlayMounted(false)
      overlayUnmountTimerRef.current = null
    }, 180)
  }, [isDraggingFiles])

  useEffect(() => {
    return () => {
      if (overlayUnmountTimerRef.current) {
        window.clearTimeout(overlayUnmountTimerRef.current)
        overlayUnmountTimerRef.current = null
      }
    }
  }, [])

  const { availableTags, uploadAssets } = usePhotoLibraryStore(
    useShallow(state => ({
      availableTags: state.availableTags,
      uploadAssets: state.uploadAssets,
    })),
  )

  useEffect(() => {
    latestRef.current = {
      availableTags,
      uploadAssets,
    }
  }, [availableTags, uploadAssets])

  useEffect(() => {
    const hasFileDrag = (event: DragEvent) => {
      const types = event.dataTransfer?.types
      if (!types) {
        return false
      }
      return Array.from(types).includes('Files')
    }

    const resetDraggingState = () => {
      setIsDraggingFiles(false)
    }

    const handleDragEnter = (event: DragEvent) => {
      if (!hasFileDrag(event)) {
        return
      }
      if (isDraggingFilesRef.current) {
        return
      }
      setIsDraggingFiles(true)
    }

    const handleDragLeave = (_event: DragEvent) => {
      if (!isDraggingFilesRef.current) {
        return
      }
      const event = _event as DragEvent & { relatedTarget?: EventTarget | null }
      const isLeavingWindow = event.relatedTarget == null
      if (!isLeavingWindow) {
        return
      }
      resetDraggingState()
    }

    const handleDragOver = (event: DragEvent) => {
      if (!hasFileDrag(event)) {
        return
      }
      event.preventDefault()
      if (!isDraggingFilesRef.current) {
        setIsDraggingFiles(true)
      }
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = 'copy'
      }
    }

    const handleDrop = (event: DragEvent) => {
      if (!hasFileDrag(event)) {
        return
      }
      event.preventDefault()
      resetDraggingState()

      const files = event.dataTransfer?.files
      if (!files || files.length === 0) {
        return
      }

      const latest = latestRef.current
      if (!latest) {
        return
      }

      const selectedFiles = Array.from(files).filter(file => isAcceptedPhotoAsset(file))
      if (selectedFiles.length === 0) {
        toast.error(t(photoLibraryDndKeys.unsupported))
        return
      }

      if (tryRouteToActiveUpload(selectedFiles, t)) {
        return
      }

      Modal.present(
        PhotoUploadConfirmModal,
        {
          files: selectedFiles,
          availableTags: latest.availableTags,
          onUpload: latest.uploadAssets,
        },
        {
          dismissOnOutsideClick: false,
        },
      )
    }

    window.addEventListener('dragenter', handleDragEnter, true)
    window.addEventListener('dragleave', handleDragLeave, true)
    window.addEventListener('dragover', handleDragOver, true)
    window.addEventListener('drop', handleDrop, true)
    window.addEventListener('dragend', resetDraggingState, true)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return
      }
      resetDraggingState()
    }

    const handleBlur = () => {
      resetDraggingState()
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        return
      }
      resetDraggingState()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('dragenter', handleDragEnter, true)
      window.removeEventListener('dragleave', handleDragLeave, true)
      window.removeEventListener('dragover', handleDragOver, true)
      window.removeEventListener('drop', handleDrop, true)
      window.removeEventListener('dragend', resetDraggingState, true)
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [t])

  if (!isOverlayMounted) {
    return null
  }

  return createPortal(
    <m.div
      initial={false}
      animate={{
        opacity: isOverlayVisible ? 1 : 0,
      }}
      transition={Spring.presets.smooth}
      className="fixed inset-0 z-50 pointer-events-none bg-background/80 backdrop-blur-sm"
    >
      <m.div
        initial={false}
        animate={{
          opacity: isOverlayVisible ? 1 : 0,
          y: isOverlayVisible ? 0 : 12,
          scale: isOverlayVisible ? 1 : 0.98,
        }}
        transition={Spring.presets.smooth}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        <LinearBorderPanel>
          <div className="relative w-[min(480px,90vw)] overflow-hidden bg-material-ultra-thick">
            {/* Decorative background layer */}
            <div className="pointer-events-none absolute inset-0 opacity-50">
              <div className="absolute -inset-32 blur-3xl bg-linear-to-br from-accent/25 via-transparent to-transparent" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_60%)]" />
            </div>

            {/* Content */}
            <div className="relative p-6">
              <div className="flex items-start gap-4">
                <m.div
                  initial={false}
                  animate={{
                    scale: isOverlayVisible ? 1 : 0.9,
                  }}
                  transition={Spring.presets.snappy}
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-accent/40 bg-accent/15 text-accent transition-all duration-200"
                >
                  <UploadCloud className="size-5" strokeWidth={2} />
                </m.div>
                <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                  <div className="text-sm font-medium leading-tight">{t(photoLibraryDndKeys.title)}</div>
                  <div className="text-xs text-text-secondary leading-relaxed">
                    {t(photoLibraryDndKeys.description)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </LinearBorderPanel>
      </m.div>
    </m.div>,
    document.body,
  )
}

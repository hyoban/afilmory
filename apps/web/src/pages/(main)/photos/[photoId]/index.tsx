import { RootPortal, RootPortalProvider } from '@afilmory/ui'
import clsx from 'clsx'
import { useAtomValue } from 'jotai'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RemoveScroll } from 'react-remove-scroll'

import { isHydrationEnded } from '~/atoms/hydration'
import { setViewer, viewerAtom } from '~/atoms/viewer'
import { NotFound } from '~/components/common/NotFound'
import { useContextPhotos, usePhotoViewer } from '~/hooks/usePhotoViewer'
import { useTitle } from '~/hooks/useTitle'
import { deriveAccentFromSources } from '~/lib/color'
import { PhotoViewer } from '~/modules/viewer'
import type { LocalPhotoTrashNavigationDirection } from '~/modules/viewer/local-photo-trash-state'
import {
  markPhotoLocallyTrashed,
  resolveLocalPhotoTrashSuccess,
  shouldIgnoreLocalPhotoTrashIndexChange,
} from '~/modules/viewer/local-photo-trash-state'

export const Component = () => {
  const photoViewer = usePhotoViewer()
  const viewerState = useAtomValue(viewerAtom)
  const photos = useContextPhotos()
  const [disableEntryTransition] = useState(() => !isHydrationEnded())

  const [ref, setRef] = useState<HTMLElement | null>(null)
  const rootPortalValue = useMemo(
    () => ({
      to: ref as HTMLElement,
    }),
    [ref],
  )
  useTitle(photos[photoViewer.currentIndex]?.title || 'Not Found')

  const [accentColor, setAccentColor] = useState<string | null>(null)

  // Track closing state to allow exit animation before navigation.
  // isCloseActiveRef is set when a close is requested and cleared when the
  // photo route changes, so a stale animation completion cannot navigate away.
  const [isClosing, setIsClosing] = useState(false)
  const closeViewerRef = useRef(photoViewer.closeViewer)
  closeViewerRef.current = photoViewer.closeViewer
  const isCloseActiveRef = useRef(false)
  const trashNavigationDirectionRef = useRef<LocalPhotoTrashNavigationDirection>('forward')
  const pendingTrashTargetPhotoIdRef = useRef<string | null>(null)

  // Cancel a pending close when the viewed photo changes (e.g. browser back/forward)
  useEffect(() => {
    if (isClosing) {
      isCloseActiveRef.current = false
      setIsClosing(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoViewer.currentIndex])

  const handleClose = useCallback(() => {
    isCloseActiveRef.current = true
    setIsClosing(true)
  }, [])

  const handlePhotoTrashSuccess = useCallback(
    (photoId: string) => {
      const trashedPhotoIndex = photos.findIndex(photo => photo.id === photoId)
      const transition = resolveLocalPhotoTrashSuccess(photos, trashedPhotoIndex, trashNavigationDirectionRef.current)

      if (transition.type === 'go-to-photo') {
        pendingTrashTargetPhotoIdRef.current = transition.photoId
        photoViewer.goToPhoto(transition.photoId, { replace: true })
        markPhotoLocallyTrashed(photoId)
        return
      }

      pendingTrashTargetPhotoIdRef.current = null
      closeViewerRef.current({ replace: true })
      markPhotoLocallyTrashed(photoId)
    },
    [photoViewer, photos],
  )

  const handleIndexChange = useCallback(
    (nextIndex: number) => {
      const pendingTrashTargetPhotoId = pendingTrashTargetPhotoIdRef.current
      if (shouldIgnoreLocalPhotoTrashIndexChange(photos, nextIndex, pendingTrashTargetPhotoId)) {
        return
      }
      if (pendingTrashTargetPhotoId && photos[nextIndex]?.id === pendingTrashTargetPhotoId) {
        pendingTrashTargetPhotoIdRef.current = null
      }

      if (nextIndex < photoViewer.currentIndex) {
        trashNavigationDirectionRef.current = 'backward'
      }
      else if (nextIndex > photoViewer.currentIndex) {
        trashNavigationDirectionRef.current = 'forward'
      }

      photoViewer.goToIndex(nextIndex)
    },
    [photoViewer, photos],
  )

  useEffect(() => {
    const pendingTrashTargetPhotoId = pendingTrashTargetPhotoIdRef.current
    if (pendingTrashTargetPhotoId && photos[photoViewer.currentIndex]?.id === pendingTrashTargetPhotoId) {
      pendingTrashTargetPhotoIdRef.current = null
    }
  }, [photoViewer.currentIndex, photos])

  const handleExitComplete = useCallback(() => {
    if (isCloseActiveRef.current) {
      isCloseActiveRef.current = false
      // Navigate away — the component unmounts so no need to reset isClosing.
      // Resetting it before navigation would momentarily flip isOpen back to true
      // (the URL still has the photoId), causing the backdrop to flash.
      closeViewerRef.current()
    }
    else {
      setIsClosing(false)
    }
  }, [])

  useEffect(() => {
    if (!photoViewer.isOpen || isClosing) {
      return
    }
    if (viewerState.pendingCloseInstanceId == null) {
      return
    }
    if (viewerState.pendingCloseInstanceId !== viewerState.openInstanceId) {
      return
    }

    setViewer((prev) => {
      if (prev.pendingCloseInstanceId !== viewerState.pendingCloseInstanceId) {
        return prev
      }

      return {
        ...prev,
        pendingCloseInstanceId: null,
      }
    })

    handleClose()
  }, [handleClose, isClosing, photoViewer.isOpen, viewerState.openInstanceId, viewerState.pendingCloseInstanceId])

  useEffect(() => {
    const current = photos[photoViewer.currentIndex]
    if (!current) {
      return
    }

    let isCancelled = false

    let cssTimeout: ReturnType<typeof setTimeout> | null = null
    let cssElement: HTMLStyleElement | null = null

    ;(async () => {
      try {
        const color = await deriveAccentFromSources({
          thumbHash: current.thumbHash,
          thumbnailUrl: current.thumbnailUrl,
        })
        if (!isCancelled) {
          const $css = document.createElement('style')
          $css.textContent = `
         * {
             transition: color 0.2s ease-in-out, background-color 0.2s ease-in-out;
            }
          `
          document.head.append($css)
          cssElement = $css

          cssTimeout = setTimeout(() => {
            $css.remove()
            cssTimeout = null
            cssElement = null
          }, 100)

          setAccentColor(color ?? null)
        }
      }
      catch {
        if (!isCancelled) {
          setAccentColor(null)
        }
      }
    })()

    return () => {
      isCancelled = true
      if (cssTimeout) {
        clearTimeout(cssTimeout)
      }
      cssElement?.remove()
    }
  }, [photoViewer.currentIndex, photos])

  if (!photos[photoViewer.currentIndex]) {
    return <NotFound />
  }

  const isOpen = photoViewer.isOpen && !isClosing

  return (
    <RootPortal>
      <RootPortalProvider value={rootPortalValue}>
        <RemoveScroll
          style={
            {
              ...(accentColor ? { '--color-accent': accentColor } : {}),
            } as React.CSSProperties
          }
          ref={setRef}
          className={clsx(isOpen ? 'fixed inset-0 z-9999' : 'pointer-events-none fixed inset-0 z-40')}
        >
          <PhotoViewer
            photos={photos}
            currentIndex={photoViewer.currentIndex}
            isOpen={isOpen}
            triggerElement={photoViewer.triggerElement}
            disableEntryTransition={disableEntryTransition}
            onClose={handleClose}
            onIndexChange={handleIndexChange}
            onTrashSuccess={handlePhotoTrashSuccess}
            onExitComplete={handleExitComplete}
          />
        </RemoveScroll>
      </RootPortalProvider>
    </RootPortal>
  )
}

import './PhotoViewer.css'
// Import Swiper styles
import 'swiper/css'
import 'swiper/css/navigation'

import { Thumbhash } from '@afilmory/ui'
import { Spring } from '@afilmory/utils'
import type { AnimationFrameRect, MobileViewerDismissSnapshot } from '@afilmory/viewer-motion'
import {
  createInspectorSheetPresentation,
  DEFAULT_MOBILE_VIEWER_MEDIA_TRANSFORM_ORIGIN,
  projectDismissedViewerMediaFrame,
  resolveInspectorSheetHeight,
  SharedElementTransitionPreview,
  useViewerMobileInteractions,
  useViewerTransitions,
} from '@afilmory/viewer-motion'
import { PanelRightOpen } from 'lucide-react'
import { AnimatePresence, m } from 'motion/react'
import { Fragment, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Swiper as SwiperType } from 'swiper'
import { Navigation, Virtual } from 'swiper/modules'
import { Swiper, SwiperSlide } from 'swiper/react'

import { useMobile } from '~/hooks/useMobile'
import type { LoadingIndicatorRef } from '~/modules/inspector/LoadingIndicator'
import { LoadingIndicator } from '~/modules/inspector/LoadingIndicator'
import { PhotoInspector } from '~/modules/inspector/PhotoInspector'
import { ShareModal } from '~/modules/social/ShareModal'
import type { PhotoManifest } from '~/types/photo'

import { ReactionRail } from '../social'
import { resolvePhotoViewerEntryState, shouldHideCurrentViewerImage } from './entry-animation-state'
import { GalleryThumbnail } from './GalleryThumbnail'
import { MobilePhotoInspectorSheet } from './MobilePhotoInspectorSheet'
import { ProgressiveImage } from './ProgressiveImage'

interface PhotoViewerProps {
  photos: PhotoManifest[]
  currentIndex: number
  isOpen: boolean
  onClose: () => void
  onDragDismiss?: (frame: AnimationFrameRect) => void
  onIndexChange: (index: number) => void
  triggerElement: HTMLElement | null
  disableEntryTransition?: boolean
  onExitComplete?: () => void
}

const AFILMORY_VIEWER_FRAME_LAYOUT = {
  desktopSidebarWidthRem: 20,
  desktopThumbnailStripHeight: 64,
  mobileThumbnailStripHeight: 48,
} as const

export const PhotoViewer = ({
  photos,
  currentIndex,
  isOpen,
  onClose,
  onDragDismiss,
  onIndexChange,
  triggerElement,
  disableEntryTransition = false,
  onExitComplete,
}: PhotoViewerProps) => {
  const { t } = useTranslation()
  const isMobile = useMobile()
  const swiperRef = useRef<SwiperType | null>(null)
  const [isImageZoomed, setIsImageZoomed] = useState(false)
  const [isCurrentImageVisualReady, setIsCurrentImageVisualReady] = useState(false)
  const [isDesktopInspectorVisible, setIsDesktopInspectorVisible] = useState(!isMobile)
  const [currentBlobSrc, setCurrentBlobSrc] = useState<string | null>(null)
  const [dragDismissExitFrame, setDragDismissExitFrame] = useState<AnimationFrameRect | null>(null)
  const [entrySuppressedPhotoId] = useState(() => (disableEntryTransition ? (photos[currentIndex]?.id ?? null) : null))

  const currentPhoto = photos[currentIndex]
  const {
    containerRef,
    entryTransition,
    exitTransition,
    hasTransitionTrigger,
    isViewerContentVisible,
    isEntryAnimating,
    shouldRenderBackdrop,
    thumbHash: transitionThumbHash,
    shouldRenderThumbhash,
    handleEntryTransitionReady,
    handleEntryTransitionComplete,
    handleExitAnimationComplete,
  } = useViewerTransitions({
    disableEntryTransition,
    exitOverrideFrame: dragDismissExitFrame,
    isOpen,
    layout: AFILMORY_VIEWER_FRAME_LAYOUT,
    triggerElement,
    currentItem: currentPhoto
      ? {
          id: currentPhoto.id,
          width: currentPhoto.width,
          height: currentPhoto.height,
          previewSrc: currentPhoto.thumbnailUrl,
          fullSrc: currentPhoto.originalUrl,
          thumbHash: currentPhoto.thumbHash,
        }
      : undefined,
    currentDisplaySrc: currentBlobSrc,
    isMobile,
    onExitComplete,
  })

  const handleCloseRequest = useCallback(() => {
    setDragDismissExitFrame(null)
    onClose()
  }, [onClose])

  const handleDragDismiss = useCallback(
    (snapshot: MobileViewerDismissSnapshot) => {
      if (!currentPhoto) {
        handleCloseRequest()
        return
      }

      const viewportRect
        = containerRef.current?.getBoundingClientRect() ?? new DOMRect(0, 0, window.innerWidth, window.innerHeight)
      const projectedFrame = projectDismissedViewerMediaFrame({
        item: {
          width: currentPhoto.width,
          height: currentPhoto.height,
        },
        layout: AFILMORY_VIEWER_FRAME_LAYOUT,
        viewportRect,
        snapshot,
        isMobile: true,
      })

      setDragDismissExitFrame(projectedFrame)
      onDragDismiss?.(projectedFrame)
      onClose()
    },
    [containerRef, currentPhoto, handleCloseRequest, onClose, onDragDismiss],
  )

  const {
    bindStage,
    closeInspector,
    dismissX,
    inspectorProgress,
    isInspectorVisible: isMobileInspectorVisible,
    isVerticalGestureActive,
    reset: resetMobileInteractions,
    stageHintOpacity,
    stageHintY,
    thumbnailsOpacity,
    thumbnailsY,
    toggleInspector,
    viewerBorderRadius,
    viewerLiftY,
    viewerRotate,
    viewerScale,
    backdropOpacity,
    chromeOpacity,
    chromeY,
  } = useViewerMobileInteractions({
    enabled: isMobile && isOpen,
    isImageZoomed,
    onDismiss: handleDragDismiss,
  })
  const isInspectorVisible = isMobile ? isMobileInspectorVisible : isDesktopInspectorVisible
  const isMobileChromeInteractive = !isMobile || !isMobileInspectorVisible
  const mobileChromeButtonClassName = isMobileChromeInteractive ? 'pointer-events-auto' : 'pointer-events-none'

  useEffect(() => {
    if (isOpen) {
      setDragDismissExitFrame(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      setIsCurrentImageVisualReady(false)
      return
    }

    if (!hasTransitionTrigger) {
      setIsCurrentImageVisualReady(true)
    }
  }, [hasTransitionTrigger, isOpen])

  useEffect(() => {
    if (entryTransition?.variant === 'entry') {
      setIsCurrentImageVisualReady(false)
    }
  }, [entryTransition])

  useEffect(() => {
    if (!isOpen) {
      setIsImageZoomed(false)
      setIsDesktopInspectorVisible(!isMobile)
      setCurrentBlobSrc(null)
      if (!dragDismissExitFrame) {
        resetMobileInteractions()
      }
    }
  }, [dragDismissExitFrame, isMobile, isOpen, resetMobileInteractions])

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      // Only trigger swiper movement - onSlideChange will call onIndexChange
      swiperRef.current?.slidePrev()
    }
  }, [currentIndex])

  const handleNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      // Only trigger swiper movement - onSlideChange will call onIndexChange
      swiperRef.current?.slideNext()
    }
  }, [currentIndex, photos.length])

  // 同步 Swiper 的索引
  useEffect(() => {
    if (swiperRef.current && swiperRef.current.activeIndex !== currentIndex) {
      swiperRef.current.slideTo(currentIndex, 300)
    }
    // 切换图片时重置缩放状态
    setDragDismissExitFrame(null)
    setIsImageZoomed(false)
    if (isMobile) {
      resetMobileInteractions()
    }
  }, [currentIndex, isMobile, resetMobileInteractions])

  // 当图片缩放状态改变时，控制 Swiper 的触摸行为
  useEffect(() => {
    if (swiperRef.current) {
      if (isImageZoomed || (isMobile && (isVerticalGestureActive || isInspectorVisible))) {
        // 图片被缩放时，禁用 Swiper 的触摸滑动
        swiperRef.current.allowTouchMove = false
      }
      else {
        // 图片未缩放时，启用 Swiper 的触摸滑动
        swiperRef.current.allowTouchMove = true
      }
    }
  }, [isImageZoomed, isInspectorVisible, isMobile, isVerticalGestureActive])

  const loadingIndicatorRef = useRef<LoadingIndicatorRef>(null)
  // 处理图片缩放状态变化
  const handleZoomChange = useCallback((isZoomed: boolean) => {
    setIsImageZoomed(isZoomed)
  }, [])

  // 处理 blobSrc 变化
  const handleBlobSrcChange = useCallback((blobSrc: string | null) => {
    setCurrentBlobSrc(blobSrc)
  }, [])

  useEffect(() => {
    if (isMobile && isImageZoomed && isInspectorVisible) {
      closeInspector()
    }
  }, [closeInspector, isImageZoomed, isInspectorVisible, isMobile])

  const currentThumbHash = transitionThumbHash
  const { shouldMountImageStage, shouldShowEntryImageCatchup } = resolvePhotoViewerEntryState({
    hasTransitionTrigger,
    isCurrentImageVisualReady,
    isEntryTransitionActive: entryTransition?.variant === 'entry',
    isOpen,
    isViewerContentVisible,
  })

  // 键盘导航
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowLeft': {
          event.preventDefault()
          handlePrevious()
          break
        }
        case 'ArrowRight': {
          event.preventDefault()
          handleNext()
          break
        }
        case 'Escape': {
          event.preventDefault()
          handleCloseRequest()
          break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleCloseRequest, handlePrevious, handleNext])

  useEffect(() => {
    if (!shouldMountImageStage) {
      swiperRef.current = null
    }
  }, [shouldMountImageStage])

  if (!currentPhoto) {
    return null
  }

  return (
    <>
      <AnimatePresence>
        {shouldRenderBackdrop && (
          <m.div
            key="photo-viewer-backdrop"
            initial={disableEntryTransition ? false : { opacity: 0 }}
            animate={{ opacity: isOpen ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={Spring.presets.snappy}
            className="fixed inset-0"
          >
            <m.div
              className="bg-material-opaque absolute inset-0"
              style={isMobile ? { opacity: backdropOpacity } : undefined}
            />
          </m.div>
        )}
      </AnimatePresence>
      {/* 固定背景层防止透出 */}
      {/* 交叉溶解的 Blurhash 背景 */}
      <AnimatePresence mode="sync">
        {shouldRenderThumbhash && (
          <m.div
            key={`${currentPhoto.id}-thumbhash`}
            initial={disableEntryTransition ? false : { opacity: 0 }}
            animate={{ opacity: isOpen ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={Spring.presets.snappy}
            className="fixed inset-0"
          >
            {currentThumbHash && <Thumbhash thumbHash={currentThumbHash} className="size-fill scale-110" />}
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <m.div
            ref={containerRef}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{
              touchAction: isMobile ? 'manipulation' : 'none',
              pointerEvents: !isViewerContentVisible || isEntryAnimating ? 'none' : 'auto',
            }}
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={Spring.presets.snappy}
          >
            <div className={`flex size-full ${isMobile ? 'flex-col' : 'flex-row'}`}>
              <div className="z-1 flex min-h-0 min-w-0 flex-1 flex-col" {...(isMobile ? bindStage() : {})}>
                <m.div
                  className={`flex min-h-0 min-w-0 flex-1 flex-col ${isMobile ? 'overflow-hidden' : ''}`}
                  style={
                    isMobile
                      ? {
                          x: dismissX,
                          y: viewerLiftY,
                          scale: viewerScale,
                          rotate: viewerRotate,
                          borderRadius: viewerBorderRadius,
                          transformOrigin: DEFAULT_MOBILE_VIEWER_MEDIA_TRANSFORM_ORIGIN,
                          touchAction: 'none',
                        }
                      : undefined
                  }
                >
                  <m.div
                    className="group/photo-viewer relative flex min-h-0 min-w-0 flex-1"
                    initial={false}
                    animate={{ opacity: 1 }}
                  >
                    {/* 顶部工具栏 */}
                    <m.div
                      initial={disableEntryTransition ? false : { opacity: 0 }}
                      animate={{ opacity: isViewerContentVisible ? 1 : 0 }}
                      exit={{ opacity: 0 }}
                      transition={Spring.presets.snappy}
                      className={`pointer-events-none absolute ${isMobile ? 'top-2 right-2 left-2' : 'top-4 right-4 left-4'} z-30 flex items-center justify-between`}
                      style={isMobile ? { opacity: chromeOpacity, y: chromeY } : undefined}
                    >
                      {/* 左侧工具按钮 */}
                      <div className="flex items-center gap-2">
                        {/* 信息按钮 - 在移动设备上显示 */}
                        {isMobile && (
                          <button
                            type="button"
                            disabled={!isMobileChromeInteractive}
                            className={`bg-material-ultra-thick ${mobileChromeButtonClassName} flex size-8 items-center justify-center rounded-full text-white backdrop-blur-2xl duration-200 hover:bg-black/40 disabled:cursor-default ${isInspectorVisible ? 'bg-accent' : ''}`}
                            onClick={toggleInspector}
                          >
                            <i className="i-mingcute-information-line" />
                          </button>
                        )}
                      </div>

                      {/* 右侧按钮组 */}
                      <div className="flex items-center gap-2">
                        {/* 分享按钮 */}
                        <ShareModal
                          photo={currentPhoto}
                          blobSrc={currentBlobSrc || undefined}
                          trigger={(
                            <button
                              type="button"
                              disabled={!isMobileChromeInteractive}
                              className={`bg-material-ultra-thick ${mobileChromeButtonClassName} flex size-8 items-center justify-center rounded-full text-white backdrop-blur-2xl duration-200 hover:bg-black/40 disabled:cursor-default`}
                              title={t('photo.share.title')}
                            >
                              <i className="i-mingcute-share-2-line" />
                            </button>
                          )}
                        />

                        {/* 展开信息面板（桌面端在折叠时显示） */}
                        {!isMobile && !isInspectorVisible && (
                          <button
                            type="button"
                            className="bg-material-ultra-thick pointer-events-auto flex size-8 items-center justify-center rounded-full text-white backdrop-blur-2xl duration-200 hover:bg-black/40"
                            onClick={() => setIsDesktopInspectorVisible(true)}
                            title={t('inspector.tab.info')}
                          >
                            <PanelRightOpen className="size-4" />
                          </button>
                        )}

                        {/* 关闭按钮 */}
                        <button
                          type="button"
                          disabled={!isMobileChromeInteractive}
                          className={`bg-material-ultra-thick ${mobileChromeButtonClassName} flex size-8 items-center justify-center rounded-full text-white backdrop-blur-2xl duration-200 hover:bg-black/40 disabled:cursor-default`}
                          onClick={handleCloseRequest}
                        >
                          <i className="i-mingcute-close-line" />
                        </button>
                      </div>
                    </m.div>

                    {/* 加载指示器 */}
                    <LoadingIndicator ref={loadingIndicatorRef} />
                    <div
                      className="relative flex h-full w-full items-center justify-center"
                      data-photo-viewer-stage="true"
                      style={{
                        touchAction: isMobile ? 'pan-x pinch-zoom' : 'pan-y',
                      }}
                    >
                      {shouldShowEntryImageCatchup && (
                        <div
                          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-150"
                          data-photo-viewer-entry-catchup="true"
                        >
                          <div className="relative h-full w-full">
                            {currentThumbHash && (
                              <Thumbhash
                                thumbHash={currentThumbHash}
                                className="pointer-events-none absolute inset-0"
                              />
                            )}
                            <img
                              src={currentPhoto.thumbnailUrl || currentPhoto.originalUrl}
                              alt=""
                              className="absolute inset-0 h-full w-full object-contain"
                              draggable={false}
                            />
                          </div>
                        </div>
                      )}

                      {shouldMountImageStage ? (
                        <Swiper
                          modules={[Navigation, Virtual]}
                          spaceBetween={0}
                          slidesPerView={1}
                          initialSlide={currentIndex}
                          virtual
                          onSwiper={(swiper) => {
                            swiperRef.current = swiper
                            swiper.allowTouchMove
                              = !isImageZoomed && !(isMobile && (isVerticalGestureActive || isInspectorVisible))
                          }}
                          onSlideChange={(swiper) => {
                            onIndexChange(swiper.activeIndex)
                          }}
                          className="h-full w-full"
                          style={{ touchAction: isMobile ? 'pan-x' : 'pan-y' }}
                        >
                          {photos.map((photo, index) => {
                            const isCurrentImage = index === currentIndex
                            const hideCurrentImage = shouldHideCurrentViewerImage({
                              isCurrentImage,
                              isEntryImageCatchupVisible: shouldShowEntryImageCatchup,
                            })
                            const suppressSlideEntry
                              = (isCurrentImage && entryTransition?.variant === 'entry')
                                || photo.id === entrySuppressedPhotoId
                            return (
                              <SwiperSlide
                                key={photo.id}
                                className="flex items-center justify-center"
                                virtualIndex={index}
                              >
                                <ReactionRail photoId={photo.id} />
                                <m.div
                                  initial={suppressSlideEntry ? false : { opacity: 0.5, scale: 0.95 }}
                                  animate={suppressSlideEntry ? undefined : { opacity: 1, scale: 1 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  transition={suppressSlideEntry ? undefined : Spring.presets.smooth}
                                  className="relative flex h-full w-full items-center justify-center"
                                  style={{
                                    opacity: hideCurrentImage ? 0 : 1,
                                    pointerEvents: hideCurrentImage ? 'none' : undefined,
                                  }}
                                >
                                  <ProgressiveImage
                                    loadingIndicatorRef={loadingIndicatorRef}
                                    isCurrentImage={isCurrentImage}
                                    src={photo.originalUrl}
                                    thumbnailSrc={photo.thumbnailUrl}
                                    alt={photo.title}
                                    width={isCurrentImage ? currentPhoto.width : undefined}
                                    height={isCurrentImage ? currentPhoto.height : undefined}
                                    className="h-full w-full object-contain"
                                    enablePan={isCurrentImage ? !isMobile || isImageZoomed : true}
                                    enableZoom={true}
                                    shouldRenderHighRes={isCurrentImage && isViewerContentVisible && isOpen}
                                    onZoomChange={isCurrentImage ? handleZoomChange : undefined}
                                    onBlobSrcChange={isCurrentImage ? handleBlobSrcChange : undefined}
                                    onVisualReadyChange={isCurrentImage ? setIsCurrentImageVisualReady : undefined}
                                    disableThumbnailTransition={isCurrentImage && entryTransition?.variant === 'entry'}
                                    videoSource={
                                      photo.video?.type === 'motion-photo'
                                        ? {
                                            type: 'motion-photo',
                                            imageUrl: photo.originalUrl,
                                            offset: photo.video.offset,
                                            size: photo.video.size,
                                            presentationTimestamp: photo.video.presentationTimestamp,
                                          }
                                        : photo.video?.type === 'live-photo'
                                          ? {
                                              type: 'live-photo',
                                              videoUrl: photo.video.videoUrl,
                                            }
                                          : { type: 'none' }
                                    }
                                    shouldAutoPlayVideoOnce={isCurrentImage}
                                    isHDR={photo.isHDR}
                                  />
                                </m.div>
                              </SwiperSlide>
                            )
                          })}
                        </Swiper>
                      ) : (
                        <div className="h-full w-full" />
                      )}

                      {isMobile && (
                        <m.div
                          className="bg-material-ultra-thick pointer-events-none absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full px-3 py-1 text-xs text-white/70 backdrop-blur-xl"
                          style={{ opacity: stageHintOpacity, y: stageHintY }}
                        >
                          <i className="i-mingcute-arrow-up-line text-sm" />
                          <i className="i-mingcute-information-line text-sm" />
                          <span className="h-3 w-px bg-white/10" />
                          <i className="i-mingcute-arrow-down-line text-sm" />
                          <i className="i-mingcute-close-line text-sm" />
                        </m.div>
                      )}

                      {/* 自定义导航按钮 */}
                      {!isMobile && (
                        <Fragment>
                          {currentIndex > 0 && (
                            <button
                              type="button"
                              className="bg-material-medium absolute top-1/2 left-4 z-20 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-white opacity-0 backdrop-blur-sm duration-200 group-hover/photo-viewer:opacity-100 hover:bg-black/40"
                              onClick={handlePrevious}
                            >
                              <i className="i-mingcute-left-line text-xl" />
                            </button>
                          )}

                          {currentIndex < photos.length - 1 && (
                            <button
                              type="button"
                              className="bg-material-medium absolute top-1/2 right-4 z-20 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-white opacity-0 backdrop-blur-sm duration-200 group-hover/photo-viewer:opacity-100 hover:bg-black/40"
                              onClick={handleNext}
                            >
                              <i className="i-mingcute-right-line text-xl" />
                            </button>
                          )}
                        </Fragment>
                      )}
                    </div>
                  </m.div>

                  <m.div
                    style={isMobile ? { opacity: thumbnailsOpacity, y: thumbnailsY } : undefined}
                    className={isMobile && isInspectorVisible ? 'pointer-events-none' : undefined}
                  >
                    <Suspense>
                      <GalleryThumbnail
                        currentIndex={currentIndex}
                        photos={photos}
                        onIndexChange={onIndexChange}
                        visible={isViewerContentVisible}
                        disableEntryTransition={disableEntryTransition}
                      />
                    </Suspense>
                  </m.div>
                </m.div>
              </div>

              {/* PhotoInspector - 根据设备与折叠状态展示 */}
              <Suspense>
                {isMobile ? (
                  <MobilePhotoInspectorSheet
                    createPresentation={createInspectorSheetPresentation}
                    currentPhoto={currentPhoto}
                    exifData={currentPhoto.exif}
                    isInteractive={isMobileInspectorVisible}
                    progress={inspectorProgress}
                    resolveHeight={resolveInspectorSheetHeight}
                    onClose={closeInspector}
                  />
                ) : (
                  isInspectorVisible && (
                    <PhotoInspector
                      currentPhoto={currentPhoto}
                      exifData={currentPhoto.exif}
                      visible={isInspectorVisible && isViewerContentVisible}
                      onClose={() => setIsDesktopInspectorVisible(false)}
                    />
                  )
                )}
              </Suspense>
            </div>
          </m.div>
        )}
      </AnimatePresence>
      {entryTransition && (
        <SharedElementTransitionPreview
          key={`${entryTransition.variant}-${entryTransition.itemId}`}
          transition={entryTransition}
          onReady={handleEntryTransitionReady}
          onComplete={handleEntryTransitionComplete}
          renderPlaceholder={thumbHash => (
            <Thumbhash thumbHash={thumbHash} className="pointer-events-none absolute inset-0 h-full w-full" />
          )}
        />
      )}
      {exitTransition && (
        <SharedElementTransitionPreview
          key={`${exitTransition.variant}-${exitTransition.itemId}`}
          transition={exitTransition}
          onComplete={handleExitAnimationComplete}
          renderPlaceholder={thumbHash => (
            <Thumbhash thumbHash={thumbHash} className="pointer-events-none absolute inset-0 h-full w-full" />
          )}
        />
      )}
    </>
  )
}

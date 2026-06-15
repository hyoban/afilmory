import { HoverCard, HoverCardContent, HoverCardTrigger, Thumbhash } from '@afilmory/ui'
import { clsxm, Spring } from '@afilmory/utils'
import { useVirtualizer } from '@tanstack/react-virtual'
import { m } from 'motion/react'
import type { FC } from 'react'
import { useEffect, useRef, useState } from 'react'

import { useMobile } from '~/hooks/useMobile'
import { nextFrame } from '~/lib/dom'
import type { PhotoManifest } from '~/types/photo'

const thumbnailSize = {
  mobile: 48,
  desktop: 64,
}

export const GalleryThumbnail: FC<{
  currentIndex: number
  photos: PhotoManifest[]
  onIndexChange: (index: number) => void
  visible?: boolean
  disableEntryTransition?: boolean
}> = ({ currentIndex, photos, onIndexChange, visible = true, disableEntryTransition = false }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const isMobile = useMobile()

  const [scrollContainerWidth, setScrollContainerWidth] = useState(0)

  const thumbnailHeight = isMobile ? thumbnailSize.mobile : thumbnailSize.desktop

  // Use tanstack virtual for horizontal scrolling
  const virtualizer = useVirtualizer({
    count: photos.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: (index) => {
      const photo = photos[index]
      return photo ? thumbnailHeight * photo.aspectRatio : thumbnailHeight
    },
    horizontal: true,
    overscan: 5,
  })

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (scrollContainer) {
      setScrollContainerWidth(scrollContainer.clientWidth)
      const handleResize = () => {
        setScrollContainerWidth(scrollContainer.clientWidth)
      }
      scrollContainer.addEventListener('resize', handleResize)
      return () => {
        scrollContainer.removeEventListener('resize', handleResize)
      }
    }
  }, [])

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current

    if (scrollContainer && photos.length > 0 && currentIndex < photos.length) {
      // Use virtualizer's actual measurements for accurate positioning
      const virtualItem = virtualizer.getVirtualItems().find(item => item.index === currentIndex)

      if (virtualItem) {
        // virtualItem.start is the actual measured start position
        // virtualItem.size is the actual measured size
        const thumbnailCenter = virtualItem.start + virtualItem.size / 2

        // Center the thumbnail in the viewport
        const scrollLeft = thumbnailCenter - scrollContainerWidth / 2

        nextFrame(() => {
          scrollContainer.scrollTo({
            left: Math.max(0, scrollLeft),
            behavior: 'smooth',
          })
        })
      }
      else {
        // Fallback: calculate manually if virtual item not yet rendered
        let thumbnailLeft = 0
        for (let i = 0; i < currentIndex; i++) {
          const photo = photos[i]
          const width = thumbnailHeight * photo.aspectRatio
          thumbnailLeft += width
        }

        const currentPhoto = photos[currentIndex]
        const currentThumbnailWidth = thumbnailHeight * currentPhoto.aspectRatio
        const thumbnailCenter = thumbnailLeft + currentThumbnailWidth / 2
        const scrollLeft = thumbnailCenter - scrollContainerWidth / 2

        nextFrame(() => {
          scrollContainer.scrollTo({
            left: Math.max(0, scrollLeft),
            behavior: 'smooth',
          })
        })
      }
    }
  }, [currentIndex, isMobile, scrollContainerWidth, photos, thumbnailHeight, virtualizer])

  // 处理鼠标滚轮事件，映射为横向滚动
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer) {
      return
    }

    const handleWheel = (e: WheelEvent) => {
      // 阻止默认的垂直滚动
      e.preventDefault()

      // 优先使用触控板的横向滚动 (deltaX)
      // 如果没有横向滚动，则将垂直滚动 (deltaY) 转换为横向滚动
      const scrollAmount = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      scrollContainer.scrollLeft += scrollAmount
    }

    scrollContainer.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      scrollContainer.removeEventListener('wheel', handleWheel)
    }
  }, [])

  return (
    <m.div
      className="pb-safe bg-material-medium z-10 shrink-0 backdrop-blur-2xl"
      initial={disableEntryTransition ? false : { y: 100, opacity: 0 }}
      animate={{
        y: visible ? 0 : 48,
        opacity: visible ? 1 : 0,
      }}
      exit={{ y: 100, opacity: 0 }}
      transition={Spring.presets.smooth}
      style={{
        pointerEvents: visible ? 'auto' : 'none',
        boxShadow:
          '0 -8px 32px color-mix(in srgb, var(--color-accent) 8%, transparent), 0 -4px 16px color-mix(in srgb, var(--color-accent) 6%, transparent), 0 -2px 8px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Inner glow layer */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'linear-gradient(to top, color-mix(in srgb, var(--color-accent) 5%, transparent), transparent)',
        }}
      />
      <div ref={scrollContainerRef} className="scrollbar-none relative z-10 overflow-x-auto">
        <div
          style={{
            height: `${thumbnailHeight}px`,
            width: `${virtualizer.getTotalSize()}px`,
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualItem) => {
            const photo = photos[virtualItem.index]
            const thumbnailWidth = thumbnailHeight * photo.aspectRatio
            const isCurrent = virtualItem.index === currentIndex

            return (
              <div
                key={virtualItem.key}
                data-index={virtualItem.index}
                className="absolute top-0"
                style={{
                  height: `${thumbnailHeight}px`,
                  width: `${thumbnailWidth}px`,
                  transform: `translateX(${virtualItem.start}px)`,
                }}
              >
                {!isMobile ? (
                  <HoverCard openDelay={100} closeDelay={0}>
                    <HoverCardTrigger asChild>
                      <button
                        type="button"
                        className={clsxm(
                          'contain-intrinsic-size h-full w-full overflow-hidden transition-all',
                          'hover:grayscale-0',
                          isCurrent
                            ? 'scale-110 border-accent shadow-[0_0_20px_color-mix(in_srgb,var(--color-accent)_20%,transparent)]'
                            : 'grayscale border-accent/20',
                        )}
                        onClick={() => onIndexChange(virtualItem.index)}
                      >
                        {photo.thumbHash && (
                          <Thumbhash thumbHash={photo.thumbHash} className="size-fill absolute inset-0" />
                        )}
                        <img
                          src={photo.thumbnailUrl}
                          alt={photo.title}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      </button>
                    </HoverCardTrigger>

                    <HoverCardContent
                      side="top"
                      align="center"
                      sideOffset={0}
                      alignOffset={0}
                      className="w-80 overflow-hidden rounded-none border-0 p-0 shadow-[8px_-9px_20px_13px_var(--color-accent)]"
                    >
                      <div className="relative">
                        {/* Preview image */}
                        <div
                          className="relative w-full overflow-hidden"
                          style={{ aspectRatio: photo.aspectRatio, height: 'auto' }}
                        >
                          {photo.thumbHash && (
                            <Thumbhash thumbHash={photo.thumbHash} className="absolute inset-0 size-full" />
                          )}
                          <img
                            src={photo.thumbnailUrl}
                            alt={photo.title}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        </div>
                        {/* Photo info overlay */}
                        {(photo.title || photo.dateTaken) && (
                          <div className="absolute right-0 bottom-0 left-0 bg-linear-to-t from-black/60 to-transparent p-3">
                            {photo.title && (
                              <div className="truncate text-sm font-medium text-white">{photo.title}</div>
                            )}
                            {photo.dateTaken && (
                              <div className="mt-1 text-xs text-white/80">
                                {new Date(photo.dateTaken).toLocaleDateString()}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                ) : (
                  <button
                    type="button"
                    className={clsxm(
                      'contain-intrinsic-size h-full w-full overflow-hidden transition-all',
                      'hover:grayscale-0',
                      isCurrent
                        ? 'scale-110 border-accent shadow-[0_0_20px_color-mix(in_srgb,var(--color-accent)_20%,transparent)]'
                        : 'grayscale border-accent/20',
                    )}
                    onClick={() => onIndexChange(virtualItem.index)}
                  >
                    {photo.thumbHash && (
                      <Thumbhash thumbHash={photo.thumbHash} className="size-fill absolute inset-0" />
                    )}
                    <img
                      src={photo.thumbnailUrl}
                      alt={photo.title}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </m.div>
  )
}

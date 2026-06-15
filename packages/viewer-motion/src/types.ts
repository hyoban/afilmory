import type { RefObject } from 'react'

export interface AnimationFrameRect {
  left: number
  top: number
  width: number
  height: number
  borderRadius: number
  rotate: number
  transformOrigin: string
}

export interface ViewportRectLike {
  height: number
  left: number
  top: number
  width: number
}

export type ViewerTransitionVariant = 'entry' | 'exit'

export interface ViewerTransitionState {
  itemId: string
  imageSrc: string
  thumbHash?: string | null
  from: AnimationFrameRect
  to: AnimationFrameRect
}

export type ViewerTransition = ViewerTransitionState & {
  variant: ViewerTransitionVariant
}

export interface ViewerTransitionItem {
  id: string
  width?: number | null
  height?: number | null
  previewSrc?: string | null
  fullSrc?: string | null
  thumbHash?: string | null
}

export interface ViewerFrameLayout {
  desktopSidebarWidthRem?: number
  desktopThumbnailStripHeight?: number
  mobileThumbnailStripHeight?: number
}

export interface ViewerFrameTransformSnapshot {
  borderRadius: number
  rotate: number
  scale: number
  translateX: number
  translateY: number
}

export interface MobileViewerDismissSnapshot extends ViewerFrameTransformSnapshot {}

export interface UseViewerTransitionsParams<TItem extends ViewerTransitionItem> {
  currentDisplaySrc?: string | null
  currentItem?: TItem
  disableEntryTransition?: boolean
  exitOverrideFrame?: AnimationFrameRect | null
  isMobile: boolean
  isOpen: boolean
  onExitComplete?: () => void
  layout?: ViewerFrameLayout
  triggerAttribute?: string
  triggerElement: HTMLElement | null
}

export interface UseViewerTransitionsResult {
  containerRef: RefObject<HTMLDivElement | null>
  entryTransition: ViewerTransition | null
  exitTransition: ViewerTransition | null
  handleEntryTransitionComplete: () => void
  handleEntryTransitionReady: () => void
  handleExitAnimationComplete: () => void
  hasTransitionTrigger: boolean
  isEntryAnimating: boolean
  isViewerContentVisible: boolean
  shouldRenderBackdrop: boolean
  shouldRenderThumbhash: boolean
  thumbHash: string | null
}

export interface UseViewerMobileInteractionsOptions {
  enabled: boolean
  isImageZoomed: boolean
  onDismiss: (snapshot: MobileViewerDismissSnapshot) => void
  viewport?: Partial<Pick<ViewportRectLike, 'width' | 'height'>>
}

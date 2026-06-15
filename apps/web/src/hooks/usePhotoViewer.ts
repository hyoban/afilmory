import { photoLoader } from '@afilmory/data'
import { useAtomValue } from 'jotai'
import { use, useCallback, useMemo } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'

import type { DateRangeFilter } from '~/atoms/app'
import { gallerySettingAtom } from '~/atoms/app'
import { setViewer, viewerAtom } from '~/atoms/viewer'
import { jotaiStore } from '~/lib/jotai'
import { trackView } from '~/lib/tracker'
import { getPhotoDateMs, getRangeEndMs, getRangeStartMs } from '~/modules/gallery/dateRangeUtils'
import { PhotosContext } from '~/providers/photos-provider'

const data = photoLoader.getPhotos()

// 抽取照片筛选和排序逻辑为独立函数
// Note: filter uses parsed-instant comparison via getPhotoDateMs, while sort
// below uses a lexical string compare. For well-formed ISO/EXIF datetimes the
// two orderings agree; they may diverge for EXIF strings carrying explicit
// timezone offsets — filter intentionally honors viewer-local calendar day.
const filterAndSortPhotos = (
  selectedTags: string[],
  selectedCameras: string[],
  selectedLenses: string[],
  selectedRatings: number | null,
  selectedDateRange: DateRangeFilter | null,
  sortOrder: 'asc' | 'desc',
  tagFilterMode: 'union' | 'intersection' = 'union',
) => {
  // 根据 tags、cameras、lenses 和 ratings 筛选
  let filteredPhotos = data

  // Tags 筛选：根据模式进行并集或交集筛选
  if (selectedTags.length > 0) {
    filteredPhotos = filteredPhotos.filter((photo) => {
      if (tagFilterMode === 'intersection') {
        // 交集模式：照片必须包含所有选中的标签
        return selectedTags.every(tag => photo.tags.includes(tag))
      }
      else {
        // 并集模式：照片必须包含至少一个选中的标签
        return selectedTags.some(tag => photo.tags.includes(tag))
      }
    })
  }

  // Cameras 筛选：照片的相机必须匹配选中的相机之一
  if (selectedCameras.length > 0) {
    filteredPhotos = filteredPhotos.filter((photo) => {
      if (!photo.exif?.Make || !photo.exif?.Model) {
        return false
      }
      const cameraDisplayName = `${photo.exif.Make.trim()} ${photo.exif.Model.trim()}`
      return selectedCameras.includes(cameraDisplayName)
    })
  }

  // Lenses 筛选：照片的镜头必须匹配选中的镜头之一
  if (selectedLenses.length > 0) {
    filteredPhotos = filteredPhotos.filter((photo) => {
      if (!photo.exif?.LensModel) {
        return false
      }
      const lensModel = photo.exif.LensModel.trim()
      const lensMake = photo.exif.LensMake?.trim()
      const lensDisplayName = lensMake ? `${lensMake} ${lensModel}` : lensModel
      return selectedLenses.includes(lensDisplayName)
    })
  }

  // Ratings 筛选：照片的评分必须大于等于选中的最小阈值
  if (selectedRatings !== null) {
    filteredPhotos = filteredPhotos.filter((photo) => {
      if (!photo.exif?.Rating) {
        return false
      }
      return photo.exif.Rating >= selectedRatings
    })
  }

  // Date range 筛选：照片拍摄日须落入选定区间（viewer-local 日历日）
  if (selectedDateRange && (selectedDateRange.from || selectedDateRange.to)) {
    const minMs = selectedDateRange.from ? getRangeStartMs(selectedDateRange.from) : -Infinity
    const maxMs = selectedDateRange.to ? getRangeEndMs(selectedDateRange.to) : Infinity
    filteredPhotos = filteredPhotos.filter((photo) => {
      const ts = getPhotoDateMs(photo)
      if (ts === null) {
        return false
      }
      return ts >= minMs && ts <= maxMs
    })
  }

  // 然后排序
  const sortedPhotos = filteredPhotos.toSorted((a, b) => {
    let aDateStr = ''
    let bDateStr = ''

    if (a.exif && a.exif.DateTimeOriginal) {
      aDateStr = a.exif.DateTimeOriginal as unknown as string
    }
    else {
      aDateStr = a.lastModified
    }

    if (b.exif && b.exif.DateTimeOriginal) {
      bDateStr = b.exif.DateTimeOriginal as unknown as string
    }
    else {
      bDateStr = b.lastModified
    }

    return sortOrder === 'asc' ? aDateStr.localeCompare(bDateStr) : bDateStr.localeCompare(aDateStr)
  })

  return sortedPhotos
}

// 提供一个 getter 函数供非 UI 组件使用
export const getFilteredPhotos = () => {
  // 直接从 jotaiStore 中读取当前状态
  const currentGallerySetting = jotaiStore.get(gallerySettingAtom)
  return filterAndSortPhotos(
    currentGallerySetting.selectedTags,
    currentGallerySetting.selectedCameras,
    currentGallerySetting.selectedLenses,
    currentGallerySetting.selectedRatings,
    currentGallerySetting.selectedDateRange,
    currentGallerySetting.sortOrder,
    currentGallerySetting.tagFilterMode,
  )
}

export const usePhotos = () => {
  const {
    sortOrder,
    selectedTags,
    selectedCameras,
    selectedLenses,
    selectedRatings,
    selectedDateRange,
    tagFilterMode,
  } = useAtomValue(gallerySettingAtom)

  const masonryItems = useMemo(() => {
    return filterAndSortPhotos(
      selectedTags,
      selectedCameras,
      selectedLenses,
      selectedRatings,
      selectedDateRange,
      sortOrder,
      tagFilterMode,
    )
  }, [sortOrder, selectedTags, selectedCameras, selectedLenses, selectedRatings, selectedDateRange, tagFilterMode])

  return masonryItems
}

export const useContextPhotos = () => {
  const photos = use(PhotosContext)
  if (!photos) {
    throw new Error('PhotosContext is not initialized')
  }
  return photos
}

export const usePhotoViewer = () => {
  const photos = usePhotos()
  const navigate = useNavigate()
  const location = useLocation()
  const { photoId: urlPhotoId } = useParams()
  const viewerState = useAtomValue(viewerAtom)

  // Derive isOpen from URL params - viewer is open if a photoId param is present
  const isOpen = !!urlPhotoId

  // Derive currentIndex from URL photo ID
  const currentIndex = useMemo(() => {
    if (!urlPhotoId) {
      return viewerState.photoId ? photos.findIndex(p => p.id === viewerState.photoId) : 0
    }
    const index = photos.findIndex(p => p.id === urlPhotoId)
    return index !== -1 ? index : 0
  }, [urlPhotoId, photos, viewerState.photoId])

  const openViewer = useCallback(
    (index: number, element?: HTMLElement) => {
      const photo = photos[index]
      if (!photo) {
        return
      }

      setViewer(prev => ({
        ...prev,
        isOpen: true,
        openInstanceId: prev.openInstanceId + 1,
        pendingCloseInstanceId: null,
        photoId: photo.id,
        triggerElement: element || null,
      }))

      // Navigate to photo URL (creates history entry)
      navigate(`/photos/${photo.id}${location.search}`)

      // 防止背景滚动
      document.body.style.overflow = 'hidden'

      trackView(photo.id)
    },
    [photos, navigate, location.search],
  )

  const closeViewer = useCallback(() => {
    setViewer(prev => ({
      ...prev,
      isOpen: false,
      pendingCloseInstanceId: null,
      triggerElement: null,
    }))

    // Navigate back to gallery (creates history entry)
    // Check if we're on explory path to preserve it
    const isExploryPath = location.pathname.includes('/explory')
    if (isExploryPath) {
      navigate(`/explory${location.search}`)
    }
    else {
      navigate(`/${location.search}`)
    }

    // 恢复背景滚动
    document.body.style.overflow = ''
  }, [navigate, location.search, location.pathname])

  const goToIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < photos.length) {
        const photo = photos[index]

        // Skip if URL already points to this photo (prevents loop on browser back/forward)
        if (urlPhotoId === photo.id) {
          return
        }

        setViewer(prev => ({
          ...prev,
          photoId: photo.id,
        }))

        // Create history entry for each photo navigation to support browser back/forward
        navigate(`/photos/${photo.id}${location.search}`)

        trackView(photo.id)
      }
    },
    [photos, navigate, location.search, urlPhotoId],
  )

  return {
    isOpen,
    currentIndex,
    triggerElement: viewerState.triggerElement,
    openViewer,
    closeViewer,
    goToIndex,
  }
}

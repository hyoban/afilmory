import { Spring } from '@afilmory/utils'
import { useAtom, useSetAtom } from 'jotai'
import type { LucideIcon } from 'lucide-react'
import { Aperture, Calendar, Camera, GitBranch, Star, Tag } from 'lucide-react'
import { m as motion } from 'motion/react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { gallerySettingAtom, isCommandPaletteOpenAtom } from '~/atoms/app'
import { useContextPhotos } from '~/hooks/usePhotoViewer'
import type { PhotoManifest } from '~/types/photo'

import { FilterChips } from './FilterChips'
import { HeroActions } from './HeroActions'

type DateRangeShape = { from: string | null, to: string | null }

const formatDateRangeHeadline = (range: DateRangeShape, t: ReturnType<typeof useTranslation>['t']): string => {
  if (range.from && range.to) {
    return `${range.from} → ${range.to}`
  }
  if (range.from) {
    return t('action.date.since', { date: range.from })
  }
  if (range.to) {
    return t('action.date.until', { date: range.to })
  }
  return ''
}

// 从照片中随机选择一些作为背景拼贴
const getRandomPhotos = (photos: PhotoManifest[], count = 12): PhotoManifest[] => {
  if (photos.length === 0) {
    return []
  }
  const shuffled = [...photos].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, photos.length))
}

export const ActiveFiltersHero = () => {
  const { t } = useTranslation()
  const [gallerySetting, setGallerySetting] = useAtom(gallerySettingAtom)
  const setCommandPaletteOpen = useSetAtom(isCommandPaletteOpenAtom)
  const photos = useContextPhotos()

  // 获取背景照片（使用筛选后的照片）
  const backgroundPhotos = useMemo(() => getRandomPhotos(photos, 12), [photos])

  const summarizeValues = (items: string[], limit = 3) => {
    if (items.length === 0) {
      return ''
    }
    const summary = items.slice(0, limit).join(' · ')
    const remaining = items.length - limit
    return remaining > 0 ? `${summary} +${remaining}` : summary
  }

  // Headline shows at most 2 fragments; priority: tags → cameras → lenses → rating → date.
  const headline = useMemo(() => {
    const fragments: string[] = []
    if (gallerySetting.selectedTags.length > 0) {
      fragments.push(summarizeValues(gallerySetting.selectedTags, 4))
    }
    if (gallerySetting.selectedCameras.length > 0) {
      fragments.push(summarizeValues(gallerySetting.selectedCameras, 2))
    }
    if (gallerySetting.selectedLenses.length > 0) {
      fragments.push(summarizeValues(gallerySetting.selectedLenses, 2))
    }
    if (gallerySetting.selectedRatings !== null) {
      fragments.push(`${gallerySetting.selectedRatings}+ ★`)
    }
    if (gallerySetting.selectedDateRange) {
      fragments.push(formatDateRangeHeadline(gallerySetting.selectedDateRange, t))
    }
    if (fragments.length === 0) {
      return t('gallery.filter.active')
    }
    return fragments.slice(0, 2).join(' · ')
  }, [
    gallerySetting.selectedCameras,
    gallerySetting.selectedDateRange,
    gallerySetting.selectedLenses,
    gallerySetting.selectedRatings,
    gallerySetting.selectedTags,
    t,
  ])

  const infoItems = useMemo(() => {
    const items: Array<{ key: string, icon: LucideIcon, label: string, value: string }> = []
    if (gallerySetting.selectedTags.length > 0) {
      items.push({
        key: 'tags',
        icon: Tag,
        label: t('exif.tags'),
        value: gallerySetting.selectedTags.join(' · '),
      })
    }
    if (gallerySetting.selectedCameras.length > 0) {
      items.push({
        key: 'cameras',
        icon: Camera,
        label: t('exif.camera'),
        value: gallerySetting.selectedCameras.join(' · '),
      })
    }
    if (gallerySetting.selectedLenses.length > 0) {
      items.push({
        key: 'lenses',
        icon: Aperture,
        label: t('exif.lens'),
        value: gallerySetting.selectedLenses.join(' · '),
      })
    }
    if (gallerySetting.selectedRatings !== null) {
      items.push({
        key: 'rating',
        icon: Star,
        label: t('exif.rating'),
        value: `${gallerySetting.selectedRatings}+`,
      })
    }
    if (gallerySetting.selectedDateRange) {
      items.push({
        key: 'date',
        icon: Calendar,
        label: t('action.date.label'),
        value: formatDateRangeHeadline(gallerySetting.selectedDateRange, t),
      })
    }
    return items
  }, [
    gallerySetting.selectedCameras,
    gallerySetting.selectedDateRange,
    gallerySetting.selectedLenses,
    gallerySetting.selectedRatings,
    gallerySetting.selectedTags,
    t,
  ])

  const tagModeLabel
    = gallerySetting.selectedTags.length > 1
      ? gallerySetting.tagFilterMode === 'intersection'
        ? t('action.tag.mode.and')
        : t('action.tag.mode.or')
      : null

  const handleRemoveTag = (tag: string) => {
    setGallerySetting(prev => ({
      ...prev,
      selectedTags: prev.selectedTags.filter(t => t !== tag),
    }))
  }

  const handleRemoveCamera = (camera: string) => {
    setGallerySetting(prev => ({
      ...prev,
      selectedCameras: prev.selectedCameras.filter(c => c !== camera),
    }))
  }

  const handleRemoveLens = (lens: string) => {
    setGallerySetting(prev => ({
      ...prev,
      selectedLenses: prev.selectedLenses.filter(l => l !== lens),
    }))
  }

  const handleRemoveRating = () => {
    setGallerySetting(prev => ({
      ...prev,
      selectedRatings: null,
    }))
  }

  const handleRemoveDateRange = () => {
    setGallerySetting(prev => ({
      ...prev,
      selectedDateRange: null,
    }))
  }

  const handleClearAll = () => {
    setGallerySetting(prev => ({
      ...prev,
      selectedTags: [],
      selectedCameras: [],
      selectedLenses: [],
      selectedRatings: null,
      selectedDateRange: null,
      tagFilterMode: 'union',
    }))
  }

  const handleEditFilters = () => {
    setCommandPaletteOpen(true)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={Spring.presets.smooth}
      className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden border border-white/5 bg-black shadow-[0_25px_60px_rgba(0,0,0,0.55)]"
    >
      {/* Background Photo Grid */}
      <div className="pointer-events-none absolute inset-0">
        <div className="grid h-full w-full grid-cols-4 grid-rows-3 gap-[2px] opacity-90">
          {Array.from({ length: 12 }).map((_, index) => {
            const photo = backgroundPhotos[index]
            if (photo) {
              return (
                <div key={photo.id} className="relative overflow-hidden">
                  <img
                    src={photo.thumbnailUrl || photo.originalUrl}
                    alt=""
                    className="h-full w-full scale-105 object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-linear-to-br from-black/80 via-black/50 to-black/80" />
                </div>
              )
            }
            return <div key={`empty-${index}`} className="bg-linear-to-br from-zinc-900 via-black to-zinc-900" />
          })}
        </div>
      </div>

      {/* Dark Overlay Gradient */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/80 via-black/90 to-black/95" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.15),rgba(0,0,0,0)_60%)] opacity-70" />

      {/* Content */}
      <div className="relative z-10 flex min-h-[320px] flex-col">
        <div className="flex flex-1 flex-col items-center justify-center px-6 pt-20 pb-12 text-center lg:px-12 lg:pt-28 lg:pb-16">
          <p className="text-xs font-medium tracking-[0.5em] text-white/60 uppercase">
            {t('gallery.filter.results', { count: photos.length })}
          </p>
          <h2 className="mt-4 text-4xl font-semibold text-white drop-shadow-[0_15px_30px_rgba(0,0,0,0.65)] lg:text-5xl">
            {headline}
          </h2>

          {infoItems.length > 0 && (
            <div className="mt-8 grid w-full max-w-4xl grid-cols-1 gap-3 text-left sm:grid-cols-2 lg:grid-cols-4">
              {infoItems.map(item => (
                <div
                  key={item.key}
                  className="flex h-full flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white/90 backdrop-blur"
                >
                  <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.3em] text-white/50 uppercase">
                    <item.icon className="size-3.5 text-white/70" />
                    <span>{item.label}</span>
                  </div>
                  <p className="line-clamp-2 text-base font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          )}

          {tagModeLabel && (
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-medium tracking-[0.3em] text-white/65 uppercase backdrop-blur">
              <GitBranch className="size-3.5 text-white/70" />
              <span>
                {t('action.tag.filter')}
                {' '}
                ·
                {tagModeLabel}
              </span>
            </div>
          )}

          <div className="mt-8 flex w-full max-w-4xl flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
            <div className="flex min-w-0 flex-1 justify-center lg:justify-start">
              <FilterChips
                tags={gallerySetting.selectedTags}
                cameras={gallerySetting.selectedCameras}
                lenses={gallerySetting.selectedLenses}
                rating={gallerySetting.selectedRatings}
                dateRange={gallerySetting.selectedDateRange}
                onRemoveTag={handleRemoveTag}
                onRemoveCamera={handleRemoveCamera}
                onRemoveLens={handleRemoveLens}
                onRemoveRating={handleRemoveRating}
                onRemoveDateRange={handleRemoveDateRange}
              />
            </div>
            <div className="flex shrink-0 justify-center lg:justify-end">
              <HeroActions onClearAll={handleClearAll} onEditFilters={handleEditFilters} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

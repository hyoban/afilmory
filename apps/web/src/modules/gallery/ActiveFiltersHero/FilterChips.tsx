import { Star } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'

import type { DateRangeFilter } from '~/atoms/app'

import { FilterChip } from './FilterChip'

interface FilterChipsProps {
  tags: string[]
  cameras: string[]
  lenses: string[]
  rating: number | null
  dateRange: DateRangeFilter | null
  onRemoveTag: (tag: string) => void
  onRemoveCamera: (camera: string) => void
  onRemoveLens: (lens: string) => void
  onRemoveRating: () => void
  onRemoveDateRange: () => void
}

export const FilterChips = ({
  tags,
  cameras,
  lenses,
  rating,
  dateRange,
  onRemoveTag,
  onRemoveCamera,
  onRemoveLens,
  onRemoveRating,
  onRemoveDateRange,
}: FilterChipsProps) => {
  const { t } = useTranslation()
  const hasFilters = tags.length > 0 || cameras.length > 0 || lenses.length > 0 || rating !== null || dateRange !== null

  if (!hasFilters) {
    return null
  }

  const dateLabel = dateRange
    ? dateRange.from && dateRange.to
      ? `${dateRange.from} → ${dateRange.to}`
      : dateRange.from
        ? t('action.date.since', { date: dateRange.from })
        : t('action.date.until', { date: dateRange.to as string })
    : null

  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <AnimatePresence mode="popLayout">
        {tags.map(tag => (
          <FilterChip key={`tag-${tag}`} type="tag" label={tag} onRemove={() => onRemoveTag(tag)} />
        ))}
        {cameras.map(camera => (
          <FilterChip key={`camera-${camera}`} type="camera" label={camera} onRemove={() => onRemoveCamera(camera)} />
        ))}
        {lenses.map(lens => (
          <FilterChip key={`lens-${lens}`} type="lens" label={lens} onRemove={() => onRemoveLens(lens)} />
        ))}
        {rating !== null && (
          <FilterChip key="rating" type="rating" label={`${rating}+`} onRemove={onRemoveRating} icon={Star} />
        )}
        {dateLabel && <FilterChip key="date" type="date" label={dateLabel} onRemove={onRemoveDateRange} />}
      </AnimatePresence>
    </div>
  )
}

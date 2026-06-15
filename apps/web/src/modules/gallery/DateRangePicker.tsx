import type { ModalComponent } from '@afilmory/ui'
import { clsxm } from '@afilmory/utils'
import { useSetAtom } from 'jotai'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { gallerySettingAtom } from '~/atoms/app'
import { jotaiStore } from '~/lib/jotai'

import type { DateRange } from './dateRangeUtils'
import { DATE_RANGE_PRESETS, normalizeDateRange } from './dateRangeUtils'

const initialDraft = (): { from: string, to: string } => {
  const current = jotaiStore.get(gallerySettingAtom).selectedDateRange
  return {
    from: current?.from ?? '',
    to: current?.to ?? '',
  }
}

const today = () => new Date()

export const DateRangePicker: ModalComponent = ({ dismiss }) => {
  const { t } = useTranslation()
  const setGallerySetting = useSetAtom(gallerySettingAtom)
  const [draft, setDraft] = useState(initialDraft)

  const invalidOrder = draft.from && draft.to && draft.from > draft.to

  const applyRange = (range: DateRange | null) => {
    setGallerySetting(prev => ({ ...prev, selectedDateRange: range }))
  }

  const handleApply = () => {
    if (invalidOrder) {
      return
    }
    const normalized = normalizeDateRange(draft.from || null, draft.to || null)
    applyRange(normalized)
    dismiss()
  }

  const handleClear = () => {
    applyRange(null)
    dismiss()
  }

  const handleCancel = () => {
    dismiss()
  }

  const presets = useMemo(() => {
    const now = today()
    return DATE_RANGE_PRESETS.map(p => ({ ...p, range: p.compute(now) }))
  }, [])

  const handlePresetClick = (range: DateRange) => {
    setDraft({ from: range.from ?? '', to: range.to ?? '' })
  }

  return (
    <div className="w-full text-base">
      <div className="mb-4">
        <p className="mb-0.5 text-xs font-medium text-white/50">{t('action.date.filter')}</p>
        <h3 className="text-lg font-semibold text-white">{t('action.date.title')}</h3>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-white/60">{t('action.date.from')}</span>
          <input
            type="date"
            value={draft.from}
            onChange={e => setDraft(prev => ({ ...prev, from: e.target.value }))}
            max={draft.to || undefined}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-white/60">{t('action.date.to')}</span>
          <input
            type="date"
            value={draft.to}
            onChange={e => setDraft(prev => ({ ...prev, to: e.target.value }))}
            min={draft.from || undefined}
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none"
          />
        </label>
      </div>

      {invalidOrder && <p className="mb-3 text-xs text-red-300">{t('action.date.error.fromAfterTo')}</p>}

      <div className="mb-4 space-y-2">
        <p className="text-xs font-medium text-white/50">{t('action.date.presets')}</p>
        <div className="flex flex-wrap gap-2">
          {presets.map(p => (
            <button
              key={p.id}
              type="button"
              onClick={() => handlePresetClick(p.range)}
              className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/80 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
            >
              {t(p.labelKey as never)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={handleClear}
          className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white"
        >
          {t('action.date.clear')}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          className="rounded-xl border border-white/10 px-4 py-2 text-sm text-white/70 transition-colors hover:border-white/20 hover:text-white"
        >
          {t('action.date.cancel')}
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={Boolean(invalidOrder)}
          className={clsxm(
            'rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors',
            invalidOrder
              ? 'cursor-not-allowed border border-white/10 bg-white/5 text-white/40'
              : 'border border-accent/40 bg-accent/30 hover:bg-accent/50',
          )}
        >
          {t('action.date.apply')}
        </button>
      </div>
    </div>
  )
}

DateRangePicker.contentClassName = 'max-w-md w-full'
DateRangePicker.displayName = 'DateRangePicker'

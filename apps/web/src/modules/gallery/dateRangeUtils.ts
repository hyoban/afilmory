import type { PhotoManifest } from '~/types/photo'

export interface DateRange {
  from: string | null
  to: string | null
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export const parseDateString = (s: string | null | undefined): string | null => {
  if (!s) {
    return null
  }
  const m = ISO_DATE_RE.exec(s)
  if (!m) {
    return null
  }
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const probe = new Date(y, mo - 1, d)
  if (probe.getFullYear() !== y || probe.getMonth() !== mo - 1 || probe.getDate() !== d) {
    return null
  }
  return s
}

export const normalizeDateRange = (
  from: string | null | undefined,
  to: string | null | undefined,
): DateRange | null => {
  const f = parseDateString(from)
  const t = parseDateString(to)
  if (!f && !t) {
    return null
  }
  if (f && t && f > t) {
    return { from: t, to: f }
  }
  return { from: f, to: t }
}

const partsOf = (date: string): [number, number, number] => {
  const m = ISO_DATE_RE.exec(date)!
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

export const getRangeStartMs = (date: string): number => {
  const [y, mo, d] = partsOf(date)
  return new Date(y, mo - 1, d, 0, 0, 0, 0).getTime()
}

export const getRangeEndMs = (date: string): number => {
  const [y, mo, d] = partsOf(date)
  return new Date(y, mo - 1, d, 23, 59, 59, 999).getTime()
}

export const getPhotoDateMs = (photo: PhotoManifest): number | null => {
  const candidates = [
    photo.dateTaken,
    photo.exif?.DateTimeOriginal as unknown as string | undefined,
    photo.lastModified,
  ]
  for (const raw of candidates) {
    if (!raw) {
      continue
    }
    const t = new Date(raw).getTime()
    if (!Number.isNaN(t)) {
      return t
    }
  }
  return null
}

const pad = (n: number) => String(n).padStart(2, '0')
const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export interface DateRangePreset {
  id: string
  labelKey: string
  keywords: string[]
  compute: (today: Date) => DateRange
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, days: number) => {
  const out = startOfDay(d)
  out.setDate(out.getDate() + days)
  return out
}

export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  {
    id: 'last7',
    labelKey: 'action.date.preset.last7',
    keywords: ['date', 'range', 'last', '7', 'days', 'week'],
    compute: today => ({ from: toIso(addDays(today, -6)), to: toIso(today) }),
  },
  {
    id: 'last30',
    labelKey: 'action.date.preset.last30',
    keywords: ['date', 'range', 'last', '30', 'days', 'month'],
    compute: today => ({ from: toIso(addDays(today, -29)), to: toIso(today) }),
  },
  {
    id: 'thisMonth',
    labelKey: 'action.date.preset.thisMonth',
    keywords: ['date', 'range', 'this', 'month'],
    compute: today => ({
      from: toIso(new Date(today.getFullYear(), today.getMonth(), 1)),
      to: toIso(today),
    }),
  },
  {
    id: 'last90',
    labelKey: 'action.date.preset.last90',
    keywords: ['date', 'range', 'last', '90', 'days', 'quarter'],
    compute: today => ({ from: toIso(addDays(today, -89)), to: toIso(today) }),
  },
  {
    id: 'thisYear',
    labelKey: 'action.date.preset.thisYear',
    keywords: ['date', 'range', 'this', 'year'],
    compute: today => ({
      from: toIso(new Date(today.getFullYear(), 0, 1)),
      to: toIso(today),
    }),
  },
  {
    id: 'lastYear',
    labelKey: 'action.date.preset.lastYear',
    keywords: ['date', 'range', 'last', 'year'],
    compute: today => ({
      from: toIso(new Date(today.getFullYear() - 1, 0, 1)),
      to: toIso(new Date(today.getFullYear() - 1, 11, 31)),
    }),
  },
]

export const isPresetActive = (preset: DateRangePreset, range: DateRange | null, today: Date): boolean => {
  if (!range) {
    return false
  }
  const r = preset.compute(today)
  return range.from === r.from && range.to === r.to
}

export interface FormattedDateRange {
  headline: string
  long: { template: 'range' | 'since' | 'until', from?: string, to?: string }
  chip: { template: 'range' | 'since' | 'until', from?: string, to?: string }
}

export const formatDateRange = (range: DateRange | null): FormattedDateRange | null => {
  if (!range) {
    return null
  }
  const { from, to } = range
  if (from && to) {
    return {
      headline: `${from} → ${to}`,
      long: { template: 'range', from, to },
      chip: { template: 'range', from, to },
    }
  }
  if (from) {
    return {
      headline: from,
      long: { template: 'since', from },
      chip: { template: 'since', from },
    }
  }
  if (to) {
    return {
      headline: to,
      long: { template: 'until', to },
      chip: { template: 'until', to },
    }
  }
  return null
}

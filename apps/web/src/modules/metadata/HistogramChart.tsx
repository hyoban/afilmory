import { cx } from '@afilmory/utils'
import clsx from 'clsx'
import type { FC } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

const BIN_COUNT = 128

const CHANNELS = ['red', 'green', 'blue', 'luminance'] as const

type Channel = (typeof CHANNELS)[number]

type HistogramBins = Record<Channel, number[]>

const CHANNEL_RGB: Record<Channel, string> = {
  red: '255, 105, 97',
  green: '52, 199, 89',
  blue: '64, 156, 255',
  luminance: '255, 255, 255',
}

const CHANNEL_ALPHA: Record<Channel, number> = {
  red: 0.7,
  green: 0.7,
  blue: 0.7,
  luminance: 0.3,
}

const calculateHistogram = (imageData: ImageData): HistogramBins => {
  const bins: HistogramBins = {
    red: Array.from({ length: BIN_COUNT }).fill(0) as number[],
    green: Array.from({ length: BIN_COUNT }).fill(0) as number[],
    blue: Array.from({ length: BIN_COUNT }).fill(0) as number[],
    luminance: Array.from({ length: BIN_COUNT }).fill(0) as number[],
  }

  const { data } = imageData
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    bins.red[r >> 1]++
    bins.green[g >> 1]++
    bins.blue[b >> 1]++
    const luminance = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)
    bins.luminance[luminance >> 1]++
  }

  return bins
}

const createRenderer = (canvas: HTMLCanvasElement) => {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    return null
  }

  const rect = canvas.getBoundingClientRect()
  const { width, height } = rect
  const dpr = window.devicePixelRatio || 1

  canvas.width = width * dpr
  canvas.height = height * dpr
  ctx.scale(dpr, dpr)
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  // 1px-wide gradient strips, stretched per bar via drawImage — avoids
  // creating a gradient per bar per animation frame
  const strips = {} as Record<Channel, HTMLCanvasElement>
  for (const channel of CHANNELS) {
    const strip = document.createElement('canvas')
    strip.width = 1
    strip.height = Math.max(1, Math.round(height * dpr))
    const stripCtx = strip.getContext('2d')
    if (!stripCtx) {
      return null
    }
    const alpha = CHANNEL_ALPHA[channel]
    const gradient = stripCtx.createLinearGradient(0, 0, 0, strip.height)
    gradient.addColorStop(0, `rgba(${CHANNEL_RGB[channel]}, ${alpha})`)
    gradient.addColorStop(1, `rgba(${CHANNEL_RGB[channel]}, ${alpha * 0.1})`)
    stripCtx.fillStyle = gradient
    stripCtx.fillRect(0, 0, 1, strip.height)
    strips[channel] = strip
  }

  const highlightGradient = ctx.createLinearGradient(0, 0, 0, height * 0.2)
  highlightGradient.addColorStop(0, 'rgba(255, 255, 255, 0.03)')
  highlightGradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

  return (histogram: HistogramBins) => {
    ctx.clearRect(0, 0, width, height)

    ctx.fillStyle = 'rgba(28, 28, 30, 0.95)'
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)'
    ctx.lineWidth = 0.5
    for (let i = 1; i <= 3; i++) {
      const y = (height / 4) * i
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    const maxVal = Math.max(...histogram.luminance, ...histogram.red, ...histogram.green, ...histogram.blue)

    if (maxVal > 0) {
      const barWidth = width / BIN_COUNT
      const drawBars = (data: number[], strip: HTMLCanvasElement) => {
        for (const [i, datum] of data.entries()) {
          const barHeight = (datum / maxVal) * height
          if (barHeight <= 0) {
            continue
          }
          ctx.drawImage(strip, i * barWidth, height - barHeight, barWidth * 0.8, barHeight)
        }
      }

      drawBars(histogram.luminance, strips.luminance)

      ctx.globalCompositeOperation = 'screen'
      drawBars(histogram.red, strips.red)
      drawBars(histogram.green, strips.green)
      drawBars(histogram.blue, strips.blue)
      ctx.globalCompositeOperation = 'source-over'
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.lineWidth = 1
    ctx.strokeRect(-0.5, -0.5, width + 1, height + 1)

    ctx.fillStyle = highlightGradient
    ctx.fillRect(0, 0, width, height * 0.2)
  }
}

export const HistogramChart: FC<{
  thumbnailUrl: string
  className?: string
}> = ({ thumbnailUrl, className = '' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previousHistogramRef = useRef<HistogramBins | null>(null)
  const animationRef = useRef<number | null>(null)
  const [histogram, setHistogram] = useState<HistogramBins | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const { t } = useTranslation()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    const img = new Image()
    img.crossOrigin = 'Anonymous'
    img.src = thumbnailUrl

    img.onload = () => {
      if (cancelled) {
        return
      }

      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        setError(true)
        setLoading(false)
        return
      }

      const maxSize = 300
      const scale = Math.min(1, maxSize / img.naturalWidth, maxSize / img.naturalHeight)
      const scaledWidth = Math.max(1, Math.floor(img.naturalWidth * scale))
      const scaledHeight = Math.max(1, Math.floor(img.naturalHeight * scale))

      canvas.width = scaledWidth
      canvas.height = scaledHeight
      ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight)

      try {
        const imageData = ctx.getImageData(0, 0, scaledWidth, scaledHeight)
        setHistogram(calculateHistogram(imageData))
      }
      catch (e) {
        console.error('Error calculating histogram:', e)
        setError(true)
      }
      finally {
        setLoading(false)
      }
    }

    img.onerror = () => {
      if (cancelled) {
        return
      }
      setError(true)
      setLoading(false)
    }

    return () => {
      cancelled = true
      img.onload = null
      img.onerror = null
    }
  }, [thumbnailUrl])

  useEffect(() => {
    if (!histogram || !canvasRef.current) {
      return
    }

    const draw = createRenderer(canvasRef.current)
    if (!draw) {
      return
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }

    const prev = previousHistogramRef.current
    if (!prev) {
      draw(histogram)
      previousHistogramRef.current = histogram
      return
    }

    const startAt = performance.now()
    const frequency = 8
    const damping = 7
    const restDelta = 0.001
    const maxMs = 1200

    // analytic step response of an underdamped second-order system,
    // clamped to [0, 1] to avoid overshoot drawing artifacts
    const springProgress = (tSec: number) => {
      const exp = Math.exp(-damping * tSec)
      const value = 1 - exp * (Math.cos(frequency * tSec) + (damping / frequency) * Math.sin(frequency * tSec))
      return Math.max(0, Math.min(1, value))
    }

    const lerpArray = (from: number[], to: number[], p: number) => from.map((v, i) => v + (to[i] - v) * p)

    const frame = (now: number) => {
      const elapsedMs = now - startAt
      const eased = springProgress(elapsedMs / 1000)

      draw({
        red: lerpArray(prev.red, histogram.red, eased),
        green: lerpArray(prev.green, histogram.green, eased),
        blue: lerpArray(prev.blue, histogram.blue, eased),
        luminance: lerpArray(prev.luminance, histogram.luminance, eased),
      })

      const done = Math.abs(1 - eased) < restDelta || elapsedMs >= maxMs
      if (!done) {
        animationRef.current = requestAnimationFrame(frame)
      }
      else {
        previousHistogramRef.current = histogram
        animationRef.current = null
      }
    }

    animationRef.current = requestAnimationFrame(frame)

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
    }
  }, [histogram])

  return (
    <div className={cx('relative grow w-full h-32 group', className)}>
      {loading && (
        <div className="bg-material-ultra-thin absolute inset-0 z-10 flex items-center justify-center rounded-sm backdrop-blur-xl">
          <div className="i-mingcute-loading-3-line animate-spin text-xl" />
        </div>
      )}
      {error && (
        <div className="bg-material-ultra-thin absolute inset-0 flex items-center justify-center rounded-sm backdrop-blur-xl">
          <div className="text-center">
            <div className="text-text-secondary text-xs">{t('photo.error.loading')}</div>
          </div>
        </div>
      )}
      {histogram && (
        <canvas
          ref={canvasRef}
          className={clsx(
            'bg-material-ultra-thin ring-fill-tertiary/20 group-hover:ring-fill-tertiary/40 h-full w-full rounded-sm ring-1 backdrop-blur-xl transition-all duration-200',
            loading && 'opacity-30',
          )}
        />
      )}
    </div>
  )
}

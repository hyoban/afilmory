import { Button, ScrollArea } from '@afilmory/ui'
import { Spring } from '@afilmory/utils'
import { Aperture, Film, ImageOff, X } from 'lucide-react'
import { m } from 'motion/react'
import { useState } from 'react'

import { FILE_STATUS_CLASS, FILE_STATUS_LABEL } from './constants'
import type { FileProgressEntry } from './types'
import { formatBytes } from './utils'

type UploadFileListProps = {
  entries: FileProgressEntry[]
  overallProgress: number
  onRemoveEntry?: (entry: FileProgressEntry) => void
}

const RAW_EXTENSIONS = new Set(['raw', 'dng', 'arw', 'cr2', 'nef'])

function getFileExtension(name: string): string {
  const normalized = name.toLowerCase()
  const lastDotIndex = normalized.lastIndexOf('.')
  return lastDotIndex === -1 ? '' : normalized.slice(lastDotIndex + 1)
}

function pickPlaceholderIcon(name: string) {
  const ext = getFileExtension(name)
  if (ext === 'mov') {
    return Film
  }
  if (RAW_EXTENSIONS.has(ext)) {
    return Aperture
  }
  return ImageOff
}

function UploadEntryThumbnail({ entry }: { entry: FileProgressEntry }) {
  const [hasLoadError, setHasLoadError] = useState(false)

  if (entry.previewUrl !== null && !hasLoadError) {
    return (
      <img
        src={entry.previewUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="size-10 flex-shrink-0 rounded object-cover bg-fill/30"
        onError={() => setHasLoadError(true)}
      />
    )
  }

  const Icon = pickPlaceholderIcon(entry.name)
  return (
    <div
      className="size-10 flex-shrink-0 rounded bg-fill/30 flex items-center justify-center text-text-tertiary"
      aria-hidden="true"
    >
      <Icon className="h-5 w-5" strokeWidth={1.5} />
    </div>
  )
}

export function UploadFileList({ entries, overallProgress, onRemoveEntry }: UploadFileListProps) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-text-tertiary">
        <span>上传进度</span>
        <span>
          {Math.round(overallProgress * 100)}
          %
        </span>
      </div>
      <div
        className="bg-fill/20 mt-2 h-2 rounded-full"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(overallProgress * 100)}
        aria-label="上传进度"
      >
        <m.div
          className="bg-accent h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${overallProgress * 100}%` }}
          transition={Spring.presets.smooth}
        />
      </div>

      <ScrollArea rootClassName="h-60 mt-4 -mx-3" viewportClassName="px-3">
        <m.ul
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={Spring.presets.smooth}
          className="divide-fill-tertiary/30"
        >
          {entries.map(entry => (
            <li key={entry.id} className="text-text-secondary flex items-center gap-3 px-2 py-2 text-sm">
              <UploadEntryThumbnail entry={entry} />
              <div className="flex-1 min-w-0">
                <span className="truncate block" title={entry.name}>
                  {entry.name}
                </span>
                <p className="text-text-tertiary text-[11px]">{formatBytes(entry.size)}</p>
                <div
                  className="bg-fill/20 mt-1.5 h-1.5 rounded-full"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(entry.progress * 100)}
                  aria-label={`${entry.name} 上传进度`}
                >
                  <div
                    className={
                      entry.status === 'done'
                        ? 'bg-emerald-400 h-full rounded-full'
                        : entry.status === 'error'
                          ? 'bg-rose-400 h-full rounded-full'
                          : entry.status === 'processing'
                            ? 'bg-amber-300 h-full rounded-full'
                            : 'bg-accent h-full rounded-full'
                    }
                    style={{ width: `${Math.min(100, entry.progress * 100)}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`${FILE_STATUS_CLASS[entry.status]} text-[11px] font-medium`}>
                  {FILE_STATUS_LABEL[entry.status]}
                </span>
                {onRemoveEntry ? (
                  <Button
                    type="button"
                    size="xs"
                    variant="ghost"
                    className="text-text-tertiary hover:text-rose-300"
                    aria-label="删除文件"
                    disabled={!(entry.status === 'pending' || entry.status === 'error')}
                    onClick={() => (entry.status === 'pending' || entry.status === 'error') && onRemoveEntry(entry)}
                  >
                    <X className="h-3 w-3" strokeWidth={2} />
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </m.ul>
      </ScrollArea>
    </div>
  )
}

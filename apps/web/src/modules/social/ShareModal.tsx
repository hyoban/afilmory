import type { ModalComponent } from '@afilmory/ui'
import { Modal } from '@afilmory/ui'
import { clsxm } from '@afilmory/utils'
import type { MouseEvent, ReactElement, ReactNode } from 'react'
import { cloneElement, isValidElement, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { siteConfig } from '~/config'
import type { PhotoManifest } from '~/types/photo'

import { CopyButton } from './CopyButton'
import { ShareActionButton } from './ShareActionButton'

// OG image aspect ratio: 1200:628 (from og.renderer.tsx)
const OG_ASPECT_RATIO = 1200 / 628

interface ShareModalTriggerProps {
  photo: PhotoManifest
  trigger: ReactNode
  blobSrc?: string
}

interface ShareSheetProps {
  photo: PhotoManifest
  blobSrc?: string
}

interface SocialShareOption {
  id: string
  label: string
  icon: string
  url: string
}

export const ShareModal = ({ photo, trigger, blobSrc }: ShareModalTriggerProps) => {
  const handleOpen = useCallback(() => {
    Modal.present(ShareSheet, { photo, blobSrc }, { dismissOnOutsideClick: true })
  }, [blobSrc, photo])

  if (isValidElement(trigger)) {
    return cloneElement(trigger as ReactElement, {
      // @ts-expect-error - onClick is not a valid prop for the trigger element
      onClick: (event: MouseEvent<HTMLElement>) => {
        // @ts-expect-error - trigger is a valid React element
        trigger.props?.onClick?.(event)
        if (event.defaultPrevented) {
          return
        }
        handleOpen()
      },
    })
  }

  return (
    <button type="button" onClick={handleOpen} className="contents">
      {trigger}
    </button>
  )
}

const ShareSheet: ModalComponent<ShareSheetProps> = ({ photo, blobSrc, dismiss }) => {
  const { t } = useTranslation()
  const [isDownloadingOriginal, setIsDownloadingOriginal] = useState(false)
  const [isDownloadingPreview, setIsDownloadingPreview] = useState(false)
  const [isOgImageLoading, setIsOgImageLoading] = useState(true)

  const resolvedBaseUrl = useMemo(() => {
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin
    }
    return siteConfig.url?.replace(/\/$/, '') ?? ''
  }, [])

  const shareLink = useMemo(() => {
    const pathname = `/photos/${photo.id}`
    if (!resolvedBaseUrl) {
      return pathname
    }
    return `${resolvedBaseUrl}${pathname}`
  }, [photo.id, resolvedBaseUrl])

  const preferredPreviewImageUrl = useMemo(() => {
    return resolveAssetUrl(photo.ogImageUrl || getStaticOgImagePath(photo.id), resolvedBaseUrl)
  }, [photo.id, photo.ogImageUrl, resolvedBaseUrl])

  const fallbackPreviewImageUrl = useMemo(() => {
    return resolveAssetUrl(photo.thumbnailUrl || photo.originalUrl, resolvedBaseUrl)
  }, [photo.originalUrl, photo.thumbnailUrl, resolvedBaseUrl])

  const [previewImageUrl, setPreviewImageUrl] = useState(preferredPreviewImageUrl)

  useEffect(() => {
    setIsOgImageLoading(true)
    setPreviewImageUrl(preferredPreviewImageUrl)
  }, [preferredPreviewImageUrl])

  const handlePreviewImageError = useCallback(() => {
    if (fallbackPreviewImageUrl && previewImageUrl !== fallbackPreviewImageUrl) {
      setPreviewImageUrl(fallbackPreviewImageUrl)
      return
    }

    setIsOgImageLoading(false)
  }, [fallbackPreviewImageUrl, previewImageUrl])

  const shareTitle = photo.title || t('photo.share.default.title')
  const shareText = t('photo.share.text', { title: shareTitle })

  const canUseNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const socialOptions = useMemo(() => getSocialOptions(t), [t])

  const handleNativeShare = useCallback(async () => {
    if (!canUseNativeShare) {
      return
    }

    try {
      const files = await buildShareFiles(photo, blobSrc)
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareLink,
        ...(files.length > 0 ? { files } : {}),
      })
      dismiss()
    }
    catch {
      await navigator.clipboard.writeText(shareLink)
      toast.success(t('photo.share.linkCopied'))
      dismiss()
    }
  }, [blobSrc, canUseNativeShare, dismiss, photo, shareLink, shareText, shareTitle, t])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareLink)
      toast.success(t('photo.share.linkCopied'))
    }
    catch {
      toast.error(t('photo.share.copy.failed'))
      throw new Error('Failed to copy')
    }
  }, [shareLink, t])

  const handleDownloadOriginal = useCallback(async () => {
    try {
      setIsDownloadingOriginal(true)
      await downloadFile(photo.originalUrl, `${photo.id}.jpg`)
      toast.success(t('photo.share.download.original'))
    }
    catch {
      toast.error(t('photo.share.copy.failed'))
    }
    finally {
      setIsDownloadingOriginal(false)
    }
  }, [photo.id, photo.originalUrl, t])

  const handleDownloadPreview = useCallback(async () => {
    try {
      setIsDownloadingPreview(true)
      await downloadFile(previewImageUrl, `${photo.id}-preview${getDownloadExtension(previewImageUrl)}`)
      toast.success(t('photo.share.downloadPreview'))
    }
    catch {
      toast.error(t('photo.share.copy.failed'))
    }
    finally {
      setIsDownloadingPreview(false)
    }
  }, [photo.id, previewImageUrl, t])

  const handleSocialShare = useCallback(
    (urlTemplate: string) => {
      const encodedUrl = encodeURIComponent(shareLink)
      const encodedTitle = encodeURIComponent(shareTitle)
      const encodedText = encodeURIComponent(shareText)
      const finalUrl = urlTemplate
        .replace('{url}', encodedUrl)
        .replace('{title}', encodedTitle)
        .replace('{text}', encodedText)
      window.open(finalUrl, '_blank', 'width=600,height=600')
      dismiss()
    },
    [dismiss, shareLink, shareText, shareTitle],
  )

  return (
    <div className="w-full text-base">
      <div className="mb-4">
        <div className="min-w-0">
          <p className="mb-0.5 text-xs font-medium text-white/50">{t('photo.share.title')}</p>
          <div className="truncate text-lg font-semibold text-white">{shareTitle}</div>
          {photo.location?.city && <p className="mt-0.5 text-xs text-white/40">{photo.location.city}</p>}
        </div>
      </div>

      <div className="mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-white/50">{t('photo.share.link')}</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white">
          <span className="flex-1 truncate text-xs">{shareLink}</span>

          <CopyButton onCopy={handleCopyLink} />
        </div>
      </div>

      <div className="mb-4 space-y-2">
        <p className="text-xs font-medium text-white/50">{t('photo.share.preview')}</p>
        <div className="relative overflow-hidden rounded-xl border border-white/10 bg-black/40">
          {/* Fixed aspect ratio placeholder to prevent CLS */}
          <div className="w-full" style={{ aspectRatio: OG_ASPECT_RATIO }}>
            {isOgImageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/5">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white/60" />
              </div>
            )}
            <img
              src={previewImageUrl}
              alt={photo.title}
              className={clsxm(
                'h-full w-full object-cover transition-opacity duration-300',
                isOgImageLoading ? 'opacity-0' : 'opacity-100',
              )}
              loading="lazy"
              onLoad={() => setIsOgImageLoading(false)}
              onError={handlePreviewImageError}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-white/50">{t('photo.share.actions')}</p>
        <div className={clsxm('grid gap-2', canUseNativeShare ? 'grid-cols-6' : 'grid-cols-5')}>
          {/* Native share button (if available) */}
          {canUseNativeShare && (
            <ShareActionButton
              icon="i-mingcute-share-2-line"
              label="System"
              onClick={handleNativeShare}
              title={t('photo.share.system')}
            />
          )}
          {/* Social share buttons */}
          {socialOptions.map(option => (
            <ShareActionButton
              key={option.id}
              icon={option.icon}
              label={option.label}
              onClick={() => handleSocialShare(option.url)}
            />
          ))}
          {/* Download buttons */}
          <ShareActionButton
            icon="i-mingcute-download-3-line"
            label={isDownloadingOriginal ? '…' : 'Original'}
            onClick={handleDownloadOriginal}
            disabled={isDownloadingOriginal}
            title={t('photo.share.download.original')}
          />
          <ShareActionButton
            icon="i-mingcute-pic-line"
            label={isDownloadingPreview ? '…' : 'Preview'}
            onClick={handleDownloadPreview}
            disabled={isDownloadingPreview}
            title={t('photo.share.downloadPreview')}
          />
        </div>
      </div>
    </div>
  )
}

ShareSheet.contentClassName = 'max-w-3xl w-full z-1000000'

async function downloadFile(url: string, filename: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Unable to download file')
  }
  const blob = await response.blob()
  const blobUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(blobUrl)
}

function resolveAssetUrl(url: string, baseUrl: string) {
  if (!url) {
    return url
  }

  try {
    return new URL(url, baseUrl || window.location.origin).toString()
  }
  catch {
    return url
  }
}

function getStaticOgImagePath(photoId: string) {
  return `/og-images/${encodeURIComponent(photoId)}.png`
}

function getDownloadExtension(url: string) {
  try {
    const pathname = new URL(url, typeof window !== 'undefined' ? window.location.origin : siteConfig.url).pathname
    const extension = pathname.match(/\.(png|jpe?g|webp|gif)$/i)?.[0]
    return extension?.toLowerCase() ?? '.jpg'
  }
  catch {
    return '.jpg'
  }
}

async function buildShareFiles(photo: PhotoManifest, blobSrc?: string) {
  const imageUrl = blobSrc || photo.originalUrl
  try {
    const response = await fetch(imageUrl)
    const blob = await response.blob()
    return [new File([blob], `${photo.title || photo.id}.jpg`, { type: blob.type || 'image/jpeg' })]
  }
  catch {
    return []
  }
}

function getSocialOptions(t: ReturnType<typeof useTranslation>['t']): SocialShareOption[] {
  return [
    {
      id: 'twitter',
      label: 'Twitter',
      icon: 'i-mingcute-twitter-fill',
      url: 'https://twitter.com/intent/tweet?text={text}&url={url}',
    },
    {
      id: 'telegram',
      label: 'Telegram',
      icon: 'i-mingcute-telegram-line',
      url: 'https://t.me/share/url?url={url}&text={text}',
    },
    {
      id: 'weibo',
      label: t('photo.share.weibo'),
      icon: 'i-mingcute-weibo-line',
      url: 'https://service.weibo.com/share/share.php?url={url}&title={text}',
    },
  ]
}

ShareSheet.displayName = 'ShareSheet'

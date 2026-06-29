import { SHARE_EMBED_SCRIPT } from '@afilmory/sdk'
import { AllowPlaceholderTenant } from '@core/decorators/allow-placeholder.decorator'
import { SkipTenantGuard } from '@core/decorators/skip-tenant.decorator'
import { BizException, ErrorCode } from '@core/errors'
import { SiteSettingService } from '@core/modules/configuration/site-setting/site-setting.service'
import { ManifestService } from '@core/modules/content/manifest/manifest.service'
import { Controller, createZodSchemaDto, Get, Query } from '@tsuki-hono/common'
import { z } from 'zod'

import type { ShareRenderContext } from './share-iframe.renderer'
import {
  parseLimit,
  pickCollectionLayout,
  preserveOrder,
  renderShareIframe,
  renderTagPill,
  trimTrailingSlash,
} from './share-iframe.renderer'
import { StaticControllerUtils } from './static-controller.utils'
import { StaticDashboardService } from './static-dashboard.service'

const shareQuerySchema = z.object({
  id: z.string().optional(),
  ids: z.string().optional(),
  tag: z.string().optional(),
  limit: z.string().optional(),
  layout: z.string().optional(),
})
class ShareQueryDto extends createZodSchemaDto(shareQuerySchema) {}

function splitIds(raw: string | undefined): string[] {
  if (!raw)
    return []
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
  })
}

@Controller({ bypassGlobalPrefix: true })
export class StaticShareController {
  constructor(
    private readonly manifestService: ManifestService,
    private readonly siteSettingService: SiteSettingService,
    private readonly staticDashboardService: StaticDashboardService,
  ) {}

  @Get('/share/embed.js')
  @SkipTenantGuard()
  @AllowPlaceholderTenant()
  async getEmbedScript() {
    return new Response(SHARE_EMBED_SCRIPT, {
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=86400',
      },
    })
  }

  @Get('/share/iframe')
  async getStaticSharePage(@Query() query: ShareQueryDto) {
    if (StaticControllerUtils.isReservedTenant({ root: true })) {
      return await StaticControllerUtils.renderTenantRestrictedPage(this.staticDashboardService)
    }
    if (StaticControllerUtils.shouldRenderTenantMissingPage()) {
      return await StaticControllerUtils.renderTenantMissingPage(this.staticDashboardService)
    }

    const siteConfig = await this.siteSettingService.getSiteConfig()
    const ctx: ShareRenderContext = {
      siteUrl: siteConfig.url,
      siteName: siteConfig.name,
    }
    const galleryUrl = `${trimTrailingSlash(ctx.siteUrl)}/`

    const singleId = query.id?.trim()
    const idList = splitIds(query.ids)
    const tag = query.tag?.trim()

    if (singleId && idList.length === 0 && !tag) {
      const ids = singleId
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      if (ids.length === 1) {
        const photo = await this.manifestService.getPhoto(ids[0]!)
        if (!photo) {
          throw new BizException(ErrorCode.COMMON_NOT_FOUND, { message: 'Share photo not found' })
        }
        const html = await renderShareIframe({ mode: 'single', photo, ctx })
        return htmlResponse(html)
      }
      if (ids.length > 1) {
        const photos = await this.manifestService.getPhotosByIds(ids)
        if (photos.length === 0) {
          throw new BizException(ErrorCode.COMMON_NOT_FOUND, { message: 'Share photos not found' })
        }
        const ordered = preserveOrder(photos, ids)
        const html = await renderShareIframe({
          mode: 'collection',
          photos: ordered,
          layout: pickCollectionLayout(query.layout, ordered.length),
          headerTitle: `${ordered.length} photos`,
          viewAllUrl: galleryUrl,
          viewAllLabel: 'View all →',
          badgeHref: galleryUrl,
          ctx,
        })
        return htmlResponse(html)
      }
    }

    if (idList.length > 0) {
      const photos = await this.manifestService.getPhotosByIds(idList)
      if (photos.length === 0) {
        throw new BizException(ErrorCode.COMMON_NOT_FOUND, { message: 'Share photos not found' })
      }
      const ordered = preserveOrder(photos, idList)
      const html = await renderShareIframe({
        mode: 'collection',
        photos: ordered,
        layout: pickCollectionLayout(query.layout, ordered.length),
        headerTitle: `${ordered.length} photos`,
        viewAllUrl: galleryUrl,
        viewAllLabel: 'View all →',
        badgeHref: galleryUrl,
        ctx,
      })
      return htmlResponse(html)
    }

    if (tag) {
      const limit = parseLimit(query.limit)
      const result = await this.manifestService.searchPhotos({
        tags: [tag],
        tagMode: 'union',
        limit,
        sort: 'desc',
      })
      const shown = result.data
      if (shown.length === 0) {
        throw new BizException(ErrorCode.COMMON_NOT_FOUND, { message: 'No photos for tag' })
      }
      const overflowCount = Math.max(0, result.total - shown.length)
      const tagFilterUrl = `${trimTrailingSlash(ctx.siteUrl)}/?tags=${encodeURIComponent(tag)}`
      const html = await renderShareIframe({
        mode: 'collection',
        photos: shown,
        layout: pickCollectionLayout(query.layout, shown.length + (overflowCount > 0 ? 1 : 0)),
        headerTitle: renderTagPill(tag),
        headerCount: `${shown.length} of ${result.total}`,
        viewAllUrl: tagFilterUrl,
        viewAllLabel: 'View all →',
        overflow: overflowCount > 0 ? { count: overflowCount, url: tagFilterUrl } : null,
        badgeHref: tagFilterUrl,
        ctx,
      })
      return htmlResponse(html)
    }

    throw new BizException(ErrorCode.COMMON_BAD_REQUEST, {
      message: 'Share iframe requires one of: id, ids, tag',
    })
  }
}

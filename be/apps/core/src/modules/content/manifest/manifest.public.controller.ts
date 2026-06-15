import { BizException, ErrorCode } from '@core/errors'
import { BypassResponseTransform } from '@core/interceptors/response-transform.decorator'
import { Body, Controller, createZodSchemaDto, Get, Param, Post, Query } from '@tsuki-hono/common'
import { z } from 'zod'

import { ManifestService } from './manifest.service'

const GetPhotosByIdsSchema = z.object({
  ids: z
    .string()
    .min(1)
    .transform(s =>
      s
        .split(',')
        .map(t => t.trim())
        .filter(Boolean))
    .refine(arr => arr.length > 0, 'ids must contain at least one id'),
})

const SearchPhotosSchema = z.object({
  tags: z.array(z.string().min(1)).optional(),
  tagMode: z.enum(['union', 'intersection']).optional(),
  cameras: z.array(z.string().min(1)).optional(),
  lenses: z.array(z.string().min(1)).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  sort: z.enum(['asc', 'desc']).optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
})

class GetPhotosByIdsDto extends createZodSchemaDto(GetPhotosByIdsSchema) {}
class SearchPhotosDto extends createZodSchemaDto(SearchPhotosSchema) {}

@Controller('manifest')
export class ManifestPublicController {
  constructor(private readonly manifestService: ManifestService) {}

  @Get()
  @BypassResponseTransform()
  async getManifest() {
    return await this.manifestService.getManifest()
  }

  @Get('photos')
  @BypassResponseTransform()
  async getPhotosByIds(@Query() query: GetPhotosByIdsDto) {
    return await this.manifestService.getPhotosByIds(query.ids)
  }

  @Post('photos/search')
  @BypassResponseTransform()
  async searchPhotos(@Body() body: SearchPhotosDto) {
    return await this.manifestService.searchPhotos(body)
  }

  @Get('photos/:id')
  @BypassResponseTransform()
  async getPhoto(@Param('id') id: string) {
    const photo = await this.manifestService.getPhoto(id)
    if (!photo) {
      throw new BizException(ErrorCode.COMMON_NOT_FOUND, { message: '照片不存在' })
    }
    return photo
  }
}

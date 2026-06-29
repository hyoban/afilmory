import { SiteSettingModule } from '@core/modules/configuration/site-setting/site-setting.module'
import { SystemSettingModule } from '@core/modules/configuration/system-setting/system-setting.module'
import { ManifestModule } from '@core/modules/content/manifest/manifest.module'
import { Module } from '@tsuki-hono/common'

import { StaticAssetController } from './static-asset.controller'
import { StaticAssetHostService } from './static-asset-host.service'
import { StaticDashboardController } from './static-dashboard.controller'
import { StaticDashboardService } from './static-dashboard.service'
import { StaticShareController } from './static-share.controller'
import { StaticWebController } from './static-web.controller'
import { StaticWebService } from './static-web.service'

@Module({
  imports: [SiteSettingModule, SystemSettingModule, ManifestModule],
  controllers: [StaticShareController, StaticWebController, StaticDashboardController, StaticAssetController],
  providers: [StaticAssetHostService, StaticWebService, StaticDashboardService],
})
export class StaticWebModule {}

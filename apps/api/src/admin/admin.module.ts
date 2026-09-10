import { Module } from '@nestjs/common';
import { EditorialModule } from '../editorial/editorial.module';
import { CatalogModule } from '../catalog/catalog.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ReferencesModule } from '../references/references.module';
import { TacticalModule } from '../tactical/tactical.module';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { TacticalAdminController } from './tactical-admin.controller';
import {
  ReferencePlayersAdminController,
  StatisticsAdminController,
} from './statistics-admin.controller';

@Module({
  imports: [EditorialModule, CatalogModule, TacticalModule, AnalyticsModule, ReferencesModule],
  controllers: [
    AdminController,
    TacticalAdminController,
    StatisticsAdminController,
    ReferencePlayersAdminController,
  ],
  providers: [AdminGuard],
})
export class AdminModule {}

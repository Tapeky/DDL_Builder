import { Module } from '@nestjs/common';
import { EditorialModule } from '../editorial/editorial.module';
import { CatalogModule } from '../catalog/catalog.module';
import { TacticalModule } from '../tactical/tactical.module';
import { AdminController } from './admin.controller';
import { AdminGuard } from './admin.guard';
import { TacticalAdminController } from './tactical-admin.controller';

@Module({
  imports: [EditorialModule, CatalogModule, TacticalModule],
  controllers: [AdminController, TacticalAdminController],
  providers: [AdminGuard],
})
export class AdminModule {}

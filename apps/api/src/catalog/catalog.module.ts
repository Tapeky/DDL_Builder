import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { EditorialModule } from '../editorial/editorial.module';
import { TacticalModule } from '../tactical/tactical.module';

@Module({
  imports: [EditorialModule, TacticalModule],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}

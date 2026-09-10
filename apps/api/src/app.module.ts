import { Controller, Get, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { DatabaseModule, DatabaseService } from './database.module';
import { CatalogModule } from './catalog/catalog.module';
import { RecommendationsModule } from './recommendations/recommendations.module';
import { EditorialModule } from './editorial/editorial.module';
import { AdminModule } from './admin/admin.module';
import { TacticalModule } from './tactical/tactical.module';

@Controller('health')
class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async health() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
}

@Module({
  imports: [
    DatabaseModule,
    EditorialModule,
    AdminModule,
    TacticalModule,
    CatalogModule,
    RecommendationsModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}

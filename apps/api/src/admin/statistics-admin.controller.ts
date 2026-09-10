import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { ReferencePlayerVerificationStatus } from '@deadlock/contracts';
import { CatalogService } from '../catalog/catalog.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { ReferencePlayerService } from '../references/reference-player.service';
import { AdminGuard } from './admin.guard';

class AnalyticsQueryDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(4_294_967_295)
  @Type(() => Number)
  heroId!: number;

  @ApiProperty({ example: 1_786_320_000 })
  @IsInt()
  @Min(0)
  @Type(() => Number)
  minUnixTimestamp!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  maxUnixTimestamp?: number;

  @ApiPropertyOptional({ enum: ['normal', 'street_brawl', 'explore_n_y_c', 'internal'] })
  @IsOptional()
  @IsIn(['normal', 'street_brawl', 'explore_n_y_c', 'internal'])
  gameMode?: 'normal' | 'street_brawl' | 'explore_n_y_c' | 'internal';

  @ApiPropertyOptional({ default: 'ranked,unranked' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  matchMode?: string;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  @Type(() => Number)
  minMatches?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(116)
  @Type(() => Number)
  minAverageBadge?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(116)
  @Type(() => Number)
  maxAverageBadge?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  minNetworth?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  maxNetworth?: number;

  @ApiPropertyOptional({ type: [Number], maxItems: 6 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(4_294_967_295, { each: true })
  @Type(() => Number)
  enemyHeroIds?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  enemyHeroIdsAllMatch?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  sameLaneFilter?: boolean;
}

class AnalyticsListQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  version?: string;
}

class RunParamsDto {
  @ApiProperty()
  @IsString()
  @MaxLength(150)
  id!: string;
}

class ReferencePlayerDto {
  @ApiProperty({ example: 'specialist-infernus-eu' })
  @IsString()
  @MaxLength(80)
  id!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  displayName!: string;

  @ApiProperty({ example: 'Europe' })
  @IsString()
  @MaxLength(80)
  region!: string;

  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(4_294_967_295, { each: true })
  @Type(() => Number)
  accountIds!: number[];

  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMaxSize(38)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(4_294_967_295, { each: true })
  @Type(() => Number)
  heroIds!: number[];

  @ApiProperty({ enum: ['pending', 'verified', 'stale', 'rejected'] })
  @IsIn(['pending', 'verified', 'stale', 'rejected'])
  verificationStatus!: ReferencePlayerVerificationStatus;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  verificationSource!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  sourceUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  lastSeenAt?: string | null;
}

class ReferencePlayerPatchDto {
  @ApiPropertyOptional()
  @IsOptional()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(80)
  region?: string;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(4_294_967_295, { each: true })
  @Type(() => Number)
  accountIds?: number[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(38)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(4_294_967_295, { each: true })
  @Type(() => Number)
  heroIds?: number[];

  @ApiPropertyOptional({ enum: ['pending', 'verified', 'stale', 'rejected'] })
  @IsOptional()
  @IsIn(['pending', 'verified', 'stale', 'rejected'])
  verificationStatus?: ReferencePlayerVerificationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  verificationSource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(500)
  sourceUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  lastSeenAt?: string | null;
}

@ApiTags('administration')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/analytics')
export class StatisticsAdminController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly analytics: AnalyticsService,
  ) {}

  @Get('runs')
  async runs(@Query() query: AnalyticsListQueryDto) {
    const snapshot = query.version ? await this.catalog.snapshot(query.version) : undefined;
    return this.analytics.listRuns(snapshot?.id);
  }

  @Get('runs/:id')
  detail(@Param() params: RunParamsDto) {
    return this.analytics.runDetail(params.id);
  }

  @Post('item-stats')
  async collect(@Body() input: AnalyticsQueryDto) {
    const snapshot = await this.catalog.snapshot();
    const heroIds = new Set(snapshot.heroes.map((hero) => hero.id));
    if (!heroIds.has(input.heroId))
      throw new UnprocessableEntityException('Héros statistique introuvable.');
    for (const enemyId of input.enemyHeroIds ?? []) {
      if (!heroIds.has(enemyId))
        throw new UnprocessableEntityException('Héros adverse statistique introuvable.');
    }
    return this.analytics.collectItemStats(snapshot.id, input.heroId, input);
  }
}

@ApiTags('administration')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/reference-players')
export class ReferencePlayersAdminController {
  constructor(private readonly players: ReferencePlayerService) {}

  @Get()
  list() {
    return this.players.list();
  }

  @Post()
  create(@Body() input: ReferencePlayerDto) {
    return this.players.create(input);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() input: ReferencePlayerPatchDto) {
    const patch = Object.fromEntries(
      Object.entries(input).filter(([key, value]) => key !== 'id' && value !== undefined),
    );
    return this.players.update(id, patch);
  }
}

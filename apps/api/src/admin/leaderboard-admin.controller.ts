import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import type { LeaderboardRegion } from '@deadlock/contracts';
import { CatalogService } from '../catalog/catalog.service';
import { LeaderboardService } from '../references/leaderboard.service';
import { AdminGuard } from './admin.guard';

const regions: LeaderboardRegion[] = ['Europe', 'Asia', 'NAmerica', 'SAmerica', 'Oceania'];

class LeaderboardCollectDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(4_294_967_295)
  @Type(() => Number)
  heroId!: number;

  @ApiProperty({ enum: regions, example: 'Europe' })
  @IsIn(regions)
  region!: LeaderboardRegion;
}

class LeaderboardRunsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  version?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4_294_967_295)
  @Type(() => Number)
  heroId?: number;

  @ApiPropertyOptional({ enum: regions })
  @IsOptional()
  @IsIn(regions)
  region?: LeaderboardRegion;
}

class LeaderboardPromotionDto {
  @ApiProperty({ example: 'specialist-infernus-eu' })
  @IsString()
  @MaxLength(80)
  referenceId!: string;

  @ApiPropertyOptional({ example: 'Infernal specialist' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayName?: string;

  @ApiProperty({ example: 'manual-review-2026-09-10' })
  @IsString()
  @MaxLength(500)
  verificationSource!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  notes?: string;
}

@ApiTags('administration')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/leaderboards')
export class LeaderboardAdminController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly leaderboards: LeaderboardService,
  ) {}

  @Get('runs')
  async runs(@Query() query: LeaderboardRunsQueryDto) {
    const snapshot = await this.catalog.snapshot(query.version);
    return this.leaderboards.list(snapshot.id, query.heroId, query.region);
  }

  @Post('collect')
  async collect(@Body() input: LeaderboardCollectDto) {
    const snapshot = await this.catalog.snapshot();
    if (!snapshot.heroes.some((hero) => hero.id === input.heroId)) {
      throw new UnprocessableEntityException('Héros leaderboard introuvable.');
    }
    return this.leaderboards.collect(snapshot.id, input.heroId, input.region);
  }

  @Post('candidates/:candidateId/promote')
  promote(@Param('candidateId') candidateId: string, @Body() input: LeaderboardPromotionDto) {
    return this.leaderboards.promote(candidateId, input);
  }

  @Post('candidates/:candidateId/reject')
  reject(@Param('candidateId') candidateId: string) {
    return this.leaderboards.reject(candidateId);
  }
}

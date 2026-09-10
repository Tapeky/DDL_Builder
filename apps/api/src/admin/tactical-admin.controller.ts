import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { TacticalProfileStatus, TacticalTagKey } from '@deadlock/contracts';
import { CatalogService } from '../catalog/catalog.service';
import { TacticalService } from '../tactical/tactical.service';
import { AdminGuard } from './admin.guard';

class TacticalTagDto {
  @ApiProperty({
    enum: [
      'anti_heal',
      'anti_mobility',
      'anti_burst',
      'anti_bullet',
      'anti_spirit',
      'anti_control',
      'anti_range',
      'anti_regeneration',
    ],
  })
  @IsString()
  @IsIn([
    'anti_heal',
    'anti_mobility',
    'anti_burst',
    'anti_bullet',
    'anti_spirit',
    'anti_control',
    'anti_range',
    'anti_regeneration',
  ])
  key!: TacticalTagKey;

  @ApiProperty({ minimum: 1, maximum: 3 })
  @IsInt()
  @Min(1)
  @Max(3)
  intensity!: 1 | 2 | 3;

  @ApiProperty()
  @IsString()
  @MaxLength(1_000)
  evidence!: string;

  @ApiPropertyOptional({ enum: ['draft', 'validated', 'stale'] })
  @IsOptional()
  @IsIn(['draft', 'validated', 'stale'])
  status?: TacticalProfileStatus;
}

class TacticalProfileQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  version?: string;
}

class TacticalHeroParams {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(4_294_967_295)
  @Type(() => Number)
  heroId!: number;
}

class UpdateTacticalProfileDto {
  @ApiPropertyOptional({ enum: ['draft', 'validated', 'stale'] })
  @IsOptional()
  @IsIn(['draft', 'validated', 'stale'])
  status?: TacticalProfileStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  source?: string;

  @ApiPropertyOptional({ type: [TacticalTagDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @Type(() => TacticalTagDto)
  tags?: TacticalTagDto[];
}

@ApiTags('administration')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/tactical-profiles')
export class TacticalAdminController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly tactical: TacticalService,
  ) {}

  @Get()
  async list(@Query() query: TacticalProfileQuery) {
    const snapshot = await this.catalog.snapshot(query.version);
    return {
      version: snapshot.id,
      tags: snapshot.tacticalTags,
      profiles: snapshot.tacticalProfiles,
    };
  }

  @Patch(':heroId')
  async update(
    @Param() params: TacticalHeroParams,
    @Body() input: UpdateTacticalProfileDto,
    @Query() query: TacticalProfileQuery,
  ) {
    const snapshot = await this.catalog.snapshot(query.version);
    if (!snapshot.heroes.some((hero) => hero.id === params.heroId)) {
      throw new NotFoundException('Héros introuvable dans cette version du catalogue.');
    }
    return this.tactical.updateProfile(snapshot.id, params.heroId, {
      ...input,
      tags: input.tags?.map((tag) => ({
        key: tag.key,
        intensity: tag.intensity,
        evidence: tag.evidence,
        status: tag.status ?? 'draft',
      })),
    });
  }
}

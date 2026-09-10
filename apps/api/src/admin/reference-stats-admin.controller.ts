import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { CatalogService } from '../catalog/catalog.service';
import { ReferenceEvidenceService } from '../references/reference-evidence.service';
import { AdminGuard } from './admin.guard';

class ReferenceStatsCollectDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(4_294_967_295)
  @Type(() => Number)
  heroId!: number;

  @ApiProperty({ example: 1_786_320_000 })
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  @Type(() => Number)
  minUnixTimestamp!: number;
}

class ReferenceStatsListDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  version?: string;
}

@ApiTags('administration')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/reference-stats')
export class ReferenceStatsAdminController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly evidence: ReferenceEvidenceService,
  ) {}

  @Get('runs')
  async runs(@Query() query: ReferenceStatsListDto) {
    const snapshot = query.version ? await this.catalog.snapshot(query.version) : undefined;
    return this.evidence.listRuns(snapshot?.id);
  }

  @Post('collect')
  async collect(@Body() input: ReferenceStatsCollectDto) {
    const snapshot = await this.catalog.snapshot();
    if (!snapshot.heroes.some((hero) => hero.id === input.heroId)) {
      throw new UnprocessableEntityException('Héros de référence introuvable.');
    }
    return this.evidence.collect(snapshot.id, input.heroId, input.minUnixTimestamp);
  }
}

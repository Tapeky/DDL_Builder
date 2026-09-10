import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import type { EditorialBuildStatus, Phase, Style } from '@deadlock/contracts';
import { AdminGuard } from './admin.guard';
import { EditorialBuildService } from '../editorial/editorial.service';

class AlternativeDto {
  @ApiProperty()
  @IsString()
  @MaxLength(120)
  itemClassName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

class StepDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(24)
  order!: number;

  @ApiProperty({ enum: ['early', 'core', 'late'] })
  @IsIn(['early', 'core', 'late'])
  phase!: Phase;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  itemClassName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({ type: [AlternativeDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => AlternativeDto)
  alternatives?: AlternativeDto[];
}

class CreateBuildDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(4_294_967_295)
  heroId!: number;

  @ApiProperty({ enum: ['balanced', 'damage', 'survival'] })
  @IsIn(['balanced', 'damage', 'survival'])
  style!: Style;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  title!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(1_000)
  summary!: string;

  @ApiPropertyOptional({ enum: ['draft'] })
  @IsOptional()
  @IsIn(['draft'])
  status?: EditorialBuildStatus;

  @ApiProperty({ type: [StepDto] })
  @IsArray()
  @ArrayMaxSize(24)
  @ValidateNested({ each: true })
  @Type(() => StepDto)
  steps!: StepDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  version?: string;
}

class UpdateBuildDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(160)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1_000)
  summary?: string;

  @ApiPropertyOptional({ type: [StepDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(24)
  @ValidateNested({ each: true })
  @Type(() => StepDto)
  steps?: StepDto[];
}

class BuildQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  version?: string;
}

class BuildParamsDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  id!: string;
}

@ApiTags('administration')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('admin/builds')
export class AdminController {
  constructor(private readonly editorial: EditorialBuildService) {}

  @Get()
  list(@Query() query: BuildQueryDto) {
    return this.editorial.listAdmin(query.version);
  }

  @Get(':id')
  detail(@Param() params: BuildParamsDto, @Query() query: BuildQueryDto) {
    return this.editorial.detailAdmin(params.id, query.version);
  }

  @Post()
  create(@Body() input: CreateBuildDto) {
    return this.editorial.createBuild(input, input.version);
  }

  @Patch(':id')
  revise(@Param() params: BuildParamsDto, @Body() input: UpdateBuildDto) {
    return this.editorial.reviseBuild(params.id, input);
  }

  @Post(':id/publish')
  publish(@Param() params: BuildParamsDto) {
    return this.editorial.publishBuild(params.id);
  }

  @Post(':id/archive')
  archive(@Param() params: BuildParamsDto) {
    return this.editorial.archiveBuild(params.id);
  }
}

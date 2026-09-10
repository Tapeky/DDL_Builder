import {
  Body,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  Post,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
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
import { Type } from 'class-transformer';
import { createHash } from 'node:crypto';
import type { FarmPriority, Recommendation, Style } from '@deadlock/contracts';
import { DatabaseService } from '../database.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CatalogService } from '../catalog/catalog.service';
import { EditorialModule } from '../editorial/editorial.module';
import { EditorialBuildService } from '../editorial/editorial.service';
import { TacticalModule } from '../tactical/tactical.module';
import { TacticalService } from '../tactical/tactical.service';
import { adaptContext } from './adaptive';

class RecommendationDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(4_294_967_295)
  heroId!: number;

  @ApiProperty({ enum: ['balanced', 'damage', 'survival'] })
  @IsIn(['balanced', 'damage', 'survival'])
  style!: Style;

  @ApiPropertyOptional({ enum: [1, 2, 3, 4, 5, 6], default: 3 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(6)
  @Type(() => Number)
  farmPriority?: FarmPriority;

  @ApiPropertyOptional({ type: [Number], maxItems: 6 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(4_294_967_295, { each: true })
  @Type(() => Number)
  opponentHeroIds?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  version?: string;
}

class BuildParams {
  @IsString()
  @MaxLength(64)
  id!: string;
}

@ApiTags('builds')
@Controller()
class RecommendationsController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly db: DatabaseService,
    private readonly editorial: EditorialBuildService,
    private readonly tactical: TacticalService,
  ) {}

  @Post('recommendations')
  async create(@Body() input: RecommendationDto): Promise<Recommendation> {
    const snapshot = await this.catalog.snapshot(input.version);
    const hero = snapshot.heroes.find((hero) => hero.id === input.heroId);
    if (!hero) throw new NotFoundException('Héros introuvable.');
    const opponentIds = input.opponentHeroIds ?? [];
    if (new Set(opponentIds).size !== opponentIds.length || opponentIds.includes(hero.id)) {
      throw new UnprocessableEntityException(
        'Les adversaires doivent être distincts et différents de votre héros.',
      );
    }
    const opponents = opponentIds.map((id) => {
      const opponent = snapshot.heroes.find((candidate) => candidate.id === id);
      if (!opponent)
        throw new UnprocessableEntityException('Un héros adverse est absent du catalogue.');
      return opponent;
    });
    const adaptive = adaptContext({
      farmPriority: input.farmPriority ?? 3,
      opponents,
      profiles: await this.tactical.listForSnapshot(snapshot.id),
      definitions: this.tactical.definitions(),
    });
    const base = await this.editorial.recommendation(hero, input.style, snapshot);
    const draft = {
      ...base,
      hero,
      style: input.style,
      version: snapshot.id,
      importedAt: snapshot.importedAt.toISOString(),
      farmPriority: input.farmPriority ?? 3,
      opponents,
      threats: adaptive.threats,
      adaptations: adaptive.adaptations,
      warnings:
        input.farmPriority !== undefined || input.opponentHeroIds !== undefined
          ? [...base.warnings, ...adaptive.warnings]
          : base.warnings,
    };
    const id = createHash('sha256').update(JSON.stringify(draft)).digest('hex').slice(0, 32);
    const payload: Recommendation = { ...draft, id, sharePath: `/?build=${id}` };
    const saved = await this.db.savedBuild.upsert({
      where: { id },
      update: {},
      create: { id, snapshotId: snapshot.id, payload: JSON.parse(JSON.stringify(payload)) },
    });
    return saved.payload as unknown as Recommendation;
  }

  @Get('builds/:id')
  async build(@Param() params: BuildParams): Promise<Recommendation> {
    const build = await this.db.savedBuild.findUnique({ where: { id: params.id } });
    if (!build) throw new NotFoundException('Build partagé introuvable.');
    return build.payload as unknown as Recommendation;
  }
}

@Module({
  imports: [CatalogModule, EditorialModule, TacticalModule],
  controllers: [RecommendationsController],
})
export class RecommendationsModule {}

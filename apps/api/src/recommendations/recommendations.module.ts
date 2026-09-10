import { Body, Controller, Get, Module, NotFoundException, Param, Post } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { createHash } from 'node:crypto';
import type { Recommendation, Style } from '@deadlock/contracts';
import { DatabaseService } from '../database.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CatalogService } from '../catalog/catalog.service';
import { EditorialModule } from '../editorial/editorial.module';
import { EditorialBuildService } from '../editorial/editorial.service';

class RecommendationDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  @Max(4_294_967_295)
  heroId!: number;

  @ApiProperty({ enum: ['balanced', 'damage', 'survival'] })
  @IsIn(['balanced', 'damage', 'survival'])
  style!: Style;

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
  ) {}

  @Post('recommendations')
  async create(@Body() input: RecommendationDto): Promise<Recommendation> {
    const snapshot = await this.catalog.snapshot(input.version);
    const hero = snapshot.heroes.find((hero) => hero.id === input.heroId);
    if (!hero) throw new NotFoundException('Héros introuvable.');
    const draft = {
      ...(await this.editorial.recommendation(hero, input.style, snapshot)),
      hero,
      style: input.style,
      version: snapshot.id,
      importedAt: snapshot.importedAt.toISOString(),
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
  imports: [CatalogModule, EditorialModule],
  controllers: [RecommendationsController],
})
export class RecommendationsModule {}

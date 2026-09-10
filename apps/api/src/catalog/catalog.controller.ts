import { Controller, Get, Query } from '@nestjs/common';
import { ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { CatalogService } from './catalog.service';

class CatalogQuery {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  version?: string;

  @ApiPropertyOptional({ enum: ['weapon', 'vitality', 'spirit'] })
  @IsOptional()
  @IsIn(['weapon', 'vitality', 'spirit'])
  category?: string;
}

@ApiTags('catalogue')
@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('catalog')
  catalog() {
    return this.catalogService.catalog();
  }

  @Get('data-status')
  status() {
    return this.catalogService.status();
  }

  @Get('heroes')
  async heroes(@Query() query: CatalogQuery) {
    return (await this.catalogService.snapshot(query.version)).heroes;
  }

  @Get('items')
  async items(@Query() query: CatalogQuery) {
    const { items } = await this.catalogService.snapshot(query.version);
    return query.category ? items.filter((item) => item.category === query.category) : items;
  }

  @Get('tactical-profiles')
  async tacticalProfiles(@Query() query: CatalogQuery) {
    const snapshot = await this.catalogService.snapshot(query.version);
    return {
      version: snapshot.id,
      tags: snapshot.tacticalTags,
      profiles: snapshot.tacticalProfiles,
    };
  }
}

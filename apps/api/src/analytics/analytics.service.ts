import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AnalyticsFilters, AnalyticsItemStat, AnalyticsRunSummary } from '@deadlock/contracts';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { DatabaseService } from '../database.module';
import { SOURCE_URL } from '../catalog/source';

const itemStat = z.object({
  item_id: z.number().int().nonnegative(),
  bucket: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  matches: z.number().int().nonnegative(),
  players: z.number().int().nonnegative(),
  avg_buy_time_s: z.number().finite().nonnegative(),
  avg_sell_time_s: z.number().finite().nonnegative(),
  avg_buy_time_relative: z.number().finite().nonnegative(),
  avg_sell_time_relative: z.number().finite().nonnegative(),
});

type GameMode = 'normal' | 'street_brawl' | 'explore_n_y_c' | 'internal';

export interface AnalyticsCollectionInput {
  minUnixTimestamp: number;
  maxUnixTimestamp?: number;
  gameMode?: GameMode;
  matchMode?: string;
  minMatches?: number;
  minAverageBadge?: number;
  maxAverageBadge?: number;
  minNetworth?: number;
  maxNetworth?: number;
  enemyHeroIds?: number[];
  enemyHeroIdsAllMatch?: boolean;
  sameLaneFilter?: boolean;
}

function json(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function normalizeFilters(input: AnalyticsCollectionInput): AnalyticsFilters {
  if (!Number.isInteger(input.minUnixTimestamp) || input.minUnixTimestamp < 0) {
    throw new UnprocessableEntityException('La date de début statistique est invalide.');
  }
  if (
    input.maxUnixTimestamp !== undefined &&
    (!Number.isInteger(input.maxUnixTimestamp) || input.maxUnixTimestamp < input.minUnixTimestamp)
  ) {
    throw new UnprocessableEntityException('La fenêtre temporelle statistique est invalide.');
  }
  const enemyHeroIds = [...new Set(input.enemyHeroIds ?? [])];
  if (input.sameLaneFilter && enemyHeroIds.length === 0) {
    throw new UnprocessableEntityException(
      'Le filtre de même lane exige au moins un héros adverse.',
    );
  }
  if (
    input.minAverageBadge !== undefined &&
    input.maxAverageBadge !== undefined &&
    input.minAverageBadge > input.maxAverageBadge
  ) {
    throw new UnprocessableEntityException('La plage de rang statistique est invalide.');
  }
  if (
    input.minNetworth !== undefined &&
    input.maxNetworth !== undefined &&
    input.minNetworth > input.maxNetworth
  ) {
    throw new UnprocessableEntityException('La plage de fortune statistique est invalide.');
  }
  return {
    gameMode: input.gameMode ?? 'normal',
    matchMode: input.matchMode?.trim() || 'ranked,unranked',
    minUnixTimestamp: input.minUnixTimestamp,
    maxUnixTimestamp: input.maxUnixTimestamp ?? null,
    minMatches: input.minMatches ?? 20,
    minAverageBadge: input.minAverageBadge ?? null,
    maxAverageBadge: input.maxAverageBadge ?? null,
    minNetworth: input.minNetworth ?? null,
    maxNetworth: input.maxNetworth ?? null,
    enemyHeroIds,
    enemyHeroIdsAllMatch: input.enemyHeroIdsAllMatch ?? false,
    sameLaneFilter: input.sameLaneFilter ?? false,
  };
}

function queryFrom(heroId: number, filters: AnalyticsFilters) {
  const query = new URLSearchParams({
    hero_id: String(heroId),
    game_mode: filters.gameMode,
    match_mode: filters.matchMode,
    min_unix_timestamp: String(filters.minUnixTimestamp),
    min_matches: String(filters.minMatches),
  });
  const optional: Array<[string, number | boolean | null]> = [
    ['max_unix_timestamp', filters.maxUnixTimestamp],
    ['min_average_badge', filters.minAverageBadge],
    ['max_average_badge', filters.maxAverageBadge],
    ['min_networth', filters.minNetworth],
    ['max_networth', filters.maxNetworth],
    ['enemy_hero_ids_all_match', filters.enemyHeroIds.length ? filters.enemyHeroIdsAllMatch : null],
    ['same_lane_filter', filters.enemyHeroIds.length ? filters.sameLaneFilter : null],
  ];
  for (const [key, value] of optional) {
    if (value !== null) query.set(key, String(value));
  }
  if (filters.enemyHeroIds.length) query.set('enemy_hero_ids', filters.enemyHeroIds.join(','));
  return query;
}

async function fetchItemStats(heroId: number, filters: AnalyticsFilters) {
  const url = `${SOURCE_URL}/v1/analytics/item-stats?${queryFrom(heroId, filters)}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    } catch {
      if (attempt === 2) throw new Error('ANALYTICS_NETWORK_FAILED');
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      continue;
    }
    if (response.status === 429 || response.status >= 500) {
      const retryAfter = Number(response.headers.get('retry-after') ?? 0);
      await response.body?.cancel();
      if (attempt === 2) throw new Error('ANALYTICS_SOURCE_UNAVAILABLE');
      await new Promise((resolve) =>
        setTimeout(resolve, retryAfter > 0 ? retryAfter * 1_000 : 500 * 2 ** attempt),
      );
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('ANALYTICS_SOURCE_REJECTED');
    }
    return itemStat.array().parse(await response.json());
  }
  throw new Error('ANALYTICS_SOURCE_UNAVAILABLE');
}

function toItemStat(row: {
  itemId: bigint;
  bucket: number;
  wins: bigint;
  losses: bigint;
  matches: bigint;
  players: bigint;
  avgBuyTimeS: number;
  avgSellTimeS: number;
  avgBuyTimeRelative: number;
  avgSellTimeRelative: number;
}): AnalyticsItemStat {
  return {
    itemId: Number(row.itemId),
    bucket: row.bucket,
    wins: Number(row.wins),
    losses: Number(row.losses),
    matches: Number(row.matches),
    players: Number(row.players),
    avgBuyTimeS: row.avgBuyTimeS,
    avgSellTimeS: row.avgSellTimeS,
    avgBuyTimeRelative: row.avgBuyTimeRelative,
    avgSellTimeRelative: row.avgSellTimeRelative,
  };
}

function toSummary(run: {
  id: string;
  snapshotId: string;
  metric: string;
  status: string;
  source: string;
  filters: unknown;
  rowCount: number | null;
  errorCode: string | null;
  startedAt: Date;
  completedAt: Date | null;
}): AnalyticsRunSummary {
  const storedFilters = run.filters as AnalyticsFilters & { heroId: number };
  const { heroId, ...filters } = storedFilters;
  return {
    id: run.id,
    snapshotId: run.snapshotId,
    heroId,
    metric: 'item-stats',
    status: run.status as AnalyticsRunSummary['status'],
    source: run.source,
    filters,
    rowCount: run.rowCount,
    errorCode: run.errorCode,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly db: DatabaseService) {}

  async collectItemStats(snapshotId: string, heroId: number, input: AnalyticsCollectionInput) {
    const snapshot = await this.db.catalogSnapshot.findUnique({ where: { id: snapshotId } });
    if (!snapshot) throw new NotFoundException('Catalogue introuvable.');
    const filters = normalizeFilters(input);
    const filterHash = createHash('sha256')
      .update(JSON.stringify({ heroId, ...filters }))
      .digest('hex')
      .slice(0, 32);
    const run = await this.db.analyticsRun.create({
      data: {
        id: `analytics-${randomUUID()}`,
        snapshotId,
        metric: 'item-stats',
        status: 'running',
        source: `${SOURCE_URL}/v1/analytics/item-stats`,
        filterHash,
        filters: json({ heroId, ...filters }),
      },
    });
    try {
      const rows = await fetchItemStats(heroId, filters);
      const completed = await this.db.$transaction(async (tx) => {
        await tx.analyticsItemStat.createMany({
          data: rows.map((row) => ({
            id: `${run.id}-${row.item_id}-${row.bucket}`,
            runId: run.id,
            itemId: BigInt(row.item_id),
            bucket: row.bucket,
            wins: BigInt(row.wins),
            losses: BigInt(row.losses),
            matches: BigInt(row.matches),
            players: BigInt(row.players),
            avgBuyTimeS: row.avg_buy_time_s,
            avgSellTimeS: row.avg_sell_time_s,
            avgBuyTimeRelative: row.avg_buy_time_relative,
            avgSellTimeRelative: row.avg_sell_time_relative,
          })),
        });
        return tx.analyticsRun.update({
          where: { id: run.id },
          data: { status: 'succeeded', rowCount: rows.length, completedAt: new Date() },
        });
      });
      return toSummary(completed);
    } catch (error) {
      await this.db.analyticsRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          errorCode: error instanceof Error ? error.message.slice(0, 100) : 'ANALYTICS_FAILED',
          completedAt: new Date(),
        },
      });
      throw new ServiceUnavailableException(
        'La collecte statistique a échoué. Aucun agrégat partiel n’a été publié.',
      );
    }
  }

  async listRuns(snapshotId?: string) {
    const runs = await this.db.analyticsRun.findMany({
      where: snapshotId ? { snapshotId } : undefined,
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
    return runs.map(toSummary);
  }

  async runDetail(id: string) {
    const run = await this.db.analyticsRun.findUnique({
      where: { id },
      include: { itemStats: { orderBy: [{ itemId: 'asc' }, { bucket: 'asc' }] } },
    });
    if (!run) throw new NotFoundException('Collecte statistique introuvable.');
    return {
      ...toSummary(run),
      stats: run.itemStats.map(toItemStat),
    };
  }
}

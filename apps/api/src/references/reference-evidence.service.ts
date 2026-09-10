import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { RecommendationReferenceEvidence, ReferenceStatRunSummary } from '@deadlock/contracts';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { SOURCE_URL } from '../catalog/source';
import { DatabaseService } from '../database.module';

const sourceInt = z.number().int().min(0).max(2_147_483_647);
const sourceCount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const sourceMetric = z.number().finite().nonnegative();
const heroStat = z.object({
  account_id: sourceInt,
  hero_id: sourceInt,
  matches_played: sourceCount,
  last_played: sourceInt,
  time_played: sourceCount,
  wins: sourceCount,
  kills_per_min: sourceMetric,
  deaths_per_min: sourceMetric,
  assists_per_min: sourceMetric,
  networth_per_min: sourceMetric,
  damage_per_min: sourceMetric,
});
const heroStats = heroStat.array().max(1_000);

function json(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function numbers(value: unknown) {
  if (!Array.isArray(value) || value.some((item) => !Number.isSafeInteger(item) || item < 0)) {
    throw new ConflictException('Un profil vérifié contient des identifiants invalides.');
  }
  return value as number[];
}

function summary(run: {
  id: string;
  snapshotId: string;
  heroId: number;
  status: string;
  source: string;
  filters: unknown;
  playerCount: number | null;
  rowCount: number | null;
  errorCode: string | null;
  startedAt: Date;
  completedAt: Date | null;
}): ReferenceStatRunSummary {
  const filters = run.filters as { minUnixTimestamp: number };
  return {
    id: run.id,
    snapshotId: run.snapshotId,
    heroId: run.heroId,
    status: run.status as ReferenceStatRunSummary['status'],
    source: run.source,
    minUnixTimestamp: filters.minUnixTimestamp,
    playerCount: run.playerCount,
    rowCount: run.rowCount,
    errorCode: run.errorCode,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
  };
}

async function fetchHeroStats(accountIds: number[], heroId: number, minUnixTimestamp: number) {
  const query = new URLSearchParams({
    account_ids: accountIds.join(','),
    hero_ids: String(heroId),
    game_mode: 'normal',
    match_mode: 'ranked,unranked',
    min_unix_timestamp: String(minUnixTimestamp),
  });
  const url = `${SOURCE_URL}/v1/players/hero-stats?${query}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    } catch {
      if (attempt === 2) throw new Error('REFERENCE_STATS_NETWORK_FAILED');
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      continue;
    }
    if (response.status === 429 || response.status >= 500) {
      const retryAfter = Number(response.headers.get('retry-after') ?? 0);
      await response.body?.cancel();
      if (attempt === 2) throw new Error('REFERENCE_STATS_SOURCE_UNAVAILABLE');
      await new Promise((resolve) =>
        setTimeout(resolve, retryAfter > 0 ? retryAfter * 1_000 : 500 * 2 ** attempt),
      );
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('REFERENCE_STATS_SOURCE_REJECTED');
    }
    return heroStats.parse(await response.json());
  }
  throw new Error('REFERENCE_STATS_SOURCE_UNAVAILABLE');
}

@Injectable()
export class ReferenceEvidenceService {
  constructor(private readonly db: DatabaseService) {}

  async collect(snapshotId: string, heroId: number, minUnixTimestamp: number) {
    if (!Number.isSafeInteger(minUnixTimestamp) || minUnixTimestamp < 0) {
      throw new UnprocessableEntityException('La date de début des références est invalide.');
    }
    const snapshot = await this.db.catalogSnapshot.findUnique({ where: { id: snapshotId } });
    if (!snapshot) throw new NotFoundException('Catalogue introuvable.');
    const verified = await this.db.referencePlayer.findMany({
      where: { verificationStatus: 'verified' },
      orderBy: { id: 'asc' },
    });
    const players = verified.filter((player) => numbers(player.heroIds).includes(heroId));
    if (players.length === 0) {
      throw new UnprocessableEntityException(
        'Aucun joueur vérifié n’est associé à ce héros. Les candidats pending sont exclus.',
      );
    }
    const ownerByAccount = new Map<number, string>();
    for (const player of players) {
      for (const accountId of numbers(player.accountIds)) {
        if (ownerByAccount.has(accountId)) {
          throw new ConflictException(
            'Un compte est attribué à plusieurs profils vérifiés. Corrigez les identités avant la collecte.',
          );
        }
        ownerByAccount.set(accountId, player.id);
      }
    }
    const accountIds = [...ownerByAccount.keys()].sort((a, b) => a - b);
    if (accountIds.length === 0 || accountIds.length > 1_000) {
      throw new UnprocessableEntityException(
        'La collecte exige entre 1 et 1 000 comptes vérifiés.',
      );
    }
    const run = await this.db.referenceStatRun.create({
      data: {
        id: `reference-stats-${randomUUID()}`,
        snapshotId,
        heroId,
        status: 'running',
        source: `${SOURCE_URL}/v1/players/hero-stats`,
        filters: json({ minUnixTimestamp, gameMode: 'normal', matchMode: 'ranked,unranked' }),
      },
    });
    try {
      const rows = await fetchHeroStats(accountIds, heroId, minUnixTimestamp);
      const seen = new Set<string>();
      for (const row of rows) {
        const key = `${row.account_id}:${row.hero_id}`;
        if (!ownerByAccount.has(row.account_id) || row.hero_id !== heroId || seen.has(key)) {
          throw new Error('REFERENCE_STATS_INVALID_SCOPE');
        }
        seen.add(key);
      }
      const completed = await this.db.$transaction(async (tx) => {
        await tx.referenceHeroStat.createMany({
          data: rows.map((row) => ({
            id: `${run.id}-${row.account_id}-${row.hero_id}`,
            runId: run.id,
            referencePlayerId: ownerByAccount.get(row.account_id)!,
            accountId: BigInt(row.account_id),
            heroId: row.hero_id,
            matchesPlayed: BigInt(row.matches_played),
            wins: BigInt(row.wins),
            lastPlayed: row.last_played,
            timePlayed: BigInt(row.time_played),
            killsPerMin: row.kills_per_min,
            deathsPerMin: row.deaths_per_min,
            assistsPerMin: row.assists_per_min,
            networthPerMin: row.networth_per_min,
            damagePerMin: row.damage_per_min,
          })),
        });
        for (const player of players) {
          const lastPlayed = Math.max(
            ...rows
              .filter((row) => ownerByAccount.get(row.account_id) === player.id)
              .map((row) => row.last_played),
            0,
          );
          if (lastPlayed > 0) {
            await tx.referencePlayer.update({
              where: { id: player.id },
              data: { lastSeenAt: new Date(lastPlayed * 1_000) },
            });
          }
        }
        return tx.referenceStatRun.update({
          where: { id: run.id },
          data: {
            status: 'succeeded',
            playerCount: new Set(rows.map((row) => ownerByAccount.get(row.account_id))).size,
            rowCount: rows.length,
            completedAt: new Date(),
          },
        });
      });
      return summary(completed);
    } catch (error) {
      await this.db.referenceStatRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          errorCode:
            error instanceof Error ? error.message.slice(0, 100) : 'REFERENCE_STATS_FAILED',
          completedAt: new Date(),
        },
      });
      throw new ServiceUnavailableException(
        'La collecte des références a échoué. Aucune statistique partielle n’a été publiée.',
      );
    }
  }

  async listRuns(snapshotId?: string) {
    const runs = await this.db.referenceStatRun.findMany({
      where: snapshotId ? { snapshotId } : undefined,
      orderBy: { startedAt: 'desc' },
      take: 100,
    });
    return runs.map(summary);
  }

  async forRecommendation(snapshotId: string, heroId: number) {
    const run = await this.db.referenceStatRun.findFirst({
      where: { snapshotId, heroId, status: 'succeeded' },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      include: {
        stats: {
          where: { referencePlayer: { verificationStatus: 'verified' } },
          include: { referencePlayer: true },
          orderBy: [{ referencePlayerId: 'asc' }, { accountId: 'asc' }],
        },
      },
    });
    if (!run?.completedAt) return [];
    const evidence = new Map<string, RecommendationReferenceEvidence>();
    const weights = new Map<string, number>();
    for (const stat of run.stats) {
      const player = stat.referencePlayer;
      if (!player.verifiedAt) continue;
      const current = evidence.get(player.id) ?? {
        playerId: player.id,
        displayName: player.displayName,
        region: player.region,
        verificationSource: player.verificationSource,
        verifiedAt: player.verifiedAt.toISOString(),
        sourceUrl: player.sourceUrl,
        collectedAt: run.completedAt.toISOString(),
        matchesPlayed: 0,
        lastPlayed: new Date(0).toISOString(),
        killsPerMin: 0,
        deathsPerMin: 0,
        assistsPerMin: 0,
        networthPerMin: 0,
        damagePerMin: 0,
      };
      const weight = Number(stat.timePlayed);
      current.matchesPlayed += Number(stat.matchesPlayed);
      current.lastPlayed = new Date(
        Math.max(Date.parse(current.lastPlayed), stat.lastPlayed * 1_000),
      ).toISOString();
      current.killsPerMin += stat.killsPerMin * weight;
      current.deathsPerMin += stat.deathsPerMin * weight;
      current.assistsPerMin += stat.assistsPerMin * weight;
      current.networthPerMin += stat.networthPerMin * weight;
      current.damagePerMin += stat.damagePerMin * weight;
      weights.set(player.id, (weights.get(player.id) ?? 0) + weight);
      evidence.set(player.id, current);
    }
    return [...evidence.values()]
      .map((item) => {
        const weight = weights.get(item.playerId) ?? 0;
        if (weight === 0) return item;
        return {
          ...item,
          killsPerMin: item.killsPerMin / weight,
          deathsPerMin: item.deathsPerMin / weight,
          assistsPerMin: item.assistsPerMin / weight,
          networthPerMin: item.networthPerMin / weight,
          damagePerMin: item.damagePerMin / weight,
        };
      })
      .filter((item) => item.matchesPlayed > 0)
      .sort(
        (left, right) =>
          right.matchesPlayed - left.matchesPlayed || left.playerId.localeCompare(right.playerId),
      );
  }
}

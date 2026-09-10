import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  LeaderboardCandidate,
  LeaderboardRegion,
  LeaderboardRunSummary,
} from '@deadlock/contracts';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { SOURCE_URL } from '../catalog/source';
import { DatabaseService } from '../database.module';
import { ReferencePlayerService } from './reference-player.service';

const regions: LeaderboardRegion[] = ['Europe', 'Asia', 'NAmerica', 'SAmerica', 'Oceania'];
const sourceInt = z.number().int().min(0).max(2_147_483_647);
const leaderboardEntry = z.object({
  account_name: z.string().nullable().optional(),
  possible_account_ids: sourceInt.array().default([]),
  rank: sourceInt.nullable().optional(),
  top_hero_ids: sourceInt.array().default([]),
});
const leaderboardResponse = z.object({ entries: leaderboardEntry.array() });

function json(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function candidateFrom(candidate: {
  id: string;
  runId: string;
  accountName: string | null;
  possibleAccountIds: unknown;
  rank: number | null;
  topHeroIds: unknown;
  status: string;
  promotedPlayerId: string | null;
}): LeaderboardCandidate {
  return {
    id: candidate.id,
    runId: candidate.runId,
    accountName: candidate.accountName,
    possibleAccountIds: candidate.possibleAccountIds as number[],
    rank: candidate.rank,
    topHeroIds: candidate.topHeroIds as number[],
    status: candidate.status as LeaderboardCandidate['status'],
    promotedPlayerId: candidate.promotedPlayerId,
  };
}

function runFrom(run: {
  id: string;
  snapshotId: string;
  heroId: number;
  region: string;
  status: string;
  source: string;
  rowCount: number | null;
  errorCode: string | null;
  startedAt: Date;
  completedAt: Date | null;
}): LeaderboardRunSummary {
  return {
    id: run.id,
    snapshotId: run.snapshotId,
    heroId: run.heroId,
    region: run.region as LeaderboardRegion,
    status: run.status as LeaderboardRunSummary['status'],
    source: run.source,
    rowCount: run.rowCount,
    errorCode: run.errorCode,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
  };
}

async function fetchLeaderboard(region: LeaderboardRegion, heroId: number) {
  const url = `${SOURCE_URL}/v1/leaderboard/${encodeURIComponent(region)}/${heroId}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    } catch {
      if (attempt === 2) throw new Error('LEADERBOARD_NETWORK_FAILED');
      await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
      continue;
    }
    if (response.status === 429 || response.status >= 500) {
      const retryAfter = Number(response.headers.get('retry-after') ?? 0);
      await response.body?.cancel();
      if (attempt === 2) throw new Error('LEADERBOARD_SOURCE_UNAVAILABLE');
      await new Promise((resolve) =>
        setTimeout(resolve, retryAfter > 0 ? retryAfter * 1_000 : 500 * 2 ** attempt),
      );
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('LEADERBOARD_SOURCE_REJECTED');
    }
    return leaderboardResponse.parse(await response.json());
  }
  throw new Error('LEADERBOARD_SOURCE_UNAVAILABLE');
}

export function normalizeLeaderboard(raw: unknown) {
  const response = leaderboardResponse.parse(raw);
  return response.entries.map((entry) => ({
    accountName: entry.account_name ?? null,
    possibleAccountIds: [...new Set(entry.possible_account_ids)],
    rank: entry.rank ?? null,
    topHeroIds: [...new Set(entry.top_hero_ids)],
  }));
}

@Injectable()
export class LeaderboardService {
  constructor(
    private readonly db: DatabaseService,
    private readonly players: ReferencePlayerService,
  ) {}

  async collect(snapshotId: string, heroId: number, region: LeaderboardRegion) {
    if (!regions.includes(region)) {
      throw new UnprocessableEntityException('La région du leaderboard est inconnue.');
    }
    const snapshot = await this.db.catalogSnapshot.findUnique({ where: { id: snapshotId } });
    if (!snapshot) throw new NotFoundException('Catalogue introuvable.');
    const run = await this.db.leaderboardRun.create({
      data: {
        id: `leaderboard-${randomUUID()}`,
        snapshotId,
        heroId,
        region,
        status: 'running',
        source: `${SOURCE_URL}/v1/leaderboard/${region}/${heroId}`,
      },
    });
    try {
      const entries = normalizeLeaderboard(await fetchLeaderboard(region, heroId));
      const completed = await this.db.$transaction(async (tx) => {
        await tx.leaderboardCandidate.createMany({
          data: entries.map((entry, index) => ({
            id: `${run.id}-${index}`,
            runId: run.id,
            accountName: entry.accountName,
            possibleAccountIds: json(entry.possibleAccountIds),
            rank: entry.rank,
            topHeroIds: json(entry.topHeroIds),
          })),
        });
        return tx.leaderboardRun.update({
          where: { id: run.id },
          data: { status: 'succeeded', rowCount: entries.length, completedAt: new Date() },
        });
      });
      return runFrom(completed);
    } catch (error) {
      await this.db.leaderboardRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          errorCode: error instanceof Error ? error.message.slice(0, 100) : 'LEADERBOARD_FAILED',
          completedAt: new Date(),
        },
      });
      throw new ServiceUnavailableException(
        'La collecte du leaderboard a échoué. Aucun candidat partiel n’a été publié.',
      );
    }
  }

  async list(snapshotId: string, heroId?: number, region?: LeaderboardRegion) {
    const runs = await this.db.leaderboardRun.findMany({
      where: {
        snapshotId,
        ...(heroId === undefined ? {} : { heroId }),
        ...(region ? { region } : {}),
      },
      orderBy: { startedAt: 'desc' },
      take: 100,
      include: { candidates: { orderBy: [{ rank: 'asc' }, { id: 'asc' }] } },
    });
    return runs.map((run) => ({
      ...runFrom(run),
      candidates: run.candidates.map(candidateFrom),
    }));
  }

  async promote(
    candidateId: string,
    input: {
      referenceId: string;
      displayName?: string;
      verificationSource: string;
      notes?: string;
    },
  ) {
    return this.db.$transaction(async (tx) => {
      const candidate = await tx.leaderboardCandidate.findUnique({
        where: { id: candidateId },
        include: { run: true },
      });
      if (!candidate) throw new NotFoundException('Candidat leaderboard introuvable.');
      if (candidate.status !== 'pending') {
        throw new ConflictException('Ce candidat a déjà été traité.');
      }
      const accountIds = candidate.possibleAccountIds as number[];
      const displayName = input.displayName?.trim() || candidate.accountName?.trim();
      if (!displayName) {
        throw new UnprocessableEntityException(
          'Un candidat sans nom doit recevoir un nom affiché avant promotion.',
        );
      }
      const player = await this.players.create(
        {
          id: input.referenceId,
          displayName,
          region: candidate.run.region,
          accountIds,
          heroIds: [candidate.run.heroId],
          verificationStatus: 'pending',
          verificationSource: input.verificationSource,
          notes: input.notes,
        },
        tx,
      );
      const updated = await tx.leaderboardCandidate.updateMany({
        where: { id: candidateId, status: 'pending' },
        data: { status: 'promoted', promotedPlayerId: player.id },
      });
      if (updated.count !== 1) throw new ConflictException('Ce candidat a déjà été traité.');
      return player;
    });
  }

  async reject(candidateId: string) {
    const result = await this.db.leaderboardCandidate.updateMany({
      where: { id: candidateId, status: 'pending' },
      data: { status: 'rejected' },
    });
    if (result.count === 0) {
      const candidate = await this.db.leaderboardCandidate.findUnique({
        where: { id: candidateId },
      });
      if (!candidate) throw new NotFoundException('Candidat leaderboard introuvable.');
      throw new ConflictException('Ce candidat a déjà été traité.');
    }
    const rejected = await this.db.leaderboardCandidate.findUniqueOrThrow({
      where: { id: candidateId },
    });
    return candidateFrom(rejected);
  }
}

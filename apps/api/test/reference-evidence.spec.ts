import { ReferenceEvidenceService } from '../src/references/reference-evidence.service';

const run = {
  id: 'reference-stats-run',
  snapshotId: 'snapshot-test',
  heroId: 1,
  status: 'running',
  source: 'https://api.deadlock-api.com/v1/players/hero-stats',
  filters: { minUnixTimestamp: 1_786_320_000 },
  playerCount: null,
  rowCount: null,
  errorCode: null,
  startedAt: new Date('2026-09-10T00:00:00.000Z'),
  completedAt: null,
};

const verifiedPlayer = {
  id: 'verified-infernus',
  displayName: 'Verified Infernus',
  region: 'Europe',
  accountIds: [12],
  heroIds: [1],
  verificationStatus: 'verified',
  verificationSource: 'manual review',
  verifiedAt: new Date('2026-09-09T00:00:00.000Z'),
  lastSeenAt: null,
  sourceUrl: 'https://example.com/evidence',
  notes: '',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sourceRow = {
  account_id: 12,
  hero_id: 1,
  matches_played: 40,
  last_played: 1_788_979_891,
  time_played: 80_000,
  wins: 21,
  kills_per_min: 0.25,
  deaths_per_min: 0.2,
  assists_per_min: 0.4,
  networth_per_min: 1_100,
  damage_per_min: 900,
};

describe('verified reference evidence', () => {
  afterEach(() => jest.restoreAllMocks());

  it('collects hero stats only for verified account IDs', async () => {
    const completed = {
      ...run,
      status: 'succeeded',
      playerCount: 1,
      rowCount: 1,
      completedAt: new Date('2026-09-10T00:00:01.000Z'),
    };
    const tx = {
      referenceHeroStat: { createMany: jest.fn() },
      referencePlayer: { update: jest.fn() },
      referenceStatRun: { update: jest.fn().mockResolvedValue(completed) },
    };
    const db = {
      catalogSnapshot: { findUnique: jest.fn().mockResolvedValue({ id: run.snapshotId }) },
      referencePlayer: { findMany: jest.fn().mockResolvedValue([verifiedPlayer]) },
      referenceStatRun: { create: jest.fn().mockResolvedValue(run), update: jest.fn() },
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) => callback(tx)),
    };
    const request = jest.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json([sourceRow]));
    const service = new ReferenceEvidenceService(db as never);
    const result = await service.collect('snapshot-test', 1, 1_786_320_000);

    const url = new URL(String(request.mock.calls[0][0]));
    expect(url.pathname).toBe('/v1/players/hero-stats');
    expect(url.searchParams.get('account_ids')).toBe('12');
    expect(url.searchParams.get('hero_ids')).toBe('1');
    expect(tx.referenceHeroStat.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          referencePlayerId: verifiedPlayer.id,
          accountId: BigInt(12),
          matchesPlayed: BigInt(40),
          wins: BigInt(21),
        }),
      ],
    });
    expect(result).toMatchObject({ status: 'succeeded', playerCount: 1, rowCount: 1 });
  });

  it('refuses candidates and ambiguous verified account ownership before collection', async () => {
    const db = {
      catalogSnapshot: { findUnique: jest.fn().mockResolvedValue({ id: run.snapshotId }) },
      referencePlayer: { findMany: jest.fn().mockResolvedValue([]) },
      referenceStatRun: { create: jest.fn() },
    };
    const service = new ReferenceEvidenceService(db as never);
    await expect(service.collect('snapshot-test', 1, 1_786_320_000)).rejects.toThrow(
      'candidats pending sont exclus',
    );
    expect(db.referenceStatRun.create).not.toHaveBeenCalled();

    db.referencePlayer.findMany.mockResolvedValue([
      verifiedPlayer,
      { ...verifiedPlayer, id: 'duplicate-owner' },
    ]);
    await expect(service.collect('snapshot-test', 1, 1_786_320_000)).rejects.toThrow(
      'plusieurs profils vérifiés',
    );
    expect(db.referenceStatRun.create).not.toHaveBeenCalled();
  });

  it('marks source failures without publishing partial reference rows', async () => {
    const db = {
      catalogSnapshot: { findUnique: jest.fn().mockResolvedValue({ id: run.snapshotId }) },
      referencePlayer: { findMany: jest.fn().mockResolvedValue([verifiedPlayer]) },
      referenceStatRun: {
        create: jest.fn().mockResolvedValue(run),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const service = new ReferenceEvidenceService(db as never);

    await expect(service.collect('snapshot-test', 1, 1_786_320_000)).rejects.toThrow(
      'collecte des références a échoué',
    );
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.referenceStatRun.update).toHaveBeenCalledWith({
      where: { id: run.id },
      data: expect.objectContaining({
        status: 'failed',
        errorCode: 'REFERENCE_STATS_NETWORK_FAILED',
      }),
    });
  });

  it('exposes the latest run as deterministic, time-weighted recommendation context', async () => {
    const completedAt = new Date('2026-09-10T00:00:01.000Z');
    const db = {
      referenceStatRun: {
        findFirst: jest.fn().mockResolvedValue({
          ...run,
          status: 'succeeded',
          completedAt,
          stats: [
            {
              ...sourceRow,
              accountId: BigInt(12),
              matchesPlayed: BigInt(40),
              wins: BigInt(21),
              lastPlayed: sourceRow.last_played,
              timePlayed: BigInt(80_000),
              killsPerMin: 0.25,
              deathsPerMin: 0.2,
              assistsPerMin: 0.4,
              networthPerMin: 1_100,
              damagePerMin: 900,
              referencePlayerId: verifiedPlayer.id,
              referencePlayer: { ...verifiedPlayer, accountIds: [12, 13] },
            },
            {
              accountId: BigInt(13),
              matchesPlayed: BigInt(20),
              wins: BigInt(10),
              lastPlayed: sourceRow.last_played - 100,
              timePlayed: BigInt(40_000),
              killsPerMin: 0.4,
              deathsPerMin: 0.3,
              assistsPerMin: 0.5,
              networthPerMin: 1_400,
              damagePerMin: 1_200,
              referencePlayerId: verifiedPlayer.id,
              referencePlayer: { ...verifiedPlayer, accountIds: [12, 13] },
            },
          ],
        }),
      },
    };
    const service = new ReferenceEvidenceService(db as never);
    const result = await service.forRecommendation('snapshot-test', 1);

    expect(db.referenceStatRun.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { snapshotId: 'snapshot-test', heroId: 1, status: 'succeeded' },
      }),
    );
    expect(result).toEqual([
      expect.objectContaining({
        playerId: verifiedPlayer.id,
        matchesPlayed: 60,
        killsPerMin: 0.3,
        networthPerMin: 1_200,
        collectedAt: completedAt.toISOString(),
      }),
    ]);
    const stored = await db.referenceStatRun.findFirst();
    for (const stat of stored.stats) stat.referencePlayer.accountIds = [12];
    expect(await service.forRecommendation('snapshot-test', 1)).toEqual([
      expect.objectContaining({ matchesPlayed: 40, networthPerMin: 1_100 }),
    ]);
    for (const stat of stored.stats) stat.referencePlayer.heroIds = [2];
    expect(await service.forRecommendation('snapshot-test', 1)).toEqual([]);
  });
});

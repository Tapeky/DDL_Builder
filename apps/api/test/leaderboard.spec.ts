import { LeaderboardService, normalizeLeaderboard } from '../src/references/leaderboard.service';

describe('leaderboard normalization', () => {
  it('keeps candidate ambiguity while removing duplicate identifiers', () => {
    expect(
      normalizeLeaderboard({
        entries: [
          {
            account_name: 'Shared name',
            possible_account_ids: [12, 12, 34],
            rank: 12,
            top_hero_ids: [1, 1, 2],
          },
        ],
      }),
    ).toEqual([
      {
        accountName: 'Shared name',
        possibleAccountIds: [12, 34],
        rank: 12,
        topHeroIds: [1, 2],
      },
    ]);
  });

  it('does not merge separate leaderboard rows that share an account name', () => {
    expect(
      normalizeLeaderboard({
        entries: [
          { account_name: 'Same name', possible_account_ids: [12], rank: 1 },
          { account_name: 'Same name', possible_account_ids: [34], rank: 2 },
        ],
      }),
    ).toHaveLength(2);
  });

  it('rejects malformed or incomplete source responses', () => {
    expect(() =>
      normalizeLeaderboard({ entries: [{ account_name: 'Missing IDs' }] }),
    ).not.toThrow();
    expect(() => normalizeLeaderboard({ entries: [{ rank: -1 }] })).toThrow();
    expect(() => normalizeLeaderboard({ entries: 'not-an-array' })).toThrow();
  });
});

describe('leaderboard collection and promotion', () => {
  const run = {
    id: 'leaderboard-run',
    snapshotId: 'snapshot-test',
    heroId: 1,
    region: 'Europe',
    status: 'running',
    source: 'https://api.deadlock-api.com/v1/leaderboard/Europe/1',
    rowCount: null,
    errorCode: null,
    startedAt: new Date('2026-09-10T00:00:00.000Z'),
    completedAt: null,
  };

  it('publishes a completed run and immutable candidate values', async () => {
    const completed = { ...run, status: 'succeeded', rowCount: 1, completedAt: new Date() };
    const tx = {
      leaderboardCandidate: { createMany: jest.fn() },
      leaderboardRun: { update: jest.fn().mockResolvedValue(completed) },
    };
    const db = {
      catalogSnapshot: { findUnique: jest.fn().mockResolvedValue({ id: run.snapshotId }) },
      leaderboardRun: { create: jest.fn().mockResolvedValue(run), update: jest.fn() },
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) => callback(tx)),
    };
    const source = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        entries: [
          {
            account_name: 'Shared name',
            possible_account_ids: [12, 12, 34],
            rank: 12,
            top_hero_ids: [1],
          },
        ],
      }),
    );
    const service = new LeaderboardService(db as never, {} as never);
    const result = await service.collect('snapshot-test', 1, 'Europe');
    expect(String(source.mock.calls[0][0])).toBe(
      'https://api.deadlock-api.com/v1/leaderboard/Europe/1',
    );
    expect(tx.leaderboardCandidate.createMany).toHaveBeenCalledWith({
      data: [
        {
          id: 'leaderboard-run-0',
          runId: 'leaderboard-run',
          accountName: 'Shared name',
          possibleAccountIds: [12, 34],
          rank: 12,
          topHeroIds: [1],
        },
      ],
    });
    expect(result.status).toBe('succeeded');
    source.mockRestore();
  });

  it('marks source failures without publishing partial candidates', async () => {
    const db = {
      catalogSnapshot: { findUnique: jest.fn().mockResolvedValue({ id: run.snapshotId }) },
      leaderboardRun: {
        create: jest.fn().mockResolvedValue(run),
        update: jest.fn(),
      },
    };
    const source = jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    const service = new LeaderboardService(db as never, {} as never);
    await expect(service.collect('snapshot-test', 1, 'Europe')).rejects.toThrow(
      'collecte du leaderboard a échoué',
    );
    expect(db.leaderboardRun.update).toHaveBeenCalledWith({
      where: { id: run.id },
      data: expect.objectContaining({ status: 'failed', errorCode: 'LEADERBOARD_NETWORK_FAILED' }),
    });
    source.mockRestore();
  });

  it('promotes only to a pending, unverified reference player', async () => {
    const candidate = {
      id: 'leaderboard-run-0',
      runId: run.id,
      accountName: 'Shared name',
      possibleAccountIds: [12, 34],
      rank: 1,
      topHeroIds: [1],
      status: 'pending',
      promotedPlayerId: null,
      run,
    };
    const db = {
      $transaction: jest.fn((callback: (value: unknown) => unknown) =>
        callback({
          leaderboardCandidate: {
            findUnique: jest.fn().mockResolvedValue(candidate),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
        }),
      ),
      leaderboardCandidate: {
        findUnique: jest.fn(),
      },
    };
    const player = {
      id: 'shared-name-eu',
      verificationStatus: 'pending',
    };
    const players = { create: jest.fn().mockResolvedValue(player) };
    const service = new LeaderboardService(db as never, players as never);
    await expect(
      service.promote('leaderboard-run-0', {
        referenceId: player.id,
        verificationSource: 'manual review',
      }),
    ).resolves.toEqual(player);
    expect(players.create).toHaveBeenCalledWith(
      expect.objectContaining({
        accountIds: [12, 34],
        verificationStatus: 'pending',
        heroIds: [1],
      }),
      expect.anything(),
    );
    expect(db.$transaction).toHaveBeenCalled();
  });
});

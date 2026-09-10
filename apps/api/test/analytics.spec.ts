import { AnalyticsService } from '../src/analytics/analytics.service';

const run = {
  id: 'analytics-test',
  snapshotId: 'snapshot-test',
  metric: 'item-stats',
  status: 'running',
  source: 'https://api.deadlock-api.com/v1/analytics/item-stats',
  filterHash: 'hash',
  filters: {},
  rowCount: null,
  errorCode: null,
  startedAt: new Date('2026-09-10T00:00:00.000Z'),
  completedAt: null,
};

function database() {
  const completed = {
    ...run,
    status: 'succeeded',
    filters: {
      heroId: 1,
      gameMode: 'normal',
      matchMode: 'ranked,unranked',
      minUnixTimestamp: 1_786_320_000,
      maxUnixTimestamp: null,
      minMatches: 20,
      minAverageBadge: null,
      maxAverageBadge: null,
      minNetworth: null,
      maxNetworth: null,
      enemyHeroIds: [2, 6],
      enemyHeroIdsAllMatch: true,
      sameLaneFilter: true,
    },
    rowCount: 1,
    completedAt: new Date('2026-09-10T00:00:01.000Z'),
  };
  const tx = {
    analyticsItemStat: { createMany: jest.fn() },
    analyticsRun: { update: jest.fn().mockResolvedValue(completed) },
  };
  return {
    db: {
      catalogSnapshot: { findUnique: jest.fn().mockResolvedValue({ id: run.snapshotId }) },
      analyticsRun: {
        create: jest.fn().mockResolvedValue(run),
        update: jest.fn(),
      },
      $transaction: jest.fn((callback: (value: typeof tx) => unknown) => callback(tx)),
    },
    tx,
    completed,
  };
}

describe('analytics collection', () => {
  afterEach(() => jest.restoreAllMocks());

  it('persists an explicitly filtered item-stat run and normalizes counts', async () => {
    const state = database();
    const response = [
      {
        item_id: 42,
        bucket: 0,
        wins: 12,
        losses: 8,
        matches: 20,
        players: 19,
        avg_buy_time_s: 240,
        avg_sell_time_s: 900,
        avg_buy_time_relative: 18,
        avg_sell_time_relative: 70,
      },
    ];
    const request = jest.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(response));
    const service = new AnalyticsService(state.db as never);
    const result = await service.collectItemStats('snapshot-test', 1, {
      minUnixTimestamp: 1_786_320_000,
      enemyHeroIds: [2, 6],
      enemyHeroIdsAllMatch: true,
      sameLaneFilter: true,
    });
    const url = new URL(String(request.mock.calls[0][0]));
    expect(url.searchParams.get('hero_id')).toBe('1');
    expect(url.searchParams.get('min_unix_timestamp')).toBe('1786320000');
    expect(url.searchParams.get('enemy_hero_ids')).toBe('2,6');
    expect(url.searchParams.get('same_lane_filter')).toBe('true');
    expect(state.tx.analyticsItemStat.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ itemId: BigInt(42), wins: BigInt(12), losses: BigInt(8) })],
    });
    expect(result.status).toBe('succeeded');
    expect(result.heroId).toBe(1);
    expect(result.rowCount).toBe(1);
  });

  it('rejects a lane filter without an enemy before creating a run', async () => {
    const state = database();
    const service = new AnalyticsService(state.db as never);
    await expect(
      service.collectItemStats('snapshot-test', 1, {
        minUnixTimestamp: 1_786_320_000,
        sameLaneFilter: true,
      }),
    ).rejects.toThrow('même lane');
    expect(state.db.analyticsRun.create).not.toHaveBeenCalled();
  });
});

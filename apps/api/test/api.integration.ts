import '../src/env';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { DatabaseService } from '../src/database.module';
import { CatalogService } from '../src/catalog/catalog.service';
import fixture from './fixture.json';

describe('NestJS API with isolated PostgreSQL schema', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let catalog: CatalogService;
  let source: jest.SpyInstance;
  let currentVersion = 100;
  let schema: string;
  let originalUrl: string;
  let originalAdminToken: string | undefined;

  beforeAll(async () => {
    originalUrl = process.env.DATABASE_URL!;
    if (!originalUrl) throw new Error('DATABASE_URL is required for integration tests');
    originalAdminToken = process.env.ADMIN_TOKEN;
    process.env.ADMIN_TOKEN = 'integration-admin-token';
    schema = `test_${randomUUID().replaceAll('-', '')}`;
    const url = new URL(originalUrl);
    url.searchParams.set('schema', schema);
    process.env.DATABASE_URL = url.toString();
    execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
      env: process.env,
      stdio: 'pipe',
    });
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    db = app.get(DatabaseService);
    catalog = app.get(CatalogService);
    source = jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('client-versions')) return Response.json([currentVersion]);
      if (url.pathname.endsWith('/analytics/item-stats')) {
        return Response.json([
          {
            item_id: 3_000_000_000,
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
        ]);
      }
      if (url.pathname === '/v1/leaderboard/Europe/1') {
        return Response.json({
          entries: [
            {
              account_name: 'Leaderboard specialist',
              possible_account_ids: [12345, 12345, 67890],
              rank: 3,
              top_hero_ids: [1, 1, 2],
            },
          ],
        });
      }
      expect(url.searchParams.get('client_version')).toBe(String(currentVersion));
      expect(url.searchParams.get('language')).toBe('french');
      if (url.pathname.endsWith('heroes')) {
        return Response.json(
          fixture.heroes.map((hero) =>
            currentVersion >= 102 && hero.id === 6
              ? { ...hero, name: 'Abrams après patch' }
              : currentVersion >= 103 && hero.id === 2
                ? { ...hero, name: 'Seven après patch' }
                : hero,
          ),
        );
      }
      return Response.json(
        fixture.classes.map((class_name, index) => ({
          id: 3_000_000_000 + index,
          class_name,
          name: `Test item ${index}`,
          shopable: true,
          item_slot_type: index % 2 ? 'weapon' : 'spirit',
          item_tier: 1,
          cost: currentVersion >= 102 && class_name === 'upgrade_rapid_rounds' ? 1_600 : 800,
        })),
      );
    });
  });

  afterAll(async () => {
    source?.mockRestore();
    await app?.close();
    process.env.DATABASE_URL = originalUrl;
    if (originalAdminToken === undefined) delete process.env.ADMIN_TOKEN;
    else process.env.ADMIN_TOKEN = originalAdminToken;
    if (schema && originalUrl) {
      const cleanup = new PrismaClient();
      await cleanup.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await cleanup.$disconnect();
    }
  });

  it('returns explicit empty status without fabricated data', async () => {
    const response = await request(app.getHttpServer()).get('/v1/catalog').expect(200);
    expect(response.body.heroes).toEqual([]);
    expect(response.body.status.state).toBe('unavailable');
    await request(app.getHttpServer())
      .post('/v1/recommendations')
      .send({ heroId: 1, style: 'balanced' })
      .expect(503);
  });

  it('pins both imports to one version and synchronizes idempotently', async () => {
    const first = await catalog.sync();
    const second = await catalog.sync();
    expect(second).toEqual(first);
    expect(await db.catalogSnapshot.count()).toBe(1);
    const response = await request(app.getHttpServer()).get('/v1/catalog').expect(200);
    expect(response.body.status.state).toBe('ready');
    expect(
      response.body.heroes.filter((hero: { hasBuild: boolean }) => hero.hasBuild),
    ).toHaveLength(5);
    expect(response.body.items[0].id).toBeGreaterThan(2_147_483_647);
    expect(response.body.tacticalProfiles).toHaveLength(6);
    expect(response.body.tacticalTags).toHaveLength(8);
  });

  it('stores farm and opponent context without adapting on unvalidated profiles', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/recommendations')
      .send({ heroId: 1, style: 'balanced', farmPriority: 1, opponentHeroIds: [2, 6] })
      .expect(201);
    expect(response.body.farmPriority).toBe(1);
    expect(response.body.opponents.map((hero: { id: number }) => hero.id)).toEqual([2, 6]);
    expect(response.body.threats).toEqual([]);
    expect(response.body.adaptations).toEqual([]);
    expect(response.body.warnings).toContain(
      'Certains profils ennemis ne sont pas encore validés : aucune adaptation automatique ne leur est appliquée.',
    );
    await db.savedBuild.delete({ where: { id: response.body.id } });
    await request(app.getHttpServer())
      .post('/v1/recommendations')
      .send({ heroId: 1, style: 'balanced', opponentHeroIds: [2, 2] })
      .expect(422);
  });

  it('collects item statistics with explicit filters and keeps reference identity manual', async () => {
    const collected = await request(app.getHttpServer())
      .post('/v1/admin/analytics/item-stats')
      .set('Authorization', 'Bearer integration-admin-token')
      .send({ heroId: 1, minUnixTimestamp: 1_786_320_000, minMatches: 20 })
      .expect(201);
    expect(collected.body.status).toBe('succeeded');
    expect(collected.body.rowCount).toBe(1);
    const detail = await request(app.getHttpServer())
      .get(`/v1/admin/analytics/runs/${collected.body.id}`)
      .set('Authorization', 'Bearer integration-admin-token')
      .expect(200);
    expect(detail.body.stats[0]).toMatchObject({ itemId: 3_000_000_000, matches: 20 });

    const created = await request(app.getHttpServer())
      .post('/v1/admin/reference-players')
      .set('Authorization', 'Bearer integration-admin-token')
      .send({
        id: 'specialist-infernus-eu',
        displayName: 'Specialist EU',
        region: 'Europe',
        accountIds: [12345, 67890],
        heroIds: [1],
        verificationStatus: 'pending',
        verificationSource: 'À vérifier manuellement',
      })
      .expect(201);
    expect(created.body.verificationStatus).toBe('pending');
    expect(created.body.accountIds).toEqual([12345, 67890]);
    const verified = await request(app.getHttpServer())
      .patch('/v1/admin/reference-players/specialist-infernus-eu')
      .set('Authorization', 'Bearer integration-admin-token')
      .send({ verificationStatus: 'verified' })
      .expect(200);
    expect(verified.body.verificationStatus).toBe('verified');
    expect(verified.body.accountIds).toEqual([12345, 67890]);
  });

  it('stores leaderboard candidates and promotes them without automatic verification', async () => {
    const collected = await request(app.getHttpServer())
      .post('/v1/admin/leaderboards/collect')
      .set('Authorization', 'Bearer integration-admin-token')
      .send({ heroId: 1, region: 'Europe' })
      .expect(201);
    expect(collected.body.status).toBe('succeeded');
    expect(collected.body.rowCount).toBe(1);

    const runs = await request(app.getHttpServer())
      .get('/v1/admin/leaderboards/runs')
      .set('Authorization', 'Bearer integration-admin-token')
      .expect(200);
    const candidate = runs.body[0].candidates[0];
    expect(candidate).toMatchObject({
      accountName: 'Leaderboard specialist',
      possibleAccountIds: [12345, 67890],
      rank: 3,
      topHeroIds: [1, 2],
      status: 'pending',
      promotedPlayerId: null,
    });

    const promoted = await request(app.getHttpServer())
      .post(`/v1/admin/leaderboards/candidates/${candidate.id}/promote`)
      .set('Authorization', 'Bearer integration-admin-token')
      .send({ referenceId: 'leaderboard-specialist-eu', verificationSource: 'manual review' })
      .expect(201);
    expect(promoted.body.verificationStatus).toBe('pending');
    expect(promoted.body.accountIds).toEqual([12345, 67890]);

    const after = await request(app.getHttpServer())
      .get('/v1/admin/leaderboards/runs')
      .set('Authorization', 'Bearer integration-admin-token')
      .expect(200);
    expect(after.body[0].candidates[0]).toMatchObject({
      status: 'promoted',
      promotedPlayerId: 'leaderboard-specialist-eu',
    });
    expect(
      await db.referencePlayer.findUnique({ where: { id: 'leaderboard-specialist-eu' } }),
    ).toMatchObject({ verificationStatus: 'pending' });
  });

  it('exposes only validated tactical tags to the recommendation engine', async () => {
    const savedProfile = await request(app.getHttpServer())
      .patch('/v1/admin/tactical-profiles/2')
      .set('Authorization', 'Bearer integration-admin-token')
      .send({
        status: 'validated',
        source: 'integration fixture',
        tags: [
          {
            key: 'anti_heal',
            intensity: 3,
            evidence: 'Fixture evidence',
            status: 'validated',
          },
        ],
      })
      .expect(200);
    expect(savedProfile.body.tags[0].key).toBe('anti_heal');
    const statusOnly = await request(app.getHttpServer())
      .patch('/v1/admin/tactical-profiles/2')
      .set('Authorization', 'Bearer integration-admin-token')
      .send({ status: 'validated' })
      .expect(200);
    expect(statusOnly.body.tags[0].key).toBe('anti_heal');
    const response = await request(app.getHttpServer())
      .post('/v1/recommendations')
      .send({ heroId: 1, style: 'balanced', opponentHeroIds: [2] })
      .expect(201);
    expect(response.body.threats).toEqual([
      {
        heroId: 2,
        heroName: 'Seven',
        tag: 'anti_heal',
        intensity: 3,
        explanation: 'Anti-soin : Fixture evidence',
      },
    ]);
    await db.savedBuild.delete({ where: { id: response.body.id } });
  });

  it('validates request bodies and rejects unsupported contexts', async () => {
    for (const body of [
      { heroId: '1', style: 'balanced' },
      { heroId: 1, style: 'unknown' },
      { heroId: 1, style: 'balanced', budget: 999 },
      { heroId: 0, style: 'balanced' },
      { heroId: 1 },
    ])
      await request(app.getHttpServer()).post('/v1/recommendations').send(body).expect(400);
    await request(app.getHttpServer())
      .post('/v1/recommendations')
      .send({ heroId: 999, style: 'balanced' })
      .expect(404);
    await request(app.getHttpServer())
      .post('/v1/recommendations')
      .send({ heroId: 99, style: 'balanced' })
      .expect(422);
    await request(app.getHttpServer()).get('/v1/items?category=invalid').expect(400);
  });

  it('generates all fifteen draft variants with explicit evidence and stable share links', async () => {
    for (const heroId of [1, 2, 6, 13, 20]) {
      for (const style of ['balanced', 'damage', 'survival']) {
        const response = await request(app.getHttpServer())
          .post('/v1/recommendations')
          .send({ heroId, style })
          .expect(201);
        expect(response.body.evidence).toBe('editorial-draft');
        expect(response.body.steps).toHaveLength(8);
        expect(response.body.warnings).toHaveLength(3);
        expect(response.body.totalCost).toBe(
          response.body.steps.reduce(
            (sum: number, step: { purchaseCost: number }) => sum + step.purchaseCost,
            0,
          ),
        );
        const shared = await request(app.getHttpServer())
          .get(`/v1/builds/${response.body.id}`)
          .expect(200);
        expect(shared.body).toEqual(response.body);
      }
    }
    const response = await request(app.getHttpServer())
      .post('/v1/recommendations')
      .send({ heroId: 1, style: 'balanced' })
      .expect(201);
    const repeat = await request(app.getHttpServer())
      .post('/v1/recommendations')
      .send({ heroId: 1, style: 'balanced' })
      .expect(201);
    expect(repeat.body.id).toBe(response.body.id);
    expect(await db.savedBuild.count()).toBe(15);
  });

  it('preserves prior snapshots and shared builds across source updates', async () => {
    const original = await request(app.getHttpServer())
      .post('/v1/recommendations')
      .send({ heroId: 1, style: 'balanced' })
      .expect(201);
    currentVersion = 101;
    await catalog.sync();
    const fresh = await request(app.getHttpServer())
      .post('/v1/recommendations')
      .send({ heroId: 1, style: 'balanced' })
      .expect(201);
    expect(fresh.body.version).not.toBe(original.body.version);
    const shared = await request(app.getHttpServer())
      .get(`/v1/builds/${original.body.id}`)
      .expect(200);
    expect(shared.body).toEqual(original.body);
    const pinned = await request(app.getHttpServer())
      .post('/v1/recommendations')
      .send({ heroId: 1, style: 'balanced', version: original.body.version })
      .expect(201);
    expect(pinned.body).toEqual(original.body);
  });

  it('keeps the last good snapshot after a failed import and marks old checks stale', async () => {
    const head = await db.catalogHead.findUniqueOrThrow({ where: { id: 'current' } });
    source.mockResolvedValueOnce(Response.json({ invalid: true }));
    await expect(catalog.sync()).rejects.toThrow('Import impossible');
    expect((await db.catalogHead.findUniqueOrThrow({ where: { id: 'current' } })).snapshotId).toBe(
      head.snapshotId,
    );
    expect(await db.syncRun.count({ where: { status: 'failed' } })).toBe(1);
    await db.catalogHead.update({
      where: { id: 'current' },
      data: { checkedAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });
    const response = await request(app.getHttpServer()).get('/v1/catalog').expect(200);
    expect(response.body.status.state).toBe('stale');
    expect(response.body.heroes).not.toHaveLength(0);
  });

  it('protects the editorial back-office and keeps revisions explicit', async () => {
    await request(app.getHttpServer()).get('/v1/admin/builds').expect(401);
    await request(app.getHttpServer())
      .get('/v1/admin/builds')
      .set('Authorization', 'Bearer wrong-token')
      .expect(401);
    const list = await request(app.getHttpServer())
      .get('/v1/admin/builds')
      .set('Authorization', 'Bearer integration-admin-token')
      .expect(200);
    expect(list.body.builds).toHaveLength(15);
    const id = 'build-1-balanced';
    const before = await request(app.getHttpServer())
      .get(`/v1/admin/builds/${id}`)
      .set('Authorization', 'Bearer integration-admin-token')
      .expect(200);
    expect(before.body.version.status).toBe('published');
    const revised = await request(app.getHttpServer())
      .patch(`/v1/admin/builds/${id}`)
      .set('Authorization', 'Bearer integration-admin-token')
      .send({ title: 'Titre révisé depuis le back-office' })
      .expect(200);
    expect(revised.body.status).toBe('draft');
    expect(revised.body.revision).toBe(2);
    const published = await request(app.getHttpServer())
      .post(`/v1/admin/builds/${id}/publish`)
      .set('Authorization', 'Bearer integration-admin-token')
      .expect(201);
    expect(published.body.status).toBe('published');
    const invested = await request(app.getHttpServer())
      .patch('/v1/admin/builds/build-2-balanced')
      .set('Authorization', 'Bearer integration-admin-token')
      .send({
        investments: [
          {
            branch: 'weapon',
            phase: 'core',
            threshold: 3_200,
            priority: 'preferred',
            reason: 'Conserver le palier utile à cet archétype.',
          },
        ],
      })
      .expect(200);
    expect(invested.body.investments).toHaveLength(1);
    await request(app.getHttpServer())
      .post('/v1/admin/builds/build-2-balanced/publish')
      .set('Authorization', 'Bearer integration-admin-token')
      .expect(201);
    const archived = await request(app.getHttpServer())
      .post(`/v1/admin/builds/${id}/archive`)
      .set('Authorization', 'Bearer integration-admin-token')
      .expect(201);
    expect(archived.body.status).toBe('archived');
    await request(app.getHttpServer())
      .post('/v1/admin/builds')
      .set('Authorization', 'Bearer integration-admin-token')
      .send({
        heroId: 99,
        style: 'damage',
        title: 'Progression invalide',
        summary: 'Ce brouillon ne doit pas être accepté.',
        steps: [
          { order: 1, phase: 'early', itemClassName: 'upgrade_health', reason: 'Premier achat.' },
          { order: 2, phase: 'core', itemClassName: 'upgrade_health', reason: 'Achat redondant.' },
        ],
      })
      .expect(422);
    const created = await request(app.getHttpServer())
      .post('/v1/admin/builds')
      .set('Authorization', 'Bearer integration-admin-token')
      .send({
        heroId: 99,
        style: 'balanced',
        title: 'Build de test éditorial',
        summary: 'Un brouillon de test.',
        steps: [
          {
            order: 1,
            phase: 'early',
            itemClassName: 'upgrade_health',
            reason: 'Test de création.',
          },
        ],
      })
      .expect(201);
    expect(created.body.versions[0].status).toBe('draft');
    await request(app.getHttpServer())
      .post('/v1/admin/builds/build-99-balanced/archive')
      .set('Authorization', 'Bearer integration-admin-token')
      .expect(201);
  });

  it('marks builds that reference changed heroes or items as stale on a new client version', async () => {
    currentVersion = 102;
    const imported = await catalog.sync();
    const status = await request(app.getHttpServer()).get('/v1/data-status').expect(200);
    expect(status.body.staleBuildCount).toBe(8);
    expect(status.body.publishedBuildCount).toBe(6);
    const current = await request(app.getHttpServer()).get('/v1/catalog').expect(200);
    expect(current.body.heroes.find((hero: { id: number }) => hero.id === 1).buildStatus).toBe(
      'stale',
    );
    expect(current.body.heroes.find((hero: { id: number }) => hero.id === 2).buildStatus).toBe(
      'published',
    );
    expect(current.body.heroes.find((hero: { id: number }) => hero.id === 6).buildStatus).toBe(
      'stale',
    );
    await request(app.getHttpServer())
      .post('/v1/recommendations')
      .send({ heroId: 1, style: 'damage' })
      .expect(422);
    const unaffected = await request(app.getHttpServer())
      .post('/v1/recommendations')
      .send({ heroId: 2, style: 'balanced' })
      .expect(201);
    expect(unaffected.body.buildStatus).toBe('published');
    const changes = await db.patchChange.findFirst({ where: { toSnapshotId: imported.version } });
    expect(changes?.changedHeroes).toEqual([6]);
    expect(changes?.changedItems).toEqual(['upgrade_rapid_rounds']);
    expect((changes?.staleBuilds as string[]).sort()).toEqual(
      [
        'build-1-damage',
        'build-1-survival',
        'build-6-balanced',
        'build-6-damage',
        'build-6-survival',
        'build-13-balanced',
        'build-13-damage',
        'build-13-survival',
      ].sort(),
    );

    currentVersion = 103;
    const secondImport = await catalog.sync();
    const secondStatus = await request(app.getHttpServer()).get('/v1/data-status').expect(200);
    expect(secondStatus.body.staleBuildCount).toBe(11);
    expect(secondStatus.body.publishedBuildCount).toBe(3);
    const secondCatalog = await request(app.getHttpServer()).get('/v1/catalog').expect(200);
    expect(
      secondCatalog.body.heroes.find((hero: { id: number }) => hero.id === 1).buildStatus,
    ).toBe('stale');
    const tactical = await request(app.getHttpServer()).get('/v1/tactical-profiles').expect(200);
    expect(
      tactical.body.profiles.find((profile: { heroId: number }) => profile.heroId === 2).status,
    ).toBe('stale');
    expect(
      secondCatalog.body.heroes.find((hero: { id: number }) => hero.id === 2).buildStatus,
    ).toBe('stale');
    const secondChanges = await db.patchChange.findFirst({
      where: { toSnapshotId: secondImport.version },
    });
    expect(secondChanges?.changedHeroes).toEqual([2]);
    expect(secondChanges?.staleBuilds).toEqual([
      'build-2-balanced',
      'build-2-damage',
      'build-2-survival',
    ]);
    const cloned = await request(app.getHttpServer())
      .get('/v1/admin/builds/build-2-balanced')
      .set('Authorization', 'Bearer integration-admin-token')
      .expect(200);
    expect(cloned.body.version.investments).toEqual([
      expect.objectContaining({
        branch: 'weapon',
        phase: 'core',
        threshold: 3_200,
        priority: 'preferred',
      }),
    ]);
  });
});

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

  beforeAll(async () => {
    originalUrl = process.env.DATABASE_URL!;
    if (!originalUrl) throw new Error('DATABASE_URL is required for integration tests');
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
      expect(url.searchParams.get('client_version')).toBe(String(currentVersion));
      expect(url.searchParams.get('language')).toBe('french');
      if (url.pathname.endsWith('heroes')) return Response.json(fixture.heroes);
      return Response.json(
        fixture.classes.map((class_name, index) => ({
          id: 3_000_000_000 + index,
          class_name,
          name: `Test item ${index}`,
          shopable: true,
          item_slot_type: index % 2 ? 'weapon' : 'spirit',
          item_tier: 1,
          cost: 800,
        })),
      );
    });
  });

  afterAll(async () => {
    source?.mockRestore();
    await app?.close();
    process.env.DATABASE_URL = originalUrl;
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
});

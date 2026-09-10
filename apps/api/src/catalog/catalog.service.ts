import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Catalog, DataStatus, Hero, Item } from '@deadlock/contracts';
import { DatabaseService } from '../database.module';
import { EditorialBuildService } from '../editorial/editorial.service';
import { fetchSource, latestVersion, normalizeCatalog, SOURCE_URL } from './source';

@Injectable()
export class CatalogService {
  constructor(
    private readonly db: DatabaseService,
    private readonly editorial: EditorialBuildService,
  ) {}

  async status(): Promise<DataStatus> {
    const head = await this.db.catalogHead.findUnique({
      where: { id: 'current' },
      include: { snapshot: true },
    });
    if (!head)
      return {
        state: 'unavailable',
        version: null,
        importedAt: null,
        checkedAt: null,
        source: SOURCE_URL,
        heroCount: 0,
        itemCount: 0,
        notice: 'Aucune donnée importée. Lancez la synchronisation du catalogue côté serveur.',
      };
    await this.editorial.ensureSnapshot(head.snapshot.id);
    const stale = Date.now() - head.checkedAt.getTime() > 24 * 60 * 60 * 1000;
    const counts = await this.editorial.statusCounts(head.snapshot.id);
    return {
      state: stale ? 'stale' : 'ready',
      version: head.snapshot.id,
      importedAt: head.snapshot.importedAt.toISOString(),
      checkedAt: head.checkedAt.toISOString(),
      source: SOURCE_URL,
      heroCount: (head.snapshot.heroes as unknown as Hero[]).length,
      itemCount: (head.snapshot.items as unknown as Item[]).length,
      ...counts,
      notice: stale
        ? 'La source n’a pas été vérifiée depuis plus de 24 heures. Les dernières données importées restent disponibles.'
        : counts.staleBuildCount > 0
          ? `${counts.staleBuildCount} build(s) doivent être revalidés après un changement de version du client.`
          : 'Données communautaires versionnées. La version du client ne constitue pas une validation des builds après un patch.',
    };
  }

  async snapshot(version?: string) {
    const snapshot = version
      ? await this.db.catalogSnapshot.findUnique({ where: { id: version } })
      : (
          await this.db.catalogHead.findUnique({
            where: { id: 'current' },
            include: { snapshot: true },
          })
        )?.snapshot;
    if (!snapshot) {
      if (version) throw new NotFoundException('Version du catalogue introuvable.');
      throw new ServiceUnavailableException('Le catalogue n’a pas encore été importé.');
    }
    await this.editorial.ensureSnapshot(snapshot.id);
    const items = snapshot.items as unknown as Item[];
    const rawHeroes = snapshot.heroes as unknown as Hero[];
    const buildStatuses = await this.editorial.heroStatuses(snapshot.id, rawHeroes);
    const heroes = rawHeroes.map((hero) => ({ ...hero, ...buildStatuses.get(hero.id) }));
    return { ...snapshot, heroes, items };
  }

  async catalog(): Promise<Catalog> {
    const status = await this.status();
    if (!status.version) return { heroes: [], items: [], status };
    const { heroes, items } = await this.snapshot(status.version);
    return { heroes, items, status };
  }

  async sync() {
    const run = await this.db.syncRun.create({ data: { status: 'running' } });
    try {
      const clientVersion = latestVersion(await fetchSource('client-versions'));
      const query = `client_version=${clientVersion}&language=french`;
      const [rawHeroes, rawItems] = await Promise.all([
        fetchSource(`heroes?${query}`),
        fetchSource(`items?${query}`),
      ]);
      const catalog = normalizeCatalog(rawHeroes, rawItems);
      const hash = createHash('sha256').update(JSON.stringify(catalog)).digest('hex').slice(0, 16);
      const id = `client-${clientVersion}-${hash}`;
      await this.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(184742901)`;
        const current = await tx.catalogHead.findUnique({
          where: { id: 'current' },
          include: { snapshot: true },
        });
        if (current && current.snapshot.clientVersion > clientVersion)
          throw new Error('SOURCE_VERSION_REGRESSION');
        const sameSnapshot = current?.snapshotId === id;
        await tx.catalogSnapshot.upsert({
          where: { id },
          update: {},
          create: {
            id,
            clientVersion,
            heroes: JSON.parse(JSON.stringify(catalog.heroes)),
            items: JSON.parse(JSON.stringify(catalog.items)),
          },
        });
        const next = await tx.catalogSnapshot.findUniqueOrThrow({ where: { id } });
        const editorialVersionCount = await tx.editorialBuildVersion.count({
          where: { snapshotId: id },
        });
        if (!sameSnapshot || editorialVersionCount === 0) {
          await this.editorial.reconcileSnapshot(
            tx,
            sameSnapshot ? null : (current?.snapshot ?? null),
            next,
          );
        }
        if (!current || current.checkedAt <= run.startedAt) {
          await tx.catalogHead.upsert({
            where: { id: 'current' },
            create: { id: 'current', snapshotId: id, checkedAt: run.startedAt },
            update: { snapshotId: id, checkedAt: run.startedAt },
          });
        }
        await tx.syncRun.update({
          where: { id: run.id },
          data: { status: 'succeeded', clientVersion, finishedAt: new Date() },
        });
      });
      return { version: id, heroCount: catalog.heroes.length, itemCount: catalog.items.length };
    } catch {
      await this.db.syncRun.update({
        where: { id: run.id },
        data: { status: 'failed', errorCode: 'SOURCE_IMPORT_FAILED', finishedAt: new Date() },
      });
      throw new ServiceUnavailableException(
        'Import impossible. Les dernières données valides sont conservées.',
      );
    }
  }
}

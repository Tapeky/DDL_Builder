import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { EditorialBuildStatus, Hero, Item, Style } from '@deadlock/contracts';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database.module';
import { purchaseSteps, recommend, validateEditorialProfile } from '../recommendations/engine';
import { seedProfiles } from './seed-data';
import type {
  EditorialAlternativeInput,
  EditorialProfile,
  EditorialProfileInput,
  EditorialStepInput,
} from './types';

export const editorialStatuses: EditorialBuildStatus[] = [
  'draft',
  'review',
  'validated',
  'published',
  'stale',
  'archived',
];

const cloneStatuses = new Set<EditorialBuildStatus>([
  'draft',
  'review',
  'validated',
  'published',
  'stale',
]);

type Transaction = Prisma.TransactionClient;
type SnapshotRecord = Prisma.CatalogSnapshotGetPayload<{
  select: { id: true; clientVersion: true; heroes: true; items: true; importedAt: true };
}>;
type RecommendationSnapshot = {
  id: string;
  importedAt: Date;
  clientVersion: number;
  items: Item[];
};
type VersionRecord = Prisma.EditorialBuildVersionGetPayload<{
  include: { build: true; steps: { include: { alternatives: true } } };
}>;

const versionInclude = {
  build: true,
  steps: { include: { alternatives: true }, orderBy: { order: 'asc' as const } },
};

function status(value: string): EditorialBuildStatus {
  if (!editorialStatuses.includes(value as EditorialBuildStatus)) return 'draft';
  return value as EditorialBuildStatus;
}

function itemsFrom(snapshot: { items: unknown }) {
  return snapshot.items as unknown as Item[];
}

function heroesFrom(snapshot: SnapshotRecord) {
  return snapshot.heroes as unknown as Hero[];
}

function json(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function stableHero(hero: Hero | undefined) {
  return hero ? { id: hero.id, name: hero.name, complexity: hero.complexity } : null;
}

function stableItem(item: Item | undefined) {
  return item
    ? {
        className: item.className,
        name: item.name,
        category: item.category,
        tier: item.tier,
        cost: item.cost,
        components: item.components,
      }
    : null;
}

export interface CatalogDiff {
  changedHeroes: number[];
  changedItems: string[];
}

export function diffCatalog(previous: SnapshotRecord, next: SnapshotRecord): CatalogDiff {
  const oldHeroes = new Map(heroesFrom(previous).map((hero) => [hero.id, hero]));
  const newHeroes = new Map(heroesFrom(next).map((hero) => [hero.id, hero]));
  const heroIds = new Set([...oldHeroes.keys(), ...newHeroes.keys()]);
  const changedHeroes = [...heroIds].filter(
    (id) =>
      JSON.stringify(stableHero(oldHeroes.get(id))) !==
      JSON.stringify(stableHero(newHeroes.get(id))),
  );
  const oldItems = new Map(itemsFrom(previous).map((item) => [item.className, item]));
  const newItems = new Map(itemsFrom(next).map((item) => [item.className, item]));
  const itemNames = new Set([...oldItems.keys(), ...newItems.keys()]);
  const changedItems = [...itemNames].filter(
    (name) =>
      JSON.stringify(stableItem(oldItems.get(name))) !==
      JSON.stringify(stableItem(newItems.get(name))),
  );
  return { changedHeroes, changedItems };
}

function inputFromVersion(version: VersionRecord): EditorialProfile {
  return {
    heroId: version.build.heroId,
    style: version.build.style as Style,
    title: version.title,
    summary: version.summary,
    status: status(version.status),
    steps: version.steps.map((step) => ({
      order: step.order,
      phase: step.phase as EditorialStepInput['phase'],
      itemClassName: step.itemClassName,
      reason: step.reason,
      alternatives: step.alternatives.map((alternative) => ({
        itemClassName: alternative.itemClassName,
        ...(alternative.reason ? { reason: alternative.reason } : {}),
      })),
    })),
  };
}

function profileSteps(profile: EditorialProfileInput) {
  return profile.steps.map((step) => ({
    id: randomUUID(),
    order: step.order,
    phase: step.phase,
    itemClassName: step.itemClassName,
    reason: step.reason,
    alternatives: {
      create: (step.alternatives ?? []).map((alternative: EditorialAlternativeInput) => ({
        id: randomUUID(),
        itemClassName: alternative.itemClassName,
        reason: alternative.reason ?? null,
      })),
    },
  }));
}

function validateProfileAndCosts(profile: EditorialProfile, items: Item[]) {
  validateEditorialProfile(profile, items);
  purchaseSteps(profile.steps, items);
}

@Injectable()
export class EditorialBuildService {
  constructor(private readonly db: DatabaseService) {}

  async currentSnapshot() {
    return (
      await this.db.catalogHead.findUnique({
        where: { id: 'current' },
        include: { snapshot: true },
      })
    )?.snapshot;
  }

  async ensureSnapshot(snapshotId: string) {
    const snapshot = await this.db.catalogSnapshot.findUnique({ where: { id: snapshotId } });
    if (!snapshot) throw new NotFoundException('Catalogue introuvable.');
    const [versionCount, buildCount] = await Promise.all([
      this.db.editorialBuildVersion.count({ where: { snapshotId } }),
      this.db.editorialBuild.count(),
    ]);
    if (versionCount > 0 || buildCount > 0) return;
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(184742902)`;
      const alreadySeeded = await tx.editorialBuildVersion.count({ where: { snapshotId } });
      if (alreadySeeded === 0) await this.seedSnapshot(tx, snapshot);
    });
  }

  async statusCounts(snapshotId: string) {
    const [published, stale] = await Promise.all([
      this.db.editorialBuildVersion.count({
        where: { snapshotId, isCurrent: true, status: 'published' },
      }),
      this.db.editorialBuildVersion.count({
        where: { snapshotId, isCurrent: true, status: 'stale' },
      }),
    ]);
    return { publishedBuildCount: published, staleBuildCount: stale };
  }

  async heroStatuses(
    snapshotId: string,
    heroes: Hero[],
  ): Promise<Map<number, { buildStatus: NonNullable<Hero['buildStatus']>; hasBuild: boolean }>> {
    const versions = await this.db.editorialBuildVersion.findMany({
      where: { snapshotId, isCurrent: true },
      select: { status: true, build: { select: { heroId: true } } },
    });
    const byHero = new Map<number, 'published' | 'stale'>();
    for (const version of versions) {
      const next = status(version.status);
      const previous = byHero.get(version.build.heroId);
      if (
        (next === 'published' || next === 'stale') &&
        (!previous || (previous !== 'published' && next === 'published'))
      ) {
        byHero.set(version.build.heroId, next);
      }
    }
    return new Map(
      heroes.map((hero) => {
        const buildStatus: NonNullable<Hero['buildStatus']> = byHero.get(hero.id) ?? 'none';
        return [hero.id, { buildStatus, hasBuild: buildStatus === 'published' }];
      }),
    );
  }

  async profileFor(heroId: number, style: Style, snapshotId: string, includeStale = false) {
    const build = await this.db.editorialBuild.findUnique({
      where: { heroId_style: { heroId, style } },
    });
    if (!build)
      throw new UnprocessableEntityException('Ce héros ne dispose pas encore de build éditorial.');
    const version = await this.db.editorialBuildVersion.findFirst({
      where: {
        buildId: build.id,
        snapshotId,
        isCurrent: true,
        ...(includeStale ? {} : { status: 'published' }),
      },
      include: versionInclude,
    });
    if (!version) {
      const staleVersion = await this.db.editorialBuildVersion.findFirst({
        where: { buildId: build.id, snapshotId, isCurrent: true, status: 'stale' },
      });
      if (staleVersion)
        throw new UnprocessableEntityException(
          'Ce build doit être revalidé après un changement de version.',
        );
      throw new UnprocessableEntityException('Ce build n’est pas encore publié.');
    }
    return { version, profile: inputFromVersion(version) };
  }

  async recommendation(hero: Hero, style: Style, snapshot: RecommendationSnapshot) {
    const { version, profile } = await this.profileFor(hero.id, style, snapshot.id);
    const result = recommend(hero, profile, itemsFrom(snapshot));
    return {
      ...result,
      buildVersionId: version.id,
      buildStatus: status(version.status),
    };
  }

  async listAdmin(snapshotId?: string) {
    const snapshot = snapshotId
      ? await this.db.catalogSnapshot.findUnique({ where: { id: snapshotId } })
      : await this.currentSnapshot();
    if (!snapshot) throw new NotFoundException('Catalogue introuvable.');
    const builds = await this.db.editorialBuild.findMany({
      orderBy: [{ heroId: 'asc' }, { style: 'asc' }],
      include: {
        versions: {
          where: { snapshotId: snapshot.id, isCurrent: true },
          include: { steps: { orderBy: { order: 'asc' } } },
        },
      },
    });
    return {
      snapshot: { id: snapshot.id, clientVersion: snapshot.clientVersion },
      builds: builds.map((build) => ({
        id: build.id,
        heroId: build.heroId,
        style: build.style,
        version: build.versions[0] ?? null,
      })),
    };
  }

  async detailAdmin(id: string, snapshotId?: string) {
    const snapshot = snapshotId
      ? await this.db.catalogSnapshot.findUnique({ where: { id: snapshotId } })
      : await this.currentSnapshot();
    if (!snapshot) throw new NotFoundException('Catalogue introuvable.');
    const build = await this.db.editorialBuild.findUnique({
      where: { id },
      include: {
        versions: {
          where: { snapshotId: snapshot.id, isCurrent: true },
          include: versionInclude,
        },
      },
    });
    if (!build) throw new NotFoundException('Build éditorial introuvable.');
    return {
      snapshot: { id: snapshot.id, clientVersion: snapshot.clientVersion },
      build,
      version: build.versions[0] ?? null,
    };
  }

  async createBuild(input: EditorialProfileInput, snapshotId?: string) {
    const snapshot = snapshotId
      ? await this.db.catalogSnapshot.findUnique({ where: { id: snapshotId } })
      : await this.currentSnapshot();
    if (!snapshot) throw new NotFoundException('Catalogue introuvable.');
    const existing = await this.db.editorialBuild.findUnique({
      where: { heroId_style: { heroId: input.heroId, style: input.style } },
    });
    if (existing) throw new ConflictException('Un build existe déjà pour ce héros et ce style.');
    if (!heroesFrom(snapshot).some((hero) => hero.id === input.heroId)) {
      throw new UnprocessableEntityException(
        'Le héros demandé est absent de cette version du catalogue.',
      );
    }
    const profile: EditorialProfile = { ...input, status: input.status ?? 'draft' };
    validateProfileAndCosts(profile, itemsFrom(snapshot));
    const id = `build-${input.heroId}-${input.style}`;
    const versionId = randomUUID();
    const build = await this.db.editorialBuild.create({
      data: {
        id,
        heroId: input.heroId,
        style: input.style,
        versions: {
          create: {
            id: versionId,
            snapshotId: snapshot.id,
            revision: 1,
            title: input.title,
            summary: input.summary,
            status: profile.status,
            steps: { create: profileSteps(profile) },
          },
        },
      },
      include: { versions: { include: versionInclude } },
    });
    return build;
  }

  async reviseBuild(id: string, input: Partial<EditorialProfileInput>, snapshotId?: string) {
    const snapshot = snapshotId
      ? await this.db.catalogSnapshot.findUnique({ where: { id: snapshotId } })
      : await this.currentSnapshot();
    if (!snapshot) throw new NotFoundException('Catalogue introuvable.');
    const build = await this.db.editorialBuild.findUnique({
      where: { id },
      include: {
        versions: { where: { snapshotId: snapshot.id, isCurrent: true }, include: versionInclude },
      },
    });
    if (!build || !build.versions[0]) throw new NotFoundException('Build éditorial introuvable.');
    const current = inputFromVersion(build.versions[0]);
    const profile: EditorialProfile = {
      ...current,
      heroId: build.heroId,
      style: build.style as Style,
      title: input.title ?? current.title,
      summary: input.summary ?? current.summary,
      status: 'draft',
      steps: input.steps ?? current.steps,
    };
    validateProfileAndCosts(profile, itemsFrom(snapshot));
    return this.db.$transaction(async (tx) => {
      await tx.editorialBuildVersion.update({
        where: { id: build.versions[0].id },
        data: { isCurrent: false },
      });
      const revision = build.versions[0].revision + 1;
      return tx.editorialBuildVersion.create({
        data: {
          id: randomUUID(),
          buildId: id,
          snapshotId: snapshot.id,
          revision,
          title: profile.title,
          summary: profile.summary,
          status: 'draft',
          steps: { create: profileSteps(profile) },
        },
        include: versionInclude,
      });
    });
  }

  async publishBuild(id: string, snapshotId?: string) {
    const snapshot = snapshotId
      ? await this.db.catalogSnapshot.findUnique({ where: { id: snapshotId } })
      : await this.currentSnapshot();
    if (!snapshot) throw new NotFoundException('Catalogue introuvable.');
    const build = await this.db.editorialBuild.findUnique({
      where: { id },
      include: {
        versions: { where: { snapshotId: snapshot.id, isCurrent: true }, include: versionInclude },
      },
    });
    if (!build || !build.versions[0]) throw new NotFoundException('Build éditorial introuvable.');
    const profile = inputFromVersion(build.versions[0]);
    validateProfileAndCosts(profile, itemsFrom(snapshot));
    return this.db.editorialBuildVersion.update({
      where: { id: build.versions[0].id },
      data: { status: 'published', reviewedAt: new Date() },
      include: versionInclude,
    });
  }

  async archiveBuild(id: string, snapshotId?: string) {
    const snapshot = snapshotId
      ? await this.db.catalogSnapshot.findUnique({ where: { id: snapshotId } })
      : await this.currentSnapshot();
    if (!snapshot) throw new NotFoundException('Catalogue introuvable.');
    const version = await this.db.editorialBuildVersion.findFirst({
      where: { build: { id }, snapshotId: snapshot.id, isCurrent: true },
    });
    if (!version) throw new NotFoundException('Build éditorial introuvable.');
    return this.db.editorialBuildVersion.update({
      where: { id: version.id },
      data: { status: 'archived' },
    });
  }

  async reconcileSnapshot(tx: Transaction, previous: SnapshotRecord | null, next: SnapshotRecord) {
    if (!previous) {
      await this.seedSnapshot(tx, next);
      return { changedHeroes: [], changedItems: [], staleBuilds: [] };
    }
    const diff = diffCatalog(previous, next);
    const oldVersions = await tx.editorialBuildVersion.findMany({
      where: { snapshotId: previous.id, isCurrent: true, status: { in: [...cloneStatuses] } },
      include: {
        build: true,
        steps: { include: { alternatives: true }, orderBy: { order: 'asc' } },
      },
    });
    const changedHeroes = new Set(diff.changedHeroes);
    const changedItems = new Set(diff.changedItems);
    const staleBuilds: string[] = [];
    for (const version of oldVersions) {
      const affected =
        changedHeroes.has(version.build.heroId) ||
        version.steps.some(
          (step) =>
            changedItems.has(step.itemClassName) ||
            step.alternatives.some((alternative) => changedItems.has(alternative.itemClassName)),
        );
      if (affected) staleBuilds.push(version.buildId);
      const targetCurrent = await tx.editorialBuildVersion.findFirst({
        where: { buildId: version.buildId, snapshotId: next.id, isCurrent: true },
      });
      if (targetCurrent) continue;
      await tx.editorialBuildVersion.create({
        data: {
          id: randomUUID(),
          buildId: version.buildId,
          snapshotId: next.id,
          revision: 1,
          title: version.title,
          summary: version.summary,
          status: affected ? 'stale' : version.status,
          steps: {
            create: version.steps.map((step) => ({
              id: randomUUID(),
              order: step.order,
              phase: step.phase,
              itemClassName: step.itemClassName,
              reason: step.reason,
              alternatives: {
                create: step.alternatives.map((alternative) => ({
                  id: randomUUID(),
                  itemClassName: alternative.itemClassName,
                  reason: alternative.reason,
                })),
              },
            })),
          },
        },
      });
    }
    await tx.patchChange.create({
      data: {
        id: `patch-${next.id}`,
        fromSnapshotId: previous.id,
        toSnapshotId: next.id,
        fromClientVersion: previous.clientVersion,
        toClientVersion: next.clientVersion,
        changedHeroes: json(diff.changedHeroes),
        changedItems: json(diff.changedItems),
        staleBuilds: json(staleBuilds),
      },
    });
    return { ...diff, staleBuilds };
  }

  private async seedSnapshot(tx: Transaction, snapshot: SnapshotRecord) {
    const items = itemsFrom(snapshot);
    const heroes = new Set(heroesFrom(snapshot).map((hero) => hero.id));
    for (const seed of seedProfiles) {
      if (!heroes.has(seed.heroId)) continue;
      const profile: EditorialProfile = { ...seed, status: 'published' };
      validateProfileAndCosts(profile, items);
      const id = `build-${seed.heroId}-${seed.style}`;
      const existing = await tx.editorialBuild.findUnique({
        where: { heroId_style: { heroId: seed.heroId, style: seed.style } },
      });
      if (existing) {
        const current = await tx.editorialBuildVersion.findFirst({
          where: { buildId: existing.id, snapshotId: snapshot.id, isCurrent: true },
        });
        if (current) continue;
      }
      await tx.editorialBuild.upsert({
        where: { heroId_style: { heroId: seed.heroId, style: seed.style } },
        update: {},
        create: {
          id,
          heroId: seed.heroId,
          style: seed.style,
          versions: {
            create: {
              id: randomUUID(),
              snapshotId: snapshot.id,
              revision: 1,
              title: profile.title,
              summary: profile.summary,
              status: 'published',
              steps: { create: profileSteps(profile) },
            },
          },
        },
      });
      if (existing) {
        await tx.editorialBuildVersion.create({
          data: {
            id: randomUUID(),
            buildId: existing.id,
            snapshotId: snapshot.id,
            revision: 1,
            title: profile.title,
            summary: profile.summary,
            status: 'published',
            steps: { create: profileSteps(profile) },
          },
        });
      }
    }
  }
}

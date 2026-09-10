import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  HeroTacticalProfile,
  TacticalProfileStatus,
  TacticalTagAssignment,
  TacticalTagDefinition,
  TacticalTagKey,
} from '@deadlock/contracts';
import { randomUUID } from 'node:crypto';
import { DatabaseService } from '../database.module';

const definitions: Array<Omit<TacticalTagDefinition, 'key'> & { key: TacticalTagKey }> = [
  {
    key: 'anti_heal',
    label: 'Anti-soin',
    description: 'Réduit ou punit la récupération de vie adverse.',
  },
  {
    key: 'anti_mobility',
    label: 'Anti-mobilité',
    description: 'Limite les déplacements, dashs ou repositionnements adverses.',
  },
  {
    key: 'anti_burst',
    label: 'Anti-burst',
    description: 'Aide à survivre à une fenêtre de dégâts très concentrée.',
  },
  {
    key: 'anti_bullet',
    label: 'Anti-arme',
    description: 'Répond à une pression principalement basée sur les dégâts d’arme.',
  },
  {
    key: 'anti_spirit',
    label: 'Anti-esprit',
    description: 'Répond à une pression principalement basée sur les dégâts spirituels.',
  },
  {
    key: 'anti_control',
    label: 'Anti-contrôle',
    description: 'Réduit le risque créé par les ralentissements, silences ou contrôles.',
  },
  {
    key: 'anti_range',
    label: 'Anti-portée',
    description: 'Aide à atteindre ou punir un adversaire qui joue à longue distance.',
  },
  {
    key: 'anti_regeneration',
    label: 'Anti-régénération',
    description: 'Répond à une forte régénération ou à une réserve de vie persistante.',
  },
];

const definitionKeys = new Set(definitions.map((definition) => definition.key));

type Transaction = Prisma.TransactionClient;

type SnapshotRecord = Prisma.CatalogSnapshotGetPayload<{
  select: { id: true; heroes: true };
}>;

function profileStatus(value: string): TacticalProfileStatus {
  if (value === 'validated' || value === 'stale') return value;
  return 'draft';
}

function toProfile(profile: {
  heroId: number;
  status: string;
  source: string;
  tags: Array<{ tagKey: string; intensity: number; evidence: string; status: string }>;
}): HeroTacticalProfile {
  return {
    heroId: profile.heroId,
    status: profileStatus(profile.status),
    source: profile.source,
    tags: profile.tags.map((tag) => ({
      key: tag.tagKey as TacticalTagKey,
      intensity: Math.max(1, Math.min(3, tag.intensity)) as 1 | 2 | 3,
      evidence: tag.evidence,
      status: profileStatus(tag.status),
    })),
  };
}

@Injectable()
export class TacticalService {
  constructor(private readonly db: DatabaseService) {}

  definitions(): TacticalTagDefinition[] {
    return definitions.map((definition) => ({ ...definition }));
  }

  async ensureSnapshot(snapshotId: string) {
    const snapshot = await this.db.catalogSnapshot.findUnique({
      where: { id: snapshotId },
      select: { id: true, heroes: true },
    });
    if (!snapshot) throw new NotFoundException('Catalogue introuvable.');
    await this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(184742903)`;
      await this.seedDefinitions(tx);
      const heroes = snapshot.heroes as Array<{ id: number }>;
      for (const hero of heroes) {
        await tx.tacticalHeroProfile.upsert({
          where: { snapshotId_heroId: { snapshotId, heroId: hero.id } },
          update: {},
          create: {
            id: `tactical-${snapshotId}-${hero.id}`,
            snapshotId,
            heroId: hero.id,
            status: 'draft',
            source: 'editorial-pending',
          },
        });
      }
    });
  }

  async listForSnapshot(snapshotId: string): Promise<HeroTacticalProfile[]> {
    await this.ensureSnapshot(snapshotId);
    const profiles = await this.db.tacticalHeroProfile.findMany({
      where: { snapshotId },
      orderBy: { heroId: 'asc' },
      include: { tags: { orderBy: { tagKey: 'asc' } } },
    });
    return profiles.map(toProfile);
  }

  async profileFor(snapshotId: string, heroId: number): Promise<HeroTacticalProfile> {
    await this.ensureSnapshot(snapshotId);
    const profile = await this.db.tacticalHeroProfile.findUnique({
      where: { snapshotId_heroId: { snapshotId, heroId } },
      include: { tags: { orderBy: { tagKey: 'asc' } } },
    });
    if (!profile) throw new NotFoundException('Profil tactique introuvable.');
    return toProfile(profile);
  }

  async updateProfile(
    snapshotId: string,
    heroId: number,
    input: {
      status?: TacticalProfileStatus;
      source?: string;
      tags?: TacticalTagAssignment[];
    },
  ) {
    await this.ensureSnapshot(snapshotId);
    const tags = input.tags;
    const seen = new Set<string>();
    if (tags !== undefined) {
      for (const tag of tags) {
        if (!definitionKeys.has(tag.key) || seen.has(tag.key)) {
          throw new UnprocessableEntityException(
            'Les tags tactiques doivent être connus et uniques.',
          );
        }
        if (!Number.isInteger(tag.intensity) || tag.intensity < 1 || tag.intensity > 3) {
          throw new UnprocessableEntityException(
            'L’intensité d’un tag tactique doit être comprise entre 1 et 3.',
          );
        }
        if (!tag.evidence.trim()) {
          throw new UnprocessableEntityException(
            'Chaque tag tactique doit citer une justification.',
          );
        }
        seen.add(tag.key);
      }
    }
    const profile = await this.db.tacticalHeroProfile.findUnique({
      where: { snapshotId_heroId: { snapshotId, heroId } },
    });
    if (!profile) throw new NotFoundException('Profil tactique introuvable.');
    return this.db.$transaction(async (tx) => {
      const data: Prisma.TacticalHeroProfileUpdateInput = {
        status: input.status ?? profile.status,
        source: input.source?.trim() || profile.source,
      };
      if (tags !== undefined) {
        await tx.tacticalHeroTag.deleteMany({ where: { profileId: profile.id } });
        data.tags = {
          create: tags.map((tag) => ({
            id: randomUUID(),
            tagKey: tag.key,
            intensity: tag.intensity,
            evidence: tag.evidence.trim(),
            status: tag.status,
          })),
        };
      }
      const updated = await tx.tacticalHeroProfile.update({
        where: { id: profile.id },
        data,
        include: { tags: { orderBy: { tagKey: 'asc' } } },
      });
      return toProfile(updated);
    });
  }

  async reconcileSnapshot(
    tx: Transaction,
    previous: SnapshotRecord | null,
    next: SnapshotRecord,
    changedHeroes = new Set<number>(),
  ) {
    await this.seedDefinitions(tx);
    const previousProfiles = previous
      ? await tx.tacticalHeroProfile.findMany({
          where: { snapshotId: previous.id },
          include: { tags: true },
        })
      : [];
    const byHero = new Map(previousProfiles.map((profile) => [profile.heroId, profile]));
    const heroes = next.heroes as Array<{ id: number }>;
    for (const hero of heroes) {
      const prior = byHero.get(hero.id);
      if (!prior) {
        await tx.tacticalHeroProfile.create({
          data: {
            id: `tactical-${next.id}-${hero.id}`,
            snapshotId: next.id,
            heroId: hero.id,
            status: 'draft',
            source: 'editorial-pending',
          },
        });
        continue;
      }
      await tx.tacticalHeroProfile.create({
        data: {
          id: `tactical-${next.id}-${hero.id}`,
          snapshotId: next.id,
          heroId: hero.id,
          status: changedHeroes.has(hero.id) ? 'stale' : prior.status,
          source: prior.source,
          tags: {
            create: prior.tags.map((tag) => ({
              id: randomUUID(),
              tagKey: tag.tagKey,
              intensity: tag.intensity,
              evidence: tag.evidence,
              status: tag.status,
            })),
          },
        },
      });
    }
  }

  private async seedDefinitions(tx: Transaction) {
    for (const definition of definitions) {
      await tx.tacticalTagDefinition.upsert({
        where: { key: definition.key },
        update: { label: definition.label, description: definition.description, active: true },
        create: definition,
      });
    }
  }
}

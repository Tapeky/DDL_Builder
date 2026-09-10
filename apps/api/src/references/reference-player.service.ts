import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ReferencePlayer, ReferencePlayerVerificationStatus } from '@deadlock/contracts';
import { DatabaseService } from '../database.module';

const statuses: ReferencePlayerVerificationStatus[] = ['pending', 'verified', 'stale', 'rejected'];

function numbers(value: unknown, label: string) {
  if (
    !Array.isArray(value) ||
    value.some((item) => !Number.isSafeInteger(item) || (item as number) < 0) ||
    new Set(value).size !== value.length
  ) {
    throw new UnprocessableEntityException(`${label} doit contenir des nombres entiers uniques.`);
  }
  return value as number[];
}

function stringValue(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new UnprocessableEntityException(`${label} est obligatoire.`);
  }
  return value.trim();
}

function toPlayer(player: {
  id: string;
  displayName: string;
  region: string;
  accountIds: unknown;
  heroIds: unknown;
  verificationStatus: string;
  verificationSource: string;
  verifiedAt: Date | null;
  lastSeenAt: Date | null;
  sourceUrl: string | null;
  notes: string;
}): ReferencePlayer {
  return {
    id: player.id,
    displayName: player.displayName,
    region: player.region,
    accountIds: numbers(player.accountIds, 'Les comptes'),
    heroIds: numbers(player.heroIds, 'Les héros'),
    verificationStatus: player.verificationStatus as ReferencePlayerVerificationStatus,
    verificationSource: player.verificationSource,
    verifiedAt: player.verifiedAt?.toISOString() ?? null,
    lastSeenAt: player.lastSeenAt?.toISOString() ?? null,
    sourceUrl: player.sourceUrl,
    notes: player.notes,
  };
}

export interface ReferencePlayerInput {
  id: string;
  displayName: string;
  region: string;
  accountIds: number[];
  heroIds: number[];
  verificationStatus: ReferencePlayerVerificationStatus;
  verificationSource: string;
  sourceUrl?: string | null;
  notes?: string;
  lastSeenAt?: string | null;
}

function validate(input: ReferencePlayerInput) {
  const id = stringValue(input.id, 'L’identifiant interne');
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(id)) {
    throw new UnprocessableEntityException('L’identifiant interne doit être un slug stable.');
  }
  const displayName = stringValue(input.displayName, 'Le nom affiché');
  const region = stringValue(input.region, 'La région');
  const accountIds = numbers(input.accountIds, 'Les comptes');
  const heroIds = numbers(input.heroIds, 'Les héros');
  if (!statuses.includes(input.verificationStatus)) {
    throw new UnprocessableEntityException('Le statut de vérification est inconnu.');
  }
  const verificationSource = stringValue(input.verificationSource, 'La source de vérification');
  if (input.verificationStatus === 'verified' && accountIds.length === 0) {
    throw new UnprocessableEntityException(
      'Un joueur vérifié doit avoir au moins un compte confirmé.',
    );
  }
  if (input.sourceUrl !== undefined && input.sourceUrl !== null) {
    try {
      const url = new URL(input.sourceUrl);
      if (url.protocol !== 'https:') throw new Error();
    } catch {
      throw new UnprocessableEntityException('Le lien source doit être une URL HTTPS valide.');
    }
  }
  let lastSeenAt: Date | null = null;
  if (input.lastSeenAt) {
    lastSeenAt = new Date(input.lastSeenAt);
    if (Number.isNaN(lastSeenAt.getTime())) {
      throw new UnprocessableEntityException('La date de dernière activité est invalide.');
    }
  }
  return {
    id,
    displayName,
    region,
    accountIds,
    heroIds,
    verificationStatus: input.verificationStatus,
    verificationSource,
    sourceUrl: input.sourceUrl ?? null,
    notes: input.notes?.trim() ?? '',
    lastSeenAt,
  };
}

function json(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

@Injectable()
export class ReferencePlayerService {
  constructor(private readonly db: DatabaseService) {}

  async list() {
    const players = await this.db.referencePlayer.findMany({
      orderBy: [{ verificationStatus: 'asc' }, { displayName: 'asc' }],
    });
    return players.map(toPlayer);
  }

  async create(
    input: ReferencePlayerInput,
    db: Pick<DatabaseService, 'referencePlayer'> = this.db,
  ) {
    const value = validate(input);
    const existing = await db.referencePlayer.findUnique({ where: { id: value.id } });
    if (existing) throw new ConflictException('Cet identifiant de joueur existe déjà.');
    const player = await db.referencePlayer.create({
      data: {
        ...value,
        accountIds: json(value.accountIds),
        heroIds: json(value.heroIds),
        verifiedAt: value.verificationStatus === 'verified' ? new Date() : null,
      },
    });
    return toPlayer(player);
  }

  async update(id: string, input: Partial<Omit<ReferencePlayerInput, 'id'>>) {
    const current = await this.db.referencePlayer.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Joueur de référence introuvable.');
    const currentValue = toPlayer(current);
    const patch = Object.fromEntries(
      Object.entries(input).filter(([key, value]) => key !== 'id' && value !== undefined),
    );
    const value = validate({
      id,
      displayName: currentValue.displayName,
      region: currentValue.region,
      accountIds: currentValue.accountIds,
      heroIds: currentValue.heroIds,
      verificationStatus: currentValue.verificationStatus,
      verificationSource: currentValue.verificationSource,
      sourceUrl: currentValue.sourceUrl,
      notes: currentValue.notes,
      lastSeenAt: currentValue.lastSeenAt,
      ...patch,
    });
    const data = {
      displayName: value.displayName,
      region: value.region,
      accountIds: value.accountIds,
      heroIds: value.heroIds,
      verificationStatus: value.verificationStatus,
      verificationSource: value.verificationSource,
      sourceUrl: value.sourceUrl,
      notes: value.notes,
      lastSeenAt: value.lastSeenAt,
    };
    const player = await this.db.referencePlayer.update({
      where: { id },
      data: {
        ...data,
        accountIds: json(data.accountIds),
        heroIds: json(data.heroIds),
        verifiedAt:
          value.verificationStatus === 'verified' ? (current.verifiedAt ?? new Date()) : null,
      },
    });
    return toPlayer(player);
  }
}

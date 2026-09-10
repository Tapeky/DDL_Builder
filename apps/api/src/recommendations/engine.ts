import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import type {
  BuildStep,
  FarmPriority,
  Hero,
  Item,
  Phase,
  Recommendation,
  Style,
} from '@deadlock/contracts';
import type { EditorialProfile, EditorialStepInput } from '../editorial/types';

export const ENGINE_VERSION = 'editorial-0.2.0';

export function validateEditorialProfile(profile: EditorialProfile, items: Item[]) {
  if (!['balanced', 'damage', 'survival'].includes(profile.style)) {
    throw new UnprocessableEntityException('Le style de ce build est inconnu.');
  }
  if (!profile.title.trim() || !profile.summary.trim()) {
    throw new UnprocessableEntityException('Le titre et le résumé du build sont obligatoires.');
  }
  if (profile.steps.length === 0 || profile.steps.length > 24) {
    throw new UnprocessableEntityException('Un build doit contenir entre 1 et 24 achats.');
  }
  const byName = new Set(items.map((item) => item.className));
  const orders = new Set<number>();
  for (const step of profile.steps) {
    if (!Number.isInteger(step.order) || step.order <= 0 || orders.has(step.order)) {
      throw new UnprocessableEntityException('Les ordres d’achat doivent être uniques.');
    }
    orders.add(step.order);
    if (!['early', 'core', 'late'].includes(step.phase)) {
      throw new UnprocessableEntityException('La phase d’un achat est inconnue.');
    }
    if (!byName.has(step.itemClassName)) {
      throw new UnprocessableEntityException(
        `L’objet ${step.itemClassName} est absent de la version du catalogue.`,
      );
    }
    for (const alternative of step.alternatives ?? []) {
      if (!byName.has(alternative.itemClassName)) {
        throw new UnprocessableEntityException(
          `L’alternative ${alternative.itemClassName} est absente de la version du catalogue.`,
        );
      }
      if (alternative.itemClassName === step.itemClassName) {
        throw new UnprocessableEntityException('Un achat ne peut pas être sa propre alternative.');
      }
    }
  }
  const investmentKeys = new Set<string>();
  for (const investment of profile.investments ?? []) {
    if (!['weapon', 'vitality', 'spirit'].includes(investment.branch)) {
      throw new UnprocessableEntityException('La branche d’investissement est inconnue.');
    }
    if (!['early', 'core', 'late'].includes(investment.phase)) {
      throw new UnprocessableEntityException('La phase d’investissement est inconnue.');
    }
    if (!['required', 'preferred'].includes(investment.priority) || investment.threshold <= 0) {
      throw new UnprocessableEntityException('Le palier d’investissement est invalide.');
    }
    if (!investment.reason.trim()) {
      throw new UnprocessableEntityException('Chaque palier d’investissement doit être justifié.');
    }
    const key = `${investment.branch}:${investment.phase}:${investment.threshold}`;
    if (investmentKeys.has(key)) {
      throw new UnprocessableEntityException('Les paliers d’investissement doivent être uniques.');
    }
    investmentKeys.add(key);
  }
}

export function purchaseSteps(drafts: EditorialStepInput[], items: Item[]): BuildStep[] {
  const byName = new Map(items.map((item) => [item.className, item]));
  const byId = new Map(items.map((item) => [item.id, item]));
  const owned = new Set<number>();
  const ancestors = (id: number, visiting = new Set<number>()): Set<number> => {
    if (visiting.has(id))
      throw new UnprocessableEntityException('La chaîne d’amélioration contient un cycle.');
    const item = byId.get(id);
    if (!item) throw new UnprocessableEntityException('Un composant est absent de cette version.');
    const next = new Set(visiting).add(id);
    return new Set(
      item.components.flatMap((component) => [component, ...ancestors(component, next)]),
    );
  };
  return [...drafts]
    .sort((a, b) => a.order - b.order)
    .map((draft) => {
      const item = byName.get(draft.itemClassName);
      if (!item)
        throw new UnprocessableEntityException(
          'Ce build doit être révisé : un objet est absent de cette version.',
        );
      if (owned.has(item.id) || [...owned].some((id) => ancestors(id).has(item.id))) {
        throw new UnprocessableEntityException('Cette progression contient un achat redondant.');
      }
      const components = ancestors(item.id);
      const replaces = [...owned].filter((id) => components.has(id));
      const purchaseCost = item.cost - replaces.reduce((sum, id) => sum + byId.get(id)!.cost, 0);
      if (purchaseCost <= 0)
        throw new UnprocessableEntityException('Le coût de cette amélioration doit être vérifié.');
      replaces.forEach((id) => owned.delete(id));
      owned.add(item.id);
      return {
        order: draft.order,
        phase: draft.phase as Phase,
        item,
        purchaseCost,
        reason: draft.reason,
        replaces,
        alternatives: (draft.alternatives ?? [])
          .map((alternative) => byName.get(alternative.itemClassName))
          .filter((alternative): alternative is Item => Boolean(alternative)),
      };
    });
}

export function recommend(
  hero: Hero,
  profile: EditorialProfile,
  items: Item[],
): Pick<
  Recommendation,
  | 'title'
  | 'summary'
  | 'steps'
  | 'totalCost'
  | 'investments'
  | 'warnings'
  | 'evidence'
  | 'engineVersion'
  | 'farmPriority'
  | 'opponents'
  | 'threats'
  | 'adaptations'
> {
  if (hero.id !== profile.heroId) {
    throw new UnprocessableEntityException('Le build ne correspond pas au héros demandé.');
  }
  validateEditorialProfile(profile, items);
  const steps = purchaseSteps(profile.steps, items);
  return {
    title: profile.title,
    summary: profile.summary,
    steps,
    totalCost: steps.reduce((sum, step) => sum + step.purchaseCost, 0),
    investments: profile.investments ?? [],
    engineVersion: ENGINE_VERSION,
    evidence: 'editorial-draft',
    farmPriority: 3 as FarmPriority,
    opponents: [],
    threats: [],
    adaptations: [],
    warnings: [
      'Build expérimental : règles de départ non validées par des joueurs experts et sans statistiques de victoire.',
      'Ce parcours ne tient pas compte de votre inventaire actuel ni de votre budget disponible.',
      'Les coûts déduisent les composants achetés dans ce parcours. Les ventes, capacités à imprégner et objets spéciaux de niveau 5 ne sont pas pris en charge.',
    ],
  };
}

export function assertStyle(style: string): asserts style is Style {
  if (!['balanced', 'damage', 'survival'].includes(style)) {
    throw new BadRequestException('Style inconnu.');
  }
}

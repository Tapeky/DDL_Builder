import type {
  FarmPriority,
  Hero,
  HeroTacticalProfile,
  RecommendationAdaptation,
  RecommendationThreat,
  TacticalTagDefinition,
} from '@deadlock/contracts';

export interface AdaptiveContext {
  farmPriority: FarmPriority;
  opponents: Hero[];
  profiles: HeroTacticalProfile[];
  definitions: TacticalTagDefinition[];
}

export function adaptContext(context: AdaptiveContext): {
  threats: RecommendationThreat[];
  adaptations: RecommendationAdaptation[];
  warnings: string[];
} {
  const definitions = new Map(
    context.definitions.map((definition) => [definition.key, definition]),
  );
  const profiles = new Map(context.profiles.map((profile) => [profile.heroId, profile]));
  const threats: RecommendationThreat[] = [];
  let hasUnvalidatedProfile = false;
  for (const opponent of context.opponents) {
    const profile = profiles.get(opponent.id);
    if (!profile || profile.status !== 'validated') {
      hasUnvalidatedProfile = true;
      continue;
    }
    for (const tag of profile.tags) {
      if (tag.status !== 'validated') continue;
      const definition = definitions.get(tag.key);
      if (!definition) continue;
      threats.push({
        heroId: opponent.id,
        heroName: opponent.name,
        tag: tag.key,
        intensity: tag.intensity,
        explanation: `${definition.label} : ${tag.evidence}`,
      });
    }
  }
  const warnings = [
    context.opponents.length === 0
      ? 'Aucun adversaire renseigné : le build de référence n’a pas été contextualisé.'
      : hasUnvalidatedProfile
        ? 'Certains profils ennemis ne sont pas encore validés : aucune adaptation automatique ne leur est appliquée.'
        : 'Les menaces sont affichées à titre de contexte ; aucune substitution éditoriale validée ne leur est encore associée.',
    `Priorité de farm ${context.farmPriority}/6 enregistrée ; les références par position seront activées après validation de leur couverture statistique.`,
  ];
  return { threats, adaptations: [], warnings };
}

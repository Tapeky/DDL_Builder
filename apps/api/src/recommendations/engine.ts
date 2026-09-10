import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import type { BuildStep, Hero, Item, Phase, Recommendation, Style } from '@deadlock/contracts';

export const ENGINE_VERSION = 'editorial-0.1.0';

type DraftStep = [className: string, reason: string];
interface Profile {
  title: string;
  summary: string;
  early: DraftStep[];
  core: DraftStep[];
  finisher: DraftStep;
  damage: DraftStep;
}

const profiles: Record<number, Profile> = {
  1: {
    title: 'Entretenir la flamme',
    summary:
      'Un parcours expérimental centré sur les dégâts spirituels et la présence dans les combats prolongés.',
    early: [
      [
        'upgrade_rapid_rounds',
        'Renforcer la cadence de tir pour accompagner les échanges à l’arme.',
      ],
      ['upgrade_improved_spirit', 'Poser une première base de puissance spirituelle.'],
      ['upgrade_health', 'Garder une marge de survie en début de partie.'],
    ],
    core: [
      [
        'upgrade_tech_defense_shredders',
        'Associer les tirs à une orientation de dégâts spirituels.',
      ],
      ['upgrade_health_stealing_magic', 'Ajouter de la récupération de vie aux dégâts spirituels.'],
      [
        'upgrade_magic_vulnerability',
        'Préparer une progression vers davantage de pression spirituelle.',
      ],
    ],
    finisher: [
      'upgrade_escalating_exposure',
      'Faire évoluer la vulnérabilité spirituelle pour les échanges prolongés.',
    ],
    damage: [
      'upgrade_boundless_spirit',
      'Investir davantage dans la puissance spirituelle, au prix d’un achat défensif.',
    ],
  },
  2: {
    title: 'Faire monter la tension',
    summary:
      'Un point de départ orienté sorts, avec une transition vers des achats spirituels plus importants.',
    early: [
      ['upgrade_improved_spirit', 'Commencer par de la puissance spirituelle.'],
      ['upgrade_non_player_bonus', 'Faciliter les dégâts à l’arme contre les unités non-joueurs.'],
      ['upgrade_health', 'Conserver une réserve de vie pendant la phase de lane.'],
    ],
    core: [
      ['upgrade_soaring_spirit', 'Améliorer le premier achat de puissance spirituelle.'],
      [
        'upgrade_health_stealing_magic',
        'Chercher de la récupération pendant les dégâts spirituels.',
      ],
      [
        'upgrade_magic_vulnerability',
        'Accompagner les sorts avec une réduction de résistance spirituelle.',
      ],
    ],
    finisher: [
      'upgrade_boundless_spirit',
      'Poursuivre la branche de puissance spirituelle déjà engagée.',
    ],
    damage: [
      'upgrade_escalating_exposure',
      'Renforcer la pression spirituelle plutôt que la défense.',
    ],
  },
  6: {
    title: 'Tenir le premier rang',
    summary:
      'Une base de combat rapproché qui privilégie la présence au contact et les améliorations de mêlée.',
    early: [
      ['upgrade_lifestrike_gauntlets', 'Ajouter de la récupération aux attaques de mêlée.'],
      ['upgrade_close_range', 'Orienter les dégâts de l’arme vers les engagements proches.'],
      ['upgrade_health', 'Disposer de davantage de vie pour les premiers engagements.'],
    ],
    core: [
      ['upgrade_melee_charge', 'Soutenir les engagements avec des attaques de mêlée.'],
      ['upgrade_boxing_glove', 'Faire évoluer l’achat de mêlée initial.'],
      ['upgrade_close_quarter_combat', 'Améliorer l’investissement de combat rapproché.'],
    ],
    finisher: [
      'upgrade_tech_purge',
      'Ajouter de la résistance spirituelle avant de prolonger les engagements.',
    ],
    damage: [
      'upgrade_critshot',
      'Ajouter une option offensive à l’arme, à comparer en partie avec les besoins défensifs.',
    ],
  },
  13: {
    title: 'Ne laisser aucun répit',
    summary:
      'Une progression à l’arme qui associe cadence de tir, récupération et investissements offensifs tardifs.',
    early: [
      ['upgrade_rapid_rounds', 'Commencer par la cadence de tir.'],
      ['upgrade_clip_size', 'Disposer de davantage de munitions entre les rechargements.'],
      ['upgrade_health', 'Éviter de consacrer tous les premiers achats aux dégâts.'],
    ],
    core: [
      ['upgrade_vampire', 'Récupérer de la vie grâce aux dégâts de l’arme.'],
      ['upgrade_burst_fire', 'Faire évoluer la cadence de tir initiale.'],
      [
        'upgrade_quick_silver',
        'Explorer un rechargement lié à une capacité ; le choix de la capacité reste à tester.',
      ],
    ],
    finisher: [
      'upgrade_ricochet',
      'Ajouter une option de tirs qui se propagent dans les combats groupés.',
    ],
    damage: ['upgrade_critshot', 'Poursuivre l’investissement dans les dégâts de l’arme.'],
  },
  20: {
    title: 'Ne jamais partir seule',
    summary:
      'Un parcours de soutien expérimental autour des soins, de la durée des capacités et de la survie.',
    early: [
      ['upgrade_health_stimpak', 'Prévoir une première option de soin actif.'],
      ['upgrade_improved_spirit', 'Accompagner les capacités avec de la puissance spirituelle.'],
      ['upgrade_health', 'Garder de la vie pour rester présente auprès de l’équipe.'],
    ],
    core: [
      ['upgrade_health_nova', 'Faire évoluer le premier soin vers une option de soin de groupe.'],
      ['upgrade_arcane_extension', 'Explorer une durée accrue pour les capacités concernées.'],
      ['upgrade_tech_purge', 'Ajouter une défense spirituelle pour rester dans le combat.'],
    ],
    finisher: [
      'upgrade_imbued_duration_extender',
      'Améliorer la branche de durée ; la capacité à imprégner reste à choisir en partie.',
    ],
    damage: [
      'upgrade_boundless_spirit',
      'Ajouter une option de puissance spirituelle plutôt qu’un achat défensif.',
    ],
  },
};

function draftSteps(heroId: number, style: Style): { phase: Phase; step: DraftStep }[] {
  const profile = profiles[heroId];
  if (!profile)
    throw new UnprocessableEntityException('Ce héros ne dispose pas encore de build de départ.');
  const adaptation: DraftStep =
    style === 'damage'
      ? profile.damage
      : style === 'survival'
        ? [
            'upgrade_improved_bullet_armor',
            'Privilégier la résistance aux dégâts d’arme. Cette option ne remplace pas une analyse des adversaires.',
          ]
        : [
            'upgrade_chonky',
            'Faire évoluer la réserve de vie initiale pour équilibrer la progression.',
          ];
  return [
    ...profile.early.map((step) => ({ phase: 'early' as const, step })),
    ...profile.core.map((step) => ({ phase: 'core' as const, step })),
    { phase: 'late', step: profile.finisher },
    { phase: 'late', step: adaptation },
  ];
}

export function canRecommend(heroId: number, items: Item[]) {
  if (!profiles[heroId]) return false;
  const available = new Set(items.map((item) => item.className));
  return (['balanced', 'damage', 'survival'] as const).every((style) =>
    draftSteps(heroId, style).every(({ step }) => available.has(step[0])),
  );
}

export function purchaseSteps(
  drafts: { phase: Phase; step: DraftStep }[],
  items: Item[],
): BuildStep[] {
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
  return drafts.map(({ phase, step: [name, reason] }, index) => {
    const item = byName.get(name);
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
    return { order: index + 1, phase, item, purchaseCost, reason, replaces };
  });
}

export function recommend(
  hero: Hero,
  style: Style,
  items: Item[],
): Pick<
  Recommendation,
  'title' | 'summary' | 'steps' | 'totalCost' | 'warnings' | 'evidence' | 'engineVersion'
> {
  if (!['balanced', 'damage', 'survival'].includes(style))
    throw new BadRequestException('Style inconnu.');
  const steps = purchaseSteps(draftSteps(hero.id, style), items);
  return {
    title: profiles[hero.id].title,
    summary: profiles[hero.id].summary,
    steps,
    totalCost: steps.reduce((sum, step) => sum + step.purchaseCost, 0),
    engineVersion: ENGINE_VERSION,
    evidence: 'editorial-draft',
    warnings: [
      'Build expérimental : règles de départ non validées par des joueurs experts et sans statistiques de victoire.',
      'Ce parcours ne tient pas compte des adversaires, de votre inventaire actuel ni de votre budget disponible.',
      'Les coûts déduisent les composants achetés dans ce parcours. Les ventes, capacités à imprégner et objets spéciaux de niveau 5 ne sont pas pris en charge.',
    ],
  };
}

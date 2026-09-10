import type { EditorialProfileInput, EditorialStepInput } from './types';

const step = (
  phase: EditorialStepInput['phase'],
  itemClassName: string,
  reason: string,
  alternatives: string[] = [],
): EditorialStepInput => ({
  order: 0,
  phase,
  itemClassName,
  reason,
  alternatives: alternatives.map((alternative) => ({ itemClassName: alternative })),
});

function ordered(steps: EditorialStepInput[]) {
  return steps.map((item, index) => ({ ...item, order: index + 1 }));
}

export const seedProfiles: EditorialProfileInput[] = [
  {
    heroId: 1,
    style: 'balanced',
    title: 'Entretenir la flamme',
    summary:
      'Un parcours expérimental centré sur les dégâts spirituels et la présence dans les combats prolongés.',
    steps: ordered([
      step(
        'early',
        'upgrade_rapid_rounds',
        'Renforcer la cadence de tir pour accompagner les échanges à l’arme.',
      ),
      step('early', 'upgrade_improved_spirit', 'Poser une première base de puissance spirituelle.'),
      step('early', 'upgrade_health', 'Garder une marge de survie en début de partie.'),
      step(
        'core',
        'upgrade_tech_defense_shredders',
        'Associer les tirs à une orientation de dégâts spirituels.',
      ),
      step(
        'core',
        'upgrade_health_stealing_magic',
        'Ajouter de la récupération de vie aux dégâts spirituels.',
      ),
      step(
        'core',
        'upgrade_magic_vulnerability',
        'Préparer une progression vers davantage de pression spirituelle.',
      ),
      step(
        'late',
        'upgrade_escalating_exposure',
        'Faire évoluer la vulnérabilité spirituelle pour les échanges prolongés.',
      ),
      step(
        'late',
        'upgrade_chonky',
        'Faire évoluer la réserve de vie initiale pour équilibrer la progression.',
      ),
    ]),
  },
  {
    heroId: 1,
    style: 'damage',
    title: 'Entretenir la flamme',
    summary:
      'Un parcours expérimental centré sur les dégâts spirituels et la présence dans les combats prolongés.',
    steps: ordered([
      step(
        'early',
        'upgrade_rapid_rounds',
        'Renforcer la cadence de tir pour accompagner les échanges à l’arme.',
      ),
      step('early', 'upgrade_improved_spirit', 'Poser une première base de puissance spirituelle.'),
      step('early', 'upgrade_health', 'Garder une marge de survie en début de partie.'),
      step(
        'core',
        'upgrade_tech_defense_shredders',
        'Associer les tirs à une orientation de dégâts spirituels.',
      ),
      step(
        'core',
        'upgrade_health_stealing_magic',
        'Ajouter de la récupération de vie aux dégâts spirituels.',
      ),
      step(
        'core',
        'upgrade_magic_vulnerability',
        'Préparer une progression vers davantage de pression spirituelle.',
      ),
      step(
        'late',
        'upgrade_escalating_exposure',
        'Faire évoluer la vulnérabilité spirituelle pour les échanges prolongés.',
      ),
      step(
        'late',
        'upgrade_boundless_spirit',
        'Investir davantage dans la puissance spirituelle, au prix d’un achat défensif.',
      ),
    ]),
  },
  {
    heroId: 1,
    style: 'survival',
    title: 'Entretenir la flamme',
    summary:
      'Un parcours expérimental centré sur les dégâts spirituels et la présence dans les combats prolongés.',
    steps: ordered([
      step(
        'early',
        'upgrade_rapid_rounds',
        'Renforcer la cadence de tir pour accompagner les échanges à l’arme.',
      ),
      step('early', 'upgrade_improved_spirit', 'Poser une première base de puissance spirituelle.'),
      step('early', 'upgrade_health', 'Garder une marge de survie en début de partie.'),
      step(
        'core',
        'upgrade_tech_defense_shredders',
        'Associer les tirs à une orientation de dégâts spirituels.',
      ),
      step(
        'core',
        'upgrade_health_stealing_magic',
        'Ajouter de la récupération de vie aux dégâts spirituels.',
      ),
      step(
        'core',
        'upgrade_magic_vulnerability',
        'Préparer une progression vers davantage de pression spirituelle.',
      ),
      step(
        'late',
        'upgrade_escalating_exposure',
        'Faire évoluer la vulnérabilité spirituelle pour les échanges prolongés.',
      ),
      step(
        'late',
        'upgrade_improved_bullet_armor',
        'Privilégier la résistance aux dégâts d’arme. Cette option ne remplace pas une analyse des adversaires.',
      ),
    ]),
  },
  {
    heroId: 2,
    style: 'balanced',
    title: 'Faire monter la tension',
    summary:
      'Un point de départ orienté sorts, avec une transition vers des achats spirituels plus importants.',
    steps: ordered([
      step('early', 'upgrade_improved_spirit', 'Commencer par de la puissance spirituelle.'),
      step(
        'early',
        'upgrade_non_player_bonus',
        'Faciliter les dégâts à l’arme contre les unités non-joueurs.',
      ),
      step('early', 'upgrade_health', 'Conserver une réserve de vie pendant la phase de lane.'),
      step(
        'core',
        'upgrade_soaring_spirit',
        'Améliorer le premier achat de puissance spirituelle.',
      ),
      step(
        'core',
        'upgrade_health_stealing_magic',
        'Chercher de la récupération pendant les dégâts spirituels.',
      ),
      step(
        'core',
        'upgrade_magic_vulnerability',
        'Accompagner les sorts avec une réduction de résistance spirituelle.',
      ),
      step(
        'late',
        'upgrade_boundless_spirit',
        'Poursuivre la branche de puissance spirituelle déjà engagée.',
      ),
      step(
        'late',
        'upgrade_chonky',
        'Faire évoluer la réserve de vie initiale pour équilibrer la progression.',
      ),
    ]),
  },
  {
    heroId: 2,
    style: 'damage',
    title: 'Faire monter la tension',
    summary:
      'Un point de départ orienté sorts, avec une transition vers des achats spirituels plus importants.',
    steps: ordered([
      step('early', 'upgrade_improved_spirit', 'Commencer par de la puissance spirituelle.'),
      step(
        'early',
        'upgrade_non_player_bonus',
        'Faciliter les dégâts à l’arme contre les unités non-joueurs.',
      ),
      step('early', 'upgrade_health', 'Conserver une réserve de vie pendant la phase de lane.'),
      step(
        'core',
        'upgrade_soaring_spirit',
        'Améliorer le premier achat de puissance spirituelle.',
      ),
      step(
        'core',
        'upgrade_health_stealing_magic',
        'Chercher de la récupération pendant les dégâts spirituels.',
      ),
      step(
        'core',
        'upgrade_magic_vulnerability',
        'Accompagner les sorts avec une réduction de résistance spirituelle.',
      ),
      step(
        'late',
        'upgrade_boundless_spirit',
        'Poursuivre la branche de puissance spirituelle déjà engagée.',
      ),
      step(
        'late',
        'upgrade_escalating_exposure',
        'Renforcer la pression spirituelle plutôt que la défense.',
      ),
    ]),
  },
  {
    heroId: 2,
    style: 'survival',
    title: 'Faire monter la tension',
    summary:
      'Un point de départ orienté sorts, avec une transition vers des achats spirituels plus importants.',
    steps: ordered([
      step('early', 'upgrade_improved_spirit', 'Commencer par de la puissance spirituelle.'),
      step(
        'early',
        'upgrade_non_player_bonus',
        'Faciliter les dégâts à l’arme contre les unités non-joueurs.',
      ),
      step('early', 'upgrade_health', 'Conserver une réserve de vie pendant la phase de lane.'),
      step(
        'core',
        'upgrade_soaring_spirit',
        'Améliorer le premier achat de puissance spirituelle.',
      ),
      step(
        'core',
        'upgrade_health_stealing_magic',
        'Chercher de la récupération pendant les dégâts spirituels.',
      ),
      step(
        'core',
        'upgrade_magic_vulnerability',
        'Accompagner les sorts avec une réduction de résistance spirituelle.',
      ),
      step(
        'late',
        'upgrade_boundless_spirit',
        'Poursuivre la branche de puissance spirituelle déjà engagée.',
      ),
      step(
        'late',
        'upgrade_improved_bullet_armor',
        'Privilégier la résistance aux dégâts d’arme. Cette option ne remplace pas une analyse des adversaires.',
      ),
    ]),
  },
  {
    heroId: 6,
    style: 'balanced',
    title: 'Tenir le premier rang',
    summary:
      'Une base de combat rapproché qui privilégie la présence au contact et les améliorations de mêlée.',
    steps: ordered([
      step(
        'early',
        'upgrade_lifestrike_gauntlets',
        'Ajouter de la récupération aux attaques de mêlée.',
      ),
      step(
        'early',
        'upgrade_close_range',
        'Orienter les dégâts de l’arme vers les engagements proches.',
      ),
      step(
        'early',
        'upgrade_health',
        'Disposer de davantage de vie pour les premiers engagements.',
      ),
      step('core', 'upgrade_melee_charge', 'Soutenir les engagements avec des attaques de mêlée.'),
      step('core', 'upgrade_boxing_glove', 'Faire évoluer l’achat de mêlée initial.'),
      step(
        'core',
        'upgrade_close_quarter_combat',
        'Améliorer l’investissement de combat rapproché.',
      ),
      step(
        'late',
        'upgrade_tech_purge',
        'Ajouter de la résistance spirituelle avant de prolonger les engagements.',
      ),
      step(
        'late',
        'upgrade_chonky',
        'Faire évoluer la réserve de vie initiale pour équilibrer la progression.',
      ),
    ]),
  },
  {
    heroId: 6,
    style: 'damage',
    title: 'Tenir le premier rang',
    summary:
      'Une base de combat rapproché qui privilégie la présence au contact et les améliorations de mêlée.',
    steps: ordered([
      step(
        'early',
        'upgrade_lifestrike_gauntlets',
        'Ajouter de la récupération aux attaques de mêlée.',
      ),
      step(
        'early',
        'upgrade_close_range',
        'Orienter les dégâts de l’arme vers les engagements proches.',
      ),
      step(
        'early',
        'upgrade_health',
        'Disposer de davantage de vie pour les premiers engagements.',
      ),
      step('core', 'upgrade_melee_charge', 'Soutenir les engagements avec des attaques de mêlée.'),
      step('core', 'upgrade_boxing_glove', 'Faire évoluer l’achat de mêlée initial.'),
      step(
        'core',
        'upgrade_close_quarter_combat',
        'Améliorer l’investissement de combat rapproché.',
      ),
      step(
        'late',
        'upgrade_tech_purge',
        'Ajouter de la résistance spirituelle avant de prolonger les engagements.',
      ),
      step(
        'late',
        'upgrade_critshot',
        'Ajouter une option offensive à l’arme, à comparer en partie avec les besoins défensifs.',
      ),
    ]),
  },
  {
    heroId: 6,
    style: 'survival',
    title: 'Tenir le premier rang',
    summary:
      'Une base de combat rapproché qui privilégie la présence au contact et les améliorations de mêlée.',
    steps: ordered([
      step(
        'early',
        'upgrade_lifestrike_gauntlets',
        'Ajouter de la récupération aux attaques de mêlée.',
      ),
      step(
        'early',
        'upgrade_close_range',
        'Orienter les dégâts de l’arme vers les engagements proches.',
      ),
      step(
        'early',
        'upgrade_health',
        'Disposer de davantage de vie pour les premiers engagements.',
      ),
      step('core', 'upgrade_melee_charge', 'Soutenir les engagements avec des attaques de mêlée.'),
      step('core', 'upgrade_boxing_glove', 'Faire évoluer l’achat de mêlée initial.'),
      step(
        'core',
        'upgrade_close_quarter_combat',
        'Améliorer l’investissement de combat rapproché.',
      ),
      step(
        'late',
        'upgrade_tech_purge',
        'Ajouter de la résistance spirituelle avant de prolonger les engagements.',
      ),
      step(
        'late',
        'upgrade_improved_bullet_armor',
        'Privilégier la résistance aux dégâts d’arme. Cette option ne remplace pas une analyse des adversaires.',
      ),
    ]),
  },
  {
    heroId: 13,
    style: 'balanced',
    title: 'Ne laisser aucun répit',
    summary:
      'Une progression à l’arme qui associe cadence de tir, récupération et investissements offensifs tardifs.',
    steps: ordered([
      step('early', 'upgrade_rapid_rounds', 'Commencer par la cadence de tir.'),
      step(
        'early',
        'upgrade_clip_size',
        'Disposer de davantage de munitions entre les rechargements.',
      ),
      step('early', 'upgrade_health', 'Éviter de consacrer tous les premiers achats aux dégâts.'),
      step('core', 'upgrade_vampire', 'Récupérer de la vie grâce aux dégâts de l’arme.'),
      step('core', 'upgrade_burst_fire', 'Faire évoluer la cadence de tir initiale.'),
      step(
        'core',
        'upgrade_quick_silver',
        'Explorer un rechargement lié à une capacité ; le choix de la capacité reste à tester.',
      ),
      step(
        'late',
        'upgrade_ricochet',
        'Ajouter une option de tirs qui se propagent dans les combats groupés.',
      ),
      step(
        'late',
        'upgrade_chonky',
        'Faire évoluer la réserve de vie initiale pour équilibrer la progression.',
      ),
    ]),
  },
  {
    heroId: 13,
    style: 'damage',
    title: 'Ne laisser aucun répit',
    summary:
      'Une progression à l’arme qui associe cadence de tir, récupération et investissements offensifs tardifs.',
    steps: ordered([
      step('early', 'upgrade_rapid_rounds', 'Commencer par la cadence de tir.'),
      step(
        'early',
        'upgrade_clip_size',
        'Disposer de davantage de munitions entre les rechargements.',
      ),
      step('early', 'upgrade_health', 'Éviter de consacrer tous les premiers achats aux dégâts.'),
      step('core', 'upgrade_vampire', 'Récupérer de la vie grâce aux dégâts de l’arme.'),
      step('core', 'upgrade_burst_fire', 'Faire évoluer la cadence de tir initiale.'),
      step(
        'core',
        'upgrade_quick_silver',
        'Explorer un rechargement lié à une capacité ; le choix de la capacité reste à tester.',
      ),
      step(
        'late',
        'upgrade_ricochet',
        'Ajouter une option de tirs qui se propagent dans les combats groupés.',
      ),
      step('late', 'upgrade_critshot', 'Poursuivre l’investissement dans les dégâts de l’arme.'),
    ]),
  },
  {
    heroId: 13,
    style: 'survival',
    title: 'Ne laisser aucun répit',
    summary:
      'Une progression à l’arme qui associe cadence de tir, récupération et investissements offensifs tardifs.',
    steps: ordered([
      step('early', 'upgrade_rapid_rounds', 'Commencer par la cadence de tir.'),
      step(
        'early',
        'upgrade_clip_size',
        'Disposer de davantage de munitions entre les rechargements.',
      ),
      step('early', 'upgrade_health', 'Éviter de consacrer tous les premiers achats aux dégâts.'),
      step('core', 'upgrade_vampire', 'Récupérer de la vie grâce aux dégâts de l’arme.'),
      step('core', 'upgrade_burst_fire', 'Faire évoluer la cadence de tir initiale.'),
      step(
        'core',
        'upgrade_quick_silver',
        'Explorer un rechargement lié à une capacité ; le choix de la capacité reste à tester.',
      ),
      step(
        'late',
        'upgrade_ricochet',
        'Ajouter une option de tirs qui se propagent dans les combats groupés.',
      ),
      step(
        'late',
        'upgrade_improved_bullet_armor',
        'Privilégier la résistance aux dégâts d’arme. Cette option ne remplace pas une analyse des adversaires.',
      ),
    ]),
  },
  {
    heroId: 20,
    style: 'balanced',
    title: 'Ne jamais partir seule',
    summary:
      'Un parcours de soutien expérimental autour des soins, de la durée des capacités et de la survie.',
    steps: ordered([
      step('early', 'upgrade_health_stimpak', 'Prévoir une première option de soin actif.'),
      step(
        'early',
        'upgrade_improved_spirit',
        'Accompagner les capacités avec de la puissance spirituelle.',
      ),
      step('early', 'upgrade_health', 'Garder de la vie pour rester présente auprès de l’équipe.'),
      step(
        'core',
        'upgrade_health_nova',
        'Faire évoluer le premier soin vers une option de soin de groupe.',
      ),
      step(
        'core',
        'upgrade_arcane_extension',
        'Explorer une durée accrue pour les capacités concernées.',
      ),
      step(
        'core',
        'upgrade_tech_purge',
        'Ajouter une défense spirituelle pour rester dans le combat.',
      ),
      step(
        'late',
        'upgrade_imbued_duration_extender',
        'Améliorer la branche de durée ; la capacité à imprégner reste à choisir en partie.',
      ),
      step(
        'late',
        'upgrade_chonky',
        'Faire évoluer la réserve de vie initiale pour équilibrer la progression.',
      ),
    ]),
  },
  {
    heroId: 20,
    style: 'damage',
    title: 'Ne jamais partir seule',
    summary:
      'Un parcours de soutien expérimental autour des soins, de la durée des capacités et de la survie.',
    steps: ordered([
      step('early', 'upgrade_health_stimpak', 'Prévoir une première option de soin actif.'),
      step(
        'early',
        'upgrade_improved_spirit',
        'Accompagner les capacités avec de la puissance spirituelle.',
      ),
      step('early', 'upgrade_health', 'Garder de la vie pour rester présente auprès de l’équipe.'),
      step(
        'core',
        'upgrade_health_nova',
        'Faire évoluer le premier soin vers une option de soin de groupe.',
      ),
      step(
        'core',
        'upgrade_arcane_extension',
        'Explorer une durée accrue pour les capacités concernées.',
      ),
      step(
        'core',
        'upgrade_tech_purge',
        'Ajouter une défense spirituelle pour rester dans le combat.',
      ),
      step(
        'late',
        'upgrade_imbued_duration_extender',
        'Améliorer la branche de durée ; la capacité à imprégner reste à choisir en partie.',
      ),
      step(
        'late',
        'upgrade_boundless_spirit',
        'Ajouter une option de puissance spirituelle plutôt qu’un achat défensif.',
      ),
    ]),
  },
  {
    heroId: 20,
    style: 'survival',
    title: 'Ne jamais partir seule',
    summary:
      'Un parcours de soutien expérimental autour des soins, de la durée des capacités et de la survie.',
    steps: ordered([
      step('early', 'upgrade_health_stimpak', 'Prévoir une première option de soin actif.'),
      step(
        'early',
        'upgrade_improved_spirit',
        'Accompagner les capacités avec de la puissance spirituelle.',
      ),
      step('early', 'upgrade_health', 'Garder de la vie pour rester présente auprès de l’équipe.'),
      step(
        'core',
        'upgrade_health_nova',
        'Faire évoluer le premier soin vers une option de soin de groupe.',
      ),
      step(
        'core',
        'upgrade_arcane_extension',
        'Explorer une durée accrue pour les capacités concernées.',
      ),
      step(
        'core',
        'upgrade_tech_purge',
        'Ajouter une défense spirituelle pour rester dans le combat.',
      ),
      step(
        'late',
        'upgrade_imbued_duration_extender',
        'Améliorer la branche de durée ; la capacité à imprégner reste à choisir en partie.',
      ),
      step(
        'late',
        'upgrade_improved_bullet_armor',
        'Privilégier la résistance aux dégâts d’arme. Cette option ne remplace pas une analyse des adversaires.',
      ),
    ]),
  },
];

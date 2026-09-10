import type { Hero, HeroTacticalProfile, TacticalTagDefinition } from '@deadlock/contracts';
import { adaptContext } from '../src/recommendations/adaptive';

const hero = (id: number, name: string): Hero => ({
  id,
  name,
  description: '',
  image: null,
  portrait: null,
  complexity: 1,
  hasBuild: true,
});

const definitions: TacticalTagDefinition[] = [
  { key: 'anti_heal', label: 'Anti-soin', description: 'Réduction du soin.' },
];

const profile = (status: HeroTacticalProfile['status']): HeroTacticalProfile => ({
  heroId: 2,
  status,
  source: 'test',
  tags: [
    {
      key: 'anti_heal',
      intensity: 3,
      evidence: 'Capacité de soin validée sur la version de test.',
      status,
    },
  ],
});

describe('adaptive context', () => {
  it('only exposes threats from validated profiles and tags', () => {
    const result = adaptContext({
      farmPriority: 1,
      opponents: [hero(2, 'Opponent')],
      profiles: [profile('validated')],
      definitions,
    });
    expect(result.threats).toEqual([
      {
        heroId: 2,
        heroName: 'Opponent',
        tag: 'anti_heal',
        intensity: 3,
        explanation: 'Anti-soin : Capacité de soin validée sur la version de test.',
      },
    ]);
    expect(result.adaptations).toEqual([]);
  });

  it('does not turn a draft profile into an automatic adaptation', () => {
    const result = adaptContext({
      farmPriority: 3,
      opponents: [hero(2, 'Opponent')],
      profiles: [profile('draft')],
      definitions,
    });
    expect(result.threats).toEqual([]);
    expect(result.warnings[0]).toContain('pas encore validés');
  });
});

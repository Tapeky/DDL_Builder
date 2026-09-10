import { latestVersion, normalizeCatalog, plainText } from '../src/catalog/source';

const heroes = [
  { id: 1, name: 'Test', player_selectable: true, description: { playstyle: '<b>Test</b>' } },
];
const baseItem = {
  id: 3_000_000_000,
  name: 'Test item',
  class_name: 'base',
  shopable: true,
  item_slot_type: 'spirit',
  item_tier: 1,
  cost: 800,
};

describe('source normalization', () => {
  it('preserves unsigned item IDs, maps component identifiers and strips markup', () => {
    const result = normalizeCatalog(heroes, [
      baseItem,
      {
        ...baseItem,
        id: 4_000_000_000,
        class_name: 'upgrade',
        cost: 1600,
        component_items: ['base'],
      },
    ]);
    expect(result.heroes[0].description).toBe('Test');
    expect(result.items[1].components).toEqual([3_000_000_000]);
    expect(result.items[0].image).toBeNull();
  });

  it('excludes disabled and unreleased heroes, non-shop items and special tier-5 items', () => {
    const result = normalizeCatalog(
      [
        ...heroes,
        { id: 2, name: 'Disabled', player_selectable: true, disabled: true },
        { id: 3, name: 'Development', player_selectable: true, in_development: true },
      ],
      [
        baseItem,
        { id: 5, name: 'Ability', class_name: 'ability' },
        { ...baseItem, id: 6, class_name: 'special', item_tier: 5 },
      ],
    );
    expect(result.heroes).toHaveLength(1);
    expect(result.items).toHaveLength(1);
  });

  it('rejects malformed, empty and duplicate catalogues instead of silently publishing partial data', () => {
    expect(() => normalizeCatalog([], [baseItem])).toThrow();
    expect(() => normalizeCatalog(heroes, [{ ...baseItem, cost: undefined }])).toThrow();
    expect(() => normalizeCatalog(heroes, [baseItem, baseItem])).toThrow('INVALID_CATALOG');
    expect(() => normalizeCatalog(heroes, [{ ...baseItem, component_items: ['missing'] }])).toThrow(
      'MISSING_ITEM_COMPONENT',
    );
  });

  it('does not expose untrusted image hosts', () => {
    expect(
      normalizeCatalog(heroes, [{ ...baseItem, image: 'https://tracker.invalid/image.png' }])
        .items[0].image,
    ).toBeNull();
  });

  it('rejects purchasable items with a missing tier rather than dropping them silently', () => {
    expect(() => normalizeCatalog(heroes, [{ ...baseItem, item_tier: undefined }])).toThrow(
      'INVALID_SHOP_ITEM',
    );
  });

  it('accepts unnamed internal entities but rejects unnamed playable heroes and purchasable items', () => {
    expect(
      normalizeCatalog([...heroes, { id: 99, name: '', player_selectable: false }], [baseItem])
        .heroes,
    ).toHaveLength(1);
    expect(() => normalizeCatalog([{ ...heroes[0], name: '' }], [baseItem])).toThrow(
      'INVALID_CATALOG',
    );
    expect(() => normalizeCatalog(heroes, [{ ...baseItem, name: '' }])).toThrow(
      'INVALID_SHOP_ITEM',
    );
  });

  it('pins the highest valid client version without inventing a patch label', () => {
    expect(latestVersion([3, 1, 2])).toBe(3);
    expect(() => latestVersion([])).toThrow();
    expect(() => latestVersion(['3'])).toThrow();
    expect(plainText('<p>Hello&nbsp;&amp; goodbye</p>')).toBe('Hello & goodbye');
  });
});

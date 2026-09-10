import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import type { Hero, Item, Style } from '@deadlock/contracts';
import { canRecommend, purchaseSteps, recommend } from '../src/recommendations/engine';

const item = (id: number, cost: number, components: number[] = []): Item => ({
  id,
  cost,
  components,
  name: `Item ${id}`,
  className: `item_${id}`,
  image: null,
  category: 'spirit',
  tier: 1,
  description: '',
});

const hero: Hero = {
  id: 1,
  name: 'Test hero',
  description: '',
  image: null,
  portrait: null,
  complexity: 1,
  hasBuild: true,
};

describe('purchase progression', () => {
  it('credits a direct component and preserves the immutable catalogue', () => {
    const items = [item(1, 800), item(2, 1600, [1])];
    const before = JSON.stringify(items);
    const result = purchaseSteps(
      [
        { phase: 'early', step: ['item_1', 'Start'] },
        { phase: 'core', step: ['item_2', 'Upgrade'] },
      ],
      items,
    );
    expect(result.map((step) => step.purchaseCost)).toEqual([800, 800]);
    expect(result[1].replaces).toEqual([1]);
    expect(JSON.stringify(items)).toBe(before);
  });

  it('credits a transitive component without charging intermediate purchases', () => {
    const result = purchaseSteps(
      [
        { phase: 'early', step: ['item_1', 'Start'] },
        { phase: 'late', step: ['item_3', 'Upgrade'] },
      ],
      [item(1, 800), item(2, 1600, [1]), item(3, 6400, [2])],
    );
    expect(result[1].purchaseCost).toBe(5600);
    expect(result[1].replaces).toEqual([1]);
  });

  it('does not double count a component consumed by an earlier upgrade', () => {
    const result = purchaseSteps(
      [
        { phase: 'early', step: ['item_1', 'Start'] },
        { phase: 'core', step: ['item_2', 'Upgrade'] },
        { phase: 'late', step: ['item_3', 'Finish'] },
      ],
      [item(1, 800), item(2, 1600, [1]), item(3, 6400, [2])],
    );
    expect(result.map((step) => step.purchaseCost)).toEqual([800, 800, 4800]);
    expect(result[2].replaces).toEqual([2]);
  });

  it('credits two independently owned components once each', () => {
    const result = purchaseSteps(
      [
        { phase: 'early', step: ['item_1', 'First'] },
        { phase: 'core', step: ['item_2', 'Second'] },
        { phase: 'late', step: ['item_3', 'Combine'] },
      ],
      [item(1, 800), item(2, 1600), item(3, 6400, [1, 2])],
    );
    expect(result[2].purchaseCost).toBe(4000);
  });

  it('rejects missing items, cycles, duplicates, and redundant ancestor purchases', () => {
    expect(() => purchaseSteps([{ phase: 'early', step: ['missing', ''] }], [])).toThrow(
      UnprocessableEntityException,
    );
    expect(() =>
      purchaseSteps(
        [{ phase: 'early', step: ['item_1', ''] }],
        [item(1, 800, [2]), item(2, 1600, [1])],
      ),
    ).toThrow(UnprocessableEntityException);
    expect(() =>
      purchaseSteps(
        [
          { phase: 'early', step: ['item_1', ''] },
          { phase: 'core', step: ['item_1', ''] },
        ],
        [item(1, 800)],
      ),
    ).toThrow(UnprocessableEntityException);
    expect(() =>
      purchaseSteps(
        [
          { phase: 'early', step: ['item_2', ''] },
          { phase: 'core', step: ['item_1', ''] },
        ],
        [item(1, 800), item(2, 1600, [1])],
      ),
    ).toThrow(UnprocessableEntityException);
  });

  it('rejects unsupported heroes, unknown styles and incomplete catalogues', () => {
    expect(() => recommend({ ...hero, id: 999 }, 'balanced', [])).toThrow(
      UnprocessableEntityException,
    );
    expect(() => recommend(hero, 'unknown' as Style, [])).toThrow(BadRequestException);
    expect(() => recommend(hero, 'balanced', [])).toThrow(UnprocessableEntityException);
    expect(canRecommend(1, [])).toBe(false);
    expect(canRecommend(999, [])).toBe(false);
  });
});

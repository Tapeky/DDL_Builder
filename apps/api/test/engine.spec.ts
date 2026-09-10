import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import type { Hero, Item } from '@deadlock/contracts';
import {
  assertStyle,
  purchaseSteps,
  recommend,
  validateEditorialProfile,
} from '../src/recommendations/engine';
import type { EditorialProfile, EditorialStepInput } from '../src/editorial/types';

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

const draft = (
  order: number,
  phase: EditorialStepInput['phase'],
  itemClassName: string,
  reason = '',
): EditorialStepInput => ({
  order,
  phase,
  itemClassName,
  reason,
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

const profile = (steps: EditorialStepInput[]): EditorialProfile => ({
  heroId: 1,
  style: 'balanced',
  title: 'Test profile',
  summary: 'Test summary',
  status: 'published',
  steps,
});

describe('purchase progression', () => {
  it('credits a direct component and preserves the immutable catalogue', () => {
    const items = [item(1, 800), item(2, 1600, [1])];
    const before = JSON.stringify(items);
    const result = purchaseSteps(
      [draft(1, 'early', 'item_1', 'Start'), draft(2, 'core', 'item_2', 'Upgrade')],
      items,
    );
    expect(result.map((step) => step.purchaseCost)).toEqual([800, 800]);
    expect(result[1].replaces).toEqual([1]);
    expect(result[0].alternatives).toEqual([]);
    expect(JSON.stringify(items)).toBe(before);
  });

  it('credits a transitive component without charging intermediate purchases', () => {
    const result = purchaseSteps(
      [draft(1, 'early', 'item_1', 'Start'), draft(2, 'late', 'item_3', 'Upgrade')],
      [item(1, 800), item(2, 1600, [1]), item(3, 6400, [2])],
    );
    expect(result[1].purchaseCost).toBe(5600);
    expect(result[1].replaces).toEqual([1]);
  });

  it('does not double count a component consumed by an earlier upgrade', () => {
    const result = purchaseSteps(
      [
        draft(1, 'early', 'item_1', 'Start'),
        draft(2, 'core', 'item_2', 'Upgrade'),
        draft(3, 'late', 'item_3', 'Finish'),
      ],
      [item(1, 800), item(2, 1600, [1]), item(3, 6400, [2])],
    );
    expect(result.map((step) => step.purchaseCost)).toEqual([800, 800, 4800]);
    expect(result[2].replaces).toEqual([2]);
  });

  it('credits two independently owned components once each', () => {
    const result = purchaseSteps(
      [
        draft(1, 'early', 'item_1', 'First'),
        draft(2, 'core', 'item_2', 'Second'),
        draft(3, 'late', 'item_3', 'Combine'),
      ],
      [item(1, 800), item(2, 1600), item(3, 6400, [1, 2])],
    );
    expect(result[2].purchaseCost).toBe(4000);
  });

  it('rejects missing items, cycles, duplicates, and redundant ancestor purchases', () => {
    expect(() => purchaseSteps([draft(1, 'early', 'missing')], [])).toThrow(
      UnprocessableEntityException,
    );
    expect(() =>
      purchaseSteps([draft(1, 'early', 'item_1')], [item(1, 800, [2]), item(2, 1600, [1])]),
    ).toThrow(UnprocessableEntityException);
    expect(() =>
      purchaseSteps([draft(1, 'early', 'item_1'), draft(2, 'core', 'item_1')], [item(1, 800)]),
    ).toThrow(UnprocessableEntityException);
    expect(() =>
      purchaseSteps(
        [draft(1, 'early', 'item_2'), draft(2, 'core', 'item_1')],
        [item(1, 800), item(2, 1600, [1])],
      ),
    ).toThrow(UnprocessableEntityException);
  });

  it('validates profiles, unknown styles and hero mismatches', () => {
    const items = [item(1, 800)];
    expect(() =>
      recommend({ ...hero, id: 999 }, profile([draft(1, 'early', 'item_1')]), items),
    ).toThrow(UnprocessableEntityException);
    expect(() => assertStyle('unknown')).toThrow(BadRequestException);
    expect(() => recommend(hero, profile([]), items)).toThrow(UnprocessableEntityException);
    expect(() => validateEditorialProfile(profile([draft(1, 'early', 'missing')]), items)).toThrow(
      UnprocessableEntityException,
    );
  });
});

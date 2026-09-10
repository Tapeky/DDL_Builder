import { setTimeout } from 'node:timers/promises';
import { z } from 'zod';
import type { Hero, Item } from '@deadlock/contracts';

export const SOURCE_URL = 'https://api.deadlock-api.com';
export const SUPPORTED_HERO_IDS = new Set([1, 2, 6, 13, 20]);

const image = z.string().url().nullish();
const sourceHero = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  player_selectable: z.boolean(),
  disabled: z.boolean().optional(),
  in_development: z.boolean().optional(),
  description: z.object({ playstyle: z.string().optional() }).optional(),
  complexity: z.number().optional(),
  images: z
    .object({
      icon_hero_card_webp: image,
      icon_hero_card: image,
      icon_image_small_webp: image,
      icon_image_small: image,
    })
    .optional(),
});

const sourceItem = z.object({
  id: z.number().int().positive(),
  class_name: z.string().min(1),
  name: z.string(),
  shopable: z.boolean().optional(),
  item_slot_type: z.enum(['weapon', 'vitality', 'spirit']).optional(),
  item_tier: z.number().int().positive().optional(),
  cost: z.number().int().nonnegative().optional(),
  shop_image_webp: image,
  shop_image: image,
  image_webp: image,
  image,
  component_items: z.array(z.string()).optional(),
  description: z.object({ desc: z.string().optional() }).optional(),
});

export function plainText(value: string) {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}

function safeImage(value: string | null | undefined) {
  if (!value) return null;
  const url = new URL(value);
  return url.protocol === 'https:' && url.hostname === 'assets-bucket.deadlock-api.com'
    ? value
    : null;
}

export function normalizeCatalog(
  rawHeroes: unknown,
  rawItems: unknown,
): { heroes: Hero[]; items: Item[] } {
  const heroSource = z.array(sourceHero).min(1).parse(rawHeroes);
  const itemSource = z.array(sourceItem).min(1).parse(rawItems);
  const shop = itemSource.filter(
    (item) => item.shopable && (item.item_tier === undefined || item.item_tier <= 4),
  );
  const itemIds = new Map(shop.map((item) => [item.class_name, item.id]));
  const items: Item[] = shop
    .map((item) => {
      if (
        !item.name.trim() ||
        !item.item_slot_type ||
        !item.item_tier ||
        item.cost === undefined ||
        item.cost <= 0
      ) {
        throw new Error('INVALID_SHOP_ITEM');
      }
      const components = (item.component_items ?? []).map((name) => {
        const id = itemIds.get(name);
        if (!id) throw new Error('MISSING_ITEM_COMPONENT');
        return id;
      });
      return {
        id: item.id,
        className: item.class_name,
        name: item.name,
        category: item.item_slot_type,
        tier: item.item_tier,
        cost: item.cost,
        image: safeImage(item.shop_image_webp ?? item.shop_image ?? item.image_webp ?? item.image),
        description: plainText(item.description?.desc ?? ''),
        components,
      };
    })
    .sort((a, b) => a.id - b.id);
  const heroes: Hero[] = heroSource
    .filter((hero) => hero.player_selectable && !hero.disabled && !hero.in_development)
    .map((hero) => ({
      id: hero.id,
      name: hero.name,
      description: plainText(hero.description?.playstyle ?? ''),
      image: safeImage(hero.images?.icon_hero_card_webp ?? hero.images?.icon_hero_card),
      portrait: safeImage(hero.images?.icon_image_small_webp ?? hero.images?.icon_image_small),
      complexity: hero.complexity ?? 1,
      hasBuild: SUPPORTED_HERO_IDS.has(hero.id),
    }))
    .sort((a, b) => a.id - b.id);
  if (
    !heroes.length ||
    heroes.some((hero) => !hero.name.trim()) ||
    !items.length ||
    new Set(heroes.map((h) => h.id)).size !== heroes.length ||
    new Set(items.map((i) => i.id)).size !== items.length ||
    new Set(items.map((i) => i.className)).size !== items.length
  ) {
    throw new Error('INVALID_CATALOG');
  }
  return { heroes, items };
}

export async function fetchSource(path: string): Promise<unknown> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`${SOURCE_URL}/v1/assets/${path}`, {
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 429 || response.status >= 500) {
      const retryAfter = response.headers.get('retry-after');
      await response.body?.cancel();
      let delay = 1000 * 2 ** attempt;
      if (retryAfter) {
        delay = /^\d+$/.test(retryAfter)
          ? Number(retryAfter) * 1000
          : Date.parse(retryAfter) - Date.now();
      }
      if (attempt === 2 || !Number.isFinite(delay) || delay > 30_000)
        throw new Error('SOURCE_RATE_OR_AVAILABILITY');
      await setTimeout(Math.max(delay, 1000));
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error('SOURCE_HTTP_ERROR');
    }
    if (!response.body) throw new Error('SOURCE_EMPTY_BODY');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 25_000_000) {
        await reader.cancel();
        throw new Error('SOURCE_BODY_TOO_LARGE');
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  }
  throw new Error('SOURCE_UNAVAILABLE');
}

export function latestVersion(value: unknown) {
  return Math.max(
    ...z.array(z.number().int().positive().max(2_147_483_647)).min(1).max(50_000).parse(value),
  );
}

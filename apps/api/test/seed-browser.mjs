import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { URL } from 'node:url';
import { normalizeCatalog } from '../dist/catalog/source.js';

if (process.env.CI !== 'true') throw new Error('Synthetic catalogue seeding is restricted to CI.');
const fixture = JSON.parse(await readFile(new URL('./fixture.json', import.meta.url), 'utf8'));
const data = normalizeCatalog(
  fixture.heroes,
  fixture.classes.map((class_name, index) => ({
    id: 3_000_000_000 + index,
    class_name,
    name: `Objet de test ${index}`,
    shopable: true,
    item_slot_type: index % 2 ? 'weapon' : 'spirit',
    item_tier: 1,
    cost: 800,
  })),
);
const db = new PrismaClient();
try {
  const id = 'client-100-ci-fixture';
  await db.catalogSnapshot.create({ data: { id, clientVersion: 100, ...data } });
  await db.catalogHead.create({ data: { id: 'current', snapshotId: id, checkedAt: new Date() } });
} finally {
  await db.$disconnect();
}

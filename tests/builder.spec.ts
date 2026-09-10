import { expect, test } from '@playwright/test';

test('a player generates a build, shares it and changes their selection', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Un plan de jeu');
  await page.getByRole('button', { name: 'Générer mon build' }).click();
  await expect(page.locator('#resultat')).toBeVisible();
  await expect(page.locator('#resultat')).toContainText('Infernus');
  await expect(page.locator('#resultat')).toContainText('Brouillon éditorial');
  await expect(page.locator('.build-item')).toHaveCount(8);
  await expect(page).toHaveURL(/\?build=[a-f0-9]+/);
  const shared = page.url();
  await page.getByRole('button', { name: 'Partager', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Lien copié' })).toBeVisible();
  await page.reload();
  await expect(page.locator('#resultat')).toContainText('Infernus');
  await page.getByRole('button', { name: /Seven.*BUILD DISPONIBLE/ }).click();
  await expect(page.locator('#resultat')).toHaveCount(0);
  await expect(page).not.toHaveURL(/build=/);
  await page.getByRole('button', { name: 'Survie', exact: true }).click();
  await page.getByRole('button', { name: 'Générer mon build' }).click();
  await expect(page.locator('#resultat')).toContainText('Seven');
  await expect(page.locator('#resultat')).toContainText('Survie');
  await page.goto(shared);
  await expect(page.locator('#resultat')).toContainText('Infernus');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('the item catalogue supports category filters and empty searches', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.catalog-item').first()).toBeVisible();
  await page.getByRole('button', { name: 'Arme', exact: true }).click();
  await expect(page.locator('.catalog-item').first()).toHaveClass(/weapon/);
  expect(await page.locator('.catalog-item:not(.weapon)').count()).toBe(0);
  await page
    .getByRole('textbox', { name: 'Rechercher un objet' })
    .fill('no-matching-test-item-xyz');
  await expect(page.getByText('Aucun objet trouvé.', { exact: false })).toBeVisible();
  await page.getByRole('textbox', { name: 'Rechercher un objet' }).fill('');
  await expect(page.locator('.catalog-item').first()).toBeVisible();
});

test('a failed catalogue request is recoverable without fake fallback data', async ({ page }) => {
  let fail = true;
  await page.route('**/api/v1/catalog', async (route) => {
    if (fail) await route.fulfill({ status: 503, body: '{}' });
    else await route.continue();
  });
  await page.goto('/');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('indisponible');
  await expect(page.locator('.hero-card')).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Réessayer' }).click();
  await expect(page.getByRole('button', { name: 'Générer mon build' })).toBeEnabled();
});

test('an unavailable shared link has a clear error', async ({ page }) => {
  await page.goto('/?build=unknown-build');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('introuvable');
  await expect(page.locator('#resultat')).toHaveCount(0);
});

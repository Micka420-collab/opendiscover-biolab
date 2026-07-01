/**
 * Smoke test of the full landing → experiments → runner happy path.
 * Doesn't hit the LLM pipeline (that's covered by Inngest replays in CI).
 */

import { expect, test } from '@playwright/test';

test('homepage renders and links to experiments', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /discover by testing/i })).toBeVisible();
  await page.getByRole('link', { name: /run an experiment/i }).click();
  await expect(page).toHaveURL(/\/experiments$/);
});

test('experiments page lists the seeded protocol', async ({ page }) => {
  await page.goto('/experiments');
  await expect(page.getByText(/small orf mining/i)).toBeVisible();
});

test('discoveries page renders empty state or feed', async ({ page }) => {
  await page.goto('/discoveries');
  await expect(page.getByRole('heading', { name: /discoveries/i })).toBeVisible();
});

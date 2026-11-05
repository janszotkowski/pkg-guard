import { expect, test } from '@playwright/test';

test('on a phone, every page fits the screen without scrolling sideways', async ({ page }) => {
    for (const path of ['/', '/about', '/api', '/mcp', '/architecture', '/changelog', '/trends', '/trends?packages=react', '/no-such-page']) {
        await page.goto(path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, path).toBeLessThanOrEqual(0);
    }
});

test('on a phone, the search is usable', async ({ page }) => {
    await page.goto('/');
    const field = page.getByRole('search', { name: 'Search npm packages' }).getByRole('combobox', { name: 'Package name' });
    await expect(field).toBeVisible();
    await field.click();
    await expect(field).toBeFocused();
});

import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';

const axePath = createRequire(import.meta.url).resolve('axe-core/axe.min.js');

/** WCAG 2.2 AA and best-practice violations on the page as it is now, by rule. */
const axeViolations = async (page: Page): Promise<string[]> => {
    await page.addScriptTag({ path: axePath });
    return page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (context: Document, options: unknown) => Promise<{ violations: { id: string; nodes: unknown[] }[] }> } }).axe;
        const result = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
        return result.violations.map((violation) => `${violation.id} (${violation.nodes.length})`);
    });
};

/** Errors in the console: a script the Content-Security-Policy blocked shows up here. */
const collectErrors = (page: Page): string[] => {
    const errors: string[] = [];
    page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    return errors;
};

/** The search field of the home page: a combobox labelled "Package name" inside the "Search npm packages" form. */
const searchField = (page: Page) => page.getByRole('search', { name: 'Search npm packages' }).getByRole('combobox', { name: 'Package name' });

test('the home page renders the search, with no errors', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    // The title of the home page in `apps/frontend/src/lib/documents/pages.ts`, which the page shows as its h1.
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('What an npm package really costs');
    await expect(searchField(page)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Or compare package trends' })).toBeVisible();
    expect(errors).toEqual([]);
});

test('an unknown address is a 404 page that stays out of the index', async ({ page }) => {
    const response = await page.goto('/no-such-page');
    expect(response?.status()).toBe(404);
    await expect(page).toHaveTitle(/not found/i);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
    expect(await page.locator('meta[name="robots"]').getAttribute('content')).toContain('noindex');
});

test('the skip link is the first Tab stop and moves focus to the content', async ({ page }) => {
    await page.goto('/about');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: 'Skip to content' });
    await expect(skip).toBeFocused();
    await skip.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
});

test('Ctrl/Cmd+K focuses the search from anywhere on the home page', async ({ page }) => {
    await page.goto('/');
    // The handler is added after hydration; the field says so with its shortcut.
    await expect(searchField(page)).toHaveAttribute('aria-keyshortcuts', 'Meta+K Control+K');
    await page.locator('body').click();
    await page.keyboard.press('ControlOrMeta+k');
    await expect(searchField(page)).toBeFocused();
});

test.describe('accessibility', () => {
    // axe is injected as an inline script, which the site's own Content-Security-Policy rightly refuses.
    test.use({ bypassCSP: true });

    test('the home page passes the accessibility audit', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        expect(await axeViolations(page)).toEqual([]);
    });

    test('the about page passes the accessibility audit', async ({ page }) => {
        await page.goto('/about');
        await page.waitForLoadState('networkidle');
        expect(await axeViolations(page)).toEqual([]);
    });

    test('the documentation pages pass the accessibility audit', async ({ page }) => {
        for (const path of ['/api', '/mcp']) {
            await page.goto(path);
            await page.waitForLoadState('networkidle');
            expect(await axeViolations(page), path).toEqual([]);
        }
    });

    test('the trends page with a package passes the accessibility audit', async ({ page }) => {
        // No worker runs here: react is queued and stays queued, and the page says so instead of showing numbers.
        await page.goto('/trends?packages=react');
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Package trends');
        await page.waitForLoadState('networkidle');
        expect(await axeViolations(page)).toEqual([]);
    });

    test('the 404 page passes the accessibility audit', async ({ page }) => {
        await page.goto('/no-such-page');
        await page.waitForLoadState('networkidle');
        expect(await axeViolations(page)).toEqual([]);
    });
});

test('the documents for crawlers and agents answer with the right types', async ({ request }) => {
    const expectations: [string, RegExp][] = [
        ['/robots.txt', /^text\/plain/],
        ['/llms.txt', /^text\/plain/],
        ['/.well-known/security.txt', /^text\/plain/],
        ['/sitemap.xml', /^application\/xml/],
    ];
    for (const [path, type] of expectations) {
        const response = await request.get(path);
        expect(response.status(), path).toBe(200);
        expect(response.headers()['content-type'], path).toMatch(type);
    }
});

test('pages carry the security headers and a strict policy', async ({ request }) => {
    const headers = (await request.get('/')).headers();
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['content-security-policy']).not.toMatch(/script-src[^;]*unsafe-inline/);
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['x-robots-tag']).toBe('noindex, nofollow');
});

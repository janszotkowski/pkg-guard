/**
 * Starts the built backend and frontend as production would run them, and checks that they
 * work together from a clean build: the part of "can this be started from zero" that unit
 * tests cannot show. Run by `pnpm smoke` (after `pnpm build`), by `pnpm verify` and by CI.
 *
 * It needs no internet and no worker: nothing here names a real package, so nothing is
 * resolved against npm or queued for a download.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const backendEntry = join(root, 'apps/backend/dist/main.api.mjs');
const frontendEntry = join(root, 'apps/frontend/.output/server/index.mjs');

// Not 4190 or 6000 and the like: `fetch` refuses the ports on the WHATWG "bad ports" list. Different from `pnpm dev`
// (3100/4100) and the browser tests (3160/4160), so all three can run at once.
const BACKEND_PORT = process.env.SMOKE_BACKEND_PORT ?? '4150';
const FRONTEND_PORT = process.env.SMOKE_FRONTEND_PORT ?? '3150';
const backend = `http://127.0.0.1:${BACKEND_PORT}`;
const frontend = `http://127.0.0.1:${FRONTEND_PORT}`;

// Tokens of the required length. The worker's is never used (no worker runs); the frontend's makes the API count its
// rendering per visitor, so the headers below are the visitor's.
const WORKER_TOKEN = 'smoke-worker-token-that-is-long-enough-1234567';
const INTERNAL_API_TOKEN = 'smoke-internal-token-that-is-long-enough-123456';

for (const entry of [backendEntry, frontendEntry]) {
    if (!existsSync(entry)) {
        process.stderr.write(`Smoke test needs a build first (${entry} is missing). Run \`pnpm build\`.\n`);
        process.exit(1);
    }
}

const children = [];
const start = (name, entry, env) => {
    const child = spawn(process.execPath, [entry], { env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (chunk) => (output += chunk));
    child.stderr.on('data', (chunk) => (output += chunk));
    children.push({ name, child, output: () => output });
    return child;
};

const stopAll = () => {
    for (const { child } of children) child.kill('SIGTERM');
};

const waitFor = async (url, seconds = 30) => {
    const until = Date.now() + seconds * 1000;
    for (;;) {
        try {
            const response = await fetch(url, { redirect: 'manual' });
            if (response.status < 500) return;
        } catch {
            // Not listening yet.
        }
        if (Date.now() > until) throw new Error(`${url} did not come up within ${seconds}s`);
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
};

const failures = [];
const check = async (label, run) => {
    try {
        await run();
        process.stdout.write(`  ok    ${label}\n`);
    } catch (error) {
        failures.push(label);
        process.stdout.write(`  FAIL  ${label}: ${error.message}\n`);
    }
};
const expect = (condition, message) => {
    if (!condition) throw new Error(message);
};

try {
    // A database in memory: the smoke test leaves nothing behind. `test`, not `production`: production requires real
    // tokens and named origins, which are the deployment's business, not the build's.
    start('backend', backendEntry, {
        NODE_ENV: 'test',
        PORT: BACKEND_PORT,
        HOST: '127.0.0.1',
        LOG_LEVEL: 'silent',
        DATABASE_PATH: ':memory:',
        CORS_ORIGINS: frontend,
        WORKER_TOKEN,
        INTERNAL_API_TOKEN,
    });
    // The frontend server reaches the backend by its internal address; the browser address is baked in at build time.
    start('frontend', frontendEntry, { PORT: FRONTEND_PORT, HOST: '127.0.0.1', API_INTERNAL_URL: backend, INTERNAL_API_TOKEN });
    await waitFor(`${backend}/v1/health`);
    await waitFor(`${frontend}/about`);
    process.stdout.write('Smoke test: backend and frontend are up\n');

    await check('backend: /v1/health answers ok', async () => {
        const response = await fetch(`${backend}/v1/health`);
        const body = await response.json();
        expect(response.status === 200 && body.status === 'ok', `got ${response.status} ${JSON.stringify(body)}`);
        expect(response.headers.get('x-request-id'), 'no X-Request-Id header');
    });

    await check('backend: a package that is no package is refused with VALIDATION_FAILED', async () => {
        for (const query of ['', '?package=', '?package=not%20a%20package', '?package=.hidden', '?package=' + 'a'.repeat(300)]) {
            const response = await fetch(`${backend}/v1/analyses${query}`);
            const body = await response.json();
            expect(response.status === 400 && body.error?.code === 'VALIDATION_FAILED', `${query || '(no query)'}: got ${response.status} ${JSON.stringify(body)}`);
            expect(typeof body.error?.requestId === 'string', 'no requestId in the error');
        }
    });

    await check('backend: every answer under /v1 says where the caller stands with the rate limit', async () => {
        const response = await fetch(`${backend}/v1/analyses?package=`);
        for (const name of ['ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset']) expect(/^\d+$/.test(response.headers.get(name) ?? ''), `no ${name} header`);
        expect(Number(response.headers.get('ratelimit-remaining')) < Number(response.headers.get('ratelimit-limit')), 'the request was not counted');
    });

    await check('backend: CORS allows the frontend origin without credentials', async () => {
        const response = await fetch(`${backend}/v1/health`, { headers: { origin: frontend } });
        expect(response.headers.get('access-control-allow-origin') === frontend, `allow-origin is ${response.headers.get('access-control-allow-origin')}`);
        expect(response.headers.get('access-control-allow-credentials') === null, 'credentials are allowed');
    });

    await check('backend: an unknown route is NOT_FOUND and the worker routes need the token', async () => {
        const missing = await fetch(`${backend}/v1/nothing`);
        expect(missing.status === 404 && (await missing.json()).error?.code === 'NOT_FOUND', `got ${missing.status}`);
        const claim = await fetch(`${backend}/internal/jobs/claim`, { method: 'POST' });
        expect(claim.status === 401 && (await claim.json()).error?.code === 'UNAUTHORIZED', `got ${claim.status}`);
    });

    await check('frontend: robots.txt, sitemap.xml, llms.txt and security.txt are served with their types', async () => {
        const documents = [
            // A build without VITE_ALLOW_INDEXING keeps every crawler out; production's file is tested in the unit tests.
            ['/robots.txt', /^text\/plain/, /^User-agent: \*\nDisallow: \//],
            ['/sitemap.xml', /^application\/xml/, /<sitemapindex[\s\S]*\/sitemaps\/pages\.xml/],
            ['/sitemaps/pages.xml', /^application\/xml/, /<urlset[\s\S]*<loc>[^<]+\/about<\/loc>/],
            ['/llms.txt', /^text\/plain/, /^# /],
            ['/.well-known/security.txt', /^text\/plain/, /^Contact: /m],
        ];
        for (const [path, type, content] of documents) {
            const response = await fetch(`${frontend}${path}`);
            expect(response.status === 200, `${path}: got ${response.status}`);
            expect(type.test(response.headers.get('content-type') ?? ''), `${path}: content-type is ${response.headers.get('content-type')}`);
            expect(content.test(await response.text()), `${path}: unexpected content`);
        }
    });

    await check('frontend: / and /about render with a title, an h1 and a canonical link', async () => {
        // The wording of the headings is the SEO tests' business (they read it from the routes); here only that a page has one.
        for (const path of ['/', '/about']) {
            const response = await fetch(`${frontend}${path}`);
            const html = await response.text();
            expect(response.status === 200, `${path}: got ${response.status}`);
            expect(/<title>[^<]+<\/title>/.test(html), `${path}: no title`);
            expect(/<h1[^>]*>[^<]+<\/h1>/.test(html), `${path}: no h1 with text`);
            expect(html.includes('rel="canonical"'), `${path}: no canonical link`);
            expect(html.includes('id="main"'), `${path}: no main landmark for the skip link`);
        }
    });

    await check('frontend: an unknown address is a 404 page that is not indexed', async () => {
        const response = await fetch(`${frontend}/no-such-page`);
        const html = await response.text();
        expect(response.status === 404, `got ${response.status}`);
        expect(/<title>Page not found/.test(html), 'the title does not say the page was not found');
        expect(/<meta[^>]*name="robots"[^>]*noindex/.test(html), 'no robots noindex meta');
    });

    await check('frontend: pages carry the security headers and a strict policy', async () => {
        const response = await fetch(`${frontend}/`);
        const csp = response.headers.get('content-security-policy') ?? '';
        expect(csp.includes("default-src 'self'") && csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'"), `CSP is ${csp}`);
        expect(!/script-src[^;]*unsafe-inline/.test(csp), 'the CSP allows unsafe-inline scripts');
        expect(csp.includes(`connect-src 'self' ${backend}`) || /connect-src 'self' https?:\/\/\S+/.test(csp), `no API origin in connect-src: ${csp}`);
        expect(response.headers.get('strict-transport-security')?.startsWith('max-age='), 'no Strict-Transport-Security');
        expect(response.headers.get('x-frame-options') === 'DENY', 'no X-Frame-Options: DENY');
        expect(response.headers.get('x-content-type-options') === 'nosniff', 'no X-Content-Type-Options: nosniff');
        expect(response.headers.get('x-robots-tag') === 'noindex, nofollow', 'a build without VITE_ALLOW_INDEXING must say noindex');
    });

    await check('frontend: a page says it varies by Accept and points agents at llms.txt', async () => {
        const response = await fetch(`${frontend}/`);
        expect(/\bAccept\b/i.test(response.headers.get('vary') ?? ''), `Vary is ${response.headers.get('vary')}`);
        expect(/llms\.txt>; rel="describedby"/.test(response.headers.get('link') ?? ''), `Link is ${response.headers.get('link')}`);
    });

    await check('frontend: / answers Markdown to an agent that asks for it', async () => {
        const response = await fetch(`${frontend}/`, { headers: { accept: 'text/markdown' } });
        const body = await response.text();
        expect(response.status === 200 && response.headers.get('content-type')?.startsWith('text/markdown'), `got ${response.status} ${response.headers.get('content-type')}`);
        expect(body.startsWith('# '), 'the Markdown has no heading');
        expect(/private/.test(response.headers.get('cache-control') ?? ''), 'negotiated Markdown must not be cached by a shared cache');
        expect(/\bAccept\b/i.test(response.headers.get('vary') ?? ''), 'no Vary: Accept on the Markdown');
    });

    await check('frontend: a package that was never measured has no Markdown twin', async () => {
        const response = await fetch(`${frontend}/package/never-measured-smoke-package.md`);
        expect(response.status === 404 && response.headers.get('content-type')?.startsWith('text/markdown'), `got ${response.status} ${response.headers.get('content-type')}`);
    });

    await check('frontend: a badge is an image, whether or not the package was measured', async () => {
        const response = await fetch(`${frontend}/badge/never-measured-smoke-package.svg`);
        expect(response.status === 200 && response.headers.get('content-type')?.startsWith('image/svg+xml'), `got ${response.status} ${response.headers.get('content-type')}`);
        expect((await response.text()).startsWith('<svg'), 'the body is not an SVG');
    });
} catch (error) {
    failures.push(error.message);
    process.stderr.write(`Smoke test could not run: ${error.message}\n`);
    for (const { name, output } of children) process.stderr.write(`--- ${name} output ---\n${output()}\n`);
} finally {
    stopAll();
}

if (failures.length > 0) {
    process.stderr.write(`Smoke test failed: ${failures.length} problem(s)\n`);
    process.exit(1);
}
process.stdout.write('Smoke test passed\n');
process.exit(0);

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomBytes } from 'node:crypto';
import { parseSpec, type PackagesResponse } from '@weighme/core';
import handler from '@tanstack/react-start/server-entry';
import { API_URL } from '@config/api';
import { ALLOW_INDEXING, canonicalUrl } from '@config/site';
import { fetchKnownAnalysis, fetchMeasuredPackages } from '@lib/api';
import { clientIpHeader, requestIp } from '@lib/clientIp';
import { compressed } from '@lib/compression';
import { packageBadge, type Badge } from '@lib/documents/badge';
import { API_CATALOG_TYPE, aiCatalog, apiCatalog } from '@lib/documents/discovery';
import { llmsTxt } from '@lib/documents/llms';
import { markdownTokens, notMeasuredMarkdown, packageMarkdown, packagePathSpec, wantsMarkdown } from '@lib/documents/markdown';
import { robotsTxt } from '@lib/documents/robots';
import { securityTxt } from '@lib/documents/securityTxt';
import { STATIC_PAGES, packageSitemap, packageSitemapCount, packageSitemapPage, pagesSitemap, sitemapIndex } from '@lib/documents/sitemap';
import { renderDefaultOgImage, renderPackageOgImage } from '@lib/ogImage';
import { fixedWindowLimiter, ttlCache } from '@lib/rateLimit';
import { contentSecurityPolicy, documentPolicy, escapeScriptNuls, pageCacheControl, securityHeaders } from '@lib/securityHeaders';
import { VISITOR_STORE_KEY, visitorIp } from '@lib/visitor';

const SECURITY_HEADERS = securityHeaders();

/** Documents for crawlers change slowly: a CDN may keep them for an hour. */
const DOCUMENT_CACHE = 'public, max-age=3600, s-maxage=3600';

/** Markdown at a page's own address: kept by the agent that asked, never by a shared cache, which would serve it to browsers as the page. */
const NEGOTIATED_CACHE = 'private, max-age=300';

const text = (body: string, contentType: string, cache = DOCUMENT_CACHE, status = 200, extra: Record<string, string> = {}): Response =>
    new Response(body, { status, headers: { 'content-type': contentType, 'cache-control': cache, ...extra } });

const notFound = (): Response => text('Not found', 'text/plain; charset=utf-8', 'public, max-age=300', 404);

/** The visitor each request renders for, read by the API client (`@config/api`) when it asks the API on their behalf. */
const visitors = new AsyncLocalStorage<{ ip: string | undefined }>();
(globalThis as Record<symbol, unknown>)[VISITOR_STORE_KEY] = visitors;
const CLIENT_IP_HEADER = clientIpHeader(process.env['CLIENT_IP_HEADER']);

/** Share images are the costliest thing here, and a package's is a different one for every version: one visitor gets a few a minute, then the site's card. */
const ogLimiter = fixedWindowLimiter({ limit: 30, windowMs: 60_000 });

/**
 * Share images: drawing one takes far longer than answering and blocks the server while it runs, and a shared link is
 * fetched by every app it is pasted into, often at once. So drawn images are kept (the least recently used go first),
 * requests for an image being drawn wait for that drawing, and only a few are drawn at a time; when too many wait, the
 * request gets the site's card instead.
 */
const ogImages = new Map<string, Uint8Array<ArrayBuffer>>();
const ogDrawing = new Map<string, Promise<Uint8Array<ArrayBuffer>>>();
const OG_CACHE_MAX = 300;
const OG_DRAWING_MAX = 2;
const OG_WAITING_MAX = 20;
let ogRunning = 0;
const ogWaiting: (() => void)[] = [];

class ShareImageBusy extends Error {}

const shareImage = (key: string, draw: () => Promise<Buffer>): Promise<Uint8Array<ArrayBuffer>> => {
    const cached = ogImages.get(key);
    if (cached !== undefined) {
        ogImages.delete(key);
        ogImages.set(key, cached);
        return Promise.resolve(cached);
    }
    const drawing = ogDrawing.get(key);
    if (drawing !== undefined) return drawing;
    const promise = (async () => {
        if (ogRunning >= OG_DRAWING_MAX) {
            if (ogWaiting.length >= OG_WAITING_MAX) throw new ShareImageBusy('too many share images are being drawn');
            await new Promise<void>((resolve) => ogWaiting.push(resolve));
        }
        ogRunning++;
        try {
            const bytes = new Uint8Array(await draw());
            ogImages.set(key, bytes);
            if (ogImages.size > OG_CACHE_MAX) ogImages.delete(ogImages.keys().next().value ?? key);
            return bytes;
        } finally {
            ogRunning--;
            ogWaiting.shift()?.();
        }
    })();
    ogDrawing.set(key, promise);
    void promise.finally(() => ogDrawing.delete(key)).catch(() => undefined);
    return promise;
};

/**
 * The measured packages the sitemap lists, read from the API at most every ten minutes: the index and every file are
 * cut from one list, so a crawler walking them costs one request, and a file past the last one is refused without any.
 */
const measured = ttlCache<PackagesResponse['packages']>({ ttlMs: 10 * 60_000, max: 1 });
const measuredPackages = (): Promise<PackagesResponse['packages']> => measured.get('packages', fetchMeasuredPackages);

/** A file past the last one is not an empty sitemap: it does not exist, and will not for a while. */
const NO_SITEMAP_CACHE = 'public, max-age=300';

/** A badge is fetched each time a README is read, mostly through one proxy: what it says is asked of the API at most every few minutes. */
const badges = ttlCache<Badge>({ ttlMs: 5 * 60_000, max: 1000 });

const png = (bytes: Uint8Array<ArrayBuffer>, cache: string): Response => new Response(bytes, { headers: { 'content-type': 'image/png', 'cache-control': cache } });

const siteCard = (cache: string): Response => new Response(null, { status: 302, headers: { location: canonicalUrl('/og/default.png'), 'cache-control': cache } });

/** The documents at a fixed address. None of them can cause a package to be downloaded. */
const DOCUMENTS: Readonly<Record<string, () => Response | Promise<Response>>> = {
    '/robots.txt': () => text(robotsTxt(ALLOW_INDEXING), 'text/plain; charset=utf-8'),
    '/llms.txt': () => text(llmsTxt(), 'text/plain; charset=utf-8'),
    '/.well-known/security.txt': () => text(securityTxt(new Date()), 'text/plain; charset=utf-8', 'public, max-age=86400'),
    '/.well-known/api-catalog': () => text(apiCatalog(), API_CATALOG_TYPE),
    // Read by agents and registries from other origins, so any page may fetch it.
    '/.well-known/ai-catalog.json': () => text(aiCatalog(), 'application/json; charset=utf-8', DOCUMENT_CACHE, 200, { 'access-control-allow-origin': '*' }),
    '/sitemap.xml': async () => text(sitemapIndex((await measuredPackages()).length), 'application/xml; charset=utf-8'),
    '/sitemaps/pages.xml': () => text(pagesSitemap(), 'application/xml; charset=utf-8'),
    '/og/default.png': async () => png(await shareImage('default', renderDefaultOgImage), 'public, max-age=86400, s-maxage=604800'),
};

const OG_PACKAGE = /^\/og\/package\/(.+)\.png$/;
const BADGE = /^\/badge\/(.+)\.svg$/;

/** One file of the package sitemap, by its number in the address. */
const packageSitemapResponse = async (page: number): Promise<Response> => {
    const packages = await measuredPackages();
    if (page > packageSitemapCount(packages.length)) return text('Not found', 'text/plain; charset=utf-8', NO_SITEMAP_CACHE, 404);
    return text(packageSitemap(packages, page), 'application/xml; charset=utf-8');
};

/** A path segment as typed; an encoding that does not decode is no package name, which `parseSpec` then says. */
const decoded = (segment: string): string => {
    try {
        return decodeURIComponent(segment);
    } catch {
        return '';
    }
};

/** A package's share image, from what has been measured. A broken preview must never break a share: anything else gets the site's card. */
const packageOgImage = async (spec: string): Promise<Response> => {
    if (parseSpec(spec) === undefined) return notFound();
    if (!ogLimiter.take(visitorIp() ?? 'unknown')) return siteCard('public, max-age=60');
    try {
        const analysis = await fetchKnownAnalysis(spec);
        if (analysis?.status !== 'done') return siteCard('public, max-age=300');
        const key = `${analysis.package.name}@${analysis.package.version}:${analysis.analyzerVersion}`;
        return png(await shareImage(key, () => renderPackageOgImage(analysis.package, analysis.result)), 'public, max-age=86400, s-maxage=86400');
    } catch (error) {
        if (!(error instanceof ShareImageBusy)) console.error('share image failed', error);
        return siteCard('public, max-age=300');
    }
};

/** A package's README badge, from what has been measured, so showing one never causes a download. A broken API still draws a badge, not a broken image. */
const packageBadgeResponse = async (spec: string): Promise<Response> => {
    if (parseSpec(spec) === undefined) return notFound();
    const badge = await badges
        .get(spec, async () => packageBadge(await fetchKnownAnalysis(spec)))
        .catch((error: unknown) => {
            console.error('badge failed', error);
            return packageBadge(undefined, true);
        });
    return text(badge.svg, 'image/svg+xml; charset=utf-8', badge.cache);
};

/** A package as Markdown: its `.md` twin, or its page asked for with `Accept: text/markdown`. Only what has been measured. */
const packageMarkdownResponse = async (spec: string, twin: boolean): Promise<Response> => {
    const markdown = (body: string, status: number, extra: Record<string, string> = {}) =>
        text(body, 'text/markdown; charset=utf-8', status !== 200 ? 'no-store' : twin ? 'public, max-age=300, s-maxage=900' : NEGOTIATED_CACHE, status, {
            'x-markdown-tokens': String(markdownTokens(body)),
            vary: 'Accept',
            ...extra,
        });
    const analysis = await fetchKnownAnalysis(spec);
    if (analysis === undefined) return markdown(notMeasuredMarkdown(spec), 404);
    return markdown(packageMarkdown(analysis), 200, { link: `<${canonicalUrl(`/package/${analysis.package.name}`)}>; rel="canonical"` });
};

/** What the server answers itself, before the router. Undefined for anything else (a page). */
const documentResponse = (request: Request, pathname: string): Promise<Response> | Response | undefined => {
    const document = DOCUMENTS[pathname];
    if (document !== undefined) return document();
    const sitemapPage = packageSitemapPage(pathname);
    if (sitemapPage !== undefined) return packageSitemapResponse(sitemapPage);
    const og = OG_PACKAGE.exec(pathname)?.[1];
    if (og !== undefined) return packageOgImage(decoded(og));
    const badge = BADGE.exec(pathname)?.[1];
    if (badge !== undefined) return packageBadgeResponse(decoded(badge));
    const accept = request.headers.get('accept');
    const pkg = packagePathSpec(pathname);
    if (pkg !== undefined && (pkg.twin || wantsMarkdown(accept))) return packageMarkdownResponse(pkg.spec, pkg.twin);
    // The site's own pages as Markdown: what `llms.txt` says of the whole site, which is what they are about.
    if (STATIC_PAGES.includes(pathname) && wantsMarkdown(accept)) {
        const body = llmsTxt();
        return text(body, 'text/markdown; charset=utf-8', NEGOTIATED_CACHE, 200, {
            'x-markdown-tokens': String(markdownTokens(body)),
            vary: 'Accept',
            link: `<${canonicalUrl(pathname)}>; rel="canonical"`,
        });
    }
    return undefined;
};

/**
 * The router answers 406 to an `Accept` without HTML (an agent asking for JSON or Markdown), so a page is always
 * rendered as HTML: agents get Markdown above where there is one, and an address with no page its 404 page.
 */
const asHtmlRequest = (request: Request): Request => {
    const accept = request.headers.get('accept');
    if (accept === null || (!wantsMarkdown(accept) && /text\/html|text\/\*|\*\/\*/i.test(accept))) return request;
    const headers = new Headers(request.headers);
    headers.set('accept', 'text/html');
    // Built from the URL, not wrapped: the server's own request object is not one `new Request` can copy. Reads only, so no body.
    return new Request(request.url, { method: request.method, headers });
};

const respond = async (request: Request): Promise<Response> => {
    const { pathname } = new URL(request.url);
    const isRead = request.method === 'GET' || request.method === 'HEAD';
    let document: Response | undefined;
    if (isRead) {
        try {
            document = await documentResponse(request, pathname);
        } catch (error) {
            console.error('document failed', error);
            document = text('The service is busy; try again in a moment.', 'text/plain; charset=utf-8', 'no-store', 503, { 'retry-after': '30' });
        }
    }
    // Marks the router's own inline scripts for this response only: the policy allows the scripts that carry it (and
    // no others), so a script that got into the page any other way is blocked. Never sent in a header.
    const nonce = randomBytes(18).toString('base64');
    const response = document ?? (await handler.fetch(isRead ? asHtmlRequest(request) : request, { context: { nonce } }));
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) headers.set(name, value);
    // Nothing on a non-production environment belongs in a search index, and neither does an error page.
    if (!ALLOW_INDEXING) headers.set('X-Robots-Tag', 'noindex, nofollow');
    else if (response.status >= 400) headers.set('X-Robots-Tag', 'noindex');
    const acceptEncoding = request.headers.get('accept-encoding');
    if (response.headers.get('content-type')?.startsWith('text/html') !== true) {
        // Not a page, so no inline script to allow: the policy without hashes, which still says where anything may load from.
        if (import.meta.env.PROD) headers.set('Content-Security-Policy', contentSecurityPolicy(API_URL));
        return compressed(new Response(response.body, { status: response.status, statusText: response.statusText, headers }), acceptEncoding);
    }
    // Hashed and sent as one text: the same bytes reach every browser and the policy.
    const html = escapeScriptNuls(await response.text());
    const policy = documentPolicy(API_URL, html, import.meta.env.PROD, nonce);
    if (policy !== undefined) headers.set('Content-Security-Policy', policy);
    if (!headers.has('Cache-Control')) headers.set('Cache-Control', pageCacheControl(response.status));
    // The same address answers Markdown to agents (package pages), so a shared cache must keep the two apart.
    headers.append('Vary', 'Accept');
    headers.append('Link', `<${canonicalUrl('/llms.txt')}>; rel="describedby"; type="text/plain"`);
    headers.append('Link', `<${canonicalUrl('/.well-known/api-catalog')}>; rel="api-catalog"`);
    const pkg = packagePathSpec(pathname);
    if (pkg !== undefined && !pkg.twin) headers.append('Link', `<${canonicalUrl(`/package/${pkg.spec}.md`)}>; rel="alternate"; type="text/markdown"`);
    // Rendered here, past Nitro's compression of static files.
    return compressed(new Response(html, { status: response.status, statusText: response.statusText, headers }), acceptEncoding);
};

/**
 * The server entry: documents and share images first, then pages. Every response goes out with the security headers
 * and, in production, a Content-Security-Policy; an HTML page's names the hashes of its inline scripts (so the whole
 * body is read) and comes with a cache policy a CDN can use, `Vary: Accept` and a `Link` to `llms.txt` for agents.
 * Pages and Markdown are compressed here, past Nitro's compression of static files. Each runs knowing whom it is for,
 * so that what it asks the API counts against that visitor.
 */
export default {
    fetch: (request: Request) => visitors.run({ ip: requestIp(request, CLIENT_IP_HEADER) }, () => respond(request)),
};

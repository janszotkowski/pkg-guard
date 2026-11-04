import { randomBytes } from 'node:crypto';
import handler from '@tanstack/react-start/server-entry';
import { API_URL } from '@config/api';
import { ALLOW_INDEXING, canonicalUrl } from '@config/site';
import { fetchKnownAnalysis, fetchMeasuredPackages } from '@lib/api';
import { aiCatalog } from '@lib/documents/discovery';
import { llmsTxt } from '@lib/documents/llms';
import { markdownTokens, notMeasuredMarkdown, packageMarkdown, packagePathSpec, wantsMarkdown } from '@lib/documents/markdown';
import { robotsTxt } from '@lib/documents/robots';
import { securityTxt } from '@lib/documents/securityTxt';
import { STATIC_PAGES, sitemapXml } from '@lib/documents/sitemap';
import { renderDefaultOgImage, renderPackageOgImage } from '@lib/ogImage';
import { documentPolicy, escapeScriptNuls, pageCacheControl, securityHeaders } from '@lib/securityHeaders';

const SECURITY_HEADERS = securityHeaders();

/** Documents for crawlers change slowly: a CDN may keep them for an hour. */
const DOCUMENT_CACHE = 'public, max-age=3600, s-maxage=3600';

/** Markdown at a page's own address: kept by the agent that asked, never by a shared cache, which would serve it to browsers as the page. */
const NEGOTIATED_CACHE = 'private, max-age=300';

const text = (body: string, contentType: string, cache = DOCUMENT_CACHE, status = 200, extra: Record<string, string> = {}): Response =>
    new Response(body, { status, headers: { 'content-type': contentType, 'cache-control': cache, ...extra } });

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

const png = (bytes: Uint8Array<ArrayBuffer>, cache: string): Response => new Response(bytes, { headers: { 'content-type': 'image/png', 'cache-control': cache } });

const siteCard = (cache: string): Response => new Response(null, { status: 302, headers: { location: canonicalUrl('/og/default.png'), 'cache-control': cache } });

/** The documents at a fixed address. None of them can cause a package to be downloaded. */
const DOCUMENTS: Readonly<Record<string, () => Response | Promise<Response>>> = {
    '/robots.txt': () => text(robotsTxt(ALLOW_INDEXING), 'text/plain; charset=utf-8'),
    '/llms.txt': () => text(llmsTxt(), 'text/plain; charset=utf-8'),
    '/.well-known/security.txt': () => text(securityTxt(new Date()), 'text/plain; charset=utf-8', 'public, max-age=86400'),
    // Read by agents and registries from other origins, so any page may fetch it.
    '/.well-known/ai-catalog.json': () => text(aiCatalog(), 'application/json; charset=utf-8', DOCUMENT_CACHE, 200, { 'access-control-allow-origin': '*' }),
    '/sitemap.xml': async () => text(sitemapXml(await fetchMeasuredPackages()), 'application/xml; charset=utf-8'),
    '/og/default.png': async () => png(await shareImage('default', renderDefaultOgImage), 'public, max-age=86400, s-maxage=604800'),
};

const OG_PACKAGE = /^\/og\/package\/(.+)\.png$/;

/** A package's share image, from what has been measured. A broken preview must never break a share: anything else gets the site's card. */
const packageOgImage = async (spec: string): Promise<Response> => {
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
    const og = OG_PACKAGE.exec(pathname)?.[1];
    if (og !== undefined) return packageOgImage(decodeURIComponent(og));
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
    if (response.headers.get('content-type')?.startsWith('text/html') !== true) {
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    }
    // Hashed and sent as one text: the same bytes reach every browser and the policy.
    const html = escapeScriptNuls(await response.text());
    const policy = documentPolicy(API_URL, html, import.meta.env.PROD, nonce);
    if (policy !== undefined) headers.set('Content-Security-Policy', policy);
    if (!headers.has('Cache-Control')) headers.set('Cache-Control', pageCacheControl(response.status));
    // The same address answers Markdown to agents (package pages), so a shared cache must keep the two apart.
    headers.append('Vary', 'Accept');
    headers.append('Link', `<${canonicalUrl('/llms.txt')}>; rel="describedby"; type="text/plain"`);
    const pkg = packagePathSpec(pathname);
    if (pkg !== undefined && !pkg.twin) headers.append('Link', `<${canonicalUrl(`/package/${pkg.spec}.md`)}>; rel="alternate"; type="text/markdown"`);
    return new Response(html, { status: response.status, statusText: response.statusText, headers });
};

/**
 * The server entry: documents and share images first, then pages. Every response goes out with the security headers;
 * an HTML page also with its own Content-Security-Policy (from the hashes of its inline scripts, so the whole body is
 * read), a cache policy a CDN can use, `Vary: Accept` and a `Link` to `llms.txt` for agents.
 */
export default {
    fetch: (request: Request) => respond(request),
};

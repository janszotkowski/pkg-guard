import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { compressed, encodingFor } from '@lib/compression';

const html = `<!doctype html><html><body>${'<p>A page long enough to be worth compressing.</p>'.repeat(60)}</body></html>`;
const page = (body = html, type = 'text/html; charset=utf-8') => new Response(body, { status: 200, headers: { 'content-type': type, vary: 'Accept' } });

describe('encodingFor', () => {
    it('prefers brotli, falls back to gzip, and respects a refusal', () => {
        expect(encodingFor('gzip, deflate, br, zstd')).toBe('br');
        expect(encodingFor('gzip')).toBe('gzip');
        expect(encodingFor('br;q=0, gzip;q=0.5')).toBe('gzip');
        expect(encodingFor('*')).toBe('gzip');
        expect(encodingFor('identity')).toBeUndefined();
        expect(encodingFor(null)).toBeUndefined();
    });
});

describe('compressed', () => {
    it('compresses an HTML page with brotli or gzip, and the body survives the round trip', async () => {
        const br = await compressed(page(), 'gzip, br');
        expect(br.headers.get('content-encoding')).toBe('br');
        expect(br.headers.get('vary')).toBe('Accept, Accept-Encoding');
        const packed = new Uint8Array(await br.arrayBuffer());
        expect(packed.byteLength).toBeLessThan(html.length / 5);
        expect(Number(br.headers.get('content-length'))).toBe(packed.byteLength);
        expect(brotliDecompressSync(packed).toString()).toBe(html);
        const gzip = await compressed(page(), 'gzip');
        expect(gunzipSync(new Uint8Array(await gzip.arrayBuffer())).toString()).toBe(html);
    });

    it('leaves alone what is not a page, a small body, or a client that takes no encoding', async () => {
        const image = await compressed(page('png', 'image/png'), 'br');
        expect(image.headers.get('content-encoding')).toBeNull();
        expect((await compressed(page('<p>tiny</p>'), 'br')).headers.get('content-encoding')).toBeNull();
        const plain = await compressed(page(), null);
        expect(plain.headers.get('content-encoding')).toBeNull();
        expect(plain.headers.get('vary')).toContain('Accept-Encoding');
        expect(await plain.text()).toBe(html);
        expect((await compressed(page(html, 'text/markdown; charset=utf-8'), 'gzip')).headers.get('content-encoding')).toBe('gzip');
    });
});

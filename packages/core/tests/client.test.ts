import { describe, expect, it } from 'vitest';
import { ApiError, analysisPath, answerOf } from '@src/client/api.ts';
import { packageRefSchema } from '@src/contract/analysis.ts';
import { formatSizeText } from '@src/format.ts';

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status });

describe('answerOf', () => {
    it('reads an answer through the contract', async () => {
        await expect(answerOf(json({ name: 'react', version: '1.0.0' }), packageRefSchema)).resolves.toEqual({ name: 'react', version: '1.0.0' });
        await expect(answerOf(json({ name: 'react' }), packageRefSchema)).rejects.toThrow();
    });

    it("turns the API's error into an ApiError with its code", async () => {
        const failure = await answerOf(json({ error: { code: 'NOT_FOUND', message: 'Not on npm' } }, 404), packageRefSchema).catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(ApiError);
        expect(failure).toMatchObject({ code: 'NOT_FOUND', message: 'Not on npm' });
    });

    it('says what little the status says when the error is not the API own', async () => {
        await expect(answerOf(new Response('<html>Bad gateway</html>', { status: 502 }), packageRefSchema)).rejects.toMatchObject({ code: 'INTERNAL', message: 'The API answered 502' });
    });
});

describe('analysisPath', () => {
    it('encodes the spec, and asks for known answers only when told to', () => {
        expect(analysisPath('@scope/name@1.0.0')).toMatch(/^\/v1\/analyses\?package=%40scope%2Fname%401\.0\.0&analyzer=\d+$/);
        expect(analysisPath('react', true)).toMatch(/^\/v1\/analyses\?package=react&known=1&analyzer=\d+$/);
    });
});

describe('formatSizeText', () => {
    it.each([
        [999, '999 B'],
        [2900, '2.9 kB'],
        [1_250_000, '1.25 MB'],
    ])('writes %d bytes as %s', (bytes, text) => {
        expect(formatSizeText(bytes)).toBe(text);
    });
});

import { describe, expect, it, vi } from 'vitest';
import { ApiError, analysisPath, createApiClient } from '@src/client/api.ts';
import { formatSizeText } from '@src/format.ts';

const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status });

const clientAnswering = (answer: Response) => {
    const fetchStub = vi.fn<typeof fetch>(() => Promise.resolve(answer));
    return { fetchStub, client: createApiClient({ baseUrl: 'https://api.example.org/', fetch: fetchStub, headers: { 'x-internal-token': 'secret' } }) };
};

describe('createApiClient', () => {
    it('asks at the base address, with the headers it was given, and reads the answer through the contract', async () => {
        const { client, fetchStub } = clientAnswering(json({ name: 'react', versions: [] }));
        await expect(client.history('@scope/name')).resolves.toEqual({ name: 'react', versions: [] });
        const [url, init] = fetchStub.mock.calls[0] ?? [];
        expect(url).toBe('https://api.example.org/v1/history?package=%40scope%2Fname');
        expect(init?.method).toBe('GET');
        expect(init?.headers).toMatchObject({ 'x-internal-token': 'secret' });
    });

    it('queues the versions of a history with a POST', async () => {
        const { client, fetchStub } = clientAnswering(json({ name: 'react', versions: [] }));
        await client.measureHistory('react');
        expect(fetchStub.mock.calls[0]?.[1]?.method).toBe('POST');
    });

    it("turns the API's error into an ApiError with its code", async () => {
        const { client } = clientAnswering(json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } }, 429));
        const failure = await client.search('react').catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(ApiError);
        expect(failure).toMatchObject({ code: 'RATE_LIMITED', message: 'Too many requests' });
    });

    it('says what little the status says when the error is not the API own', async () => {
        const { client } = clientAnswering(new Response('<html>Bad gateway</html>', { status: 502 }));
        await expect(client.packages()).rejects.toMatchObject({ code: 'INTERNAL', message: 'The API answered 502' });
    });

    it('refuses an answer that does not match the contract', async () => {
        const { client } = clientAnswering(json({ name: 'react' }));
        await expect(client.history('react')).rejects.toMatchObject({ code: 'INTERNAL' });
    });

    it('answers undefined for a package not measured, and only for that', async () => {
        const missing = clientAnswering(json({ error: { code: 'NOT_FOUND', message: 'Not measured' } }, 404));
        await expect(missing.client.knownAnalysis('react')).resolves.toBeUndefined();
        expect(String(missing.fetchStub.mock.calls[0]?.[0])).toContain('known=1');
        const down = clientAnswering(json({ error: { code: 'UNAVAILABLE', message: 'Busy' } }, 503));
        await expect(down.client.knownAnalysis('react')).rejects.toMatchObject({ code: 'UNAVAILABLE' });
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

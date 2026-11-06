import { ANALYZER_VERSION } from '@weighme/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchAnalysis } from '@lib/api';

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('fetchAnalysis', () => {
    it('names the analyzer version, so an answer measured the old way is never reused', async () => {
        const fetchMock = vi.fn(async () => Response.json({ package: { name: 'x', version: '1.0.0' }, analyzerVersion: ANALYZER_VERSION, status: 'queued' }));
        vi.stubGlobal('fetch', fetchMock);
        await fetchAnalysis('@scope/x@1.0.0');
        expect(String(fetchMock.mock.calls[0]?.at(0))).toContain(`/v1/analyses?package=%40scope%2Fx%401.0.0&analyzer=${ANALYZER_VERSION}`);
    });
});

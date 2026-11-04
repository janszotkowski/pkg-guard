import { describe, expect, it } from 'vitest';
import { parseSearch } from '@modules/analyses/infrastructure/registry.ts';

describe('parseSearch', () => {
    it('keeps the order and what the page shows', () => {
        const answer = {
            objects: [{ package: { name: 'next', version: '16.4.5', description: 'The React Framework' }, downloads: { weekly: 89 } }, { package: { name: '@next/env', version: '16.4.5' } }],
        };
        expect(parseSearch(answer)).toEqual([
            { name: 'next', version: '16.4.5', description: 'The React Framework', weeklyDownloads: 89 },
            { name: '@next/env', version: '16.4.5', description: null, weeklyDownloads: null },
        ]);
    });

    it('leaves out what could not be looked up', () => {
        const answer = {
            objects: [
                { package: { name: '../evil', version: '1.0.0' } },
                { package: { name: 'ok', version: 'not a version' } },
                { package: { version: '1.0.0' } },
                {},
                'text',
                { package: { name: 'good', version: '1.0.0' } },
            ],
        };
        expect(parseSearch(answer).map((suggestion) => suggestion.name)).toEqual(['good']);
    });

    it('caps a long description', () => {
        const [first] = parseSearch({ objects: [{ package: { name: 'x', version: '1.0.0', description: 'a'.repeat(500) } }] });
        expect(first?.description?.length).toBeLessThanOrEqual(160);
    });

    it('finds nothing in an unexpected answer', () => {
        expect(parseSearch(null)).toEqual([]);
        expect(parseSearch({ objects: 'no' })).toEqual([]);
    });
});

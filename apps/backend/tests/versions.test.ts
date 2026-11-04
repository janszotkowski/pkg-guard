import { describe, expect, it } from 'vitest';
import { selectVersions } from '@modules/analyses/application/versions.ts';

const noDates = (): undefined => undefined;

/** Many minors, so that no patches are added to fill the list. */
const manyMinors = Array.from({ length: 12 }, (_, minor) => `1.${minor}.0`);

describe('selectVersions', () => {
    it('takes latest and the first release of each minor', () => {
        const picked = selectVersions([...manyMinors, '1.11.1', '1.11.2', '1.10.5'], '1.11.2', noDates);
        expect(picked.slice(0, 3)).toEqual(['1.11.2', '1.11.0', '1.10.0']);
    });

    it('does not stack the patches of every line on one date', () => {
        const dates: Record<string, string> = { '3.0.0': '2024-01-01', '3.0.5': '2026-10-01', '3.1.0': '2025-01-01', '3.1.5': '2026-10-01', '3.2.0': '2026-01-01', '3.2.5': '2026-10-01' };
        const versions = Object.keys(dates);
        const filler = Array.from({ length: 10 }, (_, minor) => `2.${minor}.0`);
        const picked = selectVersions([...versions, ...filler], '3.2.5', (version) => dates[version]);
        expect(picked.slice(0, 4)).toEqual(['3.2.5', '3.2.0', '3.1.0', '3.0.0']);
    });

    it('leaves out a backport released after what came next', () => {
        const dates: Record<string, string> = { '2.0.0': '2025-01-01', '1.9.0': '2026-06-01', '1.8.0': '2024-01-01' };
        expect(selectVersions(Object.keys(dates), '2.0.0', (version) => dates[version])).toEqual(['2.0.0', '1.8.0']);
    });

    it('compares numbers as numbers', () => {
        expect(selectVersions(['1.9.0', '1.10.0'], '1.10.0', noDates)).toEqual(['1.10.0', '1.9.0']);
    });

    it('leaves out prereleases and anything newer than latest', () => {
        expect(selectVersions(['1.0.0', '2.0.0-beta.1', '3.0.0', '1.0.0+build'], '1.0.0', noDates)).toEqual(['1.0.0']);
    });

    it('fills a short list with patches', () => {
        expect(selectVersions(['1.0.0', '1.0.1', '1.0.2'], '1.0.2', noDates)).toEqual(['1.0.2', '1.0.1', '1.0.0']);
    });

    it('stops at ten', () => {
        const versions = Array.from({ length: 30 }, (_, minor) => `1.${minor}.0`);
        const picked = selectVersions(versions, '1.29.0', noDates);
        expect(picked).toHaveLength(10);
        expect(picked[0]).toBe('1.29.0');
    });

    it('finds nothing without a stable latest', () => {
        expect(selectVersions(['1.0.0'], '2.0.0-rc.1', noDates)).toEqual([]);
    });
});

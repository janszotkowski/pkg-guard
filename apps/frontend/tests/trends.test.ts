import { describe, expect, it } from 'vitest';
import { groupDownloads, monthTicks, parsePackages, repositoryOf, trendsView, validateTrendsSearch, weeklyDownloads } from '@lib/trends';

const days = (start: string, count: number, downloads = 1) =>
    Array.from({ length: count }, (_, index) => ({ day: new Date(Date.parse(start) + index * 86_400_000).toISOString().slice(0, 10), downloads }));

describe('parsePackages', () => {
    it('reads names once, drops versions and what is not a package', () => {
        expect(parsePackages('react,@scope/x@1.0.0,react,../evil')).toEqual(['react', '@scope/x']);
    });

    it('stops at the limit', () => {
        expect(parsePackages('a,b,c,d,e')).toHaveLength(4);
    });
});

describe('the address', () => {
    it('keeps defaults out of it', () => {
        expect(validateTrendsSearch({ packages: 'react', metric: 'size', range: '1y', group: 'week' })).toEqual({ packages: 'react' });
    });

    it('drops what it does not know', () => {
        expect(validateTrendsSearch({ metric: 'stars', range: 'forever', group: 1 })).toEqual({});
    });

    it('fills in the defaults for the page', () => {
        expect(trendsView({})).toEqual({ packages: ['react', 'vue'], metric: 'size', range: '1y', group: 'week' });
    });

    it('keeps an empty list apart from no list', () => {
        expect(validateTrendsSearch({ packages: '' })).toEqual({ packages: '' });
        expect(trendsView({ packages: '' }).packages).toEqual([]);
    });
});

describe('groupDownloads', () => {
    it('leaves out today, which has barely been counted', () => {
        expect(groupDownloads(days('2026-11-01', 4), 'day', '2026-11-04')).toHaveLength(3);
    });

    it('sums whole weeks and leaves out the partial ones', () => {
        // 2026-11-02 is a Monday: two days before it and three after two full weeks are partial.
        const points = groupDownloads(days('2026-10-31', 19), 'week', '2026-12-01');
        expect(points).toEqual([
            { time: Date.parse('2026-11-02'), value: 7 },
            { time: Date.parse('2026-11-09'), value: 7 },
        ]);
    });

    it('sums whole months and leaves out the partial ones', () => {
        const points = groupDownloads(days('2026-02-15', 45), 'month', '2026-12-01');
        expect(points).toEqual([{ time: Date.parse('2026-03-01'), value: 31 }]);
    });
});

describe('weeklyDownloads', () => {
    it('sums the last seven full days', () => {
        expect(weeklyDownloads(days('2026-11-01', 9, 2), '2026-11-09')).toBe(14);
    });

    it('says nothing with too few days', () => {
        expect(weeklyDownloads(days('2026-11-01', 3), '2026-11-04')).toBeUndefined();
    });
});

describe('repositoryOf', () => {
    it('finds the repository, even from a folder in it', () => {
        expect(repositoryOf('https://github.com/a/b/tree/HEAD/packages/c')).toBe('a/b');
        expect(repositoryOf(null)).toBeUndefined();
    });
});

describe('monthTicks', () => {
    it('thins out to what the width has room for', () => {
        const from = Date.parse('2023-11-05');
        const to = Date.parse('2026-11-04');
        // Each label takes 80 px: 36 months fit in 3000 px, every second one in 2000 px, and only a few in 400 px.
        expect(monthTicks(from, to, 3000).length).toBe(36);
        expect(monthTicks(from, to, 2000).length).toBe(18);
        expect(monthTicks(from, to, 400).length).toBeLessThanOrEqual(5);
    });
});

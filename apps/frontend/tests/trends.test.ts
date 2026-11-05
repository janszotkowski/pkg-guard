import { describe, expect, it } from 'vitest';
import { ApiError, pollInterval } from '@lib/api';
import {
    assignColors,
    groupDownloads,
    measuringText,
    monthTicks,
    packageState,
    parsePackages,
    repositoryOf,
    todayIso,
    trendsView,
    validateTrendsSearch,
    versionRows,
    weeklyDownloads,
} from '@lib/trends';

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

describe('versionRows', () => {
    it('plots the measured, dated versions oldest first and leaves the others out', () => {
        const rows = versionRows('react', [
            { version: '3.0.0', publishedAt: '2026-03-01T00:00:00.000Z', status: 'queued', gzip: null, minified: null },
            { version: '2.0.0', publishedAt: '2026-02-01T00:00:00.000Z', status: 'done', gzip: 20, minified: 40 },
            { version: '1.5.0', publishedAt: null, status: 'done', gzip: 15, minified: 30 },
            { version: '1.0.0', publishedAt: '2026-01-01T00:00:00.000Z', status: 'done', gzip: 10, minified: 20 },
        ]);
        expect(rows).toEqual([
            { name: 'react', time: Date.parse('2026-01-01T00:00:00.000Z'), value: 10, detail: '1.0.0' },
            { name: 'react', time: Date.parse('2026-02-01T00:00:00.000Z'), value: 20, detail: '2.0.0' },
        ]);
    });
});

describe('measuringText', () => {
    it('counts the versions still on their way, and says nothing once they all are measured', () => {
        expect(measuringText(0)).toBe('');
        expect(measuringText(1)).toBe('Measuring 1 more version…');
        expect(measuringText(3)).toBe('Measuring 3 more versions…');
    });
});

describe('todayIso', () => {
    it('is a day in UTC', () => {
        expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});

describe('assignColors', () => {
    const palette = ['one', 'two', 'three', 'four'];

    it('hands the colors out in order', () => {
        expect([...assignColors(['a', 'b', 'c'], new Map(), palette)]).toEqual([
            ['a', 'one'],
            ['b', 'two'],
            ['c', 'three'],
        ]);
    });

    it('keeps the colors of the packages that stay when one goes', () => {
        const before = assignColors(['a', 'b', 'c'], new Map(), palette);
        const after = assignColors(['a', 'c'], before, palette);
        expect([...after]).toEqual([
            ['a', 'one'],
            ['c', 'three'],
        ]);
    });

    it('gives a new package the first color nobody has', () => {
        const before = assignColors(
            ['a', 'c'],
            new Map([
                ['a', 'one'],
                ['c', 'three'],
            ]),
            palette,
        );
        expect(assignColors(['a', 'c', 'd'], before, palette).get('d')).toBe('two');
    });

    it('falls back to the first color once the palette is used up', () => {
        expect(assignColors(['a', 'b', 'c'], new Map(), ['one', 'two']).get('c')).toBe('one');
    });
});

describe('packageState', () => {
    it('says why there are no sizes, and nothing when there are', () => {
        expect(packageState(undefined, new ApiError('NOT_FOUND', 'no'))).toBe('Not on npm');
        expect(packageState(undefined, new Error('down'))).toBe('Could not be loaded');
        expect(packageState(undefined, undefined)).toBe('Measuring…');
    });
});

describe('pollInterval', () => {
    const query = (status: 'success' | 'error', dataUpdateCount: number, errorUpdateCount: number) => ({ state: { status, dataUpdateCount, errorUpdateCount } }) as const;

    it('asks again at the normal pace while the answers come, and not at all once there is nothing to wait for', () => {
        const polled = { state: { status: 'success' as const, dataUpdateCount: 1, errorUpdateCount: 0 } };
        expect(pollInterval(polled, 1000)).toBe(1000);
        expect(pollInterval(polled, false)).toBe(false);
    });

    it('slows down once a fetch has failed, stops after six failures in a row, and recovers with the next answer', () => {
        const polled = { state: { status: 'success' as const, dataUpdateCount: 1, errorUpdateCount: 0 } as (typeof query extends (...args: never[]) => infer R ? R : never)['state'] };
        expect(pollInterval(polled, 1000)).toBe(1000);
        for (let failures = 1; failures <= 5; failures++) {
            polled.state = { status: 'error', dataUpdateCount: 1, errorUpdateCount: failures };
            expect(pollInterval(polled, 1000), `${failures} failures`).toBe(5000);
        }
        polled.state = { status: 'error', dataUpdateCount: 1, errorUpdateCount: 6 };
        expect(pollInterval(polled, 1000)).toBe(false);
        polled.state = { status: 'success', dataUpdateCount: 2, errorUpdateCount: 6 };
        expect(pollInterval(polled, 1000)).toBe(1000);
    });

    it('counts the failures of each query on its own', () => {
        const one = query('error', 1, 3);
        const other = query('success', 1, 3);
        expect(pollInterval(one, 1000)).toBe(5000);
        expect(pollInterval(other, 1000)).toBe(1000);
    });
});

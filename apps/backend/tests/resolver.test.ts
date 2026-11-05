import { describe, expect, it, vi } from 'vitest';
import { cacheResolver } from '@modules/analyses/infrastructure/registry.ts';

describe('cacheResolver', () => {
    it('asks once within a minute, and again after it', async () => {
        let time = 0;
        const resolve = vi.fn(async () => '1.0.0');
        const cached = cacheResolver(resolve, () => time);
        await cached('x', 'latest');
        await cached('x', 'latest');
        expect(resolve).toHaveBeenCalledTimes(1);
        time = 60_000;
        await cached('x', 'latest');
        expect(resolve).toHaveBeenCalledTimes(2);
    });

    it('keeps each name and tag apart', async () => {
        const resolve = vi.fn(async (name: string, tag: string) => `${name}-${tag}`);
        const cached = cacheResolver(resolve);
        expect(await cached('x', 'latest')).toBe('x-latest');
        expect(await cached('x', 'next')).toBe('x-next');
        expect(await cached('y', 'latest')).toBe('y-latest');
    });

    it('does not keep a failure', async () => {
        const resolve = vi.fn<(name: string, tag: string) => Promise<string>>().mockRejectedValueOnce(new Error('no answer')).mockResolvedValueOnce('1.0.0');
        const cached = cacheResolver(resolve);
        await expect(cached('x', 'latest')).rejects.toThrow('no answer');
        expect(await cached('x', 'latest')).toBe('1.0.0');
    });
});

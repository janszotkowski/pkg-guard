import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * The design language is shared with sitehp and CVE Tracker, and sitehp's docs/project-design.md is its source: the
 * shape and the type scale below are its tables. This test holds src/styles/app.css to them, so the three sites cannot
 * drift apart one token at a time.
 */

const css = readFileSync('src/styles/app.css', 'utf8');

const theme = (): Map<string, string> => {
    const start = css.indexOf('@theme inline {');
    expect(start, 'the @theme block is missing from app.css').toBeGreaterThan(-1);
    const end = css.indexOf('\n}', start);
    const map = new Map<string, string>();
    for (const [, name, value] of css.slice(start, end).matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
        if (name !== undefined && value !== undefined) map.set(name, value.trim());
    }
    return map;
};

const vars = theme();

/** "xs chips · sm inputs · md buttons/rows · lg cards · xl sheets · 4xl pills" (project-design.md §5.1). */
const RADII = [
    ['--radius-xs', '8px'],
    ['--radius-sm', '12px'],
    ['--radius-md', '18px'],
    ['--radius-lg', '24px'],
    ['--radius-xl', '32px'],
    ['--radius-2xl', '40px'],
    ['--radius-3xl', '56px'],
    ['--radius-4xl', '999px'],
] as const;

describe('radii match the design document', () => {
    it.each(RADII)('%s is %s', (token, size) => {
        expect(vars.get(token), token).toBe(size);
    });
});

/** Utility, size, weight, leading, tracking (project-design.md §4.2). Tracking tightens as size grows. */
const TYPE_SCALE = [
    ['text-score', 'clamp(5rem, 22vw, 9rem)', '600', '0.95', '-0.04em'],
    ['text-display', 'clamp(2.25rem, 7vw, 4rem)', '600', '1.05', '-0.03em'],
    ['text-title-1', '2rem', '600', '1.15', '-0.02em'],
    ['text-title-2', '1.5rem', '600', '1.2', '-0.015em'],
    ['text-headline', '1.0625rem', '600', '1.35', '-0.005em'],
    ['text-callout', '0.9375rem', '400', '1.45', '0'],
    ['text-code', '0.8125rem', '400', '1.5', '0'],
    ['text-caption', '0.8125rem', '500', '1.35', '0.01em'],
    ['text-overline', '0.75rem', '600', '1.2', '0.06em'],
] as const;

describe('type scale matches the design document', () => {
    it('has a utility for every role and nothing else', () => {
        const utilities = [...vars.keys()].filter((name) => name.startsWith('--text-') && !name.includes('--', 2));
        expect(utilities.sort()).toEqual(TYPE_SCALE.map((row) => `--${row[0]}`).sort());
    });

    it.each(TYPE_SCALE)('%s has the documented size, weight, leading and tracking', (utility, size, weight, leading, tracking) => {
        const name = `--${utility}`;
        expect(vars.get(name), `${name} size`).toBe(size);
        expect(vars.get(`${name}--font-weight`), `${name} weight`).toBe(weight);
        expect(vars.get(`${name}--line-height`), `${name} leading`).toBe(leading);
        expect(vars.get(`${name}--letter-spacing`), `${name} tracking`).toBe(tracking === '0' ? undefined : tracking);
    });
});

describe('motion and type', () => {
    it('eases non-interactive changes with the standard curve', () => {
        expect(vars.get('--ease-standard')).toBe('cubic-bezier(0.2, 0, 0, 1)');
    });

    it('sets Inter Variable with a system fallback, and a system monospace for code', () => {
        expect(vars.get('--font-sans')).toMatch(/^'Inter Variable', ui-sans-serif, system-ui, sans-serif$/);
        expect(vars.get('--font-mono')).toMatch(/^ui-monospace/);
    });

    it('keeps the body at one rem with a leading of one and a half', () => {
        expect(css).toMatch(/body \{[^}]*font-size: 1rem;[^}]*line-height: 1\.5;/);
    });
});

describe('what the stylesheet no longer carries', () => {
    it.each(['vibrancy', 'scroll-edge-top', 'loading-veil', 'delayed-hint'])('has no %s, which nothing used', (name) => {
        expect(css).not.toContain(name);
    });

    it('has the glow of the main action', () => {
        expect(css).toContain('@utility cta-glow');
    });
});

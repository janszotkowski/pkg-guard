import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Accessibility guard for the palette: every pairing the UI really draws must keep its WCAG 2.2 contrast ratio in
 * both themes (4.5 : 1 for text, 3 : 1 for the edge of a control, the focus ring and the marks of a chart). Read from
 * `app.css`, so a changed token that breaks a pairing fails here before it ships. The European Accessibility Act points
 * to EN 301 549, which requires these ratios (WCAG 1.4.3 and 1.4.11).
 */

const css = readFileSync('src/styles/app.css', 'utf8');

const block = (selector: string): Map<string, string> => {
    const start = css.indexOf(`\n${selector} {`);
    expect(start, `block ${selector} is missing from app.css`).toBeGreaterThan(-1);
    const end = css.indexOf('\n}', start);
    const map = new Map<string, string>();
    for (const [, name, value] of css.slice(start, end).matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
        if (name !== undefined && value !== undefined) map.set(name, value.trim());
    }
    return map;
};

type Rgb = { r: number; g: number; b: number };

const parse = (value: string): { color: Rgb; alpha: number } => {
    const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value);
    if (hex?.[1] !== undefined) {
        // `#000` is `#000000`: each digit doubled.
        const n = Number.parseInt(hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join('') : hex[1], 16);
        return { color: { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }, alpha: 1 };
    }
    const fn = /^rgb\((\d+)\s+(\d+)\s+(\d+)(?:\s*\/\s*(\d+(?:\.\d+)?)%)?\)$/.exec(value);
    if (fn?.[1] !== undefined && fn[2] !== undefined && fn[3] !== undefined) {
        return { color: { r: Number(fn[1]), g: Number(fn[2]), b: Number(fn[3]) }, alpha: fn[4] === undefined ? 1 : Number(fn[4]) / 100 };
    }
    throw new Error(`cannot read the color "${value}"`);
};

/** `top` painted at `alpha` over `bottom`. */
const over = (top: Rgb, alpha: number, bottom: Rgb): Rgb => ({
    r: top.r * alpha + bottom.r * (1 - alpha),
    g: top.g * alpha + bottom.g * (1 - alpha),
    b: top.b * alpha + bottom.b * (1 - alpha),
});

const channel = (value: number): number => {
    const s = value / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const luminance = (c: Rgb): number => 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);

const ratio = (a: Rgb, b: Rgb): number => {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
};

const themes = { light: block(':root'), dark: block('.dark') } as const;

const solid = (theme: Map<string, string>, token: string): Rgb => {
    const value = theme.get(`--${token}`);
    if (value === undefined) throw new Error(`--${token} is missing`);
    return parse(value).color;
};

const SURFACES = ['background', 'card', 'secondary'] as const;
const TEXT = ['foreground', 'muted-foreground', 'subtle-foreground', 'link', 'destructive', 'warning'] as const;
/** What is drawn, not read: the lines, dots and legend swatches of the charts, and the rule of a notice. */
const MARKS = ['bar', 'series-1', 'series-2', 'series-3', 'series-4', 'ring', 'destructive', 'warning'] as const;

describe.each(Object.entries(themes))('contrast in the %s theme', (_name, theme) => {
    for (const surface of SURFACES) {
        it.each(TEXT)(`${surface}: %s text reaches 4.5 : 1`, (token) => {
            expect(ratio(solid(theme, token), solid(theme, surface))).toBeGreaterThanOrEqual(4.5);
        });
    }

    it('keeps the inverted primary action readable', () => {
        expect(ratio(solid(theme, 'primary-foreground'), solid(theme, 'primary'))).toBeGreaterThanOrEqual(4.5);
    });

    it('keeps the chosen option of a segmented control readable on its card', () => {
        expect(ratio(solid(theme, 'foreground'), solid(theme, 'card'))).toBeGreaterThanOrEqual(4.5);
    });

    for (const surface of SURFACES) {
        it(`${surface}: the focus ring reaches 3 : 1`, () => {
            expect(ratio(solid(theme, 'ring'), solid(theme, surface))).toBeGreaterThanOrEqual(3);
        });
    }

    it.each(MARKS)('%s is a mark the page can carry: 3 : 1 against the page and a card', (token) => {
        for (const surface of ['background', 'card'] as const) expect(ratio(solid(theme, token), solid(theme, surface)), surface).toBeGreaterThanOrEqual(3);
    });

    // The page's glow is the accent at `--glow-strength` over the page, strongest at the top. Text scrolls through that
    // spot, so every text color is checked on the peak of the glow.
    const glowStrength = Number.parseFloat(theme.get('--glow-strength') ?? 'NaN') / 100;

    it('keeps every text readable on the peak of the glow', () => {
        expect(glowStrength).toBeGreaterThan(0);
        const glow = over(solid(theme, 'glow-color'), glowStrength, solid(theme, 'background'));
        for (const token of TEXT) expect(ratio(solid(theme, token), glow), token).toBeGreaterThanOrEqual(4.5);
    });

    // `glass-heavy` (the header) is the page background at 78 % over what lies beneath: the page at the glow's peak or a
    // surface. The blur is not modelled, so a solid control passing under the header for a moment is not covered.
    const GLASS_HEAVY = Number(/@utility glass-heavy \{\s*background: color-mix\(in oklch, var\(--background\) (\d+)%/.exec(css)?.[1]) / 100;

    it('keeps every text readable on heavy glass over the glow and over each surface', () => {
        expect(GLASS_HEAVY).toBeGreaterThan(0);
        const beneath = [over(solid(theme, 'glow-color'), glowStrength, solid(theme, 'background')), ...SURFACES.map((surface) => solid(theme, surface))];
        for (const backdrop of beneath) {
            const glass = over(solid(theme, 'background'), GLASS_HEAVY, backdrop);
            for (const token of TEXT) expect(ratio(solid(theme, token), glass), token).toBeGreaterThanOrEqual(4.5);
        }
    });

    it.each(['background', 'card'] as const)('%s: the edge of a form control reaches 3 : 1', (surface) => {
        const edge = parse(theme.get('--input') ?? '');
        expect(edge.alpha, 'the control edge must be opaque, so its contrast does not depend on what is behind it').toBe(1);
        expect(ratio(edge.color, solid(theme, surface))).toBeGreaterThanOrEqual(3);
    });
});

import type { PackagesResponse } from '@pkg-guard/core';
import { canonicalUrl } from '@config/site';

/** The pages of the site itself, beside the package pages. */
export const STATIC_PAGES: readonly string[] = ['/', '/trends'];

export const escapeXml = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

/**
 * `/sitemap.xml`: the site's pages and every package with a finished measurement, by the date of that measurement. Only
 * what can be indexed: a package still waiting, or a page of one version, is not.
 */
export const sitemapXml = (packages: PackagesResponse['packages']): string => {
    const entries = [
        ...STATIC_PAGES.map((path) => `  <url><loc>${escapeXml(canonicalUrl(path))}</loc></url>`),
        ...packages.map((entry) => `  <url><loc>${escapeXml(canonicalUrl(`/package/${entry.name}`))}</loc><lastmod>${escapeXml(entry.measuredAt)}</lastmod></url>`),
    ];
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
};

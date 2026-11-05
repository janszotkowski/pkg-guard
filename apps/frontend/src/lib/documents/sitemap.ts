import type { PackagesResponse } from '@pkg-guard/core';
import { canonicalUrl } from '@config/site';
import { STATIC_PAGES } from '@lib/documents/pages';

export { STATIC_PAGES };

export const escapeXml = (value: string): string => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

const XML = '<?xml version="1.0" encoding="UTF-8"?>';
const NS = 'http://www.sitemaps.org/schemas/sitemap/0.9';

/** The most addresses one sitemap file may hold (sitemaps.org). */
export const SITEMAP_PAGE_SIZE = 50_000;

/** The number of package sitemap files for this many measured packages (at least one, so the index is never empty of them). */
export const packageSitemapCount = (total: number): number => Math.max(1, Math.ceil(total / SITEMAP_PAGE_SIZE));

/** `/sitemap.xml`: the index of the site's sitemap files, the pages first, then one file per 50,000 measured packages. */
export const sitemapIndex = (packageTotal: number): string => {
    const files = ['/sitemaps/pages.xml', ...Array.from({ length: packageSitemapCount(packageTotal) }, (_, index) => `/sitemaps/packages-${index + 1}.xml`)];
    return `${XML}\n<sitemapindex xmlns="${NS}">\n${files.map((file) => `  <sitemap><loc>${escapeXml(canonicalUrl(file))}</loc></sitemap>`).join('\n')}\n</sitemapindex>\n`;
};

const urlset = (entries: readonly { loc: string; lastmod?: string | null }[]): string =>
    `${XML}\n<urlset xmlns="${NS}">\n${entries
        .map((entry) => `  <url><loc>${escapeXml(entry.loc)}</loc>${entry.lastmod === undefined || entry.lastmod === null ? '' : `<lastmod>${escapeXml(entry.lastmod)}</lastmod>`}</url>`)
        .join('\n')}\n</urlset>\n`;

/** `/sitemaps/pages.xml`: the site's own pages. No `lastmod`: they have no real change date, and a made-up one is worse than none. */
export const pagesSitemap = (): string => urlset(STATIC_PAGES.map((path) => ({ loc: canonicalUrl(path) })));

/**
 * One file of package pages, each by the date of its measurement. Only what can be indexed: a package still waiting, or
 * a page of one version, is not. The API lists every measured package at once, so the file is cut from that list here.
 */
export const packageSitemap = (packages: PackagesResponse['packages'], page: number): string =>
    urlset(packages.slice((page - 1) * SITEMAP_PAGE_SIZE, page * SITEMAP_PAGE_SIZE).map((entry) => ({ loc: canonicalUrl(`/package/${entry.name}`), lastmod: entry.measuredAt })));

/** The number in `/sitemaps/packages-N.xml`, or undefined for any other path. */
export const packageSitemapPage = (pathname: string): number | undefined => {
    const match = /^\/sitemaps\/packages-(\d{1,4})\.xml$/.exec(pathname);
    const page = match?.[1] === undefined ? undefined : Number(match[1]);
    return page === undefined || page < 1 ? undefined : page;
};

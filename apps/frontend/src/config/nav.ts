import type { LinkProps } from '@tanstack/react-router';
import { siteConfig } from '@config/site';

/** A link of the site's navigation: a page of the site (`to`, opened by the router, with a clean filter) or any other address (`href`). */
export type NavLink = { label: string } & ({ to: LinkProps['to']; href?: never } | { href: string; to?: never });

/** The site's links, grouped: the mobile menu and the footer's columns. A new page gets its link here. */
export const NAV_GROUPS: readonly { title: string; links: readonly NavLink[] }[] = [
    {
        title: 'Product',
        links: [
            { label: 'Search', to: '/' },
            { label: 'Trends', to: '/trends' },
            { label: 'How it works', to: '/about' },
        ],
    },
    {
        title: 'Project',
        links: [
            { label: 'GitHub repository', href: siteConfig.repository },
            { label: 'Security policy', href: `${siteConfig.repository}/blob/main/SECURITY.md` },
            { label: 'MIT license', href: `${siteConfig.repository}/blob/main/LICENSE` },
        ],
    },
];

/** The header's links: the pages beside the search, which the header already is. */
export const HEADER_LINKS: readonly NavLink[] = [
    { label: 'Trends', to: '/trends' },
    { label: 'How it works', to: '/about' },
];

/** Whether the link leads to the page at this path or to a page under it (a package's page, say). */
export const isCurrentLink = (link: NavLink, pathname: string): boolean => {
    if (link.to === undefined) return false;
    return link.to === '/' ? pathname === '/' : pathname === link.to || pathname.startsWith(`${link.to}/`);
};

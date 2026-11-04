import { ALLOW_INDEXING, canonicalUrl, siteConfig } from '@config/site';

/** The size every network expects for a large preview. */
export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

export const WEBSITE_ID = `${canonicalUrl('/')}#website`;
export const AUTHOR_ID = `${canonicalUrl('/')}#author`;

export type Breadcrumb = { name: string; path: string };

type HeadInput = {
    /** The page's own title; the brand is added once. */
    title: string;
    description: string;
    /** The public path, `/package/react`. */
    path: string;
    noindex?: boolean;
    /** The share image's path (`/og/package/react.png`) and what it shows; the site's card when omitted. */
    ogImage?: { path: string; alt: string };
    /** The trail from the home page to this one, the home page included. */
    breadcrumbs?: readonly Breadcrumb[];
    /** The page's own node(s) for the JSON-LD graph, beside WebSite, Person and WebPage. */
    nodes?: readonly Record<string, unknown>[];
    /** Extra fields of the WebPage node (`datePublished`, `about`, …). */
    page?: Record<string, unknown>;
};

const DEFAULT_OG = { path: '/og/default.png', alt: `${siteConfig.title}: what an npm package really costs your bundle, measured with a modern bundler` };

/** The title as it appears in the tab and in results: the page's own, with the brand added once. */
export const fullTitle = (title: string): string => (title === siteConfig.title || title.endsWith(`| ${siteConfig.title}`) ? title : `${title} | ${siteConfig.title}`);

/** The nodes every page shares, referenced by `@id` from the others rather than copied into them. */
const siteNodes = (): Record<string, unknown>[] => [
    {
        '@type': 'WebSite',
        '@id': WEBSITE_ID,
        name: siteConfig.title,
        url: canonicalUrl('/'),
        description: siteConfig.description,
        inLanguage: 'en',
        publisher: { '@id': AUTHOR_ID },
    },
    { '@type': 'Person', '@id': AUTHOR_ID, name: siteConfig.author.name, url: siteConfig.author.url, sameAs: [siteConfig.author.x] },
];

/**
 * Head of a page: title, description, canonical, Open Graph and Twitter cards with the share image, robots, and one
 * JSON-LD graph (WebSite, Person, WebPage, breadcrumbs, the page's own nodes). The only place a page's head is built,
 * so every page has the same shape. A `noindex` page gets no graph: there is nothing to understand about a page kept out.
 */
export const pageHead = (input: HeadInput) => {
    const url = canonicalUrl(input.path);
    const title = fullTitle(input.title);
    const og = input.ogImage ?? DEFAULT_OG;
    const image = canonicalUrl(og.path);
    const noindex = input.noindex === true || !ALLOW_INDEXING;
    const breadcrumbs = input.breadcrumbs ?? [];
    const graph = [
        ...siteNodes(),
        {
            '@type': 'WebPage',
            '@id': `${url}#webpage`,
            url,
            name: title,
            description: input.description,
            inLanguage: 'en',
            isPartOf: { '@id': WEBSITE_ID },
            primaryImageOfPage: { '@type': 'ImageObject', url: image, ...OG_IMAGE_SIZE },
            ...(breadcrumbs.length > 0 ? { breadcrumb: { '@id': `${url}#breadcrumb` } } : {}),
            ...input.page,
        },
        ...(breadcrumbs.length > 0
            ? [
                  {
                      '@type': 'BreadcrumbList',
                      '@id': `${url}#breadcrumb`,
                      itemListElement: breadcrumbs.map((crumb, index) => ({ '@type': 'ListItem', position: index + 1, name: crumb.name, item: canonicalUrl(crumb.path) })),
                  },
              ]
            : []),
        ...(input.nodes ?? []),
    ];
    return {
        meta: [
            { title },
            { name: 'description', content: input.description },
            { name: 'author', content: siteConfig.author.name },
            { property: 'og:type', content: 'website' },
            { property: 'og:site_name', content: siteConfig.title },
            { property: 'og:locale', content: 'en_US' },
            { property: 'og:title', content: title },
            { property: 'og:description', content: input.description },
            { property: 'og:url', content: url },
            { property: 'og:image', content: image },
            { property: 'og:image:type', content: 'image/png' },
            { property: 'og:image:width', content: String(OG_IMAGE_SIZE.width) },
            { property: 'og:image:height', content: String(OG_IMAGE_SIZE.height) },
            { property: 'og:image:alt', content: og.alt },
            { name: 'twitter:card', content: 'summary_large_image' },
            { name: 'twitter:creator', content: siteConfig.author.xHandle },
            { name: 'twitter:title', content: title },
            { name: 'twitter:description', content: input.description },
            { name: 'twitter:image', content: image },
            { name: 'twitter:image:alt', content: og.alt },
            ...(noindex ? [{ name: 'robots', content: 'noindex, nofollow' }] : []),
        ],
        links: [{ rel: 'canonical', href: url }],
        scripts: noindex ? [] : [{ type: 'application/ld+json', children: JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('<', '\\u003c') }],
    };
};

/** A description cut at a word to fit a search result. */
export const clip = (text: string, length = 160): string => {
    const flat = text.replace(/\s+/g, ' ').trim();
    if (flat.length <= length) return flat;
    const cut = flat.slice(0, length - 1);
    return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), length / 2))}…`;
};

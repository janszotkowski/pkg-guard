import { Link, createFileRoute } from '@tanstack/react-router';
import { IsoPackage } from '@components/iso/IsoPackage';
import { PackageSearch } from '@components/PackageSearch';
import { canonicalUrl, siteConfig } from '@config/site';
import { publicPage } from '@lib/documents/pages';
import { pageHead } from '@lib/head';

/** The tab and the heading say the same thing: one sentence, in `src/lib/documents/pages.ts`. */
const PAGE = publicPage('/');

const PROMISES = [
    { title: 'Measured, not guessed', body: 'Every package goes through a real bundler, and you see which one and which version.' },
    { title: 'Its code never runs', body: 'Packages are installed without their scripts, and the bundler only reads them.' },
    { title: 'Open and free', body: 'MIT licensed, with no account and no tracking.' },
] as const;

const HomePage = () => (
    <main
        id={'main'}
        tabIndex={-1}
        className={'mx-auto flex w-full max-w-6xl flex-1 flex-col gap-16 px-4 py-14 lg:py-20'}
    >
        <div className={'grid items-center gap-10 lg:grid-cols-[1fr_1.1fr]'}>
            <div className={'flex flex-col gap-6'}>
                <h1 className={'text-display text-balance'}>{PAGE.title}</h1>
                <p className={'max-w-xl text-headline font-normal text-muted-foreground'}>Minified, gzip and brotli sizes of any npm package, and what it puts on disk.</p>
                <PackageSearch />
                <Link
                    to={'/trends'}
                    className={'w-fit text-callout text-link underline-offset-2 hover:underline'}
                >
                    Or compare package trends
                </Link>
            </div>
            <IsoPackage className={'mx-auto h-auto w-full max-w-xl'} />
        </div>
        <ul className={'grid divide-y border-y md:grid-cols-3 md:divide-x md:divide-y-0'}>
            {PROMISES.map((promise) => (
                <li
                    key={promise.title}
                    className={'flex flex-col gap-1 py-6 md:px-6 md:first:pl-0 md:last:pr-0'}
                >
                    <h2 className={'text-headline'}>{promise.title}</h2>
                    <p className={'text-callout text-muted-foreground'}>{promise.body}</p>
                </li>
            ))}
        </ul>
    </main>
);

export const Route = createFileRoute('/')({
    head: () =>
        pageHead({
            title: PAGE.title,
            description: PAGE.description ?? siteConfig.description,
            path: '/',
            nodes: [
                {
                    '@type': 'WebApplication',
                    '@id': `${canonicalUrl('/')}#application`,
                    name: siteConfig.title,
                    url: canonicalUrl('/'),
                    description: siteConfig.description,
                    applicationCategory: 'DeveloperApplication',
                    operatingSystem: 'Any',
                    isAccessibleForFree: true,
                    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
                },
            ],
        }),
    component: HomePage,
});

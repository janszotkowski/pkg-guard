import { createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { siteConfig } from '@config/site';
import { CONNECTIONS, formatDownloadTime } from '@lib/format';
import { pageHead } from '@lib/head';

const EXAMPLE_SIZES = [
    { label: '50 kB', bytes: 50_000 },
    { label: '500 kB', bytes: 500_000 },
] as const;

type SectionProps = { id: string; title: string; children: ReactNode };

const Section = (props: SectionProps) => (
    <section
        aria-labelledby={props.id}
        className={'flex flex-col gap-4'}
    >
        <h2
            id={props.id}
            className={'scroll-mt-20 text-title-2'}
        >
            {props.title}
        </h2>
        {props.children}
    </section>
);

type FactsProps = { items: readonly string[] };

const Facts = (props: FactsProps) => (
    <ul className={'flex list-disc flex-col gap-2 pl-5 text-muted-foreground'}>
        {props.items.map((item) => (
            <li key={item}>{item}</li>
        ))}
    </ul>
);

const AboutPage = () => (
    <main
        id={'main'}
        tabIndex={-1}
        className={'mx-auto flex w-full max-w-3xl flex-1 flex-col gap-12 px-4 py-14 lg:py-20'}
    >
        <div className={'flex flex-col gap-4'}>
            <h1 className={'text-display text-balance'}>How it works</h1>
            <p className={'text-headline font-normal text-muted-foreground'}>What {siteConfig.title} downloads, what it does with it, and how each number is worked out.</p>
        </div>

        <Section
            id={'downloads'}
            title={'What is downloaded, and when'}
        >
            <Facts
                items={[
                    'A package is downloaded only when someone asks for it: by opening its page, or by looking at older versions on its History tab or in the size view of the trends page. Nothing is fetched in the background.',
                    'What is downloaded is the package and its production dependencies, from the public npm registry. Development dependencies and peer dependencies are left out.',
                    'Each measurement works in a folder of its own, which is deleted when it ends. The package manager keeps its cache of downloaded packages in the same isolated storage, to reuse it. Only the results are kept for showing on this site.',
                    'Suggestions in the search box contain only names, descriptions and download counts from the npm search. Share images and the Markdown version of a page read what has already been measured. None of these downloads a package.',
                ]}
            />
        </Section>

        <Section
            id={'safety'}
            title={'How packages are handled'}
        >
            <p className={'text-muted-foreground'}>A package is untrusted code, so it is read and never run.</p>
            <Facts
                items={[
                    'Install scripts are turned off for the package and all of its dependencies, and dependencies may come only from the registry.',
                    'The bundler parses the code without importing or running it.',
                    'All of this happens in a Docker container with a read-only filesystem, an unprivileged user, no Linux capabilities and limits on memory and processes. It holds no credentials for npm.',
                    'A measurement is stopped after two minutes, or when the package and its dependencies take more than 1 GiB on disk.',
                ]}
            />
        </Section>

        <Section
            id={'sizes'}
            title={'How sizes are measured'}
        >
            <Facts
                items={[
                    'The package is bundled for the browser with Rolldown, in production mode and minified. The package page names the version of the bundler used.',
                    'Gzip uses level 9 and brotli quality 11, the highest of each. Each file is compressed on its own, as a server would send it.',
                    'Peer dependencies are not counted, because the app brings them anyway.',
                    'The install size is what the package and its dependencies put on disk.',
                    'The share of each package in a bundle is an estimate, because the bundler reports module sizes before minifying.',
                    'Entry points and named exports are each bundled alone, within a time limit, and the page says what was left out. CommonJS packages get no per-export numbers, because bundlers cannot drop parts of them reliably.',
                    'A package made for Node.js says so on its page. Its number shows what a bundler pulls in, not what it costs in a web page.',
                ]}
            />
            <p className={'text-muted-foreground'}>Another bundler or the way your app imports a package can give a different number.</p>
        </Section>

        <Section
            id={'download-time'}
            title={'How download time is worked out'}
        >
            <p className={'text-muted-foreground'}>
                It is arithmetic, not a measurement: the gzip size in bits divided by a fixed connection speed. For example, 50 kB is 400,000 bits, which takes 1 second at 400 kbit/s.
            </p>
            <div className={'overflow-x-auto'}>
                <table className={'w-full border-y text-left text-callout tabular-nums'}>
                    <caption className={'sr-only'}>Download times for example sizes on each connection</caption>
                    <thead>
                        <tr className={'border-b'}>
                            <th
                                scope={'col'}
                                className={'py-2 pr-4 font-semibold'}
                            >
                                Connection
                            </th>
                            <th
                                scope={'col'}
                                className={'py-2 pr-4 font-semibold'}
                            >
                                Speed
                            </th>
                            {EXAMPLE_SIZES.map((size) => (
                                <th
                                    key={size.label}
                                    scope={'col'}
                                    className={'py-2 pr-4 font-semibold'}
                                >
                                    {size.label}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {CONNECTIONS.map((connection) => (
                            <tr key={connection.name}>
                                <th
                                    scope={'row'}
                                    className={'py-2 pr-4 font-normal'}
                                >
                                    {connection.name}
                                </th>
                                <td className={'py-2 pr-4 text-muted-foreground'}>{connection.label}</td>
                                {EXAMPLE_SIZES.map((size) => (
                                    <td
                                        key={size.label}
                                        className={'py-2 pr-4 text-muted-foreground'}
                                    >
                                        {formatDownloadTime(size.bytes, connection.bitsPerSecond)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Facts
                items={[
                    'It counts the transfer alone: no latency, no parsing and no running of the code, so a real page takes longer.',
                    'A package made for Node.js has no download time, because a browser does not download it. Neither does a package with nothing to import.',
                ]}
            />
        </Section>

        <Section
            id={'other-data'}
            title={'Other data'}
        >
            <Facts
                items={[
                    'Versions, release dates and search results come from the npm registry.',
                    'Package health comes from the same place: deprecation, licence, declared types and install scripts as npm lists them for that version. Install scripts are those of the package itself, not of its dependencies. Only the module format comes from the measurement.',
                    'Download counts come from npm’s statistics, which it updates once a day.',
                    'Stars come from GitHub, when a package names its repository there.',
                ]}
            />
        </Section>

        <Section
            id={'limits'}
            title={'What it does not do'}
        >
            <Facts items={['It does not check whether a package is safe.', 'It covers only packages on the public npm registry.', 'It has no accounts and no tracking.']} />
            <p className={'text-muted-foreground'}>
                All of this can be checked in the{' '}
                <a
                    href={siteConfig.repository}
                    rel={'noreferrer'}
                    className={'text-link underline-offset-2 hover:underline'}
                >
                    source code
                </a>
                .
            </p>
        </Section>
    </main>
);

export const Route = createFileRoute('/about')({
    head: () =>
        pageHead({
            title: 'How it works: what is downloaded and measured',
            description: 'What pkg-guard downloads from npm, how packages are handled without running them, and how sizes and download times are worked out.',
            path: '/about',
            breadcrumbs: [
                { name: siteConfig.title, path: '/' },
                { name: 'How it works', path: '/about' },
            ],
        }),
    component: AboutPage,
});

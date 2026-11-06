import { Link } from '@tanstack/react-router';
import { PackageCheck } from 'lucide-react';
import { SiteLink } from '@components/SiteLink';
import { StarOnGitHub } from '@components/StarOnGitHub';
import { NAV_GROUPS } from '@config/nav';
import { siteConfig } from '@config/site';

const LINK = 'inline-flex min-h-8 items-center text-muted-foreground hover:text-foreground';

/** Brand marks Lucide does not ship: GitHub and X, drawn in the text colour. */
const GitHubMark = () => (
    <svg
        aria-hidden={'true'}
        viewBox={'0 0 24 24'}
        className={'size-4.5'}
        fill={'currentColor'}
    >
        <path
            d={
                'M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5Z'
            }
        />
    </svg>
);

const XMark = () => (
    <svg
        aria-hidden={'true'}
        viewBox={'0 0 24 24'}
        className={'size-4'}
        fill={'currentColor'}
    >
        <path d={'M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.65l-5.21-6.82-5.97 6.82H1.68l7.73-8.84L1.25 2.25h6.82l4.71 6.23 5.46-6.23Zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64Z'} />
    </svg>
);

/** Where to go next and who is behind the site, on every page: the brand, one column of links per group, and the legal line. */
export const SiteFooter = () => (
    <footer className={'mt-16 border-t'}>
        <div className={'mx-auto w-full max-w-6xl px-4 py-10'}>
            <div className={'grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-[2fr_1fr_1fr_1fr]'}>
                <div className={'col-span-2 flex flex-col gap-3 sm:col-span-3 lg:col-span-1'}>
                    <Link
                        to={'/'}
                        className={'flex w-fit items-center gap-2 text-headline'}
                    >
                        <PackageCheck
                            aria-hidden={'true'}
                            className={'size-5 text-link'}
                        />
                        {siteConfig.title}
                    </Link>
                    <p className={'max-w-xs text-callout text-muted-foreground'}>Free and open source, MIT licensed. No account, no tracking.</p>
                    <StarOnGitHub className={'inline-flex w-fit'} />
                    <div className={'-ml-3 flex items-center gap-1'}>
                        <a
                            href={siteConfig.repository}
                            aria-label={'Source code on GitHub'}
                            className={'inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground'}
                        >
                            <GitHubMark />
                        </a>
                        <a
                            href={siteConfig.author.x}
                            aria-label={`${siteConfig.author.name} on X`}
                            className={'inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground'}
                        >
                            <XMark />
                        </a>
                    </div>
                </div>
                {NAV_GROUPS.map((group) => (
                    <nav
                        key={group.title}
                        aria-label={group.title}
                        className={'flex flex-col gap-1'}
                    >
                        <h2 className={'mb-1 text-overline text-subtle-foreground uppercase'}>{group.title}</h2>
                        {group.links.map((link) => (
                            <SiteLink
                                key={link.label}
                                link={link}
                                className={LINK}
                            >
                                {link.label}
                            </SiteLink>
                        ))}
                    </nav>
                ))}
            </div>

            <div className={'mt-10 flex flex-col gap-3 border-t pt-6 text-caption text-subtle-foreground'}>
                <p>Sizes are measured by this site; downloads and package facts come from the npm registry, stars from GitHub. Numbers are provided as is, without warranty.</p>
                <p>
                    Made by{' '}
                    <a
                        className={'underline underline-offset-2 hover:text-foreground'}
                        href={siteConfig.author.url}
                    >
                        {siteConfig.author.name}
                    </a>
                    . MIT license.
                </p>
            </div>
        </div>
    </footer>
);

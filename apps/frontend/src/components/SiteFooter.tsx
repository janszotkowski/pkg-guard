import { siteConfig } from '@config/site';

export const SiteFooter = () => (
    <footer className={'mt-16 border-t'}>
        <div className={'mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-8 text-callout text-muted-foreground'}>
            <p>Free and open source, MIT licensed. No account, no tracking.</p>
            <a
                href={siteConfig.repository}
                rel={'noreferrer'}
                className={'inline-flex min-h-8 items-center hover:text-foreground'}
            >
                Source on GitHub
            </a>
        </div>
    </footer>
);

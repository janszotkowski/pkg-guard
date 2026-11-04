import { HeadContent, Outlet, Scripts, createRootRouteWithContext } from '@tanstack/react-router';
import interLatin from '@fontsource-variable/inter/files/inter-latin-wght-normal.woff2?url';
import { LoadingIndicator } from '@components/LoadingIndicator';
import { RouteAnnouncer } from '@components/RouteAnnouncer';
import { SiteFooter } from '@components/SiteFooter';
import { SiteHeader } from '@components/SiteHeader';
import { ALLOW_INDEXING, siteConfig } from '@config/site';
import type { RouterContext } from '@lib/routerContext';
import { THEME_BOOT_SCRIPT, THEME_COLOR } from '@lib/theme';
import appCss from '@styles/app.css?url';

const RootDocument = () => (
    // The server always renders dark (it cannot see the visitor's setting); the boot script switches before first paint, hence suppressHydrationWarning.
    <html
        lang={'en'}
        className={'dark'}
        suppressHydrationWarning
    >
        <head>
            <HeadContent />
            <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        </head>
        <body className={'flex min-h-svh flex-col'}>
            <a
                href={'#main'}
                className={
                    'sr-only rounded-md bg-primary px-4 py-2 text-callout text-primary-foreground focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-50'
                }
            >
                Skip to content
            </a>
            <RouteAnnouncer />
            <SiteHeader />
            <LoadingIndicator />
            <div className={'flex flex-1 flex-col'}>
                <Outlet />
            </div>
            <SiteFooter />
            <Scripts />
        </body>
    </html>
);

export const Route = createRootRouteWithContext<RouterContext>()({
    head: ({ matches }) => {
        // A missing or failed page says so in the tab and in what a screen reader announces after a navigation.
        const notFound = matches.some((match) => match.status === 'notFound' || match._notFound === true);
        const failed = !notFound && matches.some((match) => match.status === 'error');
        return {
            meta: [
                { charSet: 'utf-8' },
                { name: 'viewport', content: 'width=device-width, initial-scale=1' },
                { name: 'theme-color', content: THEME_COLOR.dark },
                { title: notFound ? `Page not found | ${siteConfig.title}` : failed ? `Something went wrong | ${siteConfig.title}` : siteConfig.title },
                { name: 'description', content: siteConfig.description },
                // Safe default for routes that set no head of their own; on non-production environments nothing is indexed anywhere.
                ...(ALLOW_INDEXING && !notFound && !failed ? [] : [{ name: 'robots', content: 'noindex, nofollow' }]),
            ],
            links: [
                { rel: 'stylesheet', href: appCss },
                { rel: 'preload', href: interLatin, as: 'font', type: 'font/woff2', crossOrigin: 'anonymous' },
                { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
            ],
        };
    },
    component: RootDocument,
});

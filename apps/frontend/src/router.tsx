import { CSPProvider } from '@base-ui/react/csp-provider';
import { QueryClient, QueryClientProvider, dehydrate, hydrate, type DehydratedState } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { getGlobalStartContext } from '@tanstack/react-start';
import { ErrorState } from '@components/ErrorState';
import { NotFound } from '@components/NotFound';
import type { RouterContext } from '@lib/routerContext';
import { routeTree } from './routeTree.gen';

/**
 * The nonce the server entry made for this response (`src/server.ts`), which the router writes on its inline scripts so
 * the Content-Security-Policy can tell them from anything else. Undefined in the browser.
 */
const responseNonce = (): string | undefined => {
    try {
        const nonce: unknown = (getGlobalStartContext() as { nonce?: unknown } | undefined)?.nonce;
        return typeof nonce === 'string' ? nonce : undefined;
    } catch {
        return undefined;
    }
};

export const getRouter = () => {
    const nonce = responseNonce();
    // One client per router, so per request on the server: no cached data crosses from one visitor to another. The API
    // answers at once or not at all (`lib/api.ts` has the timeout), so a failed request is not tried again by itself,
    // and what the page shows is fresh for half a minute; a query that needs otherwise says so.
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 } } });
    return createRouter({
        routeTree,
        context: { queryClient } satisfies RouterContext,
        // What the server's loaders fetched goes to the browser with the page, into the same cache.
        dehydrate: () => ({ queries: JSON.stringify(dehydrate(queryClient)) }),
        hydrate: (dehydrated: { queries: string }) => hydrate(queryClient, JSON.parse(dehydrated.queries) as DehydratedState),
        ...(nonce === undefined ? {} : { ssr: { nonce } }),
        // Base UI writes no `<style>` elements of its own: the policy allows styles from this site only (`style-src 'self'`).
        Wrap: (props) => (
            <CSPProvider disableStyleElements>
                <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>
            </CSPProvider>
        ),
        scrollRestoration: true,
        defaultPreload: 'intent',
        defaultNotFoundComponent: () => <NotFound />,
        defaultErrorComponent: ({ error, reset }) => (
            <ErrorState
                error={error}
                reset={reset}
            />
        ),
    });
};

declare module '@tanstack/react-router' {
    // oxlint-disable-next-line typescript-eslint/consistent-type-definitions
    interface Register {
        router: ReturnType<typeof getRouter>;
    }
}

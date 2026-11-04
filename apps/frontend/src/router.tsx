import { QueryClient, QueryClientProvider, dehydrate, hydrate, type DehydratedState } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';
import { ErrorState } from '@components/ErrorState';
import { NotFound } from '@components/NotFound';
import type { RouterContext } from '@lib/routerContext';
import { routeTree } from './routeTree.gen';

export const getRouter = () => {
    // One client per router, so per request on the server: no cached data crosses from one visitor to another.
    const queryClient = new QueryClient();
    return createRouter({
        routeTree,
        context: { queryClient } satisfies RouterContext,
        // What the server's loaders fetched goes to the browser with the page, into the same cache.
        dehydrate: () => ({ queries: JSON.stringify(dehydrate(queryClient)) }),
        hydrate: (dehydrated: { queries: string }) => hydrate(queryClient, JSON.parse(dehydrated.queries) as DehydratedState),
        Wrap: (props) => <QueryClientProvider client={queryClient}>{props.children}</QueryClientProvider>,
        scrollRestoration: true,
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

import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/** False on the server and during hydration, true once the page is live. */
export const useHydrated = (): boolean =>
    useSyncExternalStore(
        subscribe,
        () => true,
        () => false,
    );

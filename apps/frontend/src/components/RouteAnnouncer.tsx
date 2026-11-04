import { useRouterState } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';

/** How often, and for how long at most, the announcer waits for the new page itself (not its loading skeleton) to be there. */
const SETTLE_MS = 50;
const SETTLE_MAX_MS = 5000;

/**
 * A page change inside the app does not reload the document, so nothing tells a screen reader that it happened
 * and keyboard focus is left on an element that is gone. After each navigation to another path this says the new
 * page's title in a polite live region and moves focus to the page's `main`. Changing only the query string (a new
 * filter, sort or page of the list) is not a new page and leaves focus where the visitor is working.
 *
 * It waits for the page to be loaded and shown: a skeleton (`aria-busy`) stands in its place meanwhile, and focus put
 * on the skeleton would drop to the document when the skeleton goes away.
 */
export const RouteAnnouncer = () => {
    // The path of the page the router has finished loading, not the one it is heading to.
    const pathname = useRouterState({ select: (state) => state.resolvedLocation?.pathname ?? state.location.pathname });
    // The path of the page already announced: a re-run of the effect for the same path (React's development double run) does nothing.
    const announced = useRef(pathname);
    const [message, setMessage] = useState('');

    useEffect(() => {
        // The page load itself is not a navigation: the browser already announces and focuses it.
        if (announced.current === pathname) return undefined;
        announced.current = pathname;
        const started = Date.now();
        let timer: ReturnType<typeof setTimeout> | undefined;
        const settle = () => {
            const main = document.getElementById('main');
            if ((main === null || main.getAttribute('aria-busy') === 'true') && Date.now() - started < SETTLE_MAX_MS) {
                timer = setTimeout(settle, SETTLE_MS);
                return;
            }
            setMessage(document.title);
            if (main !== null) {
                main.tabIndex = -1;
                main.focus({ preventScroll: true });
            }
        };
        timer = setTimeout(settle, SETTLE_MS);
        return () => clearTimeout(timer);
    }, [pathname]);

    return (
        <div
            role={'status'}
            aria-live={'polite'}
            aria-atomic={'true'}
            className={'sr-only'}
        >
            {message}
        </div>
    );
};

import { useRouter, useRouterState } from '@tanstack/react-router';
import { Button } from '@components/ui/button';
import { useDelayedFlag } from '@lib/useDelayedFlag';

/** A navigation longer than this shows the bar; most are done before. */
const BAR_DELAY_MS = 200;
/** One still loading after this long is not normal: the visitor is told, and can try again. */
const SLOW_DELAY_MS = 8000;

/**
 * Whether the site is loading, for everyone: a thin bar under the header for any navigation that takes a moment, and a
 * notice with a retry when one takes much longer than it should (a slow network, a busy server).
 */
export const LoadingIndicator = () => {
    const router = useRouter();
    const pending = useRouterState({ select: (state) => state.status === 'pending' || state.isLoading });
    const visible = useDelayedFlag(pending, BAR_DELAY_MS);
    const slow = useDelayedFlag(pending, SLOW_DELAY_MS);

    return (
        <>
            {visible && (
                <div
                    role={'progressbar'}
                    aria-label={'Loading'}
                    className={'loading-bar pointer-events-none fixed inset-x-0 top-(--site-header-height) z-40 h-0.5 overflow-hidden'}
                />
            )}
            {slow && (
                <div
                    role={'status'}
                    className={'glass fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-between gap-4 rounded-md px-4 py-3 text-callout'}
                >
                    <span>This is taking longer than usual.</span>
                    <Button
                        variant={'secondary'}
                        onClick={() => void router.invalidate()}
                    >
                        Try again
                    </Button>
                </div>
            )}
        </>
    );
};

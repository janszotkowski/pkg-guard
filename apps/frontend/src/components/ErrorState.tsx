import { IsoOffline } from '@components/iso/IsoOffline';
import { Button } from '@components/ui/button';

type ErrorStateProps = { error: unknown; reset: () => void };

/** A failed load: what happened in plain words, and a way to try again. */
export const ErrorState = (props: ErrorStateProps) => (
    <main
        id={'main'}
        tabIndex={-1}
        className={'mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center'}
    >
        <IsoOffline className={'h-auto w-full max-w-64'} />
        <h1 className={'text-title-1'}>Something went wrong</h1>
        <p className={'text-muted-foreground'}>The data could not be loaded. The service may be restarting; try again in a moment.</p>
        {import.meta.env.DEV && <pre className={'max-w-full overflow-auto text-left text-code text-muted-foreground'}>{String(props.error)}</pre>}
        <Button
            variant={'secondary'}
            onClick={props.reset}
        >
            Try again
        </Button>
    </main>
);

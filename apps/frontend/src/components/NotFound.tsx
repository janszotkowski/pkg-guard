import { Link } from '@tanstack/react-router';
import { IsoMissing } from '@components/iso/IsoMissing';
import { buttonVariants } from '@components/ui/button';

type NotFoundProps = { title?: string; message?: string; label?: string };

export const NotFound = (props: NotFoundProps) => (
    <main
        id={'main'}
        tabIndex={-1}
        className={'mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center'}
    >
        <IsoMissing
            label={props.label ?? 'Error · 404'}
            className={'h-auto w-full max-w-64'}
        />
        <h1 className={'text-title-1'}>{props.title ?? 'Page not found'}</h1>
        <p className={'text-muted-foreground'}>{props.message ?? 'There is nothing at this address.'}</p>
        <Link
            to={'/'}
            className={buttonVariants({ variant: 'secondary' })}
        >
            Search for a package
        </Link>
    </main>
);

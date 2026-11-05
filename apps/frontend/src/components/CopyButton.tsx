import { Check, Copy, X } from 'lucide-react';
import type { ComponentProps } from 'react';
import { Button } from '@components/ui/button';
import { useCopy } from '@lib/useCopy';

/**
 * Copies `getText()` to the clipboard and says so for a moment, or says it could not (no permission, insecure page).
 * The text is built on click only: what it copies is not worth building on every render.
 */
type CopyButtonProps = { getText: () => string; label?: string; className?: string; variant?: ComponentProps<typeof Button>['variant'] };

export const CopyButton = (props: CopyButtonProps) => {
    const { state, copy } = useCopy();
    const Icon = state === 'copied' ? Check : state === 'failed' ? X : Copy;
    const text = state === 'copied' ? 'Copied' : state === 'failed' ? "Couldn't copy" : (props.label ?? 'Copy');

    return (
        <Button
            type={'button'}
            variant={props.variant ?? 'ghost'}
            size={'sm'}
            onClick={() => copy(props.getText())}
            className={props.className}
        >
            <Icon aria-hidden={'true'} />
            <span aria-live={'polite'}>{text}</span>
        </Button>
    );
};

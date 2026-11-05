import { useEffect, useState } from 'react';

export type CopyState = 'idle' | 'copied' | 'failed';

/** Puts text on the clipboard: false when the browser refuses (no permission) or has no clipboard (`navigator.clipboard` is undefined outside a secure context). */
export const copyText = async (text: string): Promise<boolean> => {
    try {
        if (navigator.clipboard === undefined) return false;
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
};

/** Copies on demand and says how it went for a moment: `copied`, or `failed` a little longer, so it can be read. */
export const useCopy = (): { state: CopyState; copy: (text: string) => void } => {
    const [state, setState] = useState<CopyState>('idle');

    useEffect(() => {
        if (state === 'idle') return undefined;
        const timer = setTimeout(() => setState('idle'), state === 'copied' ? 1600 : 3000);
        return () => clearTimeout(timer);
    }, [state]);

    return { state, copy: (text) => void copyText(text).then((ok) => setState(ok ? 'copied' : 'failed')) };
};

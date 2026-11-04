import { useEffect, useState } from 'react';

/** The value once it has stayed the same for a moment: typing a word asks one question, not one per letter. */
export const useDebouncedValue = <T>(value: T, delayMs: number): T => {
    const [settled, setSettled] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setSettled(value), delayMs);
        return () => clearTimeout(timer);
    }, [value, delayMs]);
    return settled;
};

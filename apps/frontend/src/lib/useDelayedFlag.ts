import { useEffect, useState } from 'react';

/**
 * True once `active` has stayed true for `delayMs`, false as soon as it is not. A loading indicator then appears only for
 * a wait the visitor would notice, and never flashes for one that ends at once.
 */
export const useDelayedFlag = (active: boolean, delayMs: number): boolean => {
    // Each stretch of `active` is its own cycle, so a timer of an earlier one can never switch a later one on.
    const [cycle, setCycle] = useState(0);
    const [lastActive, setLastActive] = useState(active);
    if (lastActive !== active) {
        setLastActive(active);
        setCycle((value) => value + 1);
    }
    const [readyCycle, setReadyCycle] = useState(-1);
    useEffect(() => {
        if (!active) return;
        const timer = setTimeout(() => setReadyCycle(cycle), delayMs);
        return () => clearTimeout(timer);
    }, [active, cycle, delayMs]);
    return active && readyCycle === cycle;
};

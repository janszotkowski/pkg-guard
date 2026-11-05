import { useState } from 'react';
import { assignColors } from '@lib/trends';

/** Removing one package must not repaint the others, so the colors outlive a change of the list while the page is open. */
export const useSeriesColors = (packages: readonly string[]): ReadonlyMap<string, string> => {
    const [colors, setColors] = useState<ReadonlyMap<string, string>>(() => assignColors(packages, new Map()));
    const key = packages.join();
    const [seenKey, setSeenKey] = useState(key);
    if (key === seenKey) return colors;
    const next = assignColors(packages, colors);
    setSeenKey(key);
    setColors(next);
    return next;
};

import type { HistoryResponse } from '@weighme/core';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { historyQuery, measureHistory } from '@lib/api';

/**
 * Asks for the versions on a page to be measured, once per package. A chart of sizes has nothing to show without them, and
 * someone looking at it has asked for that. The versions wait in the worker's container behind anything someone is waiting for.
 */
export const useMeasureOnce = (histories: readonly (HistoryResponse | undefined)[], enabled: boolean): void => {
    const client = useQueryClient();
    const asked = useRef(new Set<string>());
    useEffect(() => {
        if (!enabled) return;
        for (const history of histories) {
            if (history === undefined || asked.current.has(history.name)) continue;
            if (!history.versions.some((entry) => entry.status === 'unmeasured')) continue;
            asked.current.add(history.name);
            // The answer says the versions are queued, which is what starts the polling. It is not written to the cache as it
            // is, though: a poll that answered meanwhile may already know more, and asking again cannot go back in time.
            measureHistory(history.name).then(
                () => client.invalidateQueries({ queryKey: historyQuery(history.name).queryKey }),
                () => asked.current.delete(history.name),
            );
        }
    }, [client, enabled, histories]);
};

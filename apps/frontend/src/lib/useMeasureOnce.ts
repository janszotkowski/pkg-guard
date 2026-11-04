import type { HistoryResponse } from '@pkg-guard/core';
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
            measureHistory(history.name).then(
                (answer) => client.setQueryData(historyQuery(history.name).queryKey, answer),
                () => asked.current.delete(history.name),
            );
        }
    }, [client, enabled, histories]);
};

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/stores/useAppStore";
import type { ConnectionFunction, QueryResult } from "@/types";
import { tauriApi } from "@/lib/tauri-api";

export function useTableData(
    fn: ConnectionFunction,
    database: string,
    page: number,
    pageSize: number,
): { data: QueryResult | null; isLoading: boolean; error: string | null } {
    const { selectedDatabases, connections } = useAppStore();
    const [data, setData] = useState<QueryResult | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const connType = useMemo(
        () => connections.find((c) => c.id === fn.connectionId)?.type,
        [connections, fn.connectionId],
    );
    const selectedDb = selectedDatabases[fn.connectionId] ?? database;

    useEffect(() => {
        if (!fn.tableName) return;
        const controller = new AbortController();
        setIsLoading(true);
        setError(null);
        tauriApi
            .getTableData(
                fn.connectionId,
                selectedDb,
                fn.tableName,
                page,
                pageSize,
                undefined,
            )
            .then((result) => {
                if (!controller.signal.aborted) {
                    setData(result);
                }
            })
            .catch((err) => {
                if (!controller.signal.aborted) {
                    setError(err instanceof Error ? err.message : String(err));
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setIsLoading(false);
                }
            });
        return () => controller.abort();
    }, [fn.connectionId, fn.tableName, selectedDb, page, pageSize, connType]);

    return { data, isLoading, error };
}

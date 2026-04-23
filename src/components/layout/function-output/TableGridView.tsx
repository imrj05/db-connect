import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    getSortedRowModel,
    SortingState,
    ColumnSizingState,
    VisibilityState,
} from "@tanstack/react-table";
import {
    Loader2,
    Sparkles,
    Download,
    Hash,
    Key,
    FileText,
    FileJson,
    Trash2,
    X,
    Plus,
    AlignLeft,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    Database as DatabaseIcon,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/store/useAppStore";
import { QueryLog } from "@/components/layout/function-output/QueryLog";
import { cn } from "@/lib/utils";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Kbd } from "@/components/ui/kbd";
import {
    ConnectionFunction,
    TableStructure,
    FilterCondition,
    FilterOp,
    DatabaseType,
    PendingCellEdit,
    SchemaGraph,
    ForeignKeyRelation,
    QueryResult,
} from "@/types";
import { tauriApi } from "@/lib/tauri-api";
import { toast } from "@/components/ui/sonner";
import { GridToolbar } from "@/components/layout/function-output/table-grid/GridToolbar";
import { FilterBar } from "@/components/layout/function-output/table-grid/FilterBar";
import { ImportPanel } from "@/components/layout/function-output/table-grid/ImportPanel";
import { RowContextMenu } from "@/components/layout/function-output/table-grid/RowContextMenu";
import { ColumnContextMenu } from "@/components/layout/function-output/table-grid/ColumnContextMenu";
import { CellEditModal } from "@/components/layout/function-output/table-grid/CellEditModal";
import { DeleteRowDialog } from "@/components/layout/function-output/table-grid/DeleteRowDialog";
import { ColumnNullDialog } from "@/components/layout/function-output/table-grid/ColumnNullDialog";
import { DropTableDialog } from "@/components/layout/function-output/table-grid/DropTableDialog";
import { RenameTableDialog } from "@/components/layout/function-output/table-grid/RenameTableDialog";
import { AddColumnDialog } from "@/components/layout/function-output/table-grid/AddColumnDialog";
import { DropColumnDialog } from "@/components/layout/function-output/table-grid/DropColumnDialog";
import { CreateIndexDialog } from "@/components/layout/function-output/table-grid/CreateIndexDialog";
import { DropIndexDialog } from "@/components/layout/function-output/table-grid/DropIndexDialog";
import { DumpDatabaseDialog, type DumpOptions } from "@/components/layout/function-output/table-grid/DumpDatabaseDialog";
import { ImportSqlDialog } from "@/components/layout/function-output/table-grid/ImportSqlDialog";
import { ERDiagramView } from "@/components/layout/function-output/table-grid/ERDiagramView";

type ViewMode = "data" | "form" | "structure" | "er";

const DEFAULT_FIXED_COLUMN_WIDTH = 150;
const MIN_COLUMN_WIDTH = 72;
const MAX_CONTENT_FIT_COLUMN_WIDTH = 420;
const CONTENT_FIT_CHAR_WIDTH_PX = 8;
const CONTENT_FIT_CELL_PADDING_PX = 36;

function toDisplayString(value: unknown): string {
    if (value === null) return "[NULL]";
    if (value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

function toEditString(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

function getContentFitLength(value: unknown) {
    return toDisplayString(value).replace(/\s+/g, " ").length;
}

function normalizeQueuedValue(value: unknown): string | null {
    if (value === null || value === undefined) return null;
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
}

function buildPendingRowKey(
    primaryKeyValues: Record<string, unknown>,
    pkColumns: string[],
) {
    return JSON.stringify(
        pkColumns.map((col) => [col, primaryKeyValues[col] ?? null]),
    );
}

type ColumnEditMeta = {
    isPrimary: boolean;
    isNullable: boolean;
    isGeneratedLike: boolean;
};

const GENERATED_COLUMN_PATTERN =
    /\b(auto_increment|autoincrement|identity|generated|virtual|stored|sequence|read-only)\b/i;
const SERIAL_COLUMN_PATTERN = /\b(smallserial|serial|bigserial)\b/i;

function buildColumnEditMeta(
    column: TableStructure["columns"][number],
): ColumnEditMeta {
    const extra = column.extra ?? "";
    const dataType = column.dataType ?? "";

    return {
        isPrimary: column.isPrimary,
        isNullable: column.nullable,
        isGeneratedLike:
            GENERATED_COLUMN_PATTERN.test(extra) ||
            SERIAL_COLUMN_PATTERN.test(dataType),
    };
}

export function TableGridView({
    fn,
    queryResult,
    isLoading,
    onPageChange,
    page,
    database,
    pageSize = 50,
}: {
    fn: ConnectionFunction;
    queryResult?: { columns: string[]; rows: any[]; executionTimeMs: number };
    isLoading: boolean;
    onPageChange: (page: number) => void;
    page: number;
    database: string;
    pageSize?: number;
}) {
    const [viewMode, setViewMode] = useState<ViewMode>("data");
    const [selectedRowIdx, setSelectedRowIdx] = useState(-1);
    const [contextMenuCell, setContextMenuCell] = useState<{
        x: number;
        y: number;
        rowIdx: number;
        col: string | null;
        rowData: Record<string, unknown>;
    } | null>(null);
    const [selectedCell, setSelectedCell] = useState<{
        rowIdx: number;
        colId: string;
    } | null>(null);
    const [colCtxMenu, setColCtxMenu] = useState<{ x: number; y: number; colId: string } | null>(null);
    const [selectedColId, setSelectedColId] = useState<string | null>(null);
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(
        {},
    );
    const [columnNullConfirmCol, setColumnNullConfirmCol] = useState<
        string | null
    >(null);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
    const [structure, setStructure] = useState<TableStructure | null>(null);
    const [structureLoading, setStructureLoading] = useState(false);
    const [schemaGraph, setSchemaGraph] = useState<SchemaGraph | null>(null);
    const [schemaGraphLoading, setSchemaGraphLoading] = useState(false);
    const [schemaGraphError, setSchemaGraphError] = useState<string | null>(null);
    // Cell editing state
    const [editingCell, setEditingCell] = useState<{
        rowIdx: number;
        col: string;
        value: string;
        rowData: Record<string, unknown>;
    } | null>(null);
    const [cellEditError, setCellEditError] = useState<string | null>(null);
    const [cellEditLoading, setCellEditLoading] = useState(false);
    const [pendingApplyLoading, setPendingApplyLoading] = useState(false);
    // Edit-in-modal state
    const [cellModal, setCellModal] = useState<{
        rowIdx: number;
        col: string;
        value: string;
        format: "Text" | "JSON" | "HTML";
        rowData: Record<string, unknown>;
    } | null>(null);
    // Delete row state
    const [deleteRowSql, setDeleteRowSql] = useState<string | null>(null);
    const [deleteRowLoading, setDeleteRowLoading] = useState(false);
    // Drop table state
    const [showDropTable, setShowDropTable] = useState(false);
    const [dropTableLoading, setDropTableLoading] = useState(false);
    // Add column state
    const [showAddColumn, setShowAddColumn] = useState(false);
    const [addCol, setAddCol] = useState<{
        name: string;
        type: string;
        nullable: boolean;
    }>({ name: "", type: "TEXT", nullable: true });
    const [addColLoading, setAddColLoading] = useState(false);
    const [addColError, setAddColError] = useState<string | null>(null);
    // Drop column state
    const [dropColTarget, setDropColTarget] = useState<string | null>(null);
    const [dropColLoading, setDropColLoading] = useState(false);
    // Create index state
    const [showCreateIndex, setShowCreateIndex] = useState(false);
    const [createIdxDef, setCreateIdxDef] = useState<{
        name: string;
        columns: string[];
        unique: boolean;
    }>({ name: "", columns: [], unique: false });
    const [createIdxLoading, setCreateIdxLoading] = useState(false);
    const [createIdxError, setCreateIdxError] = useState<string | null>(null);
    // Drop index state
    const [dropIdxTarget, setDropIdxTarget] = useState<string | null>(null);
    const [dropIdxLoading, setDropIdxLoading] = useState(false);
    // Rename table state
    const [showRenameTable, setShowRenameTable] = useState(false);
    const [renameTableName, setRenameTableName] = useState("");
    const [renameTableLoading, setRenameTableLoading] = useState(false);
    // Query log state
    const [showQueryLogSyntax, setShowQueryLogSyntax] = useState(true);
    const structurePrefetchRef = useRef<string | null>(null);
    const {
        queryHistory,
        clearHistory,
        connections,
        connectionFunctions,
        selectedDatabases,
        closeTab,
        tabs,
        activeTabId,
        queuePendingCellEdit,
        clearPendingCellEdits,
        removePendingCellEdits,
        refreshTables,
        invokeFunction,
        queryLogOpen,
        updateTabFilters,
        updateTabFilteredResult,
        updateTabFiltersActive,
        clearTabFilters,
    } = useAppStore();
    const dbType =
        connections.find((c) => c.id === fn.connectionId)?.type ?? "postgresql";
    const isRelationalDb =
        dbType === "postgresql" || dbType === "mysql" || dbType === "sqlite";
    const qi = (n: string) => (dbType === "mysql" ? `\`${n}\`` : `"${n}"`);
    const fkLookup = useMemo(() => {
        if (!schemaGraph || !fn.tableName) return new Map<string, ForeignKeyRelation>();
        const map = new Map<string, ForeignKeyRelation>();
        for (const rel of schemaGraph.relationships) {
            if (rel.sourceTable === fn.tableName) {
                for (const col of rel.sourceColumns) {
                    map.set(col, rel);
                }
            }
        }
        return map;
    }, [schemaGraph, fn.tableName]);
    const navigateToFkTarget = useCallback(
        async (relation: ForeignKeyRelation, cellValue: unknown) => {
            const allFns = Object.values(connectionFunctions).flat();
            const targetFn = allFns.find(
                (candidate) =>
                    candidate.type === "table" &&
                    candidate.connectionId === fn.connectionId &&
                    candidate.tableName === relation.targetTable,
            );
            if (!targetFn) {
                toast.error(`Table "${relation.targetTable}" not found`);
                return;
            }
            const targetCol = relation.targetColumns[0] ?? relation.sourceColumns[0];
            const displayValue = cellValue === null || cellValue === undefined ? "" : String(cellValue);
            const filter: FilterCondition = {
                id: `f-${Date.now()}`,
                col: targetCol,
                op: "=" as FilterOp,
                value: displayValue,
                join: "AND" as const,
            };
            await invokeFunction(targetFn);
            const newActiveTabId = useAppStore.getState().activeTabId;
            if (newActiveTabId) {
                useAppStore.getState().updateTabFilters(newActiveTabId, [filter]);
                useAppStore.getState().updateTabFiltersActive(newActiveTabId, true);
                try {
                    const isMysql = connections.find((c) => c.id === fn.connectionId)?.type === "mysql";
                    const qi = (name: string) => (isMysql ? `\`${name}\`` : `"${name}"`);
                    const isNum = displayValue !== "" && !isNaN(Number(displayValue));
                    const sqlVal = isNum ? displayValue : `'${displayValue.replace(/'/g, "''")}'`;
                    const sql = `SELECT * FROM ${qi(relation.targetTable)} WHERE ${qi(targetCol)} = ${sqlVal} LIMIT ${pageSize}`;
                    const result = await tauriApi.executeQuery(fn.connectionId, sql);
                    useAppStore.getState().updateTabFilteredResult(newActiveTabId, result);
                } catch {
                    // Filter set but query failed — user can still apply manually
                }
            }
        },
        [connectionFunctions, fn.connectionId, invokeFunction, pageSize, connections],
    );
    const exportData = useCallback(
        (format: "csv" | "json" | "sql") => {
            if (!queryResult) return;
            const columns =
                queryResult.columns.length > 0
                    ? queryResult.columns
                    : queryResult.rows.length > 0
                        ? Object.keys(queryResult.rows[0])
                        : [];
            let content: string;
            let mimeType: string;
            let filename: string;
            if (format === "csv") {
                const header = columns.join(",");
                const rows = queryResult.rows.map((row) =>
                    columns
                        .map((col) => {
                            const val = row[col];
                            if (val === null || val === undefined) return "";
                            const str = String(val);
                            return /[,"\n]/.test(str)
                                ? `"${str.replace(/"/g, '""')}"`
                                : str;
                        })
                        .join(","),
                );
                content = [header, ...rows].join("\n");
                mimeType = "text/csv";
                filename = `${fn.tableName ?? "export"}.csv`;
            } else if (format === "sql") {
                const table = fn.tableName ?? "export";
                const sqlLines = queryResult.rows.map((row) => {
                    const vals = columns.map((col) => {
                        const val = row[col];
                        if (val === null || val === undefined) return "NULL";
                        if (typeof val === "number" || typeof val === "boolean")
                            return String(val);
                        return `'${String(val).replace(/'/g, "''")}'`;
                    });
                    return `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${vals.join(", ")});`;
                });
                content = sqlLines.join("\n");
                mimeType = "text/plain";
                filename = `${table}.sql`;
            } else {
                content = JSON.stringify(queryResult.rows, null, 2);
                mimeType = "application/json";
                filename = `${fn.tableName ?? "export"}.json`;
            }
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        },
        [queryResult, fn.tableName],
    );
    const openDumpDialog = useCallback(() => {
        if (!fn.tableName || !isRelationalDb) return;
        setShowDumpDialog(true);
    }, [fn.tableName, isRelationalDb]);

    const executeDump = useCallback(async (opts: DumpOptions) => {
        setDumpDbLoading(true);
        const activeDb = selectedDatabases[fn.connectionId] ?? connections.find((c) => c.id === fn.connectionId)?.database ?? database;
        const schemaArg = dbType === "postgresql" ? opts.schema || "public" : null;
        try {
            const sql = await tauriApi.dumpDatabase(
                fn.connectionId,
                activeDb,
                schemaArg,
                opts.includeData,
                opts.includeIndexes,
                opts.includeForeignKeys,
                opts.createDatabase,
            );
            const date = new Date().toISOString().split("T")[0];
            const defaultName = `${activeDb}-${date}.sql`;
            const savePath = await tauriApi.saveFileDialog(defaultName, [
                { name: "SQL Dump", extensions: ["sql"] },
            ]);
            if (savePath) {
                await tauriApi.writeTextFile(savePath, sql);
                toast.success("Database dump saved");
                setShowDumpDialog(false);
            }
        } catch (e) {
            toast.error(`Dump failed: ${e}`);
        } finally {
            setDumpDbLoading(false);
        }
    }, [fn.connectionId, database, selectedDatabases, connections, dbType]);

    // ─── Get active tab for filter state ───────────────────────────────────────
    const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null;
    // ─── Filter state from active tab ──────────────────────────────────────────
    const filters = activeTab?.filters ?? [];
    const filteredResult = activeTab?.filteredResult ?? null;
    const filtersActive = activeTab?.filtersActive ?? false;
    const [filterLoading, setFilterLoading] = useState(false);
    const [showSearchBar, setShowSearchBar] = useState(false);
    const [cellSearch, setCellSearch] = useState("");
    const setFilters = useCallback((newFilters: FilterCondition[]) => {
        if (activeTabId) {
            updateTabFilters(activeTabId, newFilters);
        }
    }, [activeTabId, updateTabFilters]);
    const setFilteredResult = useCallback((result: typeof queryResult | null) => {
        if (activeTabId) {
            updateTabFilteredResult(activeTabId, result as QueryResult | null);
            updateTabFiltersActive(activeTabId, result !== null && filters.length > 0);
        }
    }, [activeTabId, updateTabFilteredResult, updateTabFiltersActive, filters.length]);
    const addFilter = () => {
        if (availableCols.length === 0) return;
        const newFilters: FilterCondition[] = [
            ...filters,
            {
                id: `f-${Date.now()}`,
                col: availableCols[0],
                op: "=" as FilterOp,
                value: "",
                join: "AND" as const,
            },
        ];
        setFilters(newFilters);
    };
    const removeFilter = (id: string) => {
        const next = filters.filter((f) => f.id !== id);
        if (next.length === 0) {
            // Last row removed — clear all filters
            if (activeTabId) {
                clearTabFilters(activeTabId);
            }
        } else {
            setFilters(next);
        }
    };
    const clearFilters = () => {
        // Reset: clear applied results + give one fresh empty row
        const newFilters: FilterCondition[] = [
            {
                id: `f-${Date.now()}`,
                col: availableCols[0] ?? "",
                op: "=" as FilterOp,
                value: "",
                join: "AND" as const,
            },
        ];
        setFilters(newFilters);
        if (activeTabId) {
            updateTabFilteredResult(activeTabId, null);
            updateTabFiltersActive(activeTabId, false);
        }
    };
    const applyFilters = useCallback(async () => {
        if (!fn.tableName || filters.length === 0 || !activeTabId) return;
        setFilterLoading(true);
        const isMysql =
            connections.find((c) => c.id === fn.connectionId)?.type === "mysql";
        const qi = (name: string) => (isMysql ? `\`${name}\`` : `"${name}"`);
        try {
            const whereParts = filters.map((f) => {
                const col = qi(f.col);
                if (f.op === "IS NULL") return `${col} IS NULL`;
                if (f.op === "IS NOT NULL") return `${col} IS NOT NULL`;
                const isNum = f.value !== "" && !isNaN(Number(f.value));
                const val = isNum
                    ? f.value
                    : `'${f.value.replace(/'/g, "''")}'`;
                return `${col} ${f.op} ${val}`;
            });
            const whereClause = whereParts.reduce((acc, part, i) => {
                if (i === 0) return part;
                return `${acc} ${filters[i].join} ${part}`;
            }, "");
            const sql = `SELECT * FROM ${qi(fn.tableName)} WHERE ${whereClause} LIMIT ${pageSize} OFFSET ${page * pageSize}`;
            const result = await tauriApi.executeQuery(fn.connectionId, sql);
            setFilteredResult(result);
        } catch {
            // keep previous filtered result on error
        } finally {
            setFilterLoading(false);
        }
    }, [filters, fn, page, connections, activeTabId, setFilteredResult]);
    // Re-apply filters when page changes (if active)
    useEffect(() => {
        if (filteredResult && filters.length > 0) {
            applyFilters();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page]);
    // Reset column sizing and structure when the active function changes
    useEffect(() => {
        setColumnSizing({});
        setStructure(null);
        if (viewMode === "structure") {
            reloadStructure();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fn.id]);
    useEffect(() => {
        setSchemaGraph(null);
        setSchemaGraphError(null);
        if (viewMode === "er" && isRelationalDb) {
            loadSchemaGraph(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fn.connectionId, database, dbType]);
    const pendingEdits = activeTab?.pendingEdits ?? [];
    const effectiveResult = filteredResult ?? queryResult;
    const resultColumns = useMemo(() => {
        if (effectiveResult?.columns.length) return effectiveResult.columns;
        if (effectiveResult?.rows.length) return Object.keys(effectiveResult.rows[0]);
        return [];
    }, [effectiveResult]);
    const availableCols = resultColumns;
    const primaryKeyColumns = useMemo(
        () => structure?.columns.filter((col) => col.isPrimary).map((col) => col.name) ?? [],
        [structure],
    );
    const optimisticRows = useMemo(() => {
        const baseRows = effectiveResult?.rows ?? [];
        if (baseRows.length === 0 || pendingEdits.length === 0 || primaryKeyColumns.length === 0) {
            return baseRows;
        }
        const editsByRowKey = pendingEdits.reduce<Map<string, PendingCellEdit[]>>(
            (acc, edit) => {
                const group = acc.get(edit.rowKey) ?? [];
                group.push(edit);
                acc.set(edit.rowKey, group);
                return acc;
            },
            new Map(),
        );
        return baseRows.map((row) => {
            const primaryKeyValues = Object.fromEntries(
                primaryKeyColumns.map((col) => [col, row[col] ?? null]),
            );
            const rowKey = buildPendingRowKey(primaryKeyValues, primaryKeyColumns);
            const rowEdits = editsByRowKey.get(rowKey);
            if (!rowEdits?.length) return row;
            const optimisticRow = { ...row } as Record<string, unknown>;
            for (const edit of rowEdits) {
                optimisticRow[edit.columnId] = edit.pendingValue;
            }
            Object.defineProperty(optimisticRow, "__pendingRowKey", {
                value: rowKey,
                enumerable: false,
            });
            Object.defineProperty(optimisticRow, "__pendingPrimaryKeyValues", {
                value: primaryKeyValues,
                enumerable: false,
            });
            return optimisticRow;
        });
    }, [effectiveResult, pendingEdits, primaryKeyColumns]);
    const searchedRows = useMemo(() => {
        if (!cellSearch.trim()) return optimisticRows;
        const q = cellSearch.toLowerCase();
        return optimisticRows.filter((row) =>
            Object.values(row).some(
                (v) => v !== null && String(v).toLowerCase().includes(q),
            ),
        );
    }, [cellSearch, optimisticRows]);
    const autoColumnSizing = useMemo(() => {
        const sizing: ColumnSizingState = {};
        for (const col of resultColumns) {
            const maxLen = Math.max(
                getContentFitLength(col),
                ...searchedRows.map((row) => getContentFitLength(row[col])),
                1,
            );
            sizing[col] = Math.min(
                Math.max(
                    maxLen * CONTENT_FIT_CHAR_WIDTH_PX + CONTENT_FIT_CELL_PADDING_PX,
                    MIN_COLUMN_WIDTH,
                ),
                MAX_CONTENT_FIT_COLUMN_WIDTH,
            );
        }
        return sizing;
    }, [resultColumns, searchedRows]);
    const pendingEditLookup = useMemo(
        () =>
            new Map(
                pendingEdits.map((edit) => [`${edit.rowKey}:${edit.columnId}`, edit]),
            ),
        [pendingEdits],
    );
    const getPendingEditForCell = useCallback(
        (rowData: Record<string, unknown>, columnId: string) => {
            if (primaryKeyColumns.length === 0) return null;
            const metaPrimaryKeyValues =
                (rowData as {
                    __pendingPrimaryKeyValues?: Record<string, unknown>;
                }).__pendingPrimaryKeyValues;
            const rowKey =
                (rowData as { __pendingRowKey?: string }).__pendingRowKey ??
                buildPendingRowKey(
                    metaPrimaryKeyValues ??
                    Object.fromEntries(
                        primaryKeyColumns.map((col) => [col, rowData[col] ?? null]),
                    ),
                    primaryKeyColumns,
                );
            return pendingEditLookup.get(`${rowKey}:${columnId}`) ?? null;
        },
        [pendingEditLookup, primaryKeyColumns],
    );
    // ─── Import state ───────────────────────────────────────────────────────────
    const [showImport, setShowImport] = useState(false);
    const [showDumpDialog, setShowDumpDialog] = useState(false);
    const [dumpDbLoading, setDumpDbLoading] = useState(false);
    const [showImportSqlDialog, setShowImportSqlDialog] = useState(false);
    const [importText, setImportText] = useState("");
    const [importFormat, setImportFormat] = useState<"csv" | "json">("csv");
    const [importPreview, setImportPreview] = useState<{
        headers: string[];
        rows: string[][];
    } | null>(null);
    const [importError, setImportError] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const [importDone, setImportDone] = useState<number | null>(null);
    const dblClickRef = useRef<{
        key: string;
        timer: ReturnType<typeof setTimeout>;
    } | null>(null);
    function parseCsvRow(line: string): string[] {
        const result: string[] = [];
        let cur = "",
            inQ = false;
        for (let i = 0; i < line.length; i++) {
            if (line[i] === '"') {
                if (inQ && line[i + 1] === '"') {
                    cur += '"';
                    i++;
                } else inQ = !inQ;
            } else if (line[i] === "," && !inQ) {
                result.push(cur);
                cur = "";
            } else cur += line[i];
        }
        result.push(cur);
        return result;
    }
    const parseImport = useCallback((text: string, fmt: "csv" | "json") => {
        setImportError(null);
        setImportPreview(null);
        if (!text.trim()) return;
        try {
            if (fmt === "json") {
                const arr = JSON.parse(text);
                if (!Array.isArray(arr) || arr.length === 0)
                    throw new Error(
                        "Expected a non-empty JSON array of objects",
                    );
                const headers = Object.keys(arr[0]);
                const rows = arr.map((row: any) =>
                    headers.map((h) => (row[h] == null ? "" : String(row[h]))),
                );
                setImportPreview({ headers, rows });
            } else {
                const lines = text.trim().split(/\r?\n/);
                if (lines.length < 2)
                    throw new Error(
                        "CSV must have at least a header row and one data row",
                    );
                const headers = parseCsvRow(lines[0]);
                const rows = lines.slice(1).map(parseCsvRow);
                setImportPreview({ headers, rows });
            }
        } catch (e) {
            setImportError(String(e));
        }
    }, []);
    const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const fmt: "csv" | "json" = file.name.endsWith(".json")
            ? "json"
            : "csv";
        setImportFormat(fmt);
        const reader = new FileReader();
        reader.onload = (ev) => {
            const text = ev.target?.result as string;
            setImportText(text);
            parseImport(text, fmt);
        };
        reader.readAsText(file);
    };
    const runImport = useCallback(async () => {
        if (!importPreview || !fn.tableName) return;
        setImporting(true);
        setImportError(null);
        try {
            const { headers, rows } = importPreview;
            const colList = headers.map((h) => `"${h}"`).join(", ");
            const BATCH = 200;
            let total = 0;
            for (let i = 0; i < rows.length; i += BATCH) {
                const batch = rows.slice(i, i + BATCH);
                const values = batch
                    .map(
                        (row) =>
                            "(" +
                            row
                                .map((v) =>
                                    v === ""
                                        ? "NULL"
                                        : `'${v.replace(/'/g, "''")}'`,
                                )
                                .join(", ") +
                            ")",
                    )
                    .join(",\n");
                await tauriApi.executeQuery(
                    fn.connectionId,
                    `INSERT INTO "${fn.tableName}" (${colList}) VALUES ${values}`,
                );
                total += batch.length;
            }
            setImportDone(total);
            setImportPreview(null);
            setImportText("");
            await onPageChange(0);
        } catch (e) {
            setImportError(String(e));
        } finally {
            setImporting(false);
        }
    }, [importPreview, fn, onPageChange]);
    const loadStructure =
        useCallback(async (): Promise<TableStructure | null> => {
            if (structure) return structure;
            if (!fn.tableName) return null;
            setStructureLoading(true);
            try {
                const s = await tauriApi.getTableStructure(
                    fn.connectionId,
                    database,
                    fn.tableName,
                );
                setStructure(s);
                return s;
            } catch {
                return null;
            } finally {
                setStructureLoading(false);
            }
        }, [fn, database, structure]);
    const reloadStructure = useCallback(async () => {
        if (!fn.tableName) return;
        setStructureLoading(true);
        try {
            const s = await tauriApi.getTableStructure(
                fn.connectionId,
                database,
                fn.tableName,
            );
            setStructure(s);
        } catch {
            setStructure(null);
        } finally {
            setStructureLoading(false);
        }
    }, [fn, database]);
    const valueToSqlLiteral = useCallback((value: unknown) => {
        if (value === null || value === undefined) return "NULL";
        if (typeof value === "number" || typeof value === "boolean")
            return String(value);
        return `'${String(value).replace(/'/g, "''")}'`;
    }, []);
    const ensureEditablePrimaryKeys = useCallback(async () => {
        const s = structure ?? (await loadStructure());
        if (!s) {
            const message = "Could not load table structure";
            setCellEditError(message);
            toast.error(message);
            return null;
        }
        const pkCols = s.columns.filter((col) => col.isPrimary).map((col) => col.name);
        if (pkCols.length === 0) {
            const message = "No primary key — editing unavailable for this table";
            setCellEditError(message);
            toast.error(message);
            return null;
        }
        return pkCols;
    }, [loadStructure, structure]);
    const columnMetaMap = useMemo<Record<string, ColumnEditMeta>>(
        () =>
            Object.fromEntries(
                (structure?.columns ?? []).map((column) => [
                    column.name,
                    buildColumnEditMeta(column),
                ]),
            ),
        [structure],
    );
    const isColumnEditable = useCallback(
        (columnId: string) => !(columnMetaMap[columnId]?.isPrimary ?? false),
        [columnMetaMap],
    );
    const canSetColumnToNull = useCallback(
        (columnId: string) => !(columnMetaMap[columnId]?.isPrimary ?? false),
        [columnMetaMap],
    );
    const getEditBlockReason = useCallback(
        (columnId: string) =>
            columnMetaMap[columnId]?.isPrimary
                ? "Primary key columns are read-only in the result editor"
                : null,
        [columnMetaMap],
    );
    const showBlockedEditToast = useCallback((message: string) => {
        setCellEditError(message);
        toast.warning(message);
    }, []);
    const resolveColumnMeta = useCallback(
        async (columnId: string): Promise<ColumnEditMeta | null> => {
            const cached = columnMetaMap[columnId];
            if (cached) return cached;
            if (!fn.tableName) return null;
            const loadedStructure = await loadStructure();
            const column = loadedStructure?.columns.find(
                (candidate) => candidate.name === columnId,
            );
            return column ? buildColumnEditMeta(column) : null;
        },
        [columnMetaMap, fn.tableName, loadStructure],
    );
    const ensureColumnEditable = useCallback(
        async (columnId: string) => {
            const cachedReason = getEditBlockReason(columnId);
            if (cachedReason) {
                showBlockedEditToast(cachedReason);
                return false;
            }

            const columnMeta = await resolveColumnMeta(columnId);
            if (!columnMeta?.isPrimary) return true;

            const message =
                "Primary key columns are read-only in the result editor";
            showBlockedEditToast(message);
            return false;
        },
        [getEditBlockReason, resolveColumnMeta, showBlockedEditToast],
    );
    const ensureColumnCanSetNull = useCallback(
        async (columnId: string) => {
            if (canSetColumnToNull(columnId)) {
                const columnMeta = await resolveColumnMeta(columnId);
                if (!columnMeta?.isPrimary) return true;
            }

            const message =
                "Primary key columns cannot be set to NULL in the result editor";
            showBlockedEditToast(message);
            return false;
        },
        [canSetColumnToNull, resolveColumnMeta, showBlockedEditToast],
    );
    const startInlineEdit = useCallback(
        async (
            rowIdx: number,
            col: string,
            value: unknown,
            rowData: Record<string, unknown>,
        ) => {
            if (!fn.tableName) return;
            const canEdit = await ensureColumnEditable(col);
            if (!canEdit) return;
            setEditingCell({
                rowIdx,
                col,
                value: toEditString(value),
                rowData,
            });
        },
        [ensureColumnEditable, fn.tableName],
    );
    const editCellInModal = useCallback(async (
        rowIdx: number,
        col: string,
        value: unknown,
        rowData: Record<string, unknown>,
    ) => {
        if (!fn.tableName) return;
        const canEdit = await ensureColumnEditable(col);
        if (!canEdit) return;
        const strVal = toEditString(value);
        let fmt: "Text" | "JSON" | "HTML" = "Text";
        const trimmed = strVal.trimStart();
        if (
            (trimmed.startsWith("{") || trimmed.startsWith("[")) &&
            (() => {
                try {
                    JSON.parse(strVal);
                    return true;
                } catch {
                    return false;
                }
            })()
        ) {
            fmt = "JSON";
        } else if (trimmed.startsWith("<") && trimmed.includes(">")) {
            fmt = "HTML";
        }
        setCellModal({ rowIdx, col, value: strVal, format: fmt, rowData });
    }, [ensureColumnEditable, fn.tableName]);
    useEffect(() => {
        if (!fn.tableName || structure || structureLoading) return;
        const prefetchKey = `${fn.connectionId}:${database}:${fn.tableName}`;
        if (structurePrefetchRef.current === prefetchKey) return;
        structurePrefetchRef.current = prefetchKey;
        void loadStructure();
    }, [
        database,
        fn.connectionId,
        fn.tableName,
        loadStructure,
        structure,
        structureLoading,
    ]);
    const queueCellChange = useCallback(
        async (
            rowData: Record<string, unknown>,
            columnId: string,
            nextValue: string | null,
        ) => {
            if (!fn.tableName || !activeTabId) return false;
            const canEdit = await ensureColumnEditable(columnId);
            if (!canEdit) return false;
            const pkCols = await ensureEditablePrimaryKeys();
            if (!pkCols) return false;
            const metaPrimaryKeyValues =
                (rowData as {
                    __pendingPrimaryKeyValues?: Record<string, unknown>;
                }).__pendingPrimaryKeyValues;
            const primaryKeyValues =
                metaPrimaryKeyValues ??
                Object.fromEntries(pkCols.map((col) => [col, rowData[col] ?? null]));
            const rowKey =
                (rowData as { __pendingRowKey?: string }).__pendingRowKey ??
                buildPendingRowKey(primaryKeyValues, pkCols);
            const existingEdit = pendingEdits.find(
                (edit) => edit.rowKey === rowKey && edit.columnId === columnId,
            );
            const originalValue = existingEdit?.originalValue ?? rowData[columnId] ?? null;
            if (normalizeQueuedValue(originalValue) === nextValue) {
                if (existingEdit) {
                    removePendingCellEdits(activeTabId, [existingEdit.id]);
                }
                setCellEditError(null);
                return true;
            }
            const now = Date.now();
            queuePendingCellEdit(activeTabId, {
                id: existingEdit?.id ?? `pe-${now}-${Math.random().toString(36).slice(2, 7)}`,
                tabId: activeTabId,
                connectionId: fn.connectionId,
                tableName: fn.tableName,
                rowKey,
                primaryKeyValues,
                columnId,
                originalValue,
                pendingValue: nextValue,
                createdAt: existingEdit?.createdAt ?? now,
                updatedAt: now,
            });
            setCellEditError(null);
            return true;
        },
        [
            activeTabId,
            ensureColumnEditable,
            ensureEditablePrimaryKeys,
            fn.connectionId,
            fn.tableName,
            pendingEdits,
            queuePendingCellEdit,
            removePendingCellEdits,
        ],
    );
    const resetPendingEdits = useCallback(() => {
        if (!activeTabId || pendingEdits.length === 0) return;
        clearPendingCellEdits(activeTabId);
        setCellEditError(null);
        toast.success(`Reset ${pendingEdits.length} pending change${pendingEdits.length === 1 ? "" : "s"}`);
    }, [activeTabId, clearPendingCellEdits, pendingEdits.length]);
    const applyPendingEdits = useCallback(async () => {
        if (!activeTabId || !fn.tableName || pendingEdits.length === 0) return;
        setPendingApplyLoading(true);
        const appliedIds: string[] = [];
        const currentPrimaryKeys = new Map<string, Record<string, unknown>>();
        try {
            for (const edit of pendingEdits) {
                const whereKeys = currentPrimaryKeys.get(edit.rowKey) ?? {
                    ...edit.primaryKeyValues,
                };
                const whereParts = Object.entries(whereKeys).map(([col, value]) =>
                    value === null || value === undefined
                        ? `${qi(col)} IS NULL`
                        : `${qi(col)} = ${valueToSqlLiteral(value)}`,
                );
                const updateSql = `UPDATE ${qi(fn.tableName)} SET ${qi(edit.columnId)} = ${valueToSqlLiteral(edit.pendingValue)} WHERE ${whereParts.join(" AND ")}`;
                await tauriApi.executeQuery(fn.connectionId, updateSql);
                appliedIds.push(edit.id);
                if (Object.prototype.hasOwnProperty.call(whereKeys, edit.columnId)) {
                    whereKeys[edit.columnId] = edit.pendingValue;
                }
                currentPrimaryKeys.set(edit.rowKey, whereKeys);
            }
            clearPendingCellEdits(activeTabId);
            setCellEditError(null);
            await onPageChange(page);
            toast.success(`Applied ${appliedIds.length} pending change${appliedIds.length === 1 ? "" : "s"}`);
        } catch (error) {
            if (appliedIds.length > 0) {
                removePendingCellEdits(activeTabId, appliedIds);
            }
            setCellEditError(String(error));
            await onPageChange(page);
            toast.error(`Apply failed: ${String(error)}`);
        } finally {
            setPendingApplyLoading(false);
        }
    }, [
        activeTabId,
        clearPendingCellEdits,
        fn.connectionId,
        fn.tableName,
        onPageChange,
        page,
        pendingEdits,
        removePendingCellEdits,
        valueToSqlLiteral,
    ]);
    useEffect(() => {
        if (pendingEdits.length > 0 && !structure && fn.tableName) {
            loadStructure();
        }
    }, [fn.tableName, loadStructure, pendingEdits.length, structure]);
    const loadSchemaGraph = useCallback(
        async (force = false): Promise<SchemaGraph | null> => {
            if (!isRelationalDb) return null;
            if (schemaGraph && !force) return schemaGraph;
            setSchemaGraphLoading(true);
            setSchemaGraphError(null);
            try {
                const graph = await tauriApi.getSchemaGraph(
                    fn.connectionId,
                    database,
                );
                setSchemaGraph(graph);
                return graph;
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                setSchemaGraphError(message);
                return null;
            } finally {
                setSchemaGraphLoading(false);
            }
        },
        [database, fn.connectionId, isRelationalDb, schemaGraph],
    );
    const handleDiagramTableSelect = useCallback(
        async (tableName: string) => {
            if (tableName === fn.tableName) return;
            const allFns = Object.values(connectionFunctions).flat();
            const tableFn = allFns.find(
                (candidate) =>
                    candidate.type === "table" &&
                    candidate.connectionId === fn.connectionId &&
                    candidate.tableName === tableName,
            );
            if (tableFn) {
                await invokeFunction(tableFn);
            }
        },
        [connectionFunctions, fn.connectionId, fn.tableName, invokeFunction],
    );
    const handleViewMode = (mode: ViewMode) => {
        setViewMode(mode);
        if (mode === "structure") loadStructure();
        if (mode === "er") loadSchemaGraph();
    };
    useEffect(() => {
        setSelectedRowIdx(-1);
        setEditingCell(null);
        setCellSearch("");
        setShowSearchBar(false);
    }, [queryResult]);

    useEffect(() => {
        if (viewMode === "er" && !schemaGraph && isRelationalDb) {
            loadSchemaGraph();
        }
    }, [isRelationalDb, loadSchemaGraph, schemaGraph, viewMode]);
    useEffect(() => {
        if (viewMode === "data" && !schemaGraph && isRelationalDb) {
            loadSchemaGraph();
        }
    }, [isRelationalDb, loadSchemaGraph, schemaGraph, viewMode]);
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (
                (e.metaKey || e.ctrlKey) &&
                e.key === "f" &&
                viewMode === "data"
            ) {
                e.preventDefault();
                setShowSearchBar(true);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [viewMode]);
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key !== "Enter") return;
            if (!selectedCell || !fn.tableName) return;
            // Ignore if already editing or a modal/input is focused
            const tag = (document.activeElement as HTMLElement)?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA") return;
            e.preventDefault();
            void (async () => {
                const rowData = searchedRows[selectedCell.rowIdx];
                if (!rowData) return;
                if (e.shiftKey) {
                    await editCellInModal(
                        selectedCell.rowIdx,
                        selectedCell.colId,
                        rowData[selectedCell.colId],
                        rowData,
                    );
                } else {
                    await startInlineEdit(
                        selectedCell.rowIdx,
                        selectedCell.colId,
                        rowData[selectedCell.colId],
                        rowData,
                    );
                }
            })();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [editCellInModal, fn.tableName, searchedRows, selectedCell, startInlineEdit]);
    const commitEdit = useCallback(async () => {
        if (!editingCell || !fn.tableName) {
            setEditingCell(null);
            return;
        }
        setCellEditLoading(true);
        try {
            const queued = await queueCellChange(
                editingCell.rowData,
                editingCell.col,
                editingCell.value === "" ? null : editingCell.value,
            );
            if (!queued) return;
            setEditingCell(null);
            setCellEditError(null);
            toast.success(`Queued "${editingCell.col}"`, {
                description: `${fn.tableName} → ${editingCell.value === "" ? "NULL" : editingCell.value}`,
            });
        } catch (e) {
            setCellEditError(String(e));
            setEditingCell(null);
        } finally {
            setCellEditLoading(false);
        }
    }, [
        editingCell,
        fn,
        queueCellChange,
    ]);
    const buildAndShowDeleteSql = useCallback(
        async (rowData: Record<string, unknown>) => {
            if (!fn.tableName || !queryResult) return;
            const s = structure ?? (await loadStructure());
            if (!s) return;
            const pkCols = s.columns.filter((c) => c.isPrimary);
            const metaPrimaryKeyValues =
                (rowData as {
                    __pendingPrimaryKeyValues?: Record<string, unknown>;
                }).__pendingPrimaryKeyValues;
            let whereParts: string[];
            if (pkCols.length > 0) {
                whereParts = pkCols.map((pk) => {
                    const v = metaPrimaryKeyValues?.[pk.name] ?? rowData[pk.name];
                    if (v === null || v === undefined)
                        return `${qi(pk.name)} IS NULL`;
                    return `${qi(pk.name)} = '${String(v).replace(/'/g, "''")}'`;
                });
            } else {
                whereParts = Object.entries(rowData).map(([col, v]) => {
                    if (v === null || v === undefined)
                        return `${qi(col)} IS NULL`;
                    return `${qi(col)} = '${String(v).replace(/'/g, "''")}'`;
                });
            }
            setDeleteRowSql(
                `DELETE FROM ${qi(fn.tableName!)} WHERE ${whereParts.join(" AND ")}`,
            );
        },
        [fn, structure, queryResult, loadStructure],
    );
    const executeDeleteRow = useCallback(async () => {
        if (!deleteRowSql) return;
        setDeleteRowLoading(true);
        try {
            await tauriApi.executeQuery(fn.connectionId, deleteRowSql);
            setDeleteRowSql(null);
            await onPageChange(page);
        } catch (e) {
            setCellEditError(String(e));
            setDeleteRowSql(null);
        } finally {
            setDeleteRowLoading(false);
        }
    }, [deleteRowSql, fn, page, onPageChange]);
    // ── Row context menu helpers ────────────────────────────────────────────────
    const copyToClipboard = (text: string) =>
        navigator.clipboard.writeText(text);
    const cloneRow = useCallback(
        async (rowData: Record<string, unknown>) => {
            if (!fn.tableName) return;
            let cols = Object.keys(rowData);
            const loadedStructure = structure ?? (await loadStructure());
            if (loadedStructure) {
                const generatedPrimaryKeys = new Set(
                    loadedStructure.columns
                        .filter((column) => {
                            const meta = buildColumnEditMeta(column);
                            return meta.isPrimary && meta.isGeneratedLike;
                        })
                        .map((column) => column.name),
                );
                cols = cols.filter((col) => !generatedPrimaryKeys.has(col));
            }
            const cloneSql =
                cols.length === 0
                    ? dbType === "mysql"
                        ? `INSERT INTO ${qi(fn.tableName)} () VALUES ()`
                        : `INSERT INTO ${qi(fn.tableName)} DEFAULT VALUES`
                    : `INSERT INTO ${qi(fn.tableName)} (${cols.map((c) => qi(c)).join(", ")}) VALUES (${cols
                          .map((c) => {
                              const v = rowData[c];
                              if (v === null || v === undefined) return "NULL";
                              return `'${String(v).replace(/'/g, "''")}'`;
                          })
                          .join(", ")})`;
            try {
                await tauriApi.executeQuery(fn.connectionId, cloneSql);
                await onPageChange(page);
            } catch (e) {
                setCellEditError(String(e));
            }
        },
        [dbType, fn, loadStructure, onPageChange, page, qi, structure],
    );
    const setNullCell = useCallback(
        async (rowData: Record<string, unknown>, col: string) => {
            try {
                const canSetNull = await ensureColumnCanSetNull(col);
                if (!canSetNull) return;
                const queued = await queueCellChange(rowData, col, null);
                if (!queued) return;
                toast.success(`Queued "${col}"`, {
                    description: `${fn.tableName} → NULL`,
                });
            } catch (e) {
                setCellEditError(String(e));
            }
        },
        [ensureColumnCanSetNull, fn.tableName, queueCellChange],
    );
    // ── Cell context menu helpers ────────────────────────────────────────────────
    const copyCellAsTSV = (col: string, value: unknown) =>
        copyToClipboard(`${col}\t${value === null ? "" : String(value)}`);
    const copyCellAsJSON = (col: string, value: unknown) =>
        copyToClipboard(JSON.stringify({ [col]: value }, null, 2));
    const copyCellAsMarkdown = (col: string, value: unknown) => {
        const val = value === null ? "" : String(value);
        const w = Math.max(col.length, val.length, 1);
        copyToClipboard(
            `| ${col.padEnd(w)} |\n| ${"-".repeat(w)} |\n| ${val.padEnd(w)} |`,
        );
    };
    const copyCellAsSQL = (value: unknown) =>
        copyToClipboard(
            value === null ? "NULL" : `'${String(value).replace(/'/g, "''")}'`,
        );
    const copyCellForIN = (value: unknown) =>
        copyToClipboard(
            value === null
                ? "(NULL)"
                : `('${String(value).replace(/'/g, "''")}')`,
        );
    const pasteToCell = async (rowIdx: number, col: string) => {
        try {
            const canEdit = await ensureColumnEditable(col);
            if (!canEdit) return;
            const text = await navigator.clipboard.readText();
            const rowData = searchedRows[rowIdx];
            if (!fn.tableName || !rowData) return;
            const queued = await queueCellChange(rowData, col, text);
            if (!queued) return;
            toast.success(`Queued "${col}"`, {
                description: `${fn.tableName} → ${text || "[empty]"}`,
            });
        } catch {
            /* clipboard read denied — silently ignore */
        }
    };
    const applyCellModal = useCallback(async () => {
        if (!cellModal || !fn.tableName) return;
        try {
            setCellEditLoading(true);
            const queued = await queueCellChange(
                cellModal.rowData,
                cellModal.col,
                cellModal.value === "" ? null : cellModal.value,
            );
            if (!queued) return;
            setCellModal(null);
            toast.success(`Queued "${cellModal.col}"`, {
                description: `${fn.tableName} → ${cellModal.value === "" ? "NULL" : cellModal.value}`,
            });
        } catch (e) {
            setCellEditError(String(e));
        } finally {
            setCellEditLoading(false);
        }
    }, [cellModal, fn.tableName, queueCellChange]);
    // ── Column context menu helpers ─────────────────────────────────────────────
    const getColValues = (col: string) =>
        searchedRows.map((r) =>
            r[col] === null || r[col] === undefined ? "" : String(r[col]),
        );
    const copyColValues = (col: string) =>
        copyToClipboard(getColValues(col).join("\n"));
    const copyColAsTSV = (col: string) =>
        copyToClipboard([col, ...getColValues(col)].join("\t"));
    const copyColAsJSON = (col: string) =>
        copyToClipboard(
            JSON.stringify(
                searchedRows.map((r) => r[col] ?? null),
                null,
                2,
            ),
        );
    const copyColAsMarkdown = (col: string) => {
        const vals = getColValues(col);
        const width = Math.max(col.length, ...vals.map((v) => v.length), 1);
        const pad = (s: string) => s.padEnd(width);
        copyToClipboard(
            [
                `| ${pad(col)} |`,
                `| ${"-".repeat(width)} |`,
                ...vals.map((v) => `| ${pad(v)} |`),
            ].join("\n"),
        );
    };
    const copyColAsSQL = (col: string) =>
        copyToClipboard(
            getColValues(col)
                .map((v) => `'${v.replace(/'/g, "''")}'`)
                .join(",\n"),
        );
    const copyColForIN = (col: string) =>
        copyToClipboard(
            `(${getColValues(col)
                .map((v) => `'${v.replace(/'/g, "''")}'`)
                .join(", ")})`,
        );
    const resizeAllToMatch = (size: number) => {
        const newSizing: ColumnSizingState = {};
        table.getAllColumns().forEach((c) => {
            newSizing[c.id] = size;
        });
        setColumnSizing(newSizing);
    };
    const resizeAllToFitContent = () => {
        setColumnSizing({});
    };
    const resetLayout = () => {
        setColumnSizing({});
        setColumnVisibility({});
        setSelectedColId(null);
    };
    const executeColumnNull = useCallback(async () => {
        if (!columnNullConfirmCol || !fn.tableName) return;
        try {
            const canSetNull = await ensureColumnCanSetNull(columnNullConfirmCol);
            if (!canSetNull) return;
            await tauriApi.executeQuery(
                fn.connectionId,
                `UPDATE ${qi(fn.tableName!)} SET ${qi(columnNullConfirmCol)} = NULL`,
            );
            await onPageChange(page);
        } catch (e) {
            setCellEditError(String(e));
        } finally {
            setColumnNullConfirmCol(null);
        }
    }, [columnNullConfirmCol, ensureColumnCanSetNull, fn, page, onPageChange]);
    const openColumnNullDialog = useCallback(
        async (columnId: string) => {
            const canSetNull = await ensureColumnCanSetNull(columnId);
            if (!canSetNull) return;
            setColumnNullConfirmCol(columnId);
        },
        [ensureColumnCanSetNull],
    );
    const openFilterForCol = (col: string) => {
        setFilters([
            {
                id: `f-${Date.now()}`,
                col,
                op: "=" as FilterOp,
                value: "",
                join: "AND",
            },
        ]);
    };
    // ── DDL helpers ────────────────────────────────────────────────────────────
    const COL_TYPES: Record<DatabaseType, string[]> = {
        postgresql: [
            "TEXT",
            "INTEGER",
            "BIGINT",
            "BOOLEAN",
            "TIMESTAMP",
            "FLOAT",
            "DECIMAL",
            "JSON",
            "UUID",
            "SERIAL",
            "VARCHAR(255)",
        ],
        mysql: [
            "VARCHAR(255)",
            "INT",
            "BIGINT",
            "TEXT",
            "BOOLEAN",
            "DATETIME",
            "FLOAT",
            "DOUBLE",
            "DECIMAL",
            "JSON",
        ],
        sqlite: ["TEXT", "INTEGER", "REAL", "BLOB", "NUMERIC"],
        mongodb: [],
        redis: [],
    };
    function buildCreateIndexSql(
        tableName: string,
        idxName: string,
        columns: string[],
        unique: boolean,
    ): string {
        const uniqueClause = unique ? "UNIQUE " : "";
        const colList = columns.map(qi).join(", ");
        return `CREATE ${uniqueClause}INDEX ${qi(idxName)} ON ${qi(tableName)} (${colList})`;
    }
    function buildDropIndexSql(tableName: string, idxName: string): string {
        if (dbType === "mysql") {
            return `DROP INDEX ${qi(idxName)} ON ${qi(tableName)}`;
        }
        return `DROP INDEX ${qi(idxName)}`;
    }
    const executeDropTable = useCallback(async () => {
        if (!fn.tableName) return;
        setDropTableLoading(true);
        try {
            await tauriApi.executeQuery(
                fn.connectionId,
                `DROP TABLE ${qi(fn.tableName)}`,
            );
            setShowDropTable(false);
            // Close all tabs for this table and refresh the sidebar list
            tabs.filter(
                (t) =>
                    t.fn.connectionId === fn.connectionId &&
                    t.fn.tableName === fn.tableName,
            ).forEach((t) => closeTab(t.id));
            await refreshTables(fn.connectionId);
        } catch (e) {
            setCellEditError(String(e));
        } finally {
            setDropTableLoading(false);
        }
    }, [fn, qi, tabs, closeTab, refreshTables]);
    const executeRenameTable = useCallback(async () => {
        if (!fn.tableName || !renameTableName.trim()) return;
        setRenameTableLoading(true);
        try {
            await tauriApi.executeQuery(
                fn.connectionId,
                `ALTER TABLE ${qi(fn.tableName)} RENAME TO ${qi(renameTableName.trim())}`,
            );
            setShowRenameTable(false);
        } catch (e) {
            setCellEditError(String(e));
        } finally {
            setRenameTableLoading(false);
        }
    }, [fn, renameTableName, qi]);
    const executeAddColumn = useCallback(async () => {
        if (!fn.tableName || !addCol.name.trim()) return;
        setAddColLoading(true);
        setAddColError(null);
        try {
            const nullPart = addCol.nullable ? "" : " NOT NULL";
            await tauriApi.executeQuery(
                fn.connectionId,
                `ALTER TABLE ${qi(fn.tableName)} ADD COLUMN ${qi(addCol.name.trim())} ${addCol.type}${nullPart}`,
            );
            setShowAddColumn(false);
            setAddCol({ name: "", type: "TEXT", nullable: true });
            await reloadStructure();
        } catch (e) {
            setAddColError(String(e));
        } finally {
            setAddColLoading(false);
        }
    }, [fn, addCol, qi, reloadStructure]);
    const executeDropColumn = useCallback(async () => {
        if (!fn.tableName || !dropColTarget) return;
        setDropColLoading(true);
        try {
            await tauriApi.executeQuery(
                fn.connectionId,
                `ALTER TABLE ${qi(fn.tableName)} DROP COLUMN ${qi(dropColTarget)}`,
            );
            setDropColTarget(null);
            await reloadStructure();
        } catch (e) {
            setCellEditError(String(e));
        } finally {
            setDropColLoading(false);
        }
    }, [fn, dropColTarget, qi, reloadStructure]);
    const executeCreateIndex = useCallback(async () => {
        if (
            !fn.tableName ||
            !createIdxDef.name.trim() ||
            createIdxDef.columns.length === 0
        )
            return;
        setCreateIdxLoading(true);
        setCreateIdxError(null);
        try {
            await tauriApi.executeQuery(
                fn.connectionId,
                buildCreateIndexSql(
                    fn.tableName,
                    createIdxDef.name.trim(),
                    createIdxDef.columns,
                    createIdxDef.unique,
                ),
            );
            setShowCreateIndex(false);
            setCreateIdxDef({ name: "", columns: [], unique: false });
            await reloadStructure();
        } catch (e) {
            setCreateIdxError(String(e));
        } finally {
            setCreateIdxLoading(false);
        }
    }, [fn, createIdxDef, dbType, qi, reloadStructure]);
    const executeDropIndex = useCallback(async () => {
        if (!fn.tableName || !dropIdxTarget) return;
        setDropIdxLoading(true);
        try {
            await tauriApi.executeQuery(
                fn.connectionId,
                buildDropIndexSql(fn.tableName, dropIdxTarget),
            );
            setDropIdxTarget(null);
            await reloadStructure();
        } catch (e) {
            setCellEditError(String(e));
        } finally {
            setDropIdxLoading(false);
        }
    }, [fn, dropIdxTarget, dbType, qi, reloadStructure]);
    const table = useReactTable({
        data: searchedRows,
        columns: [
            ...resultColumns.map((col: string) => ({
                accessorKey: col,
                header: col,
                size: autoColumnSizing[col] ?? DEFAULT_FIXED_COLUMN_WIDTH,
                minSize: MIN_COLUMN_WIDTH,
                cell: (info: any) => {
                    const rowIdx = info.row.index;
                    const rowData = info.row.original as Record<string, unknown>;
                    const pendingEdit = getPendingEditForCell(rowData, col);
                    const isEditing =
                        editingCell?.rowIdx === rowIdx &&
                        editingCell?.col === col;
                    if (isEditing) {
                        return (
                            <div
                                className="flex items-stretch -mx-4 -my-2 h-8"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <input
                                    autoFocus
                                    value={editingCell.value}
                                    onChange={(e) =>
                                        setEditingCell((prev) =>
                                            prev
                                                ? {
                                                    ...prev,
                                                    value: e.target.value,
                                                }
                                                : null,
                                        )
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            commitEdit();
                                        }
                                        if (e.key === "Escape") {
                                            e.preventDefault();
                                            setEditingCell(null);
                                        }
                                    }}
                                    className="flex-1 h-full min-w-0 bg-primary/10 border-0 border-b-2 border-primary/50 px-4 py-0 outline-none text-[11px] font-mono text-foreground"
                                />
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingCell(null);
                                    }}
                                    className="h-full w-7 shrink-0 flex items-center justify-center text-muted-foreground/40 hover:text-foreground hover:bg-muted/50 border-l border-border/30 transition-colors"
                                >
                                    <X size={10} />
                                </button>
                            </div>
                        );
                    }
                    const fkRel = fkLookup.get(col);
                    const fkValue = info.getValue();
                    const showFkIcon = fkRel && fkValue !== null && fkValue !== undefined;
                    return (
                        <div className="absolute inset-0 flex items-center px-4 overflow-hidden group/fk">
                            <span
                                className={cn(
                                    "font-medium truncate",
                                    pendingEdit
                                        ? "text-warning"
                                        : info.getValue() === null
                                            ? "text-muted-foreground italic"
                                            : showFkIcon
                                                ? "text-accent-blue"
                                                : "",
                                    showFkIcon && "pr-3",
                                )}
                            >
                                {info.getValue() === null
                                    ? "[NULL]"
                                    : typeof info.getValue() === "object"
                                        ? JSON.stringify(info.getValue())
                                        : String(info.getValue())}
                            </span>
                            {showFkIcon && (
                                <button
                                    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover/fk:opacity-100 transition-opacity p-0.5 rounded hover:bg-accent-blue/15 text-accent-blue/60 hover:text-accent-blue shrink-0"
                                    title={`Go to ${fkRel.targetTable}.${fkRel.targetColumns[0]}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        navigateToFkTarget(fkRel, fkValue);
                                    }}
                                >
                                    <ExternalLink size={11} />
                                </button>
                            )}
                        </div>
                    );
                },
            })),
        ],
        columnResizeMode: "onChange",
        state: { sorting, columnSizing, columnVisibility },
        onSortingChange: setSorting,
        onColumnSizingChange: setColumnSizing,
        onColumnVisibilityChange: setColumnVisibility,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });
    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center bg-background">
                <Loader2 size={20} className="animate-spin text-primary" />
            </div>
        );
    }
    if (!effectiveResult) return null;
    // No columns at all means a DDL/non-SELECT result — show simple card
    if (effectiveResult.columns.length === 0 && !filtersActive) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-accent-green bg-background p-8 text-center">
                <div className="w-16 h-16 mb-6 bg-accent/10 rounded-full flex items-center justify-center ring-1 ring-emerald-500/20">
                    <Sparkles size={32} className="text-accent-green/40" />
                </div>
                <h3 className="text-sm font-bold uppercase tracking-[0.2em] mb-2">
                    Empty table
                </h3>
                <p className="text-[11px] text-foreground/55 uppercase tracking-widest">
                    0 rows · {effectiveResult.executionTimeMs}ms
                </p>
            </div>
        );
    }
    return (
        <div className="h-full flex flex-col bg-surface-2 overflow-hidden rounded-[inherit]">
            <GridToolbar
                fn={fn}
                executionTimeMs={effectiveResult.executionTimeMs}
                filtersActive={filtersActive}
                filterCount={filters.length}
                showSearchBar={showSearchBar}
                cellSearch={cellSearch}
                searchedRowCount={searchedRows.length}
                totalRowCount={effectiveResult?.rows.length ?? 0}
                pendingEditCount={pendingEdits.length}
                applyPendingLoading={pendingApplyLoading}
                viewMode={viewMode}
                onClearFilters={clearFilters}
                onAddFilter={addFilter}
                onApplyPendingEdits={applyPendingEdits}
                onResetPendingEdits={resetPendingEdits}
                onRefresh={async () => {
                    try {
                        if (viewMode === "structure") {
                            await reloadStructure();
                            toast.success("Structure reloaded");
                        } else if (viewMode === "er") {
                            await loadSchemaGraph(true);
                            toast.success("Diagram reloaded");
                        } else if (filtersActive && filters.length > 0) {
                            await applyFilters();
                            toast.success("Filtered rows refreshed");
                        } else {
                            await onPageChange(page);
                            toast.success("Rows refreshed");
                        }
                    } catch {
                        toast.error("Refresh failed");
                    }
                }}
                onToggleSearch={() => { setShowSearchBar((v) => !v); if (showSearchBar) setCellSearch(""); }}
                onSearchChange={setCellSearch}
                onClearSearch={() => { setCellSearch(""); setShowSearchBar(false); }}
                onToggleImport={() => { setShowImport((v) => !v); setImportDone(null); }}
                onRenameTable={() => { setRenameTableName(fn.tableName ?? ""); setShowRenameTable(true); }}
                onDropTable={() => setShowDropTable(true)}
            />
            <FilterBar
                viewMode={viewMode}
                filters={filters}
                availableCols={availableCols}
                filterLoading={filterLoading}
                onFilterChange={(id, partial) =>
                    setFilters(filters.map((x) => (x.id === id ? { ...x, ...partial } : x)))
                }
                onRemoveFilter={removeFilter}
                onAddFilter={addFilter}
                onApply={applyFilters}
            />
            <ImportPanel
                show={showImport}
                viewMode={viewMode}
                tableName={fn.tableName}
                importText={importText}
                importFormat={importFormat}
                importPreview={importPreview}
                importError={importError}
                importing={importing}
                importDone={importDone}
                onTextChange={(text, fmt) => { setImportText(text); parseImport(text, fmt); }}
                onFormatChange={(fmt) => { setImportFormat(fmt); parseImport(importText, fmt); }}
                onFileSelect={handleImportFile}
                onImport={runImport}
                onClose={() => setShowImport(false)}
            />
            {/* Content: Data view */}
            {viewMode === "data" && (
                <div className="flex-1 overflow-auto scrollbar-thin bg-surface-3">
                    <div className="min-w-full block align-middle">
                        <Table
                            className="border-collapse text-[12px] font-mono border-separate border-spacing-0 bg-surface-3"
                            style={{ width: table.getTotalSize() }}
                        >
                            <TableHeader className="sticky top-0 z-10 bg-surface-2/96 backdrop-blur-md shadow-[0_1px_0_var(--color-border-table)]">
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow
                                        key={headerGroup.id}
                                        className="hover:bg-transparent border-none"
                                    >
                                        <TableHead
                                            className="w-11 h-8 px-2.5 text-center font-bold text-foreground/36 border-r border-border-subtle bg-surface-2 cursor-pointer hover:text-foreground/62 transition-colors sticky left-0 z-20"
                                            onClick={() => {
                                                setSelectedColId(null);
                                                setSelectedRowIdx(-1);
                                            }}
                                        >
                                            #
                                        </TableHead>
                                        {headerGroup.headers.map((header) => {
                                            const colId = header.column.id;
                                            const isColSelected =
                                                selectedColId === colId;
                                            const colSize =
                                                header.column.getSize();
                                            return (
                                                <TableHead
                                                    key={header.id}
                                                    style={{
                                                        width: colSize,
                                                        position: "relative",
                                                    }}
                                                    className={cn(
                                                        "h-8 px-4 text-left font-semibold border-r border-border-subtle last:border-r-0 cursor-pointer transition-colors select-none overflow-hidden group/th bg-surface-2/96",
                                                        isColSelected
                                                            ? "bg-surface-selected/82 text-foreground"
                                                            : header.column.getIsSorted()
                                                                ? "text-foreground border-b-2 border-b-primary/35 hover:bg-surface-3"
                                                                : "text-foreground/68 hover:bg-surface-3",
                                                    )}
                                                    onClick={(e) => {
                                                        setSelectedColId(
                                                            isColSelected
                                                                ? null
                                                                : colId,
                                                        );
                                                        header.column.getToggleSortingHandler()?.(
                                                            e,
                                                        );
                                                    }}
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        setColCtxMenu({ x: e.clientX, y: e.clientY, colId });
                                                    }}
                                                >
                                                    <div className="flex items-center gap-1">
                                                        <span
                                                            className={cn(
                                                                "transition-colors",
                                                                !isColSelected &&
                                                                "group-hover/th:text-foreground",
                                                            )}
                                                        >
                                                            {flexRender(
                                                                header.column
                                                                    .columnDef
                                                                    .header,
                                                                header.getContext(),
                                                            )}
                                                        </span>
                                                        {header.column.getIsSorted() &&
                                                            !isColSelected && (
                                                                <span className="text-primary/70 text-[10px] shrink-0">
                                                                    {header.column.getIsSorted() ===
                                                                        "asc"
                                                                        ? "↑"
                                                                        : "↓"}
                                                                </span>
                                                            )}
                                                    </div>
                                                    {header.column.getCanResize() && (
                                                        <div
                                                            onMouseDown={(
                                                                e,
                                                            ) => {
                                                                e.stopPropagation();
                                                                header.getResizeHandler()(
                                                                    e,
                                                                );
                                                            }}
                                                            onTouchStart={(
                                                                e,
                                                            ) => {
                                                                e.stopPropagation();
                                                                header.getResizeHandler()(
                                                                    e,
                                                                );
                                                            }}
                                                                className={cn(
                                                                    "absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none transition-colors",
                                                                    header.column.getIsResizing()
                                                                        ? "bg-primary/80"
                                                                        : "bg-transparent hover:bg-primary/36",
                                                                )}
                                                            />
                                                    )}
                                                </TableHead>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody>
                                {table.getRowModel().rows.length === 0 ? (
                                    <TableRow className="hover:bg-transparent">
                                        <TableCell
                                            colSpan={
                                                table.getAllColumns().length + 1
                                            }
                                            className="h-24 text-center text-foreground/44 text-[12px] font-mono"
                                        >
                                            0 rows
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    table.getRowModel().rows.map((row, idx) => {
                                        const isSelected =
                                            selectedRowIdx === idx;
                                        const rowData: Record<string, unknown> =
                                            row.original;
                                        return (
                                            <TableRow
                                                key={row.id}
                                                className={cn(
                                                    "hover:bg-row-hover transition-colors group cursor-default",
                                                    isSelected
                                                        ? "bg-surface-selected/82 border-l-2 border-primary/70"
                                                        : idx % 2 === 0
                                                            ? "bg-table-bg"
                                                            : "bg-row-alt",
                                                )}
                                            >
                                                <TableCell
                                                    className={cn(
                                                        "w-11 h-8 px-2.5 text-center border-r border-border-subtle cursor-pointer select-none transition-colors sticky left-0 z-20 bg-surface-2",
                                                        isSelected
                                                            ? "bg-surface-selected/82 text-foreground font-bold"
                                                            : "text-foreground/38 bg-surface-2/92 hover:bg-surface-selected/82 hover:text-foreground",
                                                    )}
                                                    onClick={() =>
                                                        setSelectedRowIdx(
                                                            isSelected
                                                                ? -1
                                                                : idx,
                                                        )
                                                    }
                                                    onContextMenu={(e) => {
                                                        e.preventDefault();
                                                        setContextMenuCell({ x: e.clientX, y: e.clientY, rowIdx: idx, col: null, rowData });
                                                    }}
                                                >
                                                    {page * pageSize + idx + 1}
                                                </TableCell>
                                                {row
                                                    .getVisibleCells()
                                                    .map((cell) => {
                                                        const pendingEdit =
                                                            getPendingEditForCell(
                                                                rowData,
                                                                cell.column.id,
                                                            );
                                                        const isCellSelected =
                                                            selectedCell?.rowIdx ===
                                                            idx &&
                                                            selectedCell?.colId ===
                                                            cell.column.id;
                                                        return (
                                                            <TableCell
                                                                key={cell.id}
                                                                style={{
                                                                    width: cell.column.getSize(),
                                                                }}
                                                                className={cn(
                                                                    "h-8 px-4 border-r border-border-subtle last:border-r-0 text-foreground/92 whitespace-nowrap overflow-hidden text-ellipsis relative",
                                                                    pendingEdit &&
                                                                    "bg-warning/10",
                                                                    cell.column
                                                                        .id ===
                                                                    selectedColId &&
                                                                    "bg-surface-selected/58",
                                                                    isCellSelected &&
                                                                    "ring-1 ring-inset ring-primary/45 bg-surface-selected/82",
                                                                )}
                                                                onClick={() => {
                                                                    const key = `${idx}:${cell.column.id}`;
                                                                    setSelectedCell(
                                                                        {
                                                                            rowIdx: idx,
                                                                            colId: cell
                                                                                .column
                                                                                .id,
                                                                        },
                                                                    );
                                                                    if (
                                                                        dblClickRef
                                                                            .current
                                                                            ?.key ===
                                                                        key
                                                                    ) {
                                                                        clearTimeout(
                                                                            dblClickRef
                                                                                .current
                                                                                .timer,
                                                                        );
                                                                        dblClickRef.current =
                                                                            null;
                                                                    if (
                                                                        fn.tableName
                                                                    ) {
                                                                            void startInlineEdit(
                                                                                idx,
                                                                                cell.column.id,
                                                                                rowData[
                                                                                    cell.column.id
                                                                                ],
                                                                                rowData,
                                                                            );
                                                                        }
                                                                    } else {
                                                                        if (
                                                                            dblClickRef.current
                                                                        )
                                                                            clearTimeout(
                                                                                dblClickRef
                                                                                    .current
                                                                                    .timer,
                                                                            );
                                                                        const timer =
                                                                            setTimeout(
                                                                                () => {
                                                                                    dblClickRef.current =
                                                                                        null;
                                                                                },
                                                                                300,
                                                                            );
                                                                        dblClickRef.current =
                                                                        {
                                                                            key,
                                                                            timer,
                                                                        };
                                                                    }
                                                                }}
                                                                onContextMenu={(
                                                                    e,
                                                                ) => {
                                                                    e.preventDefault();
                                                                    setSelectedCell(
                                                                        {
                                                                            rowIdx: idx,
                                                                            colId: cell
                                                                                .column
                                                                                .id,
                                                                        },
                                                                    );
                                                                    setContextMenuCell(
                                                                        {
                                                                            x: e.clientX,
                                                                            y: e.clientY,
                                                                            rowIdx: idx,
                                                                            col: cell
                                                                                .column
                                                                                .id,
                                                                            rowData,
                                                                        },
                                                                    );
                                                                }}
                                                            >
                                                                {flexRender(
                                                                    cell.column
                                                                        .columnDef
                                                                        .cell,
                                                                    cell.getContext(),
                                                                )}
                                                            </TableCell>
                                                        );
                                                    })}
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
            <RowContextMenu
                contextMenu={contextMenuCell}
                hasTableName={!!fn.tableName}
                isColumnEditable={isColumnEditable}
                canSetColumnToNull={canSetColumnToNull}
                onClose={() => setContextMenuCell(null)}
                onEditInModal={(rowIdx, col, value) =>
                    contextMenuCell &&
                    void editCellInModal(
                        rowIdx,
                        col,
                        value,
                        contextMenuCell.rowData,
                    )
                }
                onSetNull={(rowData, col) => setNullCell(rowData, col)}
                onSetQuickFilter={(filter) => {
                    setFilters([{ id: `f-${Date.now()}`, ...filter }]);
                }}
                onCopy={(value) => copyToClipboard(toEditString(value))}
                onCopyColumnName={(col) => copyToClipboard(col)}
                onCopyAsTSV={copyCellAsTSV}
                onCopyAsJSON={copyCellAsJSON}
                onCopyAsMarkdown={copyCellAsMarkdown}
                onCopyAsSQL={copyCellAsSQL}
                onCopyForIN={copyCellForIN}
                onPaste={pasteToCell}
                onCloneRow={cloneRow}
                onDeleteRow={buildAndShowDeleteSql}
                onSeeDetails={(rowIdx) => { setSelectedRowIdx(rowIdx); setViewMode("form"); }}
            />
            <ColumnContextMenu
                colCtxMenu={colCtxMenu}
                hasTableName={!!fn.tableName}
                canSetNull={canSetColumnToNull}
                onClose={() => setColCtxMenu(null)}
                onSetNull={(colId) => void openColumnNullDialog(colId)}
                onCopyValues={copyColValues}
                onCopyName={(colId) => copyToClipboard(colId)}
                onCopyAsTSV={copyColAsTSV}
                onCopyAsJSON={copyColAsJSON}
                onCopyAsMarkdown={copyColAsMarkdown}
                onCopyAsSQL={copyColAsSQL}
                onCopyForIN={copyColForIN}
                onSortAsc={(colId) => setSorting([{ id: colId, desc: false }])}
                onSortDesc={(colId) => setSorting([{ id: colId, desc: true }])}
                onResizeAllToMatch={resizeAllToMatch}
                onResizeAllToFitContent={resizeAllToFitContent}
                onResizeAllFixed={() => resizeAllToMatch(DEFAULT_FIXED_COLUMN_WIDTH)}
                onHideColumn={(colId) => setColumnVisibility((v) => ({ ...v, [colId]: false }))}
                onResetLayout={resetLayout}
                onOpenFilter={openFilterForCol}
                getColSize={(colId) => table.getColumn(colId)?.getSize() ?? DEFAULT_FIXED_COLUMN_WIDTH}
            />
            <DeleteRowDialog
                sql={deleteRowSql}
                loading={deleteRowLoading}
                onCancel={() => setDeleteRowSql(null)}
                onConfirm={executeDeleteRow}
            />
            <CellEditModal
                key={cellModal ? `${cellModal.rowIdx}-${cellModal.col}` : "closed"}
                cellModal={cellModal}
                initialFormat={cellModal?.format ?? "Text"}
                loading={cellEditLoading}
                onClose={() => setCellModal(null)}
                onValueChange={(val) => setCellModal((prev) => prev ? { ...prev, value: val } : prev)}
                onCopy={copyToClipboard}
                onApply={applyCellModal}
            />
            <ColumnNullDialog
                columnName={columnNullConfirmCol}
                tableName={fn.tableName ?? ""}
                qi={qi}
                onCancel={() => setColumnNullConfirmCol(null)}
                onConfirm={executeColumnNull}
            />
            <DropTableDialog
                open={showDropTable}
                tableName={fn.tableName ?? ""}
                loading={dropTableLoading}
                qi={qi}
                onCancel={() => setShowDropTable(false)}
                onConfirm={executeDropTable}
            />
            <RenameTableDialog
                open={showRenameTable}
                currentName={fn.tableName ?? ""}
                newName={renameTableName}
                loading={renameTableLoading}
                qi={qi}
                onNameChange={setRenameTableName}
                onCancel={() => setShowRenameTable(false)}
                onConfirm={executeRenameTable}
            />
            <AddColumnDialog
                open={showAddColumn}
                tableName={fn.tableName ?? ""}
                colTypes={COL_TYPES[dbType as DatabaseType] ?? ["TEXT"]}
                addCol={addCol}
                loading={addColLoading}
                error={addColError}
                qi={qi}
                onColChange={(partial) => setAddCol((p) => ({ ...p, ...partial }))}
                onCancel={() => { setShowAddColumn(false); setAddColError(null); }}
                onConfirm={executeAddColumn}
            />
            <DropColumnDialog
                columnName={dropColTarget}
                tableName={fn.tableName ?? ""}
                loading={dropColLoading}
                qi={qi}
                onCancel={() => setDropColTarget(null)}
                onConfirm={executeDropColumn}
            />
            <CreateIndexDialog
                open={showCreateIndex}
                tableName={fn.tableName ?? ""}
                structure={structure}
                createIdxDef={createIdxDef}
                loading={createIdxLoading}
                error={createIdxError}
                buildCreateIndexSql={buildCreateIndexSql}
                onDefChange={(partial) => setCreateIdxDef((p) => ({ ...p, ...partial }))}
                onCancel={() => { setShowCreateIndex(false); setCreateIdxError(null); }}
                onConfirm={executeCreateIndex}
            />
            <DropIndexDialog
                indexName={dropIdxTarget}
                tableName={fn.tableName ?? ""}
                loading={dropIdxLoading}
                buildDropSql={buildDropIndexSql}
                onCancel={() => setDropIdxTarget(null)}
                onConfirm={executeDropIndex}
            />
            <DumpDatabaseDialog
                open={showDumpDialog}
                databaseName={selectedDatabases[fn.connectionId] ?? connections.find((c) => c.id === fn.connectionId)?.database ?? database ?? ""}
                dbType={dbType ?? ""}
                loading={dumpDbLoading}
                onCancel={() => setShowDumpDialog(false)}
                onConfirm={executeDump}
            />
            <ImportSqlDialog
                open={showImportSqlDialog}
                connectionId={fn.connectionId}
                currentDatabase={selectedDatabases[fn.connectionId] ?? connections.find((c) => c.id === fn.connectionId)?.database ?? database ?? ""}
                dbType={dbType ?? ""}
                onCancel={() => setShowImportSqlDialog(false)}
                onSuccess={async () => {
                    setShowImportSqlDialog(false);
                    await refreshTables(fn.connectionId);
                }}
            />
            {/* Content: Form view */}
            {viewMode === "form" && effectiveResult && (
                <div className="flex-1 overflow-auto scrollbar-thin bg-surface-3">
                    {effectiveResult.rows.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-foreground/38 text-[12px] font-mono">
                            0 rows
                        </div>
                    ) : (
                        (() => {
                            const formRowIdx =
                                selectedRowIdx < 0 ? 0 : selectedRowIdx;
                            const row = effectiveResult.rows[formRowIdx] ?? {};
                            const cols =
                                effectiveResult.columns.length > 0
                                    ? effectiveResult.columns
                                    : Object.keys(row);
                            return (
                                <div>
                                    {/* Record header */}
                                    <div className="sticky top-0 z-10 flex items-center justify-between px-4 h-9 bg-surface-2/94 backdrop-blur-md border-b border-border-subtle">
                                        <div className="flex items-center gap-2">
                                            <AlignLeft
                                                size={10}
                                                className="text-foreground/42"
                                            />
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/52">
                                                Record
                                            </span>
                                            <span className="text-[10px] font-mono bg-muted text-foreground/52 rounded-md px-1.5 py-0.5 leading-none">
                                                {page * pageSize +
                                                    formRowIdx +
                                                    1}{" "}
                                                / {effectiveResult.rows.length}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-0.5">
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                disabled={formRowIdx === 0}
                                                onClick={() =>
                                                    setSelectedRowIdx((i) =>
                                                        Math.max(
                                                            0,
                                                            (i < 0 ? 0 : i) - 1,
                                                        ),
                                                    )
                                                }
                                                className="h-6 w-6 text-foreground/52 hover:text-foreground disabled:opacity-20"
                                            >
                                                <ChevronLeft size={11} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                disabled={
                                                    formRowIdx ===
                                                    effectiveResult.rows
                                                        .length -
                                                    1
                                                }
                                                onClick={() =>
                                                    setSelectedRowIdx((i) =>
                                                        Math.min(
                                                            effectiveResult.rows
                                                                .length - 1,
                                                            (i < 0 ? 0 : i) + 1,
                                                        ),
                                                    )
                                                }
                                                className="h-6 w-6 text-foreground/52 hover:text-foreground disabled:opacity-20"
                                            >
                                                <ChevronRight size={11} />
                                            </Button>
                                            {fn.tableName && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    className="h-6 w-6 text-foreground/38 hover:text-destructive hover:bg-destructive/10 ml-1"
                                                    onClick={() =>
                                                        buildAndShowDeleteSql(
                                                            row,
                                                        )
                                                    }
                                                >
                                                    <Trash2 size={10} />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                    {/* Fields */}
                                    <div className="divide-y divide-border-subtle">
                                        {cols.map((col, colIdx) => {
                                            const isEditing =
                                                editingCell?.rowIdx ===
                                                formRowIdx &&
                                                editingCell?.col === col;
                                            const val = row[col];
                                            const pendingEdit =
                                                getPendingEditForCell(row, col);
                                            return (
                                                <div
                                                    key={col}
                                                    className={cn(
                                                        "group/field flex items-start gap-4 px-4 py-2.5 hover:bg-surface-hover transition-colors",
                                                        pendingEdit &&
                                                        "bg-warning/10",
                                                        colIdx % 2 === 0
                                                            ? "bg-table-bg"
                                                            : "bg-row-alt",
                                                    )}
                                                >
                                                    <span className="w-40 shrink-0 text-[12px] font-mono font-semibold text-foreground/54 truncate pt-0.5">
                                                        {col}
                                                    </span>
                                                    {isEditing ? (
                                                        <input
                                                            autoFocus
                                                            value={
                                                                editingCell.value
                                                            }
                                                            onChange={(e) =>
                                                                setEditingCell(
                                                                    (prev) =>
                                                                        prev
                                                                            ? {
                                                                                ...prev,
                                                                                value: e
                                                                                    .target
                                                                                    .value,
                                                                            }
                                                                            : null,
                                                                )
                                                            }
                                                            onKeyDown={(e) => {
                                                                if (
                                                                    e.key ===
                                                                    "Enter"
                                                                ) {
                                                                    e.preventDefault();
                                                                    commitEdit();
                                                                }
                                                                if (
                                                                    e.key ===
                                                                    "Escape"
                                                                ) {
                                                                    e.preventDefault();
                                                                    setEditingCell(
                                                                        null,
                                                                    );
                                                                }
                                                            }}
                                                            className="flex-1 bg-primary/10 border border-primary/30 rounded-md px-2 py-0.5 outline-none text-[12px] font-mono text-foreground"
                                                        />
                                                    ) : (
                                                        <span
                                                            className={cn(
                                                                "flex-1 text-[12px] font-mono break-all",
                                                                pendingEdit
                                                                    ? "text-warning"
                                                                    : val === null
                                                                        ? "text-foreground/35 italic"
                                                                        : "text-foreground/90",
                                                            )}
                                                            onDoubleClick={() => {
                                                                if (!fn.tableName)
                                                                    return;
                                                                void startInlineEdit(
                                                                    formRowIdx,
                                                                    col,
                                                                    val,
                                                                    row,
                                                                );
                                                            }}
                                                        >
                                                            {val === null
                                                                ? "[NULL]"
                                                                : typeof val === "object"
                                                                    ? JSON.stringify(val)
                                                                    : String(val)}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })()
                    )}
                </div>
            )}
            {/* Content: Structure view */}
            {viewMode === "structure" && (
                <div className="flex-1 overflow-auto scrollbar-thin bg-surface-3">
                    {structureLoading ? (
                        <div className="h-full flex items-center justify-center">
                            <Loader2
                                size={18}
                                className="animate-spin text-primary"
                            />
                        </div>
                    ) : structure ? (
                        <div>
                            {/* ── Columns ── */}
                            <div>
                                <div className="sticky top-0 z-10 flex items-center justify-between px-4 h-9 bg-surface-2/94 backdrop-blur-md border-b border-border-subtle">
                                    <div className="flex items-center gap-2">
                                        <Key
                                            size={10}
                                            className="text-foreground/42"
                                        />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/52">
                                            Columns
                                        </span>
                                        <span className="text-[10px] font-mono bg-muted text-foreground/52 rounded-md px-1.5 py-0.5 leading-none">
                                            {structure.columns.length}
                                        </span>
                                    </div>
                                    {fn.tableName && (
                                        <Button
                                            variant="ghost"
                                            size="icon-xs"
                                            onClick={() => {
                                                setAddCol({
                                                    name: "",
                                                    type:
                                                        COL_TYPES[
                                                        dbType as DatabaseType
                                                        ]?.[0] ?? "TEXT",
                                                    nullable: true,
                                                });
                                                setShowAddColumn(true);
                                            }}
                                            className="h-6 w-6 text-foreground/52 hover:text-foreground"
                                        >
                                            <Plus size={11} />
                                        </Button>
                                    )}
                                </div>
                                <div className="divide-y divide-border-subtle">
                                    {structure.columns.map((col, idx) => (
                                        <div
                                            key={col.name}
                                            className={cn(
                                                "group/row flex items-center gap-3 px-4 py-2.5 hover:bg-row-hover transition-colors",
                                                idx % 2 === 0
                                                    ? "bg-table-bg"
                                                    : "bg-row-alt",
                                            )}
                                        >
                                            <span className="text-[10px] font-mono text-foreground/28 w-4 shrink-0 text-right tabular-nums">
                                                {idx + 1}
                                            </span>
                                            <span className="text-[12px] font-mono font-semibold text-foreground flex-1 min-w-0 truncate">
                                                {col.name}
                                            </span>
                                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                                                <span className="text-[10px] font-mono text-accent-orange/78 bg-accent-orange/8 border border-accent-orange/15 px-1.5 py-0.5 rounded-md">
                                                    {col.dataType}
                                                </span>
                                                {col.isPrimary && (
                                                    <span className="px-1.5 py-0.5 rounded-[4px] text-[8px] font-black uppercase tracking-wider bg-accent-orange/12 text-accent-orange/88 border border-accent-orange/16">
                                                        PK
                                                    </span>
                                                )}
                                                {col.isUnique &&
                                                    !col.isPrimary && (
                                                        <span className="px-1.5 py-0.5 rounded-[4px] text-[8px] font-black uppercase tracking-wider bg-accent-purple/12 text-accent-purple/88 border border-accent-purple/16">
                                                            UNI
                                                        </span>
                                                    )}
                                                {!col.nullable && (
                                                    <span className="px-1.5 py-0.5 rounded-[4px] text-[8px] font-black uppercase tracking-wider bg-destructive/8 text-destructive/60 border border-destructive/15">
                                                        NOT NULL
                                                    </span>
                                                )}
                                                {col.defaultValue != null && (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-foreground/48 bg-muted border border-border">
                                                        default:{" "}
                                                        {col.defaultValue}
                                                    </span>
                                                )}
                                                {col.extra && (
                                                    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono text-foreground/42 bg-muted border border-border">
                                                        {col.extra}
                                                    </span>
                                                )}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                className="opacity-0 group-hover/row:opacity-100 transition-opacity text-foreground/38 hover:text-destructive hover:bg-destructive/10 shrink-0"
                                                onClick={() =>
                                                    setDropColTarget(col.name)
                                                }
                                            >
                                                <Trash2 size={10} />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* ── Indexes ── */}
                            <div className="border-t border-border-subtle">
                                <div className="sticky top-0 z-10 flex items-center justify-between px-4 h-9 bg-surface-2/94 backdrop-blur-md border-b border-border-subtle">
                                    <div className="flex items-center gap-2">
                                        <Hash
                                            size={10}
                                            className="text-foreground/42"
                                        />
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/52">
                                            Indexes
                                        </span>
                                        <span className="text-[10px] font-mono bg-muted text-foreground/52 rounded px-1.5 py-0.5 leading-none">
                                            {structure.indexes.length}
                                        </span>
                                    </div>
                                    {fn.tableName && (
                                        <Button
                                            variant="ghost"
                                            size="icon-xs"
                                            onClick={() => {
                                                setCreateIdxDef({
                                                    name: "",
                                                    columns: [],
                                                    unique: false,
                                                });
                                                setShowCreateIndex(true);
                                            }}
                                            className="h-6 w-6 text-foreground/52 hover:text-foreground"
                                        >
                                            <Plus size={11} />
                                        </Button>
                                    )}
                                </div>
                                {structure.indexes.length === 0 ? (
                                    <div className="px-4 py-8 text-center text-[12px] font-mono text-foreground/38">
                                        No indexes
                                    </div>
                                ) : (
                                    <div className="divide-y divide-border-subtle">
                                        {structure.indexes.map((idx, i) => (
                                            <div
                                                key={idx.name}
                                                className={cn(
                                                    "group/row flex items-center gap-3 px-4 py-2.5 hover:bg-row-hover transition-colors",
                                                    i % 2 === 0
                                                        ? "bg-table-bg"
                                                        : "bg-row-alt",
                                                )}
                                            >
                                                <span className="text-[13px] font-mono text-accent-blue/78 flex-1 min-w-0 truncate">
                                                    {idx.name}
                                                </span>
                                                <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                                                    {idx.columns.map((c) => (
                                                        <span
                                                            key={c}
                                                            className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono text-foreground/64"
                                                        >
                                                            {c}
                                                        </span>
                                                    ))}
                                                    {idx.indexType && (
                                                        <span className="text-[10px] font-mono text-foreground/38 uppercase">
                                                            {idx.indexType}
                                                        </span>
                                                    )}
                                                    {idx.unique && (
                                                        <span className="px-1.5 py-0.5 rounded-[4px] text-[8px] font-black uppercase tracking-wider bg-accent-green/8 text-accent-green/88 border border-accent-green/16">
                                                            UNIQUE
                                                        </span>
                                                    )}
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-xs"
                                                    className="opacity-0 group-hover/row:opacity-100 transition-opacity text-foreground/38 hover:text-destructive hover:bg-destructive/10 shrink-0"
                                                    onClick={() =>
                                                        setDropIdxTarget(
                                                            idx.name,
                                                        )
                                                    }
                                                >
                                                    <Trash2 size={10} />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-foreground/38 text-[12px] font-mono">
                            No structure data
                        </div>
                    )}
                </div>
            )}
            {viewMode === "er" && (
                <div className="flex-1 min-h-0 overflow-hidden bg-background">
                    {schemaGraphLoading && !schemaGraph ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="text-center space-y-3">
                                <Loader2
                                    size={18}
                                    className="animate-spin text-primary mx-auto"
                                />
                                <p className="text-[11px] font-mono uppercase tracking-widest text-foreground/48">
                                    Loading schema graph
                                </p>
                            </div>
                        </div>
                    ) : schemaGraphError && !schemaGraph ? (
                        <div className="h-full flex items-center justify-center p-6">
                            <div className="max-w-md w-full rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-center">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-destructive mb-2">
                                    Failed to load ER diagram
                                </p>
                                <p className="text-xs font-mono text-destructive/75 break-words">
                                    {schemaGraphError}
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => loadSchemaGraph(true)}
                                    className="mt-4"
                                >
                                    Retry
                                </Button>
                            </div>
                        </div>
                    ) : schemaGraph && schemaGraph.tables.length > 0 ? (
                        <ERDiagramView
                            graph={schemaGraph}
                            currentTableName={fn.tableName}
                            onTableSelect={handleDiagramTableSelect}
                            onRetry={() => loadSchemaGraph(true)}
                            isRefreshing={schemaGraphLoading}
                        />
                    ) : (
                        <div className="h-full flex items-center justify-center text-foreground/38 text-[12px] font-mono">
                            No schema graph data
                        </div>
                    )}
                </div>
            )}
            {/* Cell edit error banner */}
            {cellEditError && (
                <div className="px-3 py-1.5 bg-destructive/10 border-t border-destructive/20 flex items-center justify-between shrink-0">
                    <span className="text-[11px] font-mono text-destructive">
                        {cellEditError}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setCellEditError(null)}
                        className="text-destructive/50 hover:text-destructive"
                    >
                        <X size={10} />
                    </Button>
                </div>
            )}
            {/* Footer toolbar */}
            <div className="h-11 bg-surface-2/92 border-t border-border-subtle flex items-center justify-between px-3.5 shrink-0 gap-4 backdrop-blur-sm">
                <div className="flex items-stretch gap-0 h-full">
                    {(
                        isRelationalDb
                            ? (["data", "form", "structure", "er"] as const)
                            : (["data", "form", "structure"] as const)
                    ).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => handleViewMode(mode)}
                            className={cn(
                                "relative flex items-center px-3 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors",
                                viewMode === mode
                                    ? "text-foreground bg-surface-3/92 rounded-[4px]"
                                    : "text-foreground/46 hover:text-foreground/72 hover:bg-surface-3/72 rounded-[4px]",
                            )}
                        >
                            {mode}
                            {viewMode === mode && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
                            )}
                        </button>
                    ))}
                </div>
                {viewMode === "data" && (
                    <>
                        <div className="flex items-center gap-2.5 text-[11px] font-mono text-foreground/54">
                            {cellEditLoading ? (
                                <Loader2
                                    size={10}
                                    className="animate-spin text-accent-blue"
                                />
                            ) : (
                                <span className="flex items-center gap-1.5 text-[11px] text-foreground/48 hidden sm:flex select-none">
                                    <Kbd>↵</Kbd>
                                    <span>inline edit</span>
                                    <span className="text-foreground/28">
                                        ·
                                    </span>
                                    <Kbd>⇧↵</Kbd>
                                    <span>edit in modal</span>
                                </span>
                            )}
                            <Button
                                variant="ghost"
                                size="xs"
                                disabled={page === 0}
                                onClick={() => onPageChange(page - 1)}
                                className="h-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/58"
                            >
                                ← Prev
                            </Button>
                            <span className="tabular-nums text-foreground/56">
                                {effectiveResult.rows.length === 0
                                    ? "0 rows"
                                    : `${page * pageSize + 1}–${page * pageSize + effectiveResult.rows.length}`}
                            </span>
                            <Button
                                variant="ghost"
                                size="xs"
                                disabled={
                                    effectiveResult.rows.length < 50 ||
                                    filtersActive
                                }
                                onClick={() => onPageChange(page + 1)}
                                className="h-6 text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/58"
                            >
                                Next →
                            </Button>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="xs"
                                    className="h-6 text-[11px] font-semibold uppercase tracking-[0.12em] gap-1.5"
                                >
                                    <Download size={10} />
                                    Export
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                align="end"
                                side="top"
                                className="text-[11px] font-mono w-[180px]"
                            >
                                <DropdownMenuItem
                                    onClick={() => exportData("csv")}
                                    className="gap-2 cursor-pointer"
                                >
                                    <FileText size={11} />
                                    Export as CSV
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => exportData("json")}
                                    className="gap-2 cursor-pointer"
                                >
                                    <FileJson size={11} />
                                    Export as JSON
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => exportData("sql")}
                                    className="gap-2 cursor-pointer"
                                >
                                    <FileText size={11} />
                                    Export as SQL
                                </DropdownMenuItem>
                                {isRelationalDb && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                            onClick={openDumpDialog}
                                            disabled={dumpDbLoading}
                                            className="gap-2 cursor-pointer"
                                        >
                                            {dumpDbLoading ? (
                                                <Loader2 size={11} className="animate-spin" />
                                            ) : (
                                                <DatabaseIcon size={11} />
                                            )}
                                            {dumpDbLoading ? "Generating..." : "Dump Database"}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            onClick={() => setShowImportSqlDialog(true)}
                                            className="gap-2 cursor-pointer"
                                        >
                                            <DatabaseIcon size={11} />
                                            Import SQL File
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </>
                )}
                {viewMode === "structure" && structure && (
                    <span className="text-[11px] font-mono text-foreground/42">
                        {structure.columns.length} cols ·{" "}
                        {structure.indexes.length} idx
                    </span>
                )}
                {viewMode === "er" && schemaGraph && (
                    <span className="text-[11px] font-mono text-foreground/42">
                        {schemaGraph.tables.length} tables ·{" "}
                        {schemaGraph.relationships.length} relations
                    </span>
                )}
            </div>
            {/* Query Log — shown only when toggled via titlebar */}
            {queryLogOpen && (
                <QueryLog
                    entries={queryHistory.filter(
                        (e) => e.connectionId === fn.connectionId,
                    )}
                    showSyntax={showQueryLogSyntax}
                    onSyntaxToggle={setShowQueryLogSyntax}
                    onClear={() => clearHistory(fn.connectionId)}
                />
            )}
        </div>
    );
}
// ─── SQL editor (for _query / _execute functions) ─────────────────────────────

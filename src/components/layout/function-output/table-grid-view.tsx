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
    ColumnPinningState,
} from "@tanstack/react-table";
import {
    Loader2,
    Sparkles,
    CircleAlert,
    Download,
    Hash,
    Key,
    FileText,
    FileJson,
    Trash2,
    X,
    Plus,
     AlignLeft,
     ChevronDown,
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
import { Badge } from "@/components/ui/badge";
import { Alert, AlertAction, AlertTitle } from "@/components/ui/alert";
import { useAppStore } from "@/store/useAppStore";
import { QueryLog } from "@/components/layout/function-output/query-log";
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
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
} from "@/components/ui/empty";
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
import { GridToolbar } from "@/components/layout/function-output/table-grid/grid-toolbar";
import { TableInfoPanel } from "@/components/layout/function-output/table-grid/table-info-panel";
import { FilterBar } from "@/components/layout/function-output/table-grid/filter-bar";
import { ImportPanel } from "@/components/layout/function-output/table-grid/import-panel";
import { RowContextMenu } from "@/components/layout/function-output/table-grid/row-context-menu";
import { ColumnContextMenu } from "@/components/layout/function-output/table-grid/column-context-menu";
import { CellEditModal } from "@/components/layout/function-output/table-grid/cell-edit-modal";
import { DeleteRowDialog } from "@/components/layout/function-output/table-grid/delete-row-dialog";
import { ColumnNullDialog } from "@/components/layout/function-output/table-grid/column-null-dialog";
import { DropTableDialog } from "@/components/layout/function-output/table-grid/drop-table-dialog";
import { RenameTableDialog } from "@/components/layout/function-output/table-grid/rename-table-dialog";
import { AddColumnDialog } from "@/components/layout/function-output/table-grid/add-column-dialog";
import { DropColumnDialog } from "@/components/layout/function-output/table-grid/drop-column-dialog";
import { CreateIndexDialog } from "@/components/layout/function-output/table-grid/create-index-dialog";
import { DropIndexDialog } from "@/components/layout/function-output/table-grid/drop-index-dialog";
import { DumpDatabaseDialog, type DumpOptions } from "@/components/layout/function-output/table-grid/dump-database-dialog";
import { ImportSqlDialog } from "@/components/layout/function-output/table-grid/import-sql-dialog";
import { ERDiagramView } from "@/components/layout/function-output/table-grid/er-diagram-view";
import { RowDetailPanel } from "@/components/layout/function-output/table-grid/row-detail-panel";
import { runExport, type ExportPreset } from "@/lib/export-utils";
import { ColumnStatsPanel } from "@/components/layout/function-output/table-grid/column-stats-panel";
import { ColorRulesPanel, evaluateColorRule, COLOR_STYLE_MAP } from "@/components/layout/function-output/table-grid/color-rules-panel";
import { CellColorRule, AggMetric } from "@/types";

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
    const [showInfo, setShowInfo] = useState(false);
    const [showRowDetail, setShowRowDetail] = useState(false);
    const [selectedRowIdx, setSelectedRowIdx] = useState(-1);
    const [selectedRowIdxSet, setSelectedRowIdxSet] = useState<Set<number>>(new Set());
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
    const [columnPinning, setColumnPinning] = useState<ColumnPinningState>({ left: [], right: [] });
    // Feature 1: Column stats panel
    const [statsCol, setStatsCol] = useState<string | null>(null);
    // Feature 3: Aggregation footer
    const [showAggFooter, setShowAggFooter] = useState(false);
    const [footerMetrics, setFooterMetrics] = useState<Record<string, AggMetric>>({});
    // Feature 4: Color rules
    const [showColorRules, setShowColorRules] = useState(false);
    const [colorRules, setColorRules] = useState<CellColorRule[]>([]);
    // Feature 6: Per-tab page size
    const [localPageSize, setLocalPageSize] = useState<number | null>(null);
    // effective page size (local override wins over global setting)
    const effectivePageSize = localPageSize ?? pageSize;
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
    const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);
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
        pushUndoEntry,
        undoLastCellEdit,
        refreshTables,
        invokeFunction,
        queryLogOpen,
        updateTabFilters,
        updateTabFilteredResult,
        updateTabFiltersActive,
        clearTabFilters,
        appSettings,
    } = useAppStore();
    const rowHeightClass =
        appSettings.rowDensity === "compact" ? "h-6" :
        appSettings.rowDensity === "comfortable" ? "h-11" : "h-8";
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
                    const sql = `SELECT * FROM ${qi(relation.targetTable)} WHERE ${qi(targetCol)} = ${sqlVal} LIMIT ${effectivePageSize}`;
                    const result = await tauriApi.executeQuery(fn.connectionId, sql);
                    useAppStore.getState().updateTabFilteredResult(newActiveTabId, result);
                } catch {
                    // Filter set but query failed — user can still apply manually
                }
            }
        },
        [connectionFunctions, fn.connectionId, invokeFunction, effectivePageSize, connections],
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
            const sql = `SELECT * FROM ${qi(fn.tableName)} WHERE ${whereClause} LIMIT ${effectivePageSize} OFFSET ${page * effectivePageSize}`;
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
    // Feature 3: Aggregation footer — compute per-column aggregates from searched rows
    const aggValues = useMemo(() => {
        if (!showAggFooter) return {} as Record<string, Record<string, number | null>>;
        const result: Record<string, Record<string, number | null>> = {};
        for (const col of resultColumns) {
            const nums = searchedRows
                .map((row) => row[col])
                .filter((v) => v !== null && v !== undefined && !isNaN(Number(v)))
                .map((v) => Number(v));
            const vals = searchedRows.map((r) => r[col]).filter((v) => v !== null && v !== undefined);
            result[col] = {
                count: vals.length,
                sum: nums.length > 0 ? nums.reduce((a, b) => a + b, 0) : null,
                avg: nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null,
                min: nums.length > 0 ? Math.min(...nums) : null,
                max: nums.length > 0 ? Math.max(...nums) : null,
            };
        }
        return result;
    }, [showAggFooter, resultColumns, searchedRows]);
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
    const structureColumnMap = useMemo<
        Record<string, TableStructure["columns"][number]>
    >(
        () =>
            Object.fromEntries(
                (structure?.columns ?? []).map((column) => [column.name, column]),
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
                // Build reverse UPDATE for undo
                const reverseSql = `UPDATE ${qi(fn.tableName)} SET ${qi(edit.columnId)} = ${valueToSqlLiteral(edit.originalValue)} WHERE ${whereParts.join(" AND ")}`;
                if (activeTabId) {
                    pushUndoEntry(activeTabId, {
                        id: `undo-${Date.now()}-${edit.id}`,
                        tabId: activeTabId,
                        connectionId: fn.connectionId,
                        tableName: fn.tableName,
                        rowKey: edit.rowKey,
                        primaryKeyValues: whereKeys,
                        columnId: edit.columnId,
                        oldValue: edit.originalValue,
                        newValue: edit.pendingValue,
                        committedAt: Date.now(),
                        reverseSql,
                    });
                }
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
        pushUndoEntry,
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
    // ⌘Z / Ctrl+Z — undo last committed cell edit
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (!(e.metaKey || e.ctrlKey) || e.key !== "z") return;
            const tag = (document.activeElement as HTMLElement)?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA") return;
            if (!activeTabId) return;
            e.preventDefault();
            undoLastCellEdit(activeTabId);
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [activeTabId, undoLastCellEdit]);
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

    const buildWhereForRow = useCallback((rowData: Record<string, unknown>) => {
        const pks = structure?.columns.filter((c) => c.isPrimary).map((c) => c.name) ?? [];
        if (pks.length > 0) {
            return pks.map((pk) => {
                const v = rowData[pk];
                if (v === null || v === undefined) return `${qi(pk)} IS NULL`;
                return `${qi(pk)} = '${String(v).replace(/'/g, "''")}'`;
            }).join(" AND ");
        }
        return Object.entries(rowData).map(([col, v]) => {
            if (v === null || v === undefined) return `${qi(col)} IS NULL`;
            return `${qi(col)} = '${String(v).replace(/'/g, "''")}'`;
        }).join(" AND ");
    }, [structure, qi]);

    const executeBulkDelete = useCallback(async () => {
        if (!fn.tableName || selectedRowIdxSet.size === 0 || !searchedRows) return;
        const confirmed = window.confirm(`Delete ${selectedRowIdxSet.size} selected rows from ${fn.tableName}?`);
        if (!confirmed) return;
        setBulkDeleteLoading(true);
        try {
            const stmts = Array.from(selectedRowIdxSet).map((idx) => {
                const rowData = searchedRows[idx] as Record<string, unknown>;
                return `DELETE FROM ${qi(fn.tableName!)} WHERE ${buildWhereForRow(rowData)}`;
            });
            for (const stmt of stmts) {
                await tauriApi.executeQuery(fn.connectionId, stmt);
            }
            setSelectedRowIdxSet(new Set());
            setSelectedRowIdx(-1);
            await onPageChange(page);
        } catch (e) {
            setCellEditError(String(e));
        } finally {
            setBulkDeleteLoading(false);
        }
    }, [fn, selectedRowIdxSet, searchedRows, qi, buildWhereForRow, page, onPageChange]);

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
                                    className="flex-1 h-full min-w-0 border-0 border-b-2 border-primary/50 bg-primary/10 px-4 py-0 text-[12px] font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                                />
                                <button
                                    aria-label="Cancel inline edit"
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
                                    aria-label={`Open related row in ${fkRel.targetTable}`}
                                    className="absolute right-1 top-1/2 shrink-0 rounded p-0.5 text-accent-blue/60 opacity-0 transition-opacity hover:bg-accent-blue/15 hover:text-accent-blue group-hover/fk:opacity-100 focus-visible:opacity-100"
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
        state: { sorting, columnSizing, columnVisibility, columnPinning },
        onSortingChange: setSorting,
        onColumnSizingChange: setColumnSizing,
        onColumnVisibilityChange: setColumnVisibility,
        onColumnPinningChange: setColumnPinning,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });
    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center bg-background p-6">
                <div className="space-y-3 text-center">
                    <Loader2 size={18} className="mx-auto animate-spin text-primary" />
                    <p className="text-[12px] text-muted-foreground/60">Loading table data...</p>
                </div>
            </div>
        );
    }
    if (!effectiveResult) return null;
    // No columns at all means a DDL/non-SELECT result — show simple card
    if (effectiveResult.columns.length === 0 && !filtersActive) {
        return (
            <div className="flex h-full items-center justify-center bg-background p-6">
                <Empty className="border-0 p-0">
                    <EmptyHeader>
                        <EmptyMedia variant="icon" className="size-12 rounded-2xl bg-surface-3 text-foreground/55">
                            <Sparkles size={22} className="text-accent-green/60" />
                        </EmptyMedia>
                        <EmptyTitle className="text-[21px] font-semibold text-foreground">No rows to display</EmptyTitle>
                        <EmptyDescription className="max-w-md text-[14px] text-foreground/60">
                            {`The current result returned 0 rows in ${effectiveResult.executionTimeMs}ms.`}
                        </EmptyDescription>
                    </EmptyHeader>
                </Empty>
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
                showInfo={showInfo}
                onToggleInfo={() => setShowInfo((v) => !v)}
                showRowDetail={showRowDetail}
                onToggleRowDetail={() => {
                    setShowRowDetail((v) => !v);
                    if (!showRowDetail && selectedRowIdx < 0 && (effectiveResult?.rows.length ?? 0) > 0) {
                        setSelectedRowIdx(0);
                    }
                }}
                hasSelectedRows={selectedRowIdx >= 0}
                 columnIds={resultColumns}
                 hiddenColumns={columnVisibility as Record<string, boolean>}
                 onToggleColumn={(colId, visible) => setColumnVisibility((v) => ({ ...v, [colId]: visible }))}
                 undoCount={activeTab?.undoHistory?.length ?? 0}
                 onUndo={() => activeTabId && undoLastCellEdit(activeTabId)}
                 selectedRowCount={selectedRowIdxSet.size}
                 onBulkDelete={executeBulkDelete}
                 bulkDeleteLoading={bulkDeleteLoading}
                 showAggFooter={showAggFooter}
                 onToggleAggFooter={() => setShowAggFooter((v) => !v)}
                 showColorRules={showColorRules}
                 onToggleColorRules={() => setShowColorRules((v) => !v)}
                onExport={async (preset: ExportPreset, selectedOnly: boolean) => {
                    const result = effectiveResult;
                    if (!result) return;
                    try {
                        const rows =
                            selectedOnly && selectedRowIdx >= 0
                                ? [result.rows[selectedRowIdx]]
                                : result.rows;
                        await runExport(preset, result.columns, rows, fn.tableName ?? "export");
                        if (preset !== "clipboard-tsv") toast.success(selectedOnly && selectedRowIdx >= 0 ? "Exported selected row" : "Exported");
                        else toast.success("Copied to clipboard");
                    } catch {
                        toast.error("Export failed");
                    }
                }}
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
            {/* Feature 4: Color rules panel */}
            {showColorRules && viewMode === "data" && (
                <ColorRulesPanel
                    rules={colorRules}
                    columns={resultColumns}
                    onAdd={() => setColorRules((prev) => [
                        ...prev,
                        {
                            id: `cr-${Date.now()}`,
                            col: "",
                            op: "=",
                            value: "",
                            color: "blue",
                        },
                    ])}
                    onRemove={(id) => setColorRules((prev) => prev.filter((r) => r.id !== id))}
                    onUpdate={(id, patch) =>
                        setColorRules((prev) =>
                            prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
                        )
                    }
                    onClose={() => setShowColorRules(false)}
                />
            )}
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
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="flex flex-1 min-h-0 overflow-hidden">
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
                                                        {/* Column type badges */}
                                                        {(() => {
                                                            const col = structure?.columns.find((c) => c.name === colId);
                                                            if (!col) return null;
                                                            const fkNames = new Set(
                                                                (schemaGraph?.relationships ?? [])
                                                                    .filter((r) => r.sourceTable === fn.tableName)
                                                                    .flatMap((r) => r.sourceColumns)
                                                            );
                                                            return (
                                                                <span className="flex items-center gap-0.5 ml-auto opacity-60 group-hover/th:opacity-100 transition-opacity">
                                                                    {col.isPrimary && (
                                                                        <span className="rounded-[2px] border border-accent-yellow/40 bg-accent-yellow/10 px-0.5 text-[7px] font-bold text-accent-yellow leading-none">PK</span>
                                                                    )}
                                                                    {fkNames.has(col.name) && (
                                                                        <span className="rounded-[2px] border border-accent-blue/40 bg-accent-blue/10 px-0.5 text-[7px] font-bold text-accent-blue leading-none">FK</span>
                                                                    )}
                                                                    {col.isUnique && !col.isPrimary && (
                                                                        <span className="rounded-[2px] border border-accent-purple/40 bg-accent-purple/10 px-0.5 text-[7px] font-bold text-accent-purple leading-none">UQ</span>
                                                                    )}
                                                                    <span className="rounded-[2px] border border-border/50 bg-muted/30 px-0.5 text-[7px] font-mono text-muted-foreground/50 leading-none">
                                                                        {col.dataType.replace(/\(.*\)/, "").toUpperCase().slice(0, 7)}
                                                                    </span>
                                                                </span>
                                                            );
                                                        })()}
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
                                            No rows match the current view.
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
                                                    rowHeightClass,
                                                    isSelected || selectedRowIdxSet.has(idx)
                                                        ? "bg-surface-selected/82 border-l-2 border-primary/70"
                                                        : idx % 2 === 0
                                                            ? "bg-table-bg"
                                                            : "bg-row-alt",
                                                )}
                                                onDoubleClick={() => {
                                                    setSelectedRowIdx(idx);
                                                    setShowRowDetail(true);
                                                }}
                                            >
                                                <TableCell
                                                    className={cn(
                                                        "w-11 px-2.5 text-center border-r border-border-subtle cursor-pointer select-none transition-colors sticky left-0 z-20 bg-surface-2",
                                                        rowHeightClass,
                                                        isSelected
                                                            ? "bg-surface-selected/82 text-foreground font-bold"
                                                            : "text-foreground/38 bg-surface-2/92 hover:bg-surface-selected/82 hover:text-foreground",
                                                    )}
                                                     onClick={(e) => {
                                                        if (e.shiftKey || e.metaKey || e.ctrlKey) {
                                                            // Multi-select toggle
                                                            setSelectedRowIdxSet((prev) => {
                                                                const next = new Set(prev);
                                                                if (next.has(idx)) next.delete(idx);
                                                                else next.add(idx);
                                                                return next;
                                                            });
                                                        } else {
                                                            setSelectedRowIdxSet(new Set());
                                                            setSelectedRowIdx(isSelected ? -1 : idx);
                                                        }
                                                     }}
                                                     onContextMenu={(e) => {
                                                         e.preventDefault();
                                                         setContextMenuCell({ x: e.clientX, y: e.clientY, rowIdx: idx, col: null, rowData });
                                                     }}
                                                 >
                                                     {selectedRowIdxSet.has(idx)
                                                         ? <span className="text-primary font-bold">✓</span>
                                                         : page * effectivePageSize + idx + 1}
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
                                                        // Feature 4: color rules — find first matching rule for this cell
                                                        const matchingRule = colorRules.length > 0
                                                            ? colorRules.find((r) =>
                                                                evaluateColorRule(r, cell.column.id, rowData[cell.column.id])
                                                            ) ?? null
                                                            : null;
                                                        const colorStyle = matchingRule
                                                            ? COLOR_STYLE_MAP[matchingRule.color]
                                                            : undefined;
                                                        return (
                                                            <TableCell
                                                                key={cell.id}
                                                                style={{
                                                                    width: cell.column.getSize(),
                                                                }}
                                                                className={cn(
                                                                    "relative h-8 overflow-hidden border-r border-border-subtle px-4 text-foreground/92 whitespace-nowrap text-ellipsis last:border-r-0",
                                                                    colorStyle && colorStyle.bg,
                                                                    colorStyle && colorStyle.text,
                                                                    pendingEdit && "bg-warning/10 ring-1 ring-inset ring-warning/40",
                                                                    cell.column.id === selectedColId && "bg-surface-selected/58",
                                                                    isCellSelected && "bg-surface-selected/82 ring-1 ring-inset ring-primary/45",
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
                            {/* Feature 3: Aggregation footer row */}
                            {showAggFooter && (
                                <tfoot className="sticky bottom-0 z-10 bg-surface-2/96 backdrop-blur-sm">
                                    <tr className="border-t border-border-subtle shadow-[0_-1px_0_var(--color-border-subtle)]">
                                        {/* Row number cell */}
                                        <td className="w-11 px-2.5 text-center border-r border-border-subtle sticky left-0 z-20 bg-surface-2/98">
                                            <span className="text-[8.5px] font-bold uppercase tracking-widest text-foreground/30">Σ</span>
                                        </td>
                                        {table.getVisibleLeafColumns().map((col) => {
                                            const metric = footerMetrics[col.id] ?? null;
                                            const agg = aggValues[col.id] ?? {};
                                            const CYCLE: AggMetric[] = ["sum", "avg", "min", "max", "count", null];
                                            const next = CYCLE[(CYCLE.indexOf(metric) + 1) % CYCLE.length];
                                            const displayVal = metric && agg[metric] !== null && agg[metric] !== undefined
                                                ? (() => {
                                                    const v = agg[metric]!;
                                                    return Math.abs(v) >= 10000
                                                        ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
                                                        : Number.isInteger(v)
                                                            ? v.toLocaleString()
                                                            : v.toPrecision(5).replace(/\.?0+$/, "");
                                                })()
                                                : null;
                                            return (
                                                <td
                                                    key={col.id}
                                                    style={{ width: col.getSize() }}
                                                    className="h-7 px-3 border-r border-border-subtle last:border-r-0 cursor-pointer select-none group/agg"
                                                    onClick={() =>
                                                        setFooterMetrics((prev) => ({
                                                            ...prev,
                                                            [col.id]: next,
                                                        }))
                                                    }
                                                    title={`Click to cycle: ${CYCLE.map((m) => m ?? "off").join(" → ")}`}
                                                >
                                                    <div className="flex items-center justify-end gap-1">
                                                        {metric && (
                                                            <span className="text-[8px] font-bold uppercase text-foreground/36 group-hover/agg:text-foreground/55">
                                                                {metric}
                                                            </span>
                                                        )}
                                                        <span className={cn(
                                                            "text-[11px] font-mono tabular-nums",
                                                            displayVal
                                                                ? "text-accent-blue"
                                                                : "text-foreground/20 group-hover/agg:text-foreground/40",
                                                        )}>
                                                            {displayVal ?? "—"}
                                                        </span>
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </tfoot>
                            )}
                        </Table>
                    </div>
                </div>
                {/* Table Info Panel */}
                {showInfo && fn.tableName && (
                    <div className="w-[260px] shrink-0 border-l border-border overflow-hidden flex flex-col">
                        <div className="h-8 px-3 flex items-center justify-between border-b border-border shrink-0">
                            <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">
                                Table Info
                            </span>
                        </div>
                        <TableInfoPanel
                            structure={structure}
                            fkRelations={schemaGraph?.relationships ?? []}
                            tableName={fn.tableName}
                             rowCount={effectiveResult?.rows.length ?? 0}
                         />
                     </div>
                 )}
                {/* Row Detail Panel */}
                {showRowDetail && selectedRowIdx >= 0 && effectiveResult && (
                    <RowDetailPanel
                        row={effectiveResult.rows[selectedRowIdx] ?? {}}
                        rowIndex={page * effectivePageSize + selectedRowIdx}
                        totalRows={effectiveResult.rows.length}
                        tableName={fn.tableName}
                        structure={structure}
                        onClose={() => setShowRowDetail(false)}
                        onPrev={() => setSelectedRowIdx((i) => Math.max(0, i - 1))}
                        onNext={() => setSelectedRowIdx((i) => Math.min(effectiveResult.rows.length - 1, i + 1))}
                        hasPrev={selectedRowIdx > 0}
                        hasNext={selectedRowIdx < effectiveResult.rows.length - 1}
                    />
                )}
             </div>
                {/* Feature 1: Column Stats Panel — bottom strip */}
                {statsCol && effectiveResult && (
                    <ColumnStatsPanel
                        colId={statsCol}
                        rows={effectiveResult.rows}
                        onClose={() => setStatsCol(null)}
                    />
                )}
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
                 onPinLeft={(colId) => setColumnPinning((prev) => ({
                     left: [...(prev.left ?? []).filter((c) => c !== colId), colId],
                     right: (prev.right ?? []).filter((c) => c !== colId),
                 }))}
                 onPinRight={(colId) => setColumnPinning((prev) => ({
                     left: (prev.left ?? []).filter((c) => c !== colId),
                     right: [...(prev.right ?? []).filter((c) => c !== colId), colId],
                 }))}
                 onUnpin={(colId) => setColumnPinning((prev) => ({
                     left: (prev.left ?? []).filter((c) => c !== colId),
                     right: (prev.right ?? []).filter((c) => c !== colId),
                 }))}
                 isPinned={(colId) => table.getColumn(colId)?.getIsPinned() ?? false}
                 onShowStats={(colId) => setStatsCol((prev) => (prev === colId ? null : colId))}
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
                            const rowPendingCount = cols.filter((col) =>
                                Boolean(getPendingEditForCell(row, col)),
                            ).length;
                            return (
                                <div className="p-4 space-y-4">
                                    <div className="sticky top-0 z-10 rounded-xl border border-border-subtle bg-surface-2/96 backdrop-blur-md shadow-sm">
                                        <div className="flex flex-col gap-3 border-b border-border-subtle px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <AlignLeft
                                                        size={12}
                                                        className="text-foreground/42"
                                                    />
                                                    <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/52">
                                                        Record details
                                                    </span>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono text-foreground/64">
                                                    <Badge variant="outline" className="h-5 rounded-md border-border/60 bg-muted/40 px-1.5 text-[10px] font-medium text-muted-foreground/72">
                                                        Row {page * effectivePageSize + formRowIdx + 1}
                                                    </Badge>
                                                    <Badge variant="outline" className="h-5 rounded-md border-border/60 bg-muted/40 px-1.5 text-[10px] font-medium text-muted-foreground/72">
                                                        {cols.length} fields
                                                    </Badge>
                                                    {structure && (
                                                        <Badge variant="outline" className="h-5 rounded-md border-border/60 bg-muted/40 px-1.5 text-[10px] font-medium text-muted-foreground/72">
                                                            {primaryKeyColumns.length} PK
                                                        </Badge>
                                                    )}
                                                    {rowPendingCount > 0 && (
                                                        <Badge variant="outline" className="h-5 rounded-md border-warning/30 bg-warning/10 px-1.5 text-[10px] font-medium text-warning">
                                                            {rowPendingCount} pending
                                                        </Badge>
                                                    )}
                                                </div>
                                                {fn.tableName && (
                                                    <div className="text-[12px] text-foreground/58">
                                                        Table <span className="font-mono text-foreground">{fn.tableName}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                                <Button
                                                    variant="outline"
                                                    size="xs"
                                                    disabled={formRowIdx === 0}
                                                    onClick={() =>
                                                        setSelectedRowIdx((i) =>
                                                            Math.max(
                                                                0,
                                                                (i < 0 ? 0 : i) - 1,
                                                            ),
                                                        )
                                                    }
                                                    className="text-[11px]"
                                                >
                                                    <ChevronLeft size={11} />
                                                    Prev
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="xs"
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
                                                    className="text-[11px]"
                                                >
                                                    Next
                                                    <ChevronRight size={11} />
                                                </Button>
                                                {fn.tableName && (
                                                    <>
                                                        <Button
                                                            variant="outline"
                                                            size="xs"
                                                            onClick={() =>
                                                                void cloneRow(row)
                                                            }
                                                            className="text-[11px]"
                                                        >
                                                            <Plus size={11} />
                                                            Clone row
                                                        </Button>
                                                        <Button
                                                            variant="destructive"
                                                            size="xs"
                                                            onClick={() =>
                                                                void buildAndShowDeleteSql(
                                                                    row,
                                                                )
                                                            }
                                                            className="text-[11px]"
                                                        >
                                                            <Trash2 size={11} />
                                                            Delete row
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 px-4 py-3 text-[11px] text-foreground/58 sm:grid-cols-4">
                                            <div className="rounded-lg border border-border-subtle bg-surface-3 px-3 py-2">
                                                <div className="text-[10px] uppercase tracking-wide text-foreground/42">
                                                    Current row
                                                </div>
                                                <div className="mt-1 font-mono text-foreground">
                                                    {page * effectivePageSize + formRowIdx + 1} / {effectiveResult.rows.length}
                                                </div>
                                            </div>
                                            <div className="rounded-lg border border-border-subtle bg-surface-3 px-3 py-2">
                                                <div className="text-[10px] uppercase tracking-wide text-foreground/42">
                                                    Visible fields
                                                </div>
                                                <div className="mt-1 font-mono text-foreground">
                                                    {cols.length}
                                                </div>
                                            </div>
                                            <div className="rounded-lg border border-border-subtle bg-surface-3 px-3 py-2">
                                                <div className="text-[10px] uppercase tracking-wide text-foreground/42">
                                                    Primary keys
                                                </div>
                                                <div className="mt-1 font-mono text-foreground">
                                                    {primaryKeyColumns.length || 0}
                                                </div>
                                            </div>
                                            <div className="rounded-lg border border-border-subtle bg-surface-3 px-3 py-2">
                                                <div className="text-[10px] uppercase tracking-wide text-foreground/42">
                                                    Pending changes
                                                </div>
                                                <div className="mt-1 font-mono text-foreground">
                                                    {rowPendingCount}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        {cols.map((col, colIdx) => {
                                            const isEditing =
                                                editingCell?.rowIdx ===
                                                formRowIdx &&
                                                editingCell?.col === col;
                                            const val = row[col];
                                            const displayValue =
                                                val === null
                                                    ? "[NULL]"
                                                    : typeof val === "object"
                                                        ? JSON.stringify(val, null, 2)
                                                        : String(val);
                                            const pendingEdit =
                                                getPendingEditForCell(row, col);
                                            const columnInfo =
                                                structureColumnMap[col];
                                            return (
                                                <div
                                                    key={col}
                                                    className={cn(
                                                        "rounded-xl border border-border-subtle bg-surface-2 shadow-sm transition-colors",
                                                        pendingEdit &&
                                                        "border-warning/30 bg-warning/5",
                                                        colIdx % 2 === 0
                                                            ? ""
                                                            : "",
                                                    )}
                                                >
                                                    <div className="flex flex-col gap-3 p-4 lg:flex-row lg:items-start lg:justify-between">
                                                        <div className="min-w-0 lg:w-72 lg:shrink-0">
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <span className="text-[12px] font-mono font-semibold text-foreground truncate">
                                                                    {col}
                                                                </span>
                                                                {columnInfo?.isPrimary && (
                                                                    <Badge variant="outline" className="h-4 rounded-md border-warning/20 bg-warning/10 px-1 text-[9px] text-warning">
                                                                        PK
                                                                    </Badge>
                                                                )}
                                                                {columnInfo?.isUnique &&
                                                                    !columnInfo.isPrimary && (
                                                                        <Badge variant="outline" className="h-4 rounded-md border-primary/20 bg-primary/10 px-1 text-[9px] text-primary">
                                                                            UNIQUE
                                                                        </Badge>
                                                                    )}
                                                                {columnInfo && !columnInfo.nullable && (
                                                                    <Badge variant="outline" className="h-4 rounded-md border-destructive/20 bg-destructive/10 px-1 text-[9px] text-destructive">
                                                                        NOT NULL
                                                                    </Badge>
                                                                )}
                                                                {pendingEdit && (
                                                                    <Badge variant="outline" className="h-4 rounded-md border-warning/30 bg-warning/10 px-1 text-[9px] text-warning">
                                                                        PENDING
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <div className="mt-2 space-y-1 text-[11px] text-foreground/58">
                                                                <div>
                                                                    Type <span className="font-mono text-foreground/80">{columnInfo?.dataType ?? "Unknown"}</span>
                                                                </div>
                                                                <div>
                                                                    Nullability <span className="font-mono text-foreground/80">{columnInfo ? (columnInfo.nullable ? "Nullable" : "Required") : "Unknown"}</span>
                                                                </div>
                                                                {columnInfo?.defaultValue != null && (
                                                                    <div>
                                                                        Default <span className="font-mono text-foreground/80">{columnInfo.defaultValue}</span>
                                                                    </div>
                                                                )}
                                                                {columnInfo?.extra && (
                                                                    <div>
                                                                        Extra <span className="font-mono text-foreground/80">{columnInfo.extra}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="min-w-0 flex-1 space-y-3">
                                                            <div className="rounded-lg border border-border-subtle bg-surface-3 px-3 py-2">
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
                                                                        className="w-full bg-transparent outline-none text-[12px] font-mono text-foreground"
                                                                    />
                                                                ) : (
                                                                    <button
                                                                        type="button"
                                                                        className={cn(
                                                                            "block w-full text-left text-[12px] font-mono break-all outline-none",
                                                                            pendingEdit
                                                                                ? "text-warning"
                                                                                : val ===
                                                                                    null
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
                                                                        {displayValue}
                                                                    </button>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                {fn.tableName && (
                                                                    <>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="xs"
                                                                            onClick={() =>
                                                                                void startInlineEdit(
                                                                                    formRowIdx,
                                                                                    col,
                                                                                    val,
                                                                                    row,
                                                                                )
                                                                            }
                                                                            disabled={!isColumnEditable(col)}
                                                                        >
                                                                            Edit
                                                                        </Button>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="xs"
                                                                            onClick={() =>
                                                                                void editCellInModal(
                                                                                    formRowIdx,
                                                                                    col,
                                                                                    val,
                                                                                    row,
                                                                                )
                                                                            }
                                                                            disabled={!isColumnEditable(col)}
                                                                        >
                                                                            Detailed edit
                                                                        </Button>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="xs"
                                                                            onClick={() =>
                                                                                void setNullCell(
                                                                                    row,
                                                                                    col,
                                                                                )
                                                                            }
                                                                            disabled={!canSetColumnToNull(col)}
                                                                        >
                                                                            Set NULL
                                                                        </Button>
                                                                    </>
                                                                )}
                                                                <Button
                                                                    variant="ghost"
                                                                    size="xs"
                                                                    onClick={() =>
                                                                        copyToClipboard(
                                                                            toEditString(
                                                                                val,
                                                                            ),
                                                                        )
                                                                    }
                                                                >
                                                                    Copy value
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="xs"
                                                                    onClick={() =>
                                                                        copyToClipboard(
                                                                            col,
                                                                        )
                                                                    }
                                                                >
                                                                    Copy field
                                                                </Button>
                                                            </div>
                                                            {pendingEdit && (
                                                                <div className="rounded-lg border border-warning/20 bg-warning/10 px-3 py-2 text-[11px] text-warning">
                                                                    Pending value: <span className="font-mono">{pendingEdit.pendingValue ?? "NULL"}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
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
                        <div className="flex h-full items-center justify-center p-6">
                            <div className="space-y-3 text-center">
                                <Loader2 size={18} className="mx-auto animate-spin text-primary" />
                                <p className="text-[12px] text-muted-foreground/60">Loading structure...</p>
                            </div>
                        </div>
                    ) : structure ? (
                        <div className="space-y-4 p-4">
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-xl border border-border-subtle bg-surface-2 px-4 py-3 shadow-sm">
                                    <div className="text-[10px] uppercase tracking-wide text-foreground/42">
                                        Table
                                    </div>
                                    <div className="mt-1 text-[13px] font-mono text-foreground">
                                        {fn.tableName ?? "Unknown"}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-border-subtle bg-surface-2 px-4 py-3 shadow-sm">
                                    <div className="text-[10px] uppercase tracking-wide text-foreground/42">
                                        Columns
                                    </div>
                                    <div className="mt-1 text-[13px] font-mono text-foreground">
                                        {structure.columns.length}
                                    </div>
                                </div>
                                <div className="rounded-xl border border-border-subtle bg-surface-2 px-4 py-3 shadow-sm">
                                    <div className="text-[10px] uppercase tracking-wide text-foreground/42">
                                        Indexes
                                    </div>
                                    <div className="mt-1 text-[13px] font-mono text-foreground">
                                        {structure.indexes.length}
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-xl border border-border-subtle bg-surface-2 shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <Key size={12} className="text-foreground/42" />
                                        <span className="text-[12px] font-semibold text-foreground/72">
                                            Columns
                                        </span>
                                        <Badge variant="outline" className="h-5 rounded-md border-border/60 bg-muted/40 px-1.5 text-[10px] font-medium text-muted-foreground/72">
                                            {structure.columns.length}
                                        </Badge>
                                    </div>
                                    {fn.tableName && (
                                        <Button
                                            variant="outline"
                                            size="xs"
                                            aria-label="Add column"
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
                                        >
                                            <Plus size={11} />
                                            Add column
                                        </Button>
                                    )}
                                </div>
                                <div className="divide-y divide-border-subtle">
                                    {structure.columns.map((col) => (
                                        <div key={col.name} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="min-w-0 flex-1 space-y-2">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-[12px] font-mono font-semibold text-foreground break-all">
                                                        {col.name}
                                                    </span>
                                                    <span className="rounded-md border border-accent-orange/15 bg-accent-orange/8 px-1.5 py-0.5 text-[10px] font-mono text-accent-orange/78">
                                                        {col.dataType}
                                                    </span>
                                                    {col.isPrimary && (
                                                        <Badge variant="outline" className="h-4 rounded-md border-warning/20 bg-warning/10 px-1 text-[9px] text-warning">
                                                            PK
                                                        </Badge>
                                                    )}
                                                    {col.isUnique && !col.isPrimary && (
                                                        <Badge variant="outline" className="h-4 rounded-md border-primary/20 bg-primary/10 px-1 text-[9px] text-primary">
                                                            UNIQUE
                                                        </Badge>
                                                    )}
                                                    {!col.nullable && (
                                                        <Badge variant="outline" className="h-4 rounded-md border-destructive/20 bg-destructive/10 px-1 text-[9px] text-destructive">
                                                            NOT NULL
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="grid gap-2 text-[11px] text-foreground/58 sm:grid-cols-2 xl:grid-cols-3">
                                                    <div>
                                                        Default <span className="font-mono text-foreground/82">{col.defaultValue ?? "None"}</span>
                                                    </div>
                                                    <div>
                                                        Extra <span className="font-mono text-foreground/82">{col.extra ?? "None"}</span>
                                                    </div>
                                                    <div>
                                                        Nullable <span className="font-mono text-foreground/82">{col.nullable ? "Yes" : "No"}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            {fn.tableName && (
                                                <div className="flex items-center gap-2 lg:shrink-0">
                                                    <Button
                                                        variant="ghost"
                                                        size="xs"
                                                        onClick={() => copyToClipboard(col.name)}
                                                    >
                                                        Copy name
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="xs"
                                                        aria-label={`Drop column ${col.name}`}
                                                        onClick={() =>
                                                            setDropColTarget(col.name)
                                                        }
                                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                    >
                                                        <Trash2 size={11} />
                                                        Drop
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-xl border border-border-subtle bg-surface-2 shadow-sm overflow-hidden">
                                <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <Hash size={12} className="text-foreground/42" />
                                        <span className="text-[12px] font-semibold text-foreground/72">
                                            Indexes
                                        </span>
                                        <Badge variant="outline" className="h-5 rounded-md border-border/60 bg-muted/40 px-1.5 text-[10px] font-medium text-muted-foreground/72">
                                            {structure.indexes.length}
                                        </Badge>
                                    </div>
                                    {fn.tableName && (
                                        <Button
                                            variant="outline"
                                            size="xs"
                                            aria-label="Create index"
                                            onClick={() => {
                                                setCreateIdxDef({
                                                    name: "",
                                                    columns: [],
                                                    unique: false,
                                                });
                                                setShowCreateIndex(true);
                                            }}
                                        >
                                            <Plus size={11} />
                                            Create index
                                        </Button>
                                    )}
                                </div>
                                {structure.indexes.length === 0 ? (
                                    <Empty className="border-0 py-10">
                                        <EmptyHeader>
                                            <EmptyTitle>No indexes yet</EmptyTitle>
                                            <EmptyDescription>This table does not currently expose index metadata.</EmptyDescription>
                                        </EmptyHeader>
                                    </Empty>
                                ) : (
                                    <div className="divide-y divide-border-subtle">
                                        {structure.indexes.map((idx) => (
                                            <div key={idx.name} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                                                <div className="min-w-0 flex-1 space-y-2">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span className="text-[12px] font-mono font-semibold text-accent-blue/78 break-all">
                                                            {idx.name}
                                                        </span>
                                                        {idx.unique && (
                                                            <Badge variant="outline" className="h-4 rounded-md border-accent-green/20 bg-accent-green/10 px-1 text-[9px] text-accent-green">
                                                                UNIQUE
                                                            </Badge>
                                                        )}
                                                        {idx.indexType && (
                                                            <span className="text-[10px] font-mono uppercase text-foreground/42">
                                                                {idx.indexType}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {idx.columns.map((c) => (
                                                            <span
                                                                key={c}
                                                                className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-foreground/64"
                                                            >
                                                                {c}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 lg:shrink-0">
                                                    <Button
                                                        variant="ghost"
                                                        size="xs"
                                                        onClick={() =>
                                                            copyToClipboard(idx.name)
                                                        }
                                                    >
                                                        Copy name
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="xs"
                                                        aria-label={`Drop index ${idx.name}`}
                                                        onClick={() =>
                                                            setDropIdxTarget(
                                                                idx.name,
                                                            )
                                                        }
                                                        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                                    >
                                                        <Trash2 size={11} />
                                                        Drop
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <Empty className="border-0 py-10">
                            <EmptyHeader>
                                <EmptyTitle>No structure data</EmptyTitle>
                                <EmptyDescription>The schema metadata for this table is currently unavailable.</EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}
                </div>
            )}
            {viewMode === "er" && (
                <div className="flex-1 min-h-0 overflow-hidden bg-background">
                    {schemaGraphLoading && !schemaGraph ? (
                        <div className="flex h-full items-center justify-center p-6">
                            <div className="space-y-3 text-center">
                                <Loader2 size={18} className="mx-auto animate-spin text-primary" />
                                <p className="text-[12px] text-muted-foreground/60">Loading schema graph...</p>
                            </div>
                        </div>
                    ) : schemaGraphError && !schemaGraph ? (
                        <div className="flex h-full items-center justify-center p-6">
                            <Alert variant="destructive" className="max-w-md rounded-xl border-destructive/20 bg-destructive/5 p-5 text-center">
                                <CircleAlert size={18} className="mx-auto mb-3 text-destructive" />
                                <AlertTitle className="text-[15px] font-semibold tracking-tight text-destructive">
                                    Failed to load ER diagram
                                </AlertTitle>
                                <p className="mt-2 break-words text-[12px] font-mono text-destructive/75">{schemaGraphError}</p>
                                <AlertAction className="static mt-4 flex justify-center">
                                    <Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-md px-3 text-[12px] font-medium" onClick={() => loadSchemaGraph(true)}>
                                        Retry
                                    </Button>
                                </AlertAction>
                            </Alert>
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
                        <Empty className="border-0 py-10">
                            <EmptyHeader>
                                <EmptyTitle>No schema graph data</EmptyTitle>
                                <EmptyDescription>This connection did not return enough relationship metadata to draw a diagram.</EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}
                </div>
            )}
            {/* Cell edit error banner */}
            {cellEditError && (
                <Alert variant="destructive" className="shrink-0 rounded-none border-x-0 border-b-0 border-t bg-destructive/10 px-3 py-2 text-[12px]">
                    <span className="min-w-0 flex-1 truncate font-mono text-destructive">{cellEditError}</span>
                    <AlertAction className="static ml-auto">
                        <Button variant="ghost" size="icon-xs" aria-label="Dismiss error" onClick={() => setCellEditError(null)} className="text-destructive/60 hover:bg-destructive/10 hover:text-destructive">
                        <X size={10} />
                        </Button>
                    </AlertAction>
                </Alert>
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
                                "relative flex items-center px-3 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
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
                                className="h-6 px-2 text-[11px] text-foreground/58"
                            >
                                ← Prev
                            </Button>
                            <span className="tabular-nums text-foreground/56">
                                {effectiveResult.rows.length === 0
                                    ? "0 rows"
                                    : `${page * effectivePageSize + 1}–${page * effectivePageSize + effectiveResult.rows.length}`}
                            </span>
                            <Button
                                variant="ghost"
                                size="xs"
                                 disabled={
                                     effectiveResult.rows.length < effectivePageSize ||
                                     filtersActive
                                 }
                                onClick={() => onPageChange(page + 1)}
                                className="h-6 px-2 text-[11px] text-foreground/58"
                            >
                                Next →
                            </Button>
                         </div>
                         {/* Feature 6: Per-tab page size selector */}
                         <DropdownMenu>
                             <DropdownMenuTrigger asChild>
                                 <Button size="xs" variant="ghost" className="h-6 gap-1 px-2 text-[11px] text-foreground/55">
                                     {effectivePageSize} / page
                                     <ChevronDown size={9} />
                                 </Button>
                             </DropdownMenuTrigger>
                             <DropdownMenuContent align="end" side="top" className="text-[11px] w-[110px]">
                                 {[25, 50, 100, 250, 500].map((n) => (
                                     <DropdownMenuItem
                                         key={n}
                                         onClick={() => { setLocalPageSize(n); onPageChange(0); }}
                                         className={cn("gap-2 cursor-pointer", effectivePageSize === n && "font-semibold text-primary")}
                                     >
                                         {n} rows
                                         {effectivePageSize === n && <span className="ml-auto text-primary">✓</span>}
                                     </DropdownMenuItem>
                                 ))}
                                 {localPageSize !== null && (
                                     <>
                                         <DropdownMenuSeparator />
                                         <DropdownMenuItem
                                             onClick={() => { setLocalPageSize(null); onPageChange(0); }}
                                             className="gap-2 cursor-pointer text-foreground/55"
                                         >
                                             Reset to default
                                         </DropdownMenuItem>
                                     </>
                                 )}
                             </DropdownMenuContent>
                         </DropdownMenu>
                         <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button size="xs" variant="outline" className="h-6 gap-1.5 px-2 text-[11px]">
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

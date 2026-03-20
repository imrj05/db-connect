import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { sql } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    getSortedRowModel,
    SortingState,
} from "@tanstack/react-table";
import {
    Play,
    Loader2,
    Search,
    Sparkles,
    Download,
    Database,
    Server,
    Lock,
    Hash,
    Key,
    FileText,
    FileJson,
    Clock,
    Bookmark,
    BookmarkPlus,
    Trash2,
    Check,
    X,
    Pencil,
    Plus,
    Filter,
    FilterX,
    Upload,
    AlignLeft,
    Circle,
    TableProperties,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    TableInfo,
    ConnectionFunction,
    TableStructure,
    QueryHistoryEntry,
    SavedQuery,
    FilterCondition,
    FilterOp,
    DatabaseType,
} from "@/types";
import { tauriApi } from "@/lib/tauri-api";
// ─── Idle state ────────────────────────────────────────────────────────────────
function IdleView({ onNewConnection }: { onNewConnection: () => void }) {
    return (
        <div className="h-full flex flex-col items-center justify-center bg-background text-muted-foreground gap-4">
            <div className="w-16 h-16 opacity-10 bg-primary/10 rounded-2xl flex items-center justify-center">
                <Search size={32} className="text-primary/20" />
            </div>
            <div className="text-center space-y-2">
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    No function selected
                </p>
                <p className="text-[10px] text-muted-foreground/60">
                    Click a function in the sidebar or press ⌘K to search
                </p>
            </div>
            <Button
                onClick={onNewConnection}
                className="mt-2 text-xs font-bold uppercase tracking-widest"
            >
                Add Connection
            </Button>
        </div>
    );
}
// ─── Table grid (for _tbl / per-table functions) ────────────────────────────────
function TableGridView({
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
    const [viewMode, setViewMode] = useState<"data" | "form" | "structure">("data");
    const [selectedRowIdx, setSelectedRowIdx] = useState(0);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [structure, setStructure] = useState<TableStructure | null>(null);
    const [structureLoading, setStructureLoading] = useState(false);
    // Cell editing state
    const [editingCell, setEditingCell] = useState<{
        rowIdx: number;
        col: string;
        value: string;
    } | null>(null);
    const [cellEditError, setCellEditError] = useState<string | null>(null);
    const [cellEditLoading, setCellEditLoading] = useState(false);
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
    // Create table state
    type ColDef = {
        id: string;
        name: string;
        type: string;
        nullable: boolean;
        isPrimary: boolean;
    };
    const [showCreateTable, setShowCreateTable] = useState(false);
    const [newTableName, setNewTableName] = useState("");
    const [colDefs, setColDefs] = useState<ColDef[]>([
        {
            id: "c0",
            name: "id",
            type: "INTEGER",
            nullable: false,
            isPrimary: true,
        },
    ]);
    const [createTableLoading, setCreateTableLoading] = useState(false);
    const [createTableError, setCreateTableError] = useState<string | null>(
        null,
    );
    // Query log state
    const [showQueryLogSyntax, setShowQueryLogSyntax] = useState(true);
    const { queryHistory, clearHistory, connections } = useAppStore();
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
                        if (typeof val === "number" || typeof val === "boolean") return String(val);
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
    // ─── Filter state ──────────────────────────────────────────────────────────
    const [showFilterBar, setShowFilterBar] = useState(false);
    const [filters, setFilters] = useState<FilterCondition[]>([]);
    const [filteredResult, setFilteredResult] = useState<
        typeof queryResult | null
    >(null);
    const [filterLoading, setFilterLoading] = useState(false);
    const [showSearchBar, setShowSearchBar] = useState(false);
    const [cellSearch, setCellSearch] = useState("");
    const availableCols = queryResult?.columns.length
        ? queryResult.columns
        : queryResult?.rows.length
            ? Object.keys(queryResult.rows[0])
            : [];
    const addFilter = () => {
        if (availableCols.length === 0) return;
        setFilters((prev) => [
            ...prev,
            {
                id: `f-${Date.now()}`,
                col: availableCols[0],
                op: "=" as FilterOp,
                value: "",
                join: "AND",
            },
        ]);
        setShowFilterBar(true);
    };
    const removeFilter = (id: string) => {
        const next = filters.filter((f) => f.id !== id);
        if (next.length === 0) {
            // Last row removed — dismiss the bar entirely
            setShowFilterBar(false);
            setFilters([]);
            setFilteredResult(null);
        } else {
            setFilters(next);
        }
    };
    const clearFilters = () => {
        // Reset: clear applied results + give one fresh empty row, keep bar open
        setFilters([{ id: `f-${Date.now()}`, col: availableCols[0] ?? "", op: "=" as FilterOp, value: "", join: "AND" }]);
        setFilteredResult(null);
    };
    const applyFilters = useCallback(async () => {
        if (!fn.tableName || filters.length === 0) return;
        setFilterLoading(true);
        const isMysql =
            connections.find((c) => c.id === fn.connectionId)?.type ===
            "mysql";
        const qi = (name: string) =>
            isMysql ? `\`${name}\`` : `"${name}"`;
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
    }, [filters, fn, page, connections]);
    // Re-apply filters when page changes (if active)
    useEffect(() => {
        if (filteredResult && filters.length > 0) {
            applyFilters();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page]);
    // Reset filters when the active function changes
    useEffect(() => {
        setFilters([]);
        setFilteredResult(null);
        setShowFilterBar(false);
    }, [fn.id]);
    const effectiveResult = filteredResult ?? queryResult;
    const filtersActive = filteredResult !== null && filters.length > 0;
    const searchedRows = useMemo(() => {
        if (!cellSearch.trim() || !effectiveResult)
            return effectiveResult?.rows ?? [];
        const q = cellSearch.toLowerCase();
        return effectiveResult.rows.filter((row) =>
            Object.values(row).some(
                (v) => v !== null && String(v).toLowerCase().includes(q),
            ),
        );
    }, [cellSearch, effectiveResult]);
    // ─── Import state ───────────────────────────────────────────────────────────
    const [showImport, setShowImport] = useState(false);
    const [importText, setImportText] = useState("");
    const [importFormat, setImportFormat] = useState<"csv" | "json">("csv");
    const [importPreview, setImportPreview] = useState<{
        headers: string[];
        rows: string[][];
    } | null>(null);
    const [importError, setImportError] = useState<string | null>(null);
    const [importing, setImporting] = useState(false);
    const [importDone, setImportDone] = useState<number | null>(null);
    const importFileRef = useRef<HTMLInputElement>(null);
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
    const handleViewMode = (mode: "data" | "form" | "structure") => {
        setViewMode(mode);
        if (mode === "structure") loadStructure();
    };
    useEffect(() => {
        setSelectedRowIdx(0);
        setCellSearch("");
        setShowSearchBar(false);
    }, [queryResult]);
    useEffect(() => {
        if (filtersActive) setShowFilterBar(true);
    }, [filtersActive]);
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "f" && viewMode === "data") {
                e.preventDefault();
                setShowSearchBar(true);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [viewMode]);
    const commitEdit = useCallback(async () => {
        if (!editingCell || !fn.tableName || !queryResult) {
            setEditingCell(null);
            return;
        }
        const s = structure ?? (await loadStructure());
        if (!s) {
            setCellEditError("Could not load table structure");
            setEditingCell(null);
            return;
        }
        const pkCols = s.columns.filter((c) => c.isPrimary);
        if (pkCols.length === 0) {
            setCellEditError(
                "No primary key — editing unavailable for this table",
            );
            setEditingCell(null);
            return;
        }
        const row = queryResult.rows[editingCell.rowIdx];
        const whereParts = pkCols.map((pk) => {
            const v = row[pk.name];
            if (v === null || v === undefined) return `"${pk.name}" IS NULL`;
            return `"${pk.name}" = '${String(v).replace(/'/g, "''")}'`;
        });
        const newVal = editingCell.value;
        const setVal =
            newVal === "" ? "NULL" : `'${newVal.replace(/'/g, "''")}'`;
        const updateSql = `UPDATE "${fn.tableName}" SET "${editingCell.col}" = ${setVal} WHERE ${whereParts.join(" AND ")}`;
        setCellEditLoading(true);
        try {
            await tauriApi.executeQuery(fn.connectionId, updateSql);
            setEditingCell(null);
            setCellEditError(null);
            await onPageChange(page);
        } catch (e) {
            setCellEditError(String(e));
            setEditingCell(null);
        } finally {
            setCellEditLoading(false);
        }
    }, [
        editingCell,
        fn,
        structure,
        queryResult,
        page,
        onPageChange,
        loadStructure,
    ]);
    const buildAndShowDeleteSql = useCallback(
        async (rowData: Record<string, unknown>) => {
            if (!fn.tableName || !queryResult) return;
            const s = structure ?? (await loadStructure());
            if (!s) return;
            const pkCols = s.columns.filter((c) => c.isPrimary);
            let whereParts: string[];
            if (pkCols.length > 0) {
                whereParts = pkCols.map((pk) => {
                    const v = rowData[pk.name];
                    if (v === null || v === undefined)
                        return `"${pk.name}" IS NULL`;
                    return `"${pk.name}" = '${String(v).replace(/'/g, "''")}'`;
                });
            } else {
                whereParts = Object.entries(rowData).map(([col, v]) => {
                    if (v === null || v === undefined)
                        return `"${col}" IS NULL`;
                    return `"${col}" = '${String(v).replace(/'/g, "''")}'`;
                });
            }
            setDeleteRowSql(
                `DELETE FROM "${fn.tableName}" WHERE ${whereParts.join(" AND ")}`,
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
    const dbType =
        connections.find((c) => c.id === fn.connectionId)?.type ??
        "postgresql";
    const qi = (n: string) =>
        dbType === "mysql" ? `\`${n}\`` : `"${n}"`;
    function buildCreateTableSql(
        tableName: string,
        cols: ColDef[],
    ): string {
        const pkCols = cols.filter((c) => c.isPrimary);
        const colLines = cols.map((c) => {
            const parts = [qi(c.name), c.type];
            if (!c.nullable && !c.isPrimary) parts.push("NOT NULL");
            if (c.isPrimary && pkCols.length === 1)
                parts.push("PRIMARY KEY");
            return "  " + parts.join(" ");
        });
        if (pkCols.length > 1) {
            colLines.push(
                `  PRIMARY KEY (${pkCols.map((c) => qi(c.name)).join(", ")})`,
            );
        }
        return `CREATE TABLE ${qi(tableName)} (\n${colLines.join(",\n")}\n)`;
    }
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
    const executeCreateTable = useCallback(async () => {
        if (!newTableName.trim() || colDefs.length === 0) return;
        setCreateTableLoading(true);
        setCreateTableError(null);
        try {
            const sql = buildCreateTableSql(newTableName.trim(), colDefs);
            await tauriApi.executeQuery(fn.connectionId, sql);
            setShowCreateTable(false);
            setNewTableName("");
            setColDefs([
                {
                    id: "c0",
                    name: "id",
                    type: "INTEGER",
                    nullable: false,
                    isPrimary: true,
                },
            ]);
        } catch (e) {
            setCreateTableError(String(e));
        } finally {
            setCreateTableLoading(false);
        }
    }, [newTableName, colDefs, fn]);
    const executeDropTable = useCallback(async () => {
        if (!fn.tableName) return;
        setDropTableLoading(true);
        try {
            await tauriApi.executeQuery(
                fn.connectionId,
                `DROP TABLE ${qi(fn.tableName)}`,
            );
            setShowDropTable(false);
        } catch (e) {
            setCellEditError(String(e));
        } finally {
            setDropTableLoading(false);
        }
    }, [fn, qi]);
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
            setStructure(null);
        } catch (e) {
            setAddColError(String(e));
        } finally {
            setAddColLoading(false);
        }
    }, [fn, addCol, qi]);
    const executeDropColumn = useCallback(async () => {
        if (!fn.tableName || !dropColTarget) return;
        setDropColLoading(true);
        try {
            await tauriApi.executeQuery(
                fn.connectionId,
                `ALTER TABLE ${qi(fn.tableName)} DROP COLUMN ${qi(dropColTarget)}`,
            );
            setDropColTarget(null);
            setStructure(null);
        } catch (e) {
            setCellEditError(String(e));
        } finally {
            setDropColLoading(false);
        }
    }, [fn, dropColTarget, qi]);
    const executeCreateIndex = useCallback(async () => {
        if (!fn.tableName || !createIdxDef.name.trim() || createIdxDef.columns.length === 0) return;
        setCreateIdxLoading(true);
        setCreateIdxError(null);
        try {
            await tauriApi.executeQuery(
                fn.connectionId,
                buildCreateIndexSql(fn.tableName, createIdxDef.name.trim(), createIdxDef.columns, createIdxDef.unique),
            );
            setShowCreateIndex(false);
            setCreateIdxDef({ name: "", columns: [], unique: false });
            setStructure(null);
        } catch (e) {
            setCreateIdxError(String(e));
        } finally {
            setCreateIdxLoading(false);
        }
    }, [fn, createIdxDef, dbType, qi]);
    const executeDropIndex = useCallback(async () => {
        if (!fn.tableName || !dropIdxTarget) return;
        setDropIdxLoading(true);
        try {
            await tauriApi.executeQuery(
                fn.connectionId,
                buildDropIndexSql(fn.tableName, dropIdxTarget),
            );
            setDropIdxTarget(null);
            setStructure(null);
        } catch (e) {
            setCellEditError(String(e));
        } finally {
            setDropIdxLoading(false);
        }
    }, [fn, dropIdxTarget, dbType, qi]);
    const table = useReactTable({
        data: searchedRows,
        columns: [
            ...(effectiveResult?.columns && effectiveResult.columns.length > 0
                ? effectiveResult.columns
                : effectiveResult?.rows && effectiveResult.rows.length > 0
                    ? Object.keys(effectiveResult.rows[0])
                    : []
            ).map((col: string) => ({
                accessorKey: col,
                header: col,
                cell: (info: any) => {
                    const rowIdx = info.row.index;
                    const isEditing =
                        editingCell?.rowIdx === rowIdx && editingCell?.col === col;
                    if (isEditing) {
                        return (
                            <input
                                autoFocus
                                value={editingCell.value}
                                onChange={(e) =>
                                    setEditingCell((prev) =>
                                        prev
                                            ? { ...prev, value: e.target.value }
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
                                onClick={(e) => e.stopPropagation()}
                                className="w-full bg-primary/10 border border-blue-500/50 rounded px-1 outline-none text-[11px] font-mono text-foreground"
                            />
                        );
                    }
                    return (
                        <span
                            className={cn(
                                "font-medium",
                                info.getValue() === null
                                    ? "text-muted-foreground italic"
                                    : "",
                            )}
                            onDoubleClick={() =>
                                fn.tableName &&
                                setEditingCell({
                                    rowIdx,
                                    col,
                                    value:
                                        info.getValue() === null
                                            ? ""
                                            : String(info.getValue()),
                                })
                            }
                        >
                            {info.getValue() === null
                                ? "null"
                                : String(info.getValue())}
                        </span>
                    );
                },
            })),
            ...(fn.tableName
                ? [
                    {
                        id: "_delete",
                        header: "",
                        enableSorting: false,
                        cell: (info: any) => {
                            const rowData = info.row.original;
                            return (
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive/50 hover:text-destructive hover:bg-destructive/10"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        buildAndShowDeleteSql(rowData);
                                    }}
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            );
                        },
                    },
                ]
                : []),
        ],
        state: { sorting },
        onSortingChange: setSorting,
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
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest opacity-60">
                    0 rows · {effectiveResult.executionTimeMs}ms
                </p>
            </div>
        );
    }
    return (
        <div className="h-full flex flex-col bg-background overflow-hidden">
            {/* Header */}
            <div className="h-9 px-4 flex items-center justify-between border-b border-border bg-background shrink-0">
                <span className="font-mono text-[11px] text-accent-blue font-bold">
                    {fn.type === "table"
                        ? fn.tableName
                        : fn.callSignature
                            .slice(fn.prefix.length + 1)
                            .replace(/\(.*$/, "")}
                </span>
                <div className="flex items-center gap-1">
                    <span className="text-[10px] font-mono text-muted-foreground/40 mr-2">
                        {effectiveResult.executionTimeMs}ms
                    </span>
                    {/* Filter toggle */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => {
                                    if (filtersActive) {
                                        clearFilters();
                                    } else {
                                        setShowFilterBar((v) => !v);
                                        if (!showFilterBar && filters.length === 0)
                                            addFilter();
                                    }
                                }}
                                className={
                                    filtersActive
                                        ? "text-accent-blue"
                                        : showFilterBar
                                          ? "text-foreground"
                                          : "text-muted-foreground"
                                }
                            >
                                <span className="relative">
                                    {filtersActive ? (
                                        <FilterX size={11} />
                                    ) : (
                                        <Filter size={11} />
                                    )}
                                    {filtersActive && (
                                        <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-accent-blue text-[8px] font-black text-white flex items-center justify-center px-0.5 leading-none">
                                            {filters.length}
                                        </span>
                                    )}
                                    {showFilterBar && !filtersActive && (
                                        <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-accent-blue" />
                                    )}
                                </span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Toggle filters</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => {
                                    setShowSearchBar((v) => !v);
                                    if (showSearchBar) setCellSearch("");
                                }}
                                className={cn(
                                    cellSearch
                                        ? "text-accent-blue"
                                        : showSearchBar
                                          ? "text-foreground"
                                          : "text-muted-foreground",
                                )}
                            >
                                <span className="relative">
                                    <Search size={11} />
                                    {cellSearch && (
                                        <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] rounded-full bg-accent-blue text-[8px] font-black text-white flex items-center justify-center px-0.5 leading-none">
                                            {searchedRows.length}
                                        </span>
                                    )}
                                </span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Search cells (⌘F)</TooltipContent>
                    </Tooltip>
                    {/* Import button */}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => {
                                    setShowImport((v) => !v);
                                    setImportDone(null);
                                }}
                                className="text-muted-foreground"
                            >
                                <Upload size={11} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Import data</TooltipContent>
                    </Tooltip>
                    {fn.tableName && (
                        <>
                            {/* Create table */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() =>
                                            setShowCreateTable(true)
                                        }
                                        className="text-muted-foreground"
                                    >
                                        <Plus size={11} />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    Create table
                                </TooltipContent>
                            </Tooltip>
                            {/* Rename table */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() => {
                                            setRenameTableName(fn.tableName ?? "");
                                            setShowRenameTable(true);
                                        }}
                                        className="text-muted-foreground"
                                    >
                                        <Pencil size={11} />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Rename table</TooltipContent>
                            </Tooltip>
                            {/* Drop table */}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() =>
                                            setShowDropTable(true)
                                        }
                                        className="text-destructive/50 hover:text-destructive"
                                    >
                                        <TableProperties size={11} />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Drop table</TooltipContent>
                            </Tooltip>
                        </>
                    )}
                </div>
            </div>
            {/* Search bar */}
            {showSearchBar && viewMode === "data" && (
                <div className="shrink-0 border-b border-border bg-card px-3 py-1.5 flex items-center gap-2">
                    <Search
                        size={11}
                        className="text-muted-foreground/40 shrink-0"
                    />
                    <Input
                        autoFocus
                        value={cellSearch}
                        onChange={(e) => setCellSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Escape") {
                                setCellSearch("");
                                setShowSearchBar(false);
                            }
                        }}
                        placeholder="Search cells…"
                        className="h-6 flex-1 text-[11px] font-mono border-0 bg-transparent shadow-none focus-visible:ring-0 px-0"
                    />
                    {cellSearch && (
                        <span className="text-[9px] font-mono text-muted-foreground/50 shrink-0">
                            {searchedRows.length} of{" "}
                            {effectiveResult?.rows.length ?? 0}
                        </span>
                    )}
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => {
                            setCellSearch("");
                            setShowSearchBar(false);
                        }}
                        className="h-5 w-5 text-muted-foreground/40 hover:text-foreground"
                    >
                        <X size={10} />
                    </Button>
                </div>
            )}
            {/* Filter bar */}
            {showFilterBar && viewMode === "data" && (
                <div className="shrink-0 border-b border-border bg-card px-3 py-2 flex flex-col gap-2">
                    {filters.map((f, i) => (
                        <div key={f.id}>
                        {i > 0 && (
                            <div className="flex items-center py-0.5 pl-1 mb-1">
                                <button
                                    onClick={() =>
                                        setFilters((prev) =>
                                            prev.map((x) =>
                                                x.id === f.id
                                                    ? { ...x, join: x.join === "AND" ? "OR" : "AND" }
                                                    : x,
                                            ),
                                        )
                                    }
                                    className="text-[9px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                                >
                                    {f.join}
                                </button>
                            </div>
                        )}
                        <div className="flex items-center gap-2">
                            <select
                                value={f.col}
                                onChange={(e) =>
                                    setFilters((prev) =>
                                        prev.map((x) =>
                                            x.id === f.id
                                                ? { ...x, col: e.target.value }
                                                : x,
                                        ),
                                    )
                                }
                                className="h-6 px-2 rounded bg-background border border-border text-[11px] font-mono text-foreground outline-none"
                            >
                                {availableCols.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                            <select
                                value={f.op}
                                onChange={(e) =>
                                    setFilters((prev) =>
                                        prev.map((x) =>
                                            x.id === f.id
                                                ? {
                                                    ...x,
                                                    op: e.target
                                                        .value as FilterOp,
                                                }
                                                : x,
                                        ),
                                    )
                                }
                                className="h-6 px-2 rounded bg-background border border-border text-[11px] font-mono text-foreground outline-none"
                            >
                                {(
                                    [
                                        "=",
                                        "!=",
                                        ">",
                                        "<",
                                        ">=",
                                        "<=",
                                        "LIKE",
                                        "NOT LIKE",
                                        "IS NULL",
                                        "IS NOT NULL",
                                    ] as FilterOp[]
                                ).map((op) => (
                                    <option key={op} value={op}>
                                        {op}
                                    </option>
                                ))}
                            </select>
                            {f.op !== "IS NULL" && f.op !== "IS NOT NULL" && (
                                <Input
                                    value={f.value}
                                    onChange={(e) =>
                                        setFilters((prev) =>
                                            prev.map((x) =>
                                                x.id === f.id
                                                    ? {
                                                        ...x,
                                                        value: e.target
                                                            .value,
                                                    }
                                                    : x,
                                            ),
                                        )
                                    }
                                    onKeyDown={(e) =>
                                        e.key === "Enter" && applyFilters()
                                    }
                                    placeholder="value"
                                    className="h-6 text-[11px] font-mono w-36"
                                />
                            )}
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => removeFilter(f.id)}
                                className="text-muted-foreground/40 hover:text-destructive"
                            >
                                <X size={10} />
                            </Button>
                        </div>
                        </div>
                    ))}
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="xs"
                            onClick={addFilter}
                            className="h-6 text-[10px] font-bold uppercase tracking-widest"
                        >
                            + Add
                        </Button>
                        <Button
                            size="xs"
                            onClick={applyFilters}
                            disabled={filterLoading || filters.length === 0}
                            className="h-6 text-[10px] font-bold uppercase tracking-widest gap-1"
                        >
                            {filterLoading && (
                                <Loader2 size={9} className="animate-spin" />
                            )}
                            Apply
                        </Button>
                        <Button
                            variant="ghost"
                            size="xs"
                            onClick={clearFilters}
                            className="h-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                        >
                            Clear
                        </Button>
                        {filtersActive && (
                            <Badge
                                variant="secondary"
                                className="text-[9px] font-mono h-5"
                            >
                                {effectiveResult?.rows.length ?? 0} filtered
                            </Badge>
                        )}
                    </div>
                </div>
            )}
            {/* Import panel */}
            {showImport && viewMode === "data" && fn.tableName && (
                <div className="shrink-0 border-b border-border bg-card px-3 py-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
                            Import data into {fn.tableName}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setShowImport(false)}
                            className="text-muted-foreground/40 hover:text-foreground"
                        >
                            <X size={10} />
                        </Button>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-muted-foreground/60">
                            Format:
                        </span>
                        {(["csv", "json"] as const).map((fmt) => (
                            <Button
                                key={fmt}
                                variant={
                                    importFormat === fmt
                                        ? "secondary"
                                        : "outline"
                                }
                                size="xs"
                                onClick={() => {
                                    setImportFormat(fmt);
                                    parseImport(importText, fmt);
                                }}
                                className="h-6 text-[10px] font-bold uppercase tracking-widest"
                            >
                                {fmt.toUpperCase()}
                            </Button>
                        ))}
                        <Button
                            variant="outline"
                            size="xs"
                            onClick={() => importFileRef.current?.click()}
                            className="h-6 text-[10px] font-bold uppercase tracking-widest"
                        >
                            Open file…
                        </Button>
                        <input
                            ref={importFileRef}
                            type="file"
                            accept=".csv,.json"
                            className="hidden"
                            onChange={handleImportFile}
                        />
                    </div>
                    <textarea
                        value={importText}
                        onChange={(e) => {
                            setImportText(e.target.value);
                            parseImport(e.target.value, importFormat);
                        }}
                        placeholder={
                            importFormat === "csv"
                                ? "Paste CSV (first row = headers)…"
                                : "Paste JSON array of objects…"
                        }
                        rows={4}
                        className="w-full bg-background border border-border rounded px-2 py-1.5 text-[11px] font-mono text-foreground outline-none resize-none"
                    />
                    {importError && (
                        <span className="text-[10px] font-mono text-destructive">
                            {importError}
                        </span>
                    )}
                    {importPreview && (
                        <div className="text-[10px] font-mono text-muted-foreground/60">
                            Preview: {importPreview.rows.length} row(s),
                            columns: {importPreview.headers.join(", ")}
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <Button
                            size="xs"
                            onClick={runImport}
                            disabled={importing || !importPreview}
                            className="h-6 text-[10px] font-bold uppercase tracking-widest gap-1"
                        >
                            {importing && (
                                <Loader2 size={9} className="animate-spin" />
                            )}
                            Import
                            {importPreview
                                ? ` ${importPreview.rows.length} rows`
                                : ""}
                        </Button>
                        {importDone !== null && (
                            <Badge
                                variant="secondary"
                                className="text-[10px] font-mono h-5 text-accent-green"
                            >
                                ✓ {importDone} rows imported
                            </Badge>
                        )}
                    </div>
                </div>
            )}
            {/* Content: Data view */}
            {viewMode === "data" && (
                <div className="flex-1 overflow-auto scrollbar-thin">
                    <div className="min-w-full inline-block align-middle">
                        <Table className="w-full border-collapse text-[11px] font-mono border-separate border-spacing-0">
                            <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_var(--color-border-table)]">
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow
                                        key={headerGroup.id}
                                        className="hover:bg-transparent border-none"
                                    >
                                        <TableHead className="w-10 h-8 px-2 text-center font-bold text-muted-foreground/30 border-r border-border bg-card">
                                            #
                                        </TableHead>
                                        {headerGroup.headers.map((header) => (
                                            <TableHead
                                                key={header.id}
                                                className="h-8 px-4 text-left font-bold text-muted-foreground border-r border-border last:border-r-0 hover:bg-accent cursor-pointer transition-colors"
                                                onClick={header.column.getToggleSortingHandler()}
                                            >
                                                {flexRender(
                                                    header.column.columnDef
                                                        .header,
                                                    header.getContext(),
                                                )}
                                            </TableHead>
                                        ))}
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
                                            className="h-24 text-center text-muted-foreground/40 text-[11px] font-mono"
                                        >
                                            0 rows
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    table.getRowModel().rows.map((row, idx) => (
                                        <TableRow
                                            key={row.id}
                                            className={cn(
                                                "hover:bg-row-hover transition-colors group",
                                                idx % 2 === 0
                                                    ? "bg-table-bg"
                                                    : "bg-row-alt",
                                            )}
                                        >
                                            <TableCell className="w-10 h-8 px-2 text-center text-muted-foreground/30 border-r border-border bg-card/30">
                                                {page * pageSize + idx + 1}
                                            </TableCell>
                                            {row
                                                .getVisibleCells()
                                                .map((cell) => (
                                                    <TableCell
                                                        key={cell.id}
                                                        className="h-8 px-4 border-r border-border last:border-r-0 text-foreground/90 whitespace-nowrap overflow-hidden text-ellipsis max-w-75"
                                                    >
                                                        {flexRender(
                                                            cell.column
                                                                .columnDef.cell,
                                                            cell.getContext(),
                                                        )}
                                                    </TableCell>
                                                ))}
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
            {/* Delete row confirmation dialog */}
            <AlertDialog
                open={!!deleteRowSql}
                onOpenChange={(o) => !o && setDeleteRowSql(null)}
            >
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete row?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the row. This cannot be
                            undone.
                            <pre className="mt-2 rounded bg-muted p-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all">
                                {deleteRowSql}
                            </pre>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={executeDeleteRow}
                            disabled={deleteRowLoading}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {deleteRowLoading ? "Deleting…" : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {/* Drop table confirmation */}
            <AlertDialog
                open={showDropTable}
                onOpenChange={(o) => !o && setShowDropTable(false)}
            >
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Drop table?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the table and all
                            its data. This cannot be undone.
                            <pre className="mt-2 rounded bg-muted p-2 text-xs font-mono whitespace-pre-wrap break-all">
                                {`DROP TABLE ${qi(fn.tableName ?? "")}`}
                            </pre>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={executeDropTable}
                            disabled={dropTableLoading}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {dropTableLoading
                                ? "Dropping…"
                                : "Drop Table"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {/* Rename table dialog */}
            <Dialog open={showRenameTable} onOpenChange={(o) => !o && setShowRenameTable(false)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Rename table</DialogTitle>
                        <DialogDescription>
                            Enter a new name for{" "}
                            <span className="font-mono">{fn.tableName}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 py-2">
                        <Input
                            autoFocus
                            value={renameTableName}
                            onChange={(e) => setRenameTableName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && executeRenameTable()}
                            placeholder="new_table_name"
                            className="font-mono text-[12px]"
                        />
                        <pre className="rounded bg-muted px-3 py-2 text-xs font-mono whitespace-pre-wrap break-all text-muted-foreground">
                            {`ALTER TABLE ${qi(fn.tableName ?? "")} RENAME TO ${qi(renameTableName.trim() || "…")}`}
                        </pre>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowRenameTable(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={executeRenameTable}
                            disabled={
                                renameTableLoading ||
                                !renameTableName.trim() ||
                                renameTableName.trim() === fn.tableName
                            }
                        >
                            {renameTableLoading ? "Renaming…" : "Rename"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Add column dialog */}
            <Dialog
                open={showAddColumn}
                onOpenChange={(o) => {
                    if (!o) {
                        setShowAddColumn(false);
                        setAddColError(null);
                    }
                }}
            >
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Add column</DialogTitle>
                        <DialogDescription>
                            Add a new column to{" "}
                            <span className="font-mono">{fn.tableName}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 py-2">
                        <Input
                            autoFocus
                            value={addCol.name}
                            onChange={(e) =>
                                setAddCol((p) => ({
                                    ...p,
                                    name: e.target.value,
                                }))
                            }
                            onKeyDown={(e) =>
                                e.key === "Enter" && executeAddColumn()
                            }
                            placeholder="column_name"
                            className="font-mono text-[12px]"
                        />
                        <select
                            value={addCol.type}
                            onChange={(e) =>
                                setAddCol((p) => ({
                                    ...p,
                                    type: e.target.value,
                                }))
                            }
                            className="h-9 px-3 rounded-md bg-background border border-input text-[12px] font-mono text-foreground outline-none"
                        >
                            {(
                                COL_TYPES[dbType as DatabaseType] ?? ["TEXT"]
                            ).map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>
                        <div className="flex items-center gap-2">
                            <Button
                                variant={
                                    addCol.nullable ? "outline" : "default"
                                }
                                size="sm"
                                onClick={() =>
                                    setAddCol((p) => ({
                                        ...p,
                                        nullable: !p.nullable,
                                    }))
                                }
                                className="h-6 text-[10px] font-bold uppercase tracking-widest"
                            >
                                {addCol.nullable ? "NULL" : "NOT NULL"}
                            </Button>
                        </div>
                        <pre className="rounded bg-muted px-3 py-2 text-xs font-mono whitespace-pre-wrap break-all text-muted-foreground">
                            {`ALTER TABLE ${qi(fn.tableName ?? "")} ADD COLUMN ${qi(addCol.name.trim() || "…")} ${addCol.type}${addCol.nullable ? "" : " NOT NULL"}`}
                        </pre>
                        {addColError && (
                            <p className="text-[11px] text-destructive font-mono">
                                {addColError}
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowAddColumn(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={executeAddColumn}
                            disabled={
                                addColLoading || !addCol.name.trim()
                            }
                        >
                            {addColLoading ? "Adding…" : "Add Column"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Drop column confirmation */}
            <AlertDialog
                open={dropColTarget !== null}
                onOpenChange={(o) => !o && setDropColTarget(null)}
            >
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Drop column?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove the column and all
                            its data.
                            <pre className="mt-2 rounded bg-muted p-2 text-xs font-mono whitespace-pre-wrap break-all">
                                {`ALTER TABLE ${qi(fn.tableName ?? "")} DROP COLUMN ${qi(dropColTarget ?? "")}`}
                            </pre>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={executeDropColumn}
                            disabled={dropColLoading}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {dropColLoading ? "Dropping…" : "Drop Column"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {/* Create index dialog */}
            <Dialog
                open={showCreateIndex}
                onOpenChange={(o) => {
                    if (!o) {
                        setShowCreateIndex(false);
                        setCreateIdxError(null);
                    }
                }}
            >
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Create index</DialogTitle>
                        <DialogDescription>
                            Add an index to{" "}
                            <span className="font-mono">{fn.tableName}</span>.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-3 py-2">
                        <Input
                            autoFocus
                            value={createIdxDef.name}
                            onChange={(e) =>
                                setCreateIdxDef((p) => ({
                                    ...p,
                                    name: e.target.value,
                                }))
                            }
                            placeholder="index_name"
                            className="font-mono text-[12px]"
                        />
                        <div className="flex flex-col gap-1 max-h-36 overflow-y-auto rounded border border-border p-2">
                            {(structure?.columns ?? []).map((col) => (
                                <label
                                    key={col.name}
                                    className="flex items-center gap-2 cursor-pointer hover:bg-accent/10 px-1 py-0.5 rounded text-[11px] font-mono"
                                >
                                    <input
                                        type="checkbox"
                                        checked={createIdxDef.columns.includes(col.name)}
                                        onChange={(e) =>
                                            setCreateIdxDef((p) => ({
                                                ...p,
                                                columns: e.target.checked
                                                    ? [...p.columns, col.name]
                                                    : p.columns.filter((c) => c !== col.name),
                                            }))
                                        }
                                        className="accent-accent-blue"
                                    />
                                    {col.name}
                                    <span className="text-muted-foreground/40 text-[9px]">
                                        {col.dataType}
                                    </span>
                                </label>
                            ))}
                        </div>
                        <Button
                            variant={createIdxDef.unique ? "default" : "outline"}
                            size="sm"
                            onClick={() =>
                                setCreateIdxDef((p) => ({
                                    ...p,
                                    unique: !p.unique,
                                }))
                            }
                            className="h-6 text-[10px] font-bold uppercase tracking-widest w-fit"
                        >
                            {createIdxDef.unique ? "UNIQUE" : "NOT UNIQUE"}
                        </Button>
                        <pre className="rounded bg-muted px-3 py-2 text-xs font-mono whitespace-pre-wrap break-all text-muted-foreground">
                            {fn.tableName
                                ? buildCreateIndexSql(
                                      fn.tableName,
                                      createIdxDef.name.trim() || "…",
                                      createIdxDef.columns.length > 0
                                          ? createIdxDef.columns
                                          : ["…"],
                                      createIdxDef.unique,
                                  )
                                : ""}
                        </pre>
                        {createIdxError && (
                            <p className="text-[11px] text-destructive font-mono">
                                {createIdxError}
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowCreateIndex(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={executeCreateIndex}
                            disabled={
                                createIdxLoading ||
                                !createIdxDef.name.trim() ||
                                createIdxDef.columns.length === 0
                            }
                        >
                            {createIdxLoading ? "Creating…" : "Create Index"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Drop index confirmation */}
            <AlertDialog
                open={dropIdxTarget !== null}
                onOpenChange={(o) => !o && setDropIdxTarget(null)}
            >
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Drop index?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove the index.
                            <pre className="mt-2 rounded bg-muted p-2 text-xs font-mono whitespace-pre-wrap break-all">
                                {fn.tableName
                                    ? buildDropIndexSql(
                                          fn.tableName,
                                          dropIdxTarget ?? "",
                                      )
                                    : ""}
                            </pre>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={executeDropIndex}
                            disabled={dropIdxLoading}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {dropIdxLoading ? "Dropping…" : "Drop Index"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {/* Create table dialog */}
            <Dialog
                open={showCreateTable}
                onOpenChange={(o) => {
                    setShowCreateTable(o);
                    if (!o) setCreateTableError(null);
                }}
            >
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create Table</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 py-1">
                        {/* Table name */}
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                                Table Name
                            </Label>
                            <Input
                                value={newTableName}
                                onChange={(e) =>
                                    setNewTableName(e.target.value)
                                }
                                placeholder="e.g. users"
                                className="h-8 text-[12px] font-mono"
                            />
                        </div>
                        {/* Columns */}
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center justify-between">
                                <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                                    Columns
                                </Label>
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    className="h-6 text-[10px] gap-1 text-muted-foreground"
                                    onClick={() =>
                                        setColDefs((prev) => [
                                            ...prev,
                                            {
                                                id: `c${Date.now()}`,
                                                name: "",
                                                type:
                                                    COL_TYPES[
                                                    dbType as DatabaseType
                                                    ]?.[0] ?? "TEXT",
                                                nullable: true,
                                                isPrimary: false,
                                            },
                                        ])
                                    }
                                >
                                    <Plus size={10} />
                                    Add column
                                </Button>
                            </div>
                            <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
                                {colDefs.map((col) => (
                                    <div
                                        key={col.id}
                                        className="flex items-center gap-2"
                                    >
                                        <Input
                                            value={col.name}
                                            onChange={(e) =>
                                                setColDefs((prev) =>
                                                    prev.map((c) =>
                                                        c.id === col.id
                                                            ? {
                                                                ...c,
                                                                name: e
                                                                    .target
                                                                    .value,
                                                            }
                                                            : c,
                                                    ),
                                                )
                                            }
                                            placeholder="column name"
                                            className="h-7 text-[11px] font-mono flex-1"
                                        />
                                        <Select
                                            value={col.type}
                                            onValueChange={(v) =>
                                                setColDefs((prev) =>
                                                    prev.map((c) =>
                                                        c.id === col.id
                                                            ? {
                                                                ...c,
                                                                type: v,
                                                            }
                                                            : c,
                                                    ),
                                                )
                                            }
                                        >
                                            <SelectTrigger className="h-7 text-[11px] font-mono w-36">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {(
                                                    COL_TYPES[
                                                    dbType as DatabaseType
                                                    ] ?? ["TEXT"]
                                                ).map((t) => (
                                                    <SelectItem
                                                        key={t}
                                                        value={t}
                                                        className="text-[11px] font-mono"
                                                    >
                                                        {t}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    onClick={() =>
                                                        setColDefs((prev) =>
                                                            prev.map((c) =>
                                                                c.id ===
                                                                    col.id
                                                                    ? {
                                                                        ...c,
                                                                        nullable:
                                                                            !c.nullable,
                                                                    }
                                                                    : c,
                                                            ),
                                                        )
                                                    }
                                                    className={cn(
                                                        "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border transition-colors",
                                                        col.nullable
                                                            ? "border-border text-muted-foreground"
                                                            : "border-primary/40 text-accent-blue",
                                                    )}
                                                >
                                                    NULL
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                Toggle nullable
                                            </TooltipContent>
                                        </Tooltip>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    onClick={() =>
                                                        setColDefs((prev) =>
                                                            prev.map((c) =>
                                                                c.id ===
                                                                    col.id
                                                                    ? {
                                                                        ...c,
                                                                        isPrimary:
                                                                            !c.isPrimary,
                                                                    }
                                                                    : c,
                                                            ),
                                                        )
                                                    }
                                                    className={cn(
                                                        "text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border transition-colors",
                                                        col.isPrimary
                                                            ? "border-primary/40 text-accent-green"
                                                            : "border-border text-muted-foreground",
                                                    )}
                                                >
                                                    PK
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                                Toggle primary key
                                            </TooltipContent>
                                        </Tooltip>
                                        {colDefs.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                className="text-muted-foreground/40 hover:text-destructive"
                                                onClick={() =>
                                                    setColDefs((prev) =>
                                                        prev.filter(
                                                            (c) =>
                                                                c.id !==
                                                                col.id,
                                                        ),
                                                    )
                                                }
                                            >
                                                <X size={10} />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                        {/* SQL preview */}
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                                Preview
                            </Label>
                            <pre className="rounded bg-muted p-2 text-[11px] font-mono overflow-x-auto whitespace-pre-wrap break-all text-muted-foreground">
                                {newTableName.trim() && colDefs.length > 0
                                    ? buildCreateTableSql(
                                        newTableName.trim(),
                                        colDefs,
                                    )
                                    : "—"}
                            </pre>
                        </div>
                        {createTableError && (
                            <p className="text-[11px] text-destructive font-mono">
                                {createTableError}
                            </p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowCreateTable(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            disabled={
                                !newTableName.trim() ||
                                colDefs.length === 0 ||
                                createTableLoading
                            }
                            onClick={executeCreateTable}
                        >
                            {createTableLoading
                                ? "Creating…"
                                : "Create Table"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Content: Form view */}
            {viewMode === "form" && effectiveResult && (
                <div className="flex-1 overflow-auto scrollbar-thin">
                    {effectiveResult.rows.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground/40 text-[11px] font-mono">
                            0 rows
                        </div>
                    ) : (
                        (() => {
                            const row =
                                effectiveResult.rows[selectedRowIdx] ??
                                {};
                            const cols =
                                effectiveResult.columns.length > 0
                                    ? effectiveResult.columns
                                    : Object.keys(row);
                            return (
                                <div className="flex flex-col divide-y divide-border">
                                    {cols.map((col) => {
                                        const isEditing =
                                            editingCell?.rowIdx ===
                                            selectedRowIdx &&
                                            editingCell?.col === col;
                                        const val = row[col];
                                        return (
                                            <div
                                                key={col}
                                                className="flex items-center min-h-9 gap-4 py-1.5 hover:bg-accent/20 px-4"
                                            >
                                                <span className="w-44 shrink-0 text-[11px] font-mono font-bold text-muted-foreground truncate">
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
                                                        className="flex-1 bg-primary/10 border border-blue-500/50 rounded px-2 py-0.5 outline-none text-[12px] font-mono text-foreground"
                                                    />
                                                ) : (
                                                    <span
                                                        className={cn(
                                                            "flex-1 text-[12px] font-mono",
                                                            val === null
                                                                ? "text-muted-foreground/40 italic"
                                                                : "text-foreground/90",
                                                        )}
                                                        onDoubleClick={() =>
                                                            fn.tableName &&
                                                            setEditingCell({
                                                                rowIdx: selectedRowIdx,
                                                                col,
                                                                value:
                                                                    val ===
                                                                        null
                                                                        ? ""
                                                                        : String(
                                                                            val,
                                                                        ),
                                                            })
                                                        }
                                                    >
                                                        {val === null
                                                            ? "null"
                                                            : String(val)}
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()
                    )}
                </div>
            )}
            {/* Content: Structure view */}
            {viewMode === "structure" && (
                <div className="flex-1 overflow-auto scrollbar-thin bg-background">
                    {structureLoading ? (
                        <div className="h-full flex items-center justify-center">
                            <Loader2
                                size={18}
                                className="animate-spin text-primary"
                            />
                        </div>
                    ) : structure ? (
                        <div className="p-0">
                            {/* Columns */}
                            <div className="border-b border-border">
                                <div className="px-4 py-2 bg-card flex items-center gap-2 border-b border-border">
                                    <Key
                                        size={11}
                                        className="text-muted-foreground/50"
                                    />
                                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
                                        Columns ({structure.columns.length})
                                    </span>
                                </div>
                                <table className="w-full text-[11px] font-mono">
                                    <thead className="sticky top-0 bg-sidebar z-10">
                                        <tr>
                                            <th className="h-7 px-3 text-left text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 border-b border-border w-6">
                                                #
                                            </th>
                                            <th className="h-7 px-3 text-left text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 border-b border-border">
                                                Name
                                            </th>
                                            <th className="h-7 px-3 text-left text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 border-b border-border">
                                                Type
                                            </th>
                                            <th className="h-7 px-3 text-left text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 border-b border-border">
                                                Null
                                            </th>
                                            <th className="h-7 px-3 text-left text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 border-b border-border">
                                                Default
                                            </th>
                                            <th className="h-7 px-3 text-left text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 border-b border-border">
                                                Key
                                            </th>
                                            <th className="h-7 px-3 text-left text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 border-b border-border">
                                                Extra
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {structure.columns.map((col, idx) => (
                                            <tr
                                                key={col.name}
                                                className="group/row hover:bg-muted transition-colors border-b border-border"
                                            >
                                                <td className="h-8 px-3 text-muted-foreground/30">
                                                    {idx + 1}
                                                </td>
                                                <td className="h-8 px-3 text-foreground font-semibold">
                                                    {col.name}
                                                </td>
                                                <td className="h-8 px-3 text-accent-orange/80">
                                                    {col.dataType}
                                                </td>
                                                <td className="h-8 px-3">
                                                    <span
                                                        className={cn(
                                                            "text-[9px] font-bold uppercase",
                                                            col.nullable
                                                                ? "text-muted-foreground/40"
                                                                : "text-destructive/70",
                                                        )}
                                                    >
                                                        {col.nullable
                                                            ? "YES"
                                                            : "NO"}
                                                    </span>
                                                </td>
                                                <td className="h-8 px-3 text-muted-foreground/50 italic">
                                                    {col.defaultValue ?? (
                                                        <span className="text-muted-foreground/70 not-italic">
                                                            —
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="h-8 px-3">
                                                    <div className="flex items-center gap-1">
                                                        {col.isPrimary && (
                                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-accent-orange/15 text-accent-orange border border-accent-orange/20">
                                                                PK
                                                            </span>
                                                        )}
                                                        {col.isUnique &&
                                                            !col.isPrimary && (
                                                                <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-accent-purple/15 text-accent-purple border border-accent-purple/20">
                                                                    UNI
                                                                </span>
                                                            )}
                                                    </div>
                                                </td>
                                                <td className="h-8 px-3 text-muted-foreground/40 italic text-[10px]">
                                                    {col.extra ?? (
                                                        <span className="text-muted-foreground/70 not-italic">
                                                            —
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="h-8 px-3 text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-5 w-5 opacity-0 group-hover/row:opacity-100 text-muted-foreground/40 hover:text-destructive"
                                                        onClick={() => setDropColTarget(col.name)}
                                                    >
                                                        <Trash2 size={10} />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {/* Indexes */}
                            {structure.indexes.length > 0 && (
                                <div>
                                    <div className="px-4 py-2 bg-card flex items-center gap-2 border-b border-border">
                                        <Hash
                                            size={11}
                                            className="text-muted-foreground/50"
                                        />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
                                            Indexes ({structure.indexes.length})
                                        </span>
                                    </div>
                                    <table className="w-full text-[11px] font-mono">
                                        <thead className="sticky top-0 bg-sidebar">
                                            <tr>
                                                <th className="h-7 px-3 text-left text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 border-b border-border">
                                                    Name
                                                </th>
                                                <th className="h-7 px-3 text-left text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 border-b border-border">
                                                    Columns
                                                </th>
                                                <th className="h-7 px-3 text-left text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 border-b border-border">
                                                    Type
                                                </th>
                                                <th className="h-7 px-3 text-left text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 border-b border-border">
                                                    Unique
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {structure.indexes.map((idx) => (
                                                <tr
                                                    key={idx.name}
                                                    className="group/row hover:bg-muted transition-colors border-b border-border"
                                                >
                                                    <td className="h-8 px-3 text-accent-blue/80">
                                                        {idx.name}
                                                    </td>
                                                    <td className="h-8 px-3 text-foreground/80">
                                                        <div className="flex flex-wrap gap-1">
                                                            {idx.columns.map(
                                                                (c) => (
                                                                    <span
                                                                        key={c}
                                                                        className="px-1.5 py-0.5 bg-card rounded text-[9px]"
                                                                    >
                                                                        {c}
                                                                    </span>
                                                                ),
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="h-8 px-3 text-muted-foreground/50 uppercase text-[9px]">
                                                        {idx.indexType ?? "—"}
                                                    </td>
                                                    <td className="h-8 px-3">
                                                        {idx.unique ? (
                                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-accent/15 text-accent-green border border-accent/20">
                                                                YES
                                                            </span>
                                                        ) : (
                                                            <span className="text-muted-foreground/30 text-[9px]">
                                                                NO
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="h-8 px-3 text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-5 w-5 opacity-0 group-hover/row:opacity-100 text-muted-foreground/40 hover:text-destructive"
                                                            onClick={() => setDropIdxTarget(idx.name)}
                                                        >
                                                            <Trash2 size={10} />
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground/30 text-[11px] font-mono">
                            No structure data
                        </div>
                    )}
                </div>
            )}
            {/* Cell edit error banner */}
            {cellEditError && (
                <div className="px-3 py-1.5 bg-destructive/10 border-t border-destructive/20 flex items-center justify-between shrink-0">
                    <span className="text-[10px] font-mono text-destructive">
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
            <div className="h-9 bg-card border-t border-border flex items-center justify-between px-2 shrink-0">
                <div className="flex items-stretch gap-0 h-full">
                    {(["data", "form", "structure"] as const).map((mode) => (
                        <button
                            key={mode}
                            onClick={() => handleViewMode(mode)}
                            className={cn(
                                "relative flex items-center px-3 text-[10px] font-bold uppercase tracking-widest transition-colors",
                                viewMode === mode
                                    ? "text-foreground"
                                    : "text-muted-foreground/40 hover:text-muted-foreground",
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
                        <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground/60">
                            {cellEditLoading ? (
                                <Loader2
                                    size={10}
                                    className="animate-spin text-accent-blue"
                                />
                            ) : (
                                <span className="text-[9px] text-muted-foreground/70 hidden sm:inline">
                                    dbl-click to edit
                                </span>
                            )}
                            <Button
                                variant="ghost"
                                size="xs"
                                disabled={page === 0}
                                onClick={() => onPageChange(page - 1)}
                                className="h-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                            >
                                ← Prev
                            </Button>
                            <span className="tabular-nums text-muted-foreground/60">
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
                                className="h-6 text-[10px] font-bold uppercase tracking-widest text-muted-foreground"
                            >
                                Next →
                            </Button>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="xs"
                                    className="h-6 text-[10px] font-bold uppercase tracking-widest gap-1"
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
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </>
                )}
                {viewMode === "form" && effectiveResult && effectiveResult.rows.length > 0 && (
                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            disabled={selectedRowIdx === 0}
                            onClick={() => setSelectedRowIdx((i) => Math.max(0, i - 1))}
                        >
                            <ChevronLeft size={11} />
                        </Button>
                        <span className="text-[10px] font-mono text-muted-foreground/60">
                            Row {page * pageSize + selectedRowIdx + 1}
                        </span>
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            disabled={selectedRowIdx === effectiveResult.rows.length - 1}
                            onClick={() => setSelectedRowIdx((i) => Math.min(effectiveResult.rows.length - 1, i + 1))}
                        >
                            <ChevronRight size={11} />
                        </Button>
                        {fn.tableName && (
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                className="text-destructive/50 hover:text-destructive ml-2"
                                onClick={() => buildAndShowDeleteSql(effectiveResult.rows[selectedRowIdx])}
                            >
                                <Trash2 size={11} />
                            </Button>
                        )}
                    </div>
                )}
                {viewMode === "structure" && (
                    <span className="text-[9px] font-mono text-muted-foreground/30">
                        {structure
                            ? `${structure.columns.length} columns · ${structure.indexes.length} indexes`
                            : ""}
                    </span>
                )}
                {fn.tableName && viewMode === "structure" && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setAddCol({
                                name: "",
                                type:
                                    COL_TYPES[dbType as DatabaseType]?.[0] ??
                                    "TEXT",
                                nullable: true,
                            });
                            setShowAddColumn(true);
                        }}
                        className="h-6 text-[10px] font-bold uppercase tracking-widest gap-1"
                    >
                        <Plus size={10} />
                        Add Column
                    </Button>
                )}
                {fn.tableName && viewMode === "structure" && structure && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setCreateIdxDef({ name: "", columns: [], unique: false });
                            setShowCreateIndex(true);
                        }}
                        className="h-6 text-[10px] font-bold uppercase tracking-widest gap-1"
                    >
                        <Plus size={10} />
                        Add Index
                    </Button>
                )}
            </div>
            {/* Query Log */}
            <QueryLog
                entries={queryHistory.filter((e) => e.connectionId === fn.connectionId)}
                showSyntax={showQueryLogSyntax}
                onSyntaxToggle={setShowQueryLogSyntax}
                onClear={() => clearHistory(fn.connectionId)}
            />
        </div>
    );
}
// ─── Query Log (displays executed query with timestamp) ──────────────────────
function QueryLog({
    entries,
    showSyntax,
    onSyntaxToggle,
    onClear,
}: {
    entries: Array<{ sql: string; executedAt: number }>;
    showSyntax: boolean;
    onSyntaxToggle: (show: boolean) => void;
    onClear: () => void;
}) {
    const scrollRef = useRef<HTMLDivElement>(null);
    // Auto-scroll to bottom after render (double-rAF to let CodeMirror finish layout)
    useEffect(() => {
        const id = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
            });
        });
        return () => cancelAnimationFrame(id);
    }, [entries.length, showSyntax]);
    const formatTimestamp = (ts: number) => {
        const d = new Date(ts);
        const pad = (n: number, len = 2) => String(n).padStart(len, "0");
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
    };
    // entries are newest-first; reverse so oldest is at top (terminal-style)
    const ordered = [...entries].reverse();
    const fullText = ordered
        .map((e) => `-- ${formatTimestamp(e.executedAt)}\n${e.sql}`)
        .join("\n\n");
    return (
        <div className="h-[140px] w-full border-t border-border flex flex-col bg-background shrink-0 overflow-hidden">
            {/* Query display */}
            <div ref={scrollRef} className="flex-1 overflow-auto scrollbar-thin px-3 py-2">
                {entries.length === 0 ? (
                    <p className="text-[10px] font-mono text-muted-foreground/30 py-1">No queries executed yet</p>
                ) : showSyntax ? (
                    <CodeMirror
                        value={fullText}
                        extensions={[sql()]}
                        basicSetup={{ lineNumbers: false, foldGutter: false }}
                        theme={EditorView.theme({
                            "&": {
                                fontSize: "11px",
                                backgroundColor: "transparent",
                                color: "var(--color-foreground)",
                            },
                            ".cm-gutters": { display: "none" },
                            ".cm-content": { padding: "0" },
                        })}
                        readOnly
                        height="auto"
                    />
                ) : (
                    <pre className="text-[11px] font-mono text-foreground whitespace-pre-wrap break-words">
                        {fullText}
                    </pre>
                )}
            </div>
            {/* Bottom toolbar */}
            <div className="h-7 flex items-center justify-start px-3 py-1 border-t border-border shrink-0 bg-card gap-3">
                <Button
                    variant="ghost"
                    size="icon-xs"
                    className="size-5 text-muted-foreground/40 hover:text-muted-foreground"
                    title="Clear logs"
                    onClick={onClear}
                >
                    <Trash2 size={10} />
                </Button>
                <span className="text-[9px] font-mono text-muted-foreground/30">{entries.length} {entries.length === 1 ? "query" : "queries"}</span>
                <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                    <input
                        type="checkbox"
                        checked={showSyntax}
                        onChange={(e) => onSyntaxToggle(e.target.checked)}
                        className="w-3 h-3 accent-primary"
                    />
                    <span className="text-[9px] font-label text-muted-foreground/70">
                        Enable Syntax highlighting
                    </span>
                </label>
            </div>
        </div>
    );
}
// ─── SQL editor (for _query / _execute functions) ─────────────────────────────
function SqlEditorView({
    fn,
    queryResult,
    isLoading,
    pendingSql,
    onSqlChange,
    onExecute,
    onExplain,
    tables,
}: {
    fn: ConnectionFunction;
    queryResult?: { columns: string[]; rows: any[]; executionTimeMs: number };
    isLoading: boolean;
    pendingSql: string;
    onSqlChange: (sql: string) => void;
    onExecute: () => void;
    onExplain: () => void;
    tables: TableInfo[];
}) {
    const {
        theme,
        queryHistory,
        connections,
        savedQueries,
        clearHistory,
        saveQuery,
        deleteSavedQuery,
        appSettings,
    } = useAppStore();
    const editorFontSize = appSettings.editorFontSize;
    // Sub-panel tab: which panel is currently shown
    const [panel, setPanel] = useState<"editor" | "history" | "saved">(
        "editor",
    );
    // Save-query UI state
    const [saveOpen, setSaveOpen] = useState(false);
    const [saveName, setSaveName] = useState("");
    const saveInputRef = useRef<HTMLInputElement>(null);
    // Query log state
    const [showQueryLogSyntax, setShowQueryLogSyntax] = useState(true);
    const history: QueryHistoryEntry[] = queryHistory;
    const connectionSaved: SavedQuery[] = savedQueries.filter(
        (q) => !q.connectionId || q.connectionId === fn.connectionId,
    );
    useEffect(() => {
        if (saveOpen) saveInputRef.current?.focus();
    }, [saveOpen]);
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (
                e.key === "Enter" &&
                (e.metaKey || e.ctrlKey) &&
                panel === "editor"
            ) {
                e.preventDefault();
                onExecute();
            }
        };
        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, [onExecute, panel]);
    const fontSizeTheme = EditorView.theme({
        "&": { fontSize: `${editorFontSize}px` },
        ".cm-content": { fontSize: `${editorFontSize}px` },
    });
    const editorTheme =
        theme === "dark"
            ? oneDark
            : EditorView.theme({
                "&": {
                    backgroundColor: "var(--color-card)",
                    color: "var(--color-foreground)",
                },
                ".cm-gutters": {
                    backgroundColor: "var(--color-card)",
                    color: "var(--color-muted-foreground)",
                    borderRight: "1px solid var(--color-border)",
                },
                ".cm-activeLineGutter": {
                    backgroundColor: "var(--color-accent)",
                },
                ".cm-activeLine": {
                    backgroundColor: "var(--color-accent)",
                },
                ".cm-cursor": {
                    borderLeftColor: "var(--color-foreground)",
                },
                ".cm-selectionBackground": {
                    backgroundColor: "var(--color-muted) !important",
                },
            });
    const sqlSchema = useMemo(() => {
        const s: Record<string, string[]> = {};
        for (const t of tables)
            s[t.name] = (t.columns ?? []).map((c) => c.name);
        return s;
    }, [tables]);
    // Resizable split
    const [editorHeightPx, setEditorHeightPx] = useState(220);
    const dragState = useRef<{ startY: number; startH: number } | null>(null);
    const startDrag = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault();
            dragState.current = { startY: e.clientY, startH: editorHeightPx };
            const onMove = (ev: MouseEvent) => {
                if (!dragState.current) return;
                setEditorHeightPx(
                    Math.max(
                        80,
                        Math.min(
                            600,
                            dragState.current.startH +
                            (ev.clientY - dragState.current.startY),
                        ),
                    ),
                );
            };
            const onUp = () => {
                dragState.current = null;
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
        },
        [editorHeightPx],
    );
    // Results table
    const [sorting, setSorting] = useState<SortingState>([]);
    const table = useReactTable({
        data: queryResult?.rows ?? [],
        columns: (queryResult?.columns && queryResult.columns.length > 0
            ? queryResult.columns
            : queryResult?.rows && queryResult.rows.length > 0
                ? Object.keys(queryResult.rows[0])
                : []
        ).map((col: string) => ({
            accessorKey: col,
            header: col,
            cell: (info: any) => (
                <span
                    className={
                        info.getValue() === null
                            ? "text-muted-foreground italic"
                            : ""
                    }
                >
                    {info.getValue() === null
                        ? "null"
                        : String(info.getValue())}
                </span>
            ),
        })),
        state: { sorting },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
    });
    const handleSave = () => {
        const name = saveName.trim();
        if (!name || !pendingSql.trim()) return;
        saveQuery(name, pendingSql, fn.connectionId);
        setSaveName("");
        setSaveOpen(false);
    };
    const tabBtn = (
        id: typeof panel,
        icon: React.ReactNode,
        label: string,
        count?: number,
    ) => (
        <Button
            variant="ghost"
            onClick={() => setPanel(id)}
            className={cn(
                "h-full px-3 rounded-none gap-1.5 text-[9px] font-bold uppercase tracking-widest border-b-2 border-transparent",
                panel === id
                    ? "text-accent-blue border-blue-500"
                    : "text-muted-foreground/50 hover:text-muted-foreground",
            )}
        >
            {icon}
            {label}
            {count !== undefined && count > 0 && (
                <Badge
                    variant="secondary"
                    className="h-4 px-1 text-[8px] font-mono"
                >
                    {count}
                </Badge>
            )}
        </Button>
    );
    return (
        <div className="h-full flex flex-col bg-background overflow-hidden">
            {/* Header */}
            <div className="h-9 flex items-center justify-between bg-background border-b border-border px-4 shrink-0">
                <span className="font-mono text-[11px] text-accent-blue font-bold">
                    {fn.callSignature
                        .slice(fn.prefix.length + 1)
                        .replace(/\(.*$/, "")}
                </span>
                <span className="text-[9px] font-mono text-muted-foreground/30 uppercase tracking-widest">
                    {fn.type === "execute" ? "DDL / DML" : "SELECT"}
                </span>
            </div>
            {/* Sub-tab strip */}
            <div className="h-8 bg-background border-b border-border flex items-stretch shrink-0 px-1">
                {tabBtn("editor", <Pencil size={9} />, "Editor")}
                {tabBtn(
                    "history",
                    <Clock size={9} />,
                    "History",
                    history.length,
                )}
                {tabBtn(
                    "saved",
                    <Bookmark size={9} />,
                    "Saved",
                    connectionSaved.length,
                )}
            </div>
            {/* ── History panel ── */}
            {panel === "history" && (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 shrink-0 border-b border-border">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40">
                            {history.length} queries
                        </span>
                        {history.length > 0 && (
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => clearHistory(fn.connectionId)}
                                className="h-5 text-[9px] text-muted-foreground/40 hover:text-destructive uppercase tracking-widest"
                            >
                                Clear
                            </Button>
                        )}
                    </div>
                    <div className="flex-1 overflow-auto scrollbar-thin">
                        {history.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground/30 gap-2">
                                <Clock size={20} className="opacity-30" />
                                <p className="text-[10px] font-mono">
                                    No queries executed yet
                                </p>
                            </div>
                        ) : (
                            history.map((entry) => {
                                const connName = connections.find((c) => c.id === entry.connectionId)?.name ?? entry.connectionId;
                                return (
                                    <div
                                        key={entry.id}
                                        onClick={() => {
                                            onSqlChange(entry.sql);
                                            setPanel("editor");
                                        }}
                                        className="border-b border-border px-3 py-2 hover:bg-accent cursor-pointer group transition-colors"
                                    >
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="text-[9px] font-mono text-muted-foreground/40 shrink-0">
                                                    {new Date(entry.executedAt).toLocaleString()}
                                                </span>
                                                <span className="text-[9px] font-mono text-primary/50 truncate">
                                                    {connName}
                                                </span>
                                            </div>
                                            <span className="text-[9px] font-mono text-muted-foreground/30 shrink-0 ml-2">
                                                {entry.rowCount} rows · {entry.executionTimeMs}ms
                                            </span>
                                        </div>
                                        <pre className="text-[11px] font-mono text-foreground/80 truncate whitespace-pre-wrap line-clamp-2">
                                            {entry.sql}
                                        </pre>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
            {/* ── Saved queries panel ── */}
            {panel === "saved" && (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex-1 overflow-auto scrollbar-thin">
                        {connectionSaved.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-muted-foreground/30 gap-2">
                                <Bookmark size={20} className="opacity-30" />
                                <p className="text-[10px] font-mono">
                                    No saved queries
                                </p>
                                <p className="text-[9px] text-muted-foreground/70">
                                    Use the save button in the Editor tab
                                </p>
                            </div>
                        ) : (
                            connectionSaved.map((sq) => (
                                <div
                                    key={sq.id}
                                    className="border-b border-border px-3 py-2 hover:bg-accent group transition-colors"
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[11px] font-semibold text-foreground/90 truncate flex-1">
                                            {sq.name}
                                        </span>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button
                                                size="xs"
                                                variant="secondary"
                                                onClick={() => {
                                                    onSqlChange(sq.sql);
                                                    setPanel("editor");
                                                }}
                                                className="h-5 text-[9px] font-bold uppercase tracking-wider"
                                            >
                                                Load
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-xs"
                                                onClick={() =>
                                                    deleteSavedQuery(sq.id)
                                                }
                                                className="size-5 text-muted-foreground/40 hover:text-destructive"
                                            >
                                                <Trash2 size={10} />
                                            </Button>
                                        </div>
                                    </div>
                                    <pre className="text-[10px] font-mono text-muted-foreground/50 truncate">
                                        {sq.sql.slice(0, 120)}
                                    </pre>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
            {/* ── Editor panel ── */}
            {panel === "editor" && (
                <>
                    {/* Editor area — fixed height when results visible, flex-1 otherwise */}
                    <div
                        className="relative group min-h-0 overflow-hidden"
                        style={
                            queryResult
                                ? { height: editorHeightPx, flexShrink: 0 }
                                : { flex: "1 1 0%" }
                        }
                    >
                        <div className="absolute inset-0 scrollbar-thin">
                            <CodeMirror
                                value={pendingSql}
                                height="100%"
                                theme={editorTheme}
                                extensions={[
                                    sql({ schema: sqlSchema }),
                                    fontSizeTheme,
                                ]}
                                onChange={onSqlChange}
                                className="text-[13px] h-full selection:bg-primary/30"
                                basicSetup={{
                                    lineNumbers: true,
                                    foldGutter: false,
                                    highlightActiveLine: true,
                                    dropCursor: true,
                                    allowMultipleSelections: true,
                                    indentOnInput: true,
                                    syntaxHighlighting: true,
                                    bracketMatching: true,
                                    autocompletion: true,
                                    rectangularSelection: true,
                                    crosshairCursor: true,
                                    highlightSelectionMatches: true,
                                    closeBrackets: true,
                                    searchKeymap: true,
                                }}
                            />
                        </div>
                        <div className="absolute top-4 right-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                            <kbd className="px-1.5 h-5 rounded border border-border bg-background/80 backdrop-blur-sm text-[9px] font-mono text-muted-foreground/60 flex items-center gap-1">
                                ⌘<span>↵</span>
                            </kbd>
                        </div>
                    </div>
                    {/* Execute + Format + Save bar */}
                    <div className="h-10 bg-background border-t border-border flex items-center justify-between px-3 shrink-0 select-none gap-2">
                        <div className="flex items-center gap-1.5">
                            <Button
                                onClick={onExecute}
                                disabled={isLoading || !pendingSql.trim()}
                                variant="outline"
                                size="sm"
                                className={cn(
                                    "h-7 text-[10px] font-black uppercase tracking-[0.15em] gap-2 border-border/60",
                                    !isLoading && pendingSql.trim()
                                        ? "text-accent-green border-primary/40 hover:border-primary/70 hover:text-accent-green"
                                        : "text-muted-foreground/40",
                                )}
                            >
                                {isLoading ? (
                                    <Loader2 className="size-3 animate-spin" />
                                ) : (
                                    <Play size={11} className="fill-current" />
                                )}
                                Run [Cmd+Enter]
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={isLoading || !pendingSql.trim()}
                                onClick={onExplain}
                                className="h-7 text-[10px] font-bold uppercase tracking-[0.15em] gap-1.5 text-muted-foreground/50 hover:text-muted-foreground"
                            >
                                <Search size={11} />
                                Explain
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={!pendingSql.trim()}
                                onClick={() => {
                                    // Basic SQL formatter: uppercase keywords + indent
                                    const keywords = [
                                        "SELECT",
                                        "FROM",
                                        "WHERE",
                                        "JOIN",
                                        "LEFT JOIN",
                                        "RIGHT JOIN",
                                        "INNER JOIN",
                                        "OUTER JOIN",
                                        "GROUP BY",
                                        "ORDER BY",
                                        "HAVING",
                                        "LIMIT",
                                        "OFFSET",
                                        "ON",
                                        "AND",
                                        "OR",
                                        "AS",
                                        "INSERT INTO",
                                        "UPDATE",
                                        "SET",
                                        "DELETE FROM",
                                        "CREATE",
                                        "DROP",
                                        "ALTER",
                                        "VALUES",
                                        "UNION",
                                        "WITH",
                                    ];
                                    let fmt = pendingSql.trim();
                                    keywords.forEach((kw) => {
                                        fmt = fmt.replace(
                                            new RegExp(`\\b${kw}\\b`, "gi"),
                                            `\n${kw}`,
                                        );
                                    });
                                    onSqlChange(
                                        fmt
                                            .replace(/^\n/, "")
                                            .replace(/\n{2,}/g, "\n"),
                                    );
                                }}
                                className="h-7 text-[10px] font-bold uppercase tracking-[0.15em] gap-1.5 text-muted-foreground/50 hover:text-muted-foreground"
                            >
                                <AlignLeft size={11} />
                                Format
                            </Button>
                        </div>
                        {/* Save query inline UI */}
                        <div className="flex items-center gap-1 ml-auto">
                            {saveOpen ? (
                                <>
                                    <Input
                                        ref={saveInputRef}
                                        value={saveName}
                                        onChange={(e) =>
                                            setSaveName(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") handleSave();
                                            if (e.key === "Escape") {
                                                setSaveOpen(false);
                                                setSaveName("");
                                            }
                                        }}
                                        placeholder="Query name…"
                                        className="h-6 text-[11px] font-mono w-36"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={handleSave}
                                        disabled={
                                            !saveName.trim() ||
                                            !pendingSql.trim()
                                        }
                                        className="size-6 text-accent-green"
                                    >
                                        <Check size={10} />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() => {
                                            setSaveOpen(false);
                                            setSaveName("");
                                        }}
                                        className="size-6 text-muted-foreground/40"
                                    >
                                        <X size={10} />
                                    </Button>
                                </>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={() => setSaveOpen(true)}
                                    disabled={!pendingSql.trim()}
                                    className="h-6 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 gap-1"
                                >
                                    <BookmarkPlus size={10} />
                                    Save
                                </Button>
                            )}
                        </div>
                    </div>
                    {/* Results */}
                    {queryResult && (
                        <>
                            {/* Drag handle */}
                            <div
                                onMouseDown={startDrag}
                                className="h-1.5 bg-border-table hover:bg-primary/40 active:bg-primary/60 cursor-row-resize transition-colors shrink-0 select-none"
                                title="Drag to resize"
                            />
                            {/* Results grid */}
                            <div className="flex-1 border-t border-border overflow-auto scrollbar-thin min-h-0">
                                {queryResult.rows.length === 0 &&
                                    queryResult.columns.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-full text-accent-green p-8 text-center">
                                        <Sparkles
                                            size={24}
                                            className="mb-3 text-accent-green/40"
                                        />
                                        <p className="text-xs font-bold uppercase tracking-widest">
                                            Executed successfully ·{" "}
                                            {queryResult.executionTimeMs}ms
                                        </p>
                                    </div>
                                ) : (
                                    <Table className="w-full text-[11px] font-mono border-collapse">
                                        <TableHeader className="sticky top-0 z-10 bg-card">
                                            {table
                                                .getHeaderGroups()
                                                .map((hg) => (
                                                    <TableRow
                                                        key={hg.id}
                                                        className="hover:bg-transparent border-none"
                                                    >
                                                        {hg.headers.map((h) => {
                                                            // Look up column type from tables schema
                                                            const colName =
                                                                String(
                                                                    h.column
                                                                        .columnDef
                                                                        .header,
                                                                );
                                                            const colType =
                                                                tables
                                                                    .flatMap(
                                                                        (t) =>
                                                                            t.columns ??
                                                                            [],
                                                                    )
                                                                    .find(
                                                                        (c) =>
                                                                            c.name.toLowerCase() ===
                                                                            colName.toLowerCase(),
                                                                    )
                                                                    ?.dataType?.toUpperCase();
                                                            const sortDir =
                                                                h.column.getIsSorted();
                                                            return (
                                                                <TableHead
                                                                    key={h.id}
                                                                    className="h-auto px-3 py-1 text-left border-r border-border last:border-r-0 cursor-pointer hover:bg-muted/30 transition-colors group/th"
                                                                    onClick={h.column.getToggleSortingHandler()}
                                                                >
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="font-bold text-muted-foreground text-[10px] uppercase tracking-wider group-hover/th:text-foreground transition-colors">
                                                                            {flexRender(
                                                                                h
                                                                                    .column
                                                                                    .columnDef
                                                                                    .header,
                                                                                h.getContext(),
                                                                            )}
                                                                        </span>
                                                                        {sortDir && (
                                                                            <span className="text-accent-blue text-[9px]">
                                                                                {sortDir ===
                                                                                    "asc"
                                                                                    ? "↑"
                                                                                    : "↓"}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {colType && (
                                                                        <div className="text-[9px] font-mono text-muted-foreground/35 leading-tight mt-0.5">
                                                                            {
                                                                                colType
                                                                            }
                                                                        </div>
                                                                    )}
                                                                </TableHead>
                                                            );
                                                        })}
                                                    </TableRow>
                                                ))}
                                        </TableHeader>
                                        <TableBody>
                                            {table
                                                .getRowModel()
                                                .rows.map((row) => (
                                                    <TableRow
                                                        key={row.id}
                                                        className={cn(
                                                            "hover:bg-row-hover transition-colors",
                                                            row.index % 2 === 0
                                                                ? "bg-table-bg"
                                                                : "bg-row-alt",
                                                        )}
                                                    >
                                                        {row
                                                            .getVisibleCells()
                                                            .map((cell) => (
                                                                <TableCell
                                                                    key={
                                                                        cell.id
                                                                    }
                                                                    className="h-6 px-3 border-r border-border last:border-r-0 text-foreground/90 whitespace-nowrap overflow-hidden text-ellipsis max-w-75"
                                                                >
                                                                    {flexRender(
                                                                        cell
                                                                            .column
                                                                            .columnDef
                                                                            .cell,
                                                                        cell.getContext(),
                                                                    )}
                                                                </TableCell>
                                                            ))}
                                                    </TableRow>
                                                ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </div>
                            {/* Status bar */}
                            <StatusBar
                                connectionId={fn.connectionId}
                                executionTimeMs={queryResult.executionTimeMs}
                                rowCount={queryResult.rows.length}
                            />
                        </>
                    )}
                    {/* Query Log — always visible */}
                    <QueryLog
                        entries={queryHistory.filter((e) => e.connectionId === fn.connectionId)}
                        showSyntax={showQueryLogSyntax}
                        onSyntaxToggle={setShowQueryLogSyntax}
                        onClear={() => clearHistory(fn.connectionId)}
                    />
                </>
            )}
        </div>
    );
}
// ─── Table list (for _list function) ──────────────────────────────────────────
function TableListView({
    fn,
    tables,
    onTableClick,
}: {
    fn: ConnectionFunction;
    tables: TableInfo[];
    onTableClick: (tableName: string) => void;
}) {
    return (
        <div className="h-full flex flex-col bg-background overflow-hidden">
            <div className="h-9 px-4 flex items-center border-b border-border shrink-0">
                <span className="font-mono text-[11px] text-accent-blue font-bold">
                    {fn.callSignature
                        .slice(fn.prefix.length + 1)
                        .replace(/\(.*$/, "")}
                </span>
                <span className="ml-auto text-[10px] font-mono text-muted-foreground/40">
                    {tables.length} tables
                </span>
            </div>
            <div className="flex-1 overflow-auto scrollbar-thin">
                <table className="w-full text-[11px] font-mono">
                    <thead className="sticky top-0 bg-card">
                        <tr>
                            <th className="h-8 px-4 text-left font-bold text-muted-foreground border-b border-border">
                                Table
                            </th>
                            <th className="h-8 px-4 text-left font-bold text-muted-foreground border-b border-border">
                                Schema / DB
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {tables.map((t) => (
                            <tr
                                key={`${t.schema}-${t.name}`}
                                onClick={() => onTableClick(t.name)}
                                className="hover:bg-primary/10 cursor-pointer transition-colors border-b border-border group"
                            >
                                <td className="h-8 px-4 text-foreground/90">
                                    <div className="flex items-center gap-2">
                                        <Database
                                            size={11}
                                            className="text-accent-blue/50 shrink-0"
                                        />
                                        <span className="group-hover:text-accent-blue transition-colors">
                                            {t.name}
                                        </span>
                                    </div>
                                </td>
                                <td className="h-8 px-4 text-muted-foreground/50">
                                    {t.schema ?? "—"}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
// ─── Connection source info (for _src function) ────────────────────────────────
function ConnectionSrcView({
    fn,
    info,
}: {
    fn: ConnectionFunction;
    info: {
        connectionId: string;
        name: string;
        prefix: string;
        type: string;
        host?: string;
        port?: number;
        database?: string;
        ssl?: boolean;
        tableCount: number;
    };
}) {
    return (
        <div className="h-full flex flex-col bg-background overflow-hidden">
            <div className="h-9 px-4 flex items-center border-b border-border shrink-0">
                <span className="font-mono text-[11px] text-accent-blue font-bold">
                    {fn.callSignature
                        .slice(fn.prefix.length + 1)
                        .replace(/\(.*$/, "")}
                </span>
            </div>
            <div className="flex-1 p-8 flex items-start justify-center">
                <div className="w-full max-w-lg space-y-4">
                    {/* Connection name + type badge */}
                    <div className="flex items-center gap-3">
                        <div className="size-10 bg-primary rounded-xl flex items-center justify-center font-bold text-foreground text-[11px] shrink-0">
                            {info.type.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-foreground tracking-tight">
                                {info.name}
                            </h2>
                            <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">
                                {info.type}
                            </p>
                        </div>
                    </div>
                    {/* Info grid */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <InfoCard
                            icon={<Hash size={14} />}
                            label="Prefix"
                            value={`${info.prefix}_`}
                            mono
                        />
                        <InfoCard
                            icon={<Database size={14} />}
                            label="Tables"
                            value={String(info.tableCount)}
                        />
                        {info.host && (
                            <InfoCard
                                icon={<Server size={14} />}
                                label="Host"
                                value={`${info.host}:${info.port ?? ""}`}
                                mono
                            />
                        )}
                        {info.database && (
                            <InfoCard
                                icon={<Database size={14} />}
                                label="Database"
                                value={info.database}
                                mono
                            />
                        )}
                        <InfoCard
                            icon={<Lock size={14} />}
                            label="SSL"
                            value={info.ssl ? "Enabled" : "Disabled"}
                            accent={info.ssl ? "emerald" : "zinc"}
                        />
                    </div>
                    {/* Generated functions preview */}
                    <div className="pt-2">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2">
                            Generated Functions
                        </p>
                        <div className="bg-background rounded-xl p-4 border border-border">
                            <div className="flex flex-col gap-1">
                                {[
                                    `${info.prefix}_list()`,
                                    `${info.prefix}_src()`,
                                    `${info.prefix}_query(sql)`,
                                    `${info.prefix}_execute(sql)`,
                                    `${info.prefix}_tbl(table)`,
                                    `${info.prefix}_tableName() × ${info.tableCount}`,
                                ].map((fn) => (
                                    <span
                                        key={fn}
                                        className="text-[11px] font-mono text-muted-foreground/60"
                                    >
                                        {fn}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
function InfoCard({
    icon,
    label,
    value,
    mono = false,
    accent,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    mono?: boolean;
    accent?: "emerald" | "zinc";
}) {
    return (
        <div className="bg-card rounded-xl p-3 border border-border flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-muted-foreground/50">
                {icon}
                <span className="text-[9px] font-bold uppercase tracking-widest">
                    {label}
                </span>
            </div>
            <span
                className={cn(
                    "text-[12px] font-semibold",
                    mono ? "font-mono" : "",
                    accent === "emerald"
                        ? "text-accent-green"
                        : accent === "zinc"
                            ? "text-muted-foreground"
                            : "text-foreground",
                )}
            >
                {value}
            </span>
        </div>
    );
}
// ─── Status bar (bottom of editor when results are shown) ─────────────────────
function StatusBar({
    connectionId,
    executionTimeMs,
    rowCount,
}: {
    connectionId: string;
    executionTimeMs: number;
    rowCount: number;
}) {
    const { connections, connectedIds, selectedDatabases } = useAppStore();
    const conn = connections.find((c) => c.id === connectionId);
    const isConnected = conn ? connectedIds.includes(conn.id) : false;
    const dbName =
        selectedDatabases[connectionId] ?? conn?.database ?? conn?.name ?? "—";
    return (
        <div className="h-6 bg-card border-t border-border flex items-center justify-between px-3 shrink-0 select-none">
            {/* Left: connection indicator */}
            <div className="flex items-center gap-2.5">
                <div className="flex items-center gap-1.5">
                    <Circle
                        size={6}
                        className={cn(
                            "fill-current shrink-0",
                            isConnected
                                ? "text-primary animate-pulse"
                                : "text-muted-foreground/30",
                        )}
                    />
                    <span className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-wider">
                        {isConnected ? "Connected" : "Disconnected"}
                    </span>
                </div>
                <span className="text-muted-foreground/70 text-[9px]">·</span>
                <span className="text-[9px] font-mono text-muted-foreground/50">
                    Current DB:{" "}
                    <span className="text-muted-foreground/80">{dbName}</span>
                </span>
            </div>
            {/* Right: timing + row count */}
            <div className="flex items-center gap-3">
                <span className="text-[9px] font-mono text-muted-foreground/50">
                    Execution Time:{" "}
                    <span className="text-muted-foreground/80">
                        {executionTimeMs}ms
                    </span>
                </span>
                <span className="text-[9px] font-mono text-muted-foreground/50">
                    Rows:{" "}
                    <span className="text-muted-foreground/80">{rowCount}</span>
                </span>
            </div>
        </div>
    );
}
// ─── Tab bar ──────────────────────────────────────────────────────────────────
const TYPE_DOT: Record<string, string> = {
    list: "bg-accent-purple",
    src: "bg-muted-foreground",
    query: "bg-accent-green",
    execute: "bg-accent-orange",
    tbl: "bg-accent-blue",
    table: "bg-accent-blue",
};
function isDestructive(sql: string): boolean {
    return /\b(DELETE|DROP|TRUNCATE)\b/i.test(sql.trim());
}
// ─── Main FunctionOutput component ────────────────────────────────────────────
const FunctionOutput = () => {
    const {
        invocationResult,
        activeFunction,
        pendingSqlValue,
        setPendingSql,
        invokeFunction,
        connectionFunctions,
        connectionTables,
        connections,
        setConnectionDialogOpen,
        isLoading,
        tabs,
        activeTabId,
        openNewTab,
        closeTab,
        switchToTab,
        connectedIds,
        appSettings,
    } = useAppStore();
    const [page, setPage] = useState(0);
    const [pendingDangerSql, setPendingDangerSql] = useState<string | null>(
        null,
    );
    useEffect(() => {
        setPage(0);
    }, [activeFunction?.id]);
    const handleExecuteSql = useCallback(async () => {
        if (!activeFunction || !pendingSqlValue.trim()) return;
        if (isDestructive(pendingSqlValue)) {
            setPendingDangerSql(pendingSqlValue.trim());
            return;
        }
        await invokeFunction(activeFunction, { sql: pendingSqlValue });
    }, [activeFunction, pendingSqlValue, invokeFunction]);
    const confirmDangerSql = useCallback(async () => {
        if (!pendingDangerSql || !activeFunction) return;
        const sql = pendingDangerSql;
        setPendingDangerSql(null);
        await invokeFunction(activeFunction, { sql });
    }, [pendingDangerSql, activeFunction, invokeFunction]);
    const handleExplainSql = useCallback(async () => {
        if (!activeFunction || !pendingSqlValue.trim()) return;
        await invokeFunction(activeFunction, {
            sql: `EXPLAIN ${pendingSqlValue.trim()}`,
        });
    }, [activeFunction, pendingSqlValue, invokeFunction]);
    const handlePageChange = useCallback(
        async (newPage: number) => {
            if (!activeFunction) return;
            setPage(newPage);
            await invokeFunction(activeFunction, { page: newPage });
        },
        [activeFunction, invokeFunction],
    );
    const handleTableClick = useCallback(
        async (tableName: string) => {
            if (!invocationResult) return;
            const allFns = Object.values(connectionFunctions).flat();
            const tableFn = allFns.find(
                (fn) =>
                    fn.type === "table" &&
                    fn.connectionId === invocationResult.fn.connectionId &&
                    fn.tableName === tableName,
            );
            if (tableFn) await invokeFunction(tableFn);
        },
        [invocationResult, connectionFunctions, invokeFunction],
    );
    const activeTableDatabase = useMemo(() => {
        if (!activeFunction?.tableName) return "default";
        const tables = connectionTables[activeFunction.connectionId] ?? [];
        const tableInfo = tables.find(
            (t) => t.name === activeFunction.tableName,
        );
        return (
            tableInfo?.schema ??
            connections.find((c) => c.id === activeFunction.connectionId)
                ?.database ??
            "default"
        );
    }, [activeFunction, connectionTables, connections]);
    // ── Content renderer ──
    const renderContent = () => {
        const outputType = invocationResult?.outputType ?? "idle";
        if (isLoading || invocationResult?.isLoading) {
            const label = activeFunction
                ? activeFunction.callSignature
                    .slice(activeFunction.prefix.length + 1)
                    .replace(/\(.*$/, "")
                : "";
            return (
                <div className="h-full flex items-center justify-center bg-background">
                    <div className="text-center space-y-3">
                        <Loader2
                            size={24}
                            className="animate-spin text-primary mx-auto"
                        />
                        {label && (
                            <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">
                                {label}
                            </p>
                        )}
                    </div>
                </div>
            );
        }
        if (outputType === "idle" || !invocationResult || !activeFunction) {
            return (
                <IdleView
                    onNewConnection={() => setConnectionDialogOpen(true)}
                />
            );
        }
        if (invocationResult.error) {
            return (
                <div className="h-full flex items-center justify-center bg-background p-8">
                    <div className="max-w-lg w-full bg-destructive/5 border border-destructive/20 rounded-xl p-6">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-destructive mb-2">
                            Error
                        </p>
                        <p className="text-xs font-mono text-destructive/80">
                            {invocationResult.error}
                        </p>
                    </div>
                </div>
            );
        }
        switch (outputType) {
            case "table-grid":
                return (
                    <TableGridView
                        fn={activeFunction}
                        queryResult={invocationResult.queryResult}
                        isLoading={false}
                        onPageChange={handlePageChange}
                        page={page}
                        database={activeTableDatabase}
                        pageSize={appSettings.tablePageSize}
                    />
                );
            case "sql-editor":
                return (
                    <SqlEditorView
                        fn={activeFunction}
                        queryResult={invocationResult.queryResult}
                        isLoading={false}
                        pendingSql={pendingSqlValue}
                        onSqlChange={setPendingSql}
                        onExecute={handleExecuteSql}
                        onExplain={handleExplainSql}
                        tables={
                            connectionTables[activeFunction.connectionId] ?? []
                        }
                    />
                );
            case "table-list":
                return (
                    <TableListView
                        fn={activeFunction}
                        tables={invocationResult.tables ?? []}
                        onTableClick={handleTableClick}
                    />
                );
            case "connection-src":
                return (
                    <ConnectionSrcView
                        fn={activeFunction}
                        info={invocationResult.connectionInfo!}
                    />
                );
            default:
                return (
                    <IdleView
                        onNewConnection={() => setConnectionDialogOpen(true)}
                    />
                );
        }
    };
    return (
        <div className="h-full w-full flex flex-col overflow-hidden">
            {/* Tab bar — shown when there are 1+ tabs */}
            {tabs.length > 0 && (
                <div className="h-8 bg-sidebar border-b border-border flex items-stretch overflow-x-auto shrink-0 no-scrollbar">
                    {tabs.map((tab) => {
                        const isActive = tab.id === activeTabId;
                        return (
                            <div
                                key={tab.id}
                                onClick={() => switchToTab(tab.id)}
                                className={cn(
                                    "relative flex items-center gap-1.5 px-3 border-r border-border cursor-pointer shrink-0 select-none group/tab transition-colors",
                                    isActive
                                        ? "bg-background text-foreground"
                                        : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40",
                                )}
                            >
                                {/* Neon-green active-tab indicator */}
                                {isActive && (
                                    <span className="absolute inset-x-0 top-0 h-[2px] bg-primary" />
                                )}
                                <span
                                    className={cn(
                                        "w-1.5 h-1.5 shrink-0",
                                        /* square in dark (sharp corners), pill in light */
                                        "rounded-sm dark:rounded-none",
                                        TYPE_DOT[tab.fn.type] ??
                                        "bg-accent-blue",
                                    )}
                                />
                                <span className="text-[10px] font-mono max-w-[120px] truncate">
                                    {tab.label}
                                </span>
                                {tabs.length > 1 && (
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            closeTab(tab.id);
                                        }}
                                        className="ml-0.5 size-4 opacity-0 group-hover/tab:opacity-100 text-muted-foreground/40 hover:text-foreground"
                                    >
                                        <X size={9} />
                                    </Button>
                                )}
                            </div>
                        );
                    })}
                    {/* New tab button */}
                    {connectedIds.length > 0 && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={openNewTab}
                                    className="mx-1 my-auto size-6 text-muted-foreground/40 hover:text-muted-foreground shrink-0"
                                >
                                    <Plus size={11} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>New query tab</TooltipContent>
                        </Tooltip>
                    )}
                </div>
            )}
            {/* Main content */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {renderContent()}
            </div>
            {/* Destructive query confirmation dialog */}
            <AlertDialog
                open={!!pendingDangerSql}
                onOpenChange={(o) => !o && setPendingDangerSql(null)}
            >
                <AlertDialogContent className="max-w-md">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Destructive query detected
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This query contains a destructive operation (DELETE /
                            DROP / TRUNCATE). Review carefully before running.
                            <pre className="mt-2 rounded bg-muted p-2 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all max-h-40">
                                {pendingDangerSql}
                            </pre>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDangerSql}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Run anyway
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
export default FunctionOutput;

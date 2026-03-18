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
    TableInfo,
    ConnectionFunction,
    TableStructure,
    QueryHistoryEntry,
    SavedQuery,
    FilterCondition,
    FilterOp,
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
    const [viewMode, setViewMode] = useState<"data" | "structure">("data");
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
    const exportData = useCallback(
        (format: "csv" | "json") => {
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
            },
        ]);
        setShowFilterBar(true);
    };
    const removeFilter = (id: string) => {
        const next = filters.filter((f) => f.id !== id);
        setFilters(next);
        if (next.length === 0) {
            setFilteredResult(null);
        }
    };
    const clearFilters = () => {
        setFilters([]);
        setFilteredResult(null);
    };
    const applyFilters = useCallback(async () => {
        if (!fn.tableName || filters.length === 0) return;
        setFilterLoading(true);
        try {
            const whereParts = filters.map((f) => {
                const col = `"${f.col}"`;
                if (f.op === "IS NULL") return `${col} IS NULL`;
                if (f.op === "IS NOT NULL") return `${col} IS NOT NULL`;
                const isNum = f.value !== "" && !isNaN(Number(f.value));
                const val = isNum
                    ? f.value
                    : `'${f.value.replace(/'/g, "''")}'`;
                return `${col} ${f.op} ${val}`;
            });
            const sql = `SELECT * FROM "${fn.tableName}" WHERE ${whereParts.join(" AND ")} LIMIT ${pageSize} OFFSET ${page * pageSize}`;
            const result = await tauriApi.executeQuery(fn.connectionId, sql);
            setFilteredResult(result);
        } catch {
            // keep previous filtered result on error
        } finally {
            setFilterLoading(false);
        }
    }, [filters, fn, page]);
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
    const handleViewMode = (mode: "data" | "structure") => {
        setViewMode(mode);
        if (mode === "structure") loadStructure();
    };
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
    const table = useReactTable({
        data: effectiveResult?.rows ?? [],
        columns: (effectiveResult?.columns && effectiveResult.columns.length > 0
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
                    {fn.type === "table" ? fn.tableName : fn.callSignature.slice(fn.prefix.length + 1).replace(/\(.*$/, "")}
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
                                    setShowFilterBar((v) => !v);
                                    if (!showFilterBar && filters.length === 0)
                                        addFilter();
                                }}
                                className={filtersActive ? "text-accent-blue" : "text-muted-foreground"}
                            >
                                {filtersActive ? <FilterX size={11} /> : <Filter size={11} />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Toggle filters</TooltipContent>
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
                </div>
            </div>
            {/* Filter bar */}
            {showFilterBar && viewMode === "data" && (
                <div className="shrink-0 border-b border-border bg-card px-3 py-2 flex flex-col gap-2">
                    {filters.map((f) => (
                        <div key={f.id} className="flex items-center gap-2">
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
                                                    ? { ...x, value: e.target.value }
                                                    : x,
                                            ),
                                        )
                                    }
                                    onKeyDown={(e) => e.key === "Enter" && applyFilters()}
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
                            {filterLoading && <Loader2 size={9} className="animate-spin" />}
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
                            <Badge variant="secondary" className="text-[9px] font-mono h-5">
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
                                variant={importFormat === fmt ? "secondary" : "outline"}
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
                            {importing && <Loader2 size={9} className="animate-spin" />}
                            Import{importPreview ? ` ${importPreview.rows.length} rows` : ""}
                        </Button>
                        {importDone !== null && (
                            <Badge variant="secondary" className="text-[10px] font-mono h-5 text-accent-green">
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
                                                idx % 2 === 0 ? "bg-table-bg" : "bg-row-alt",
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
                                                className="hover:bg-muted transition-colors border-b border-border"
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
                                                        <span className="text-muted-foreground/25 not-italic">
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
                                                        <span className="text-muted-foreground/20 not-italic">
                                                            —
                                                        </span>
                                                    )}
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
                                                    className="hover:bg-muted transition-colors border-b border-border"
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
                    {(["data", "structure"] as const).map((mode) => (
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
                                <Loader2 size={10} className="animate-spin text-accent-blue" />
                            ) : (
                                <span className="text-[9px] text-muted-foreground/20 hidden sm:inline">
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
                                disabled={effectiveResult.rows.length < 50 || filtersActive}
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
                                className="text-[11px] font-mono min-w-[140px]"
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
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </>
                )}
                {viewMode === "structure" && (
                    <span className="text-[9px] font-mono text-muted-foreground/30">
                        {structure
                            ? `${structure.columns.length} columns · ${structure.indexes.length} indexes`
                            : ""}
                    </span>
                )}
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
    tables,
}: {
    fn: ConnectionFunction;
    queryResult?: { columns: string[]; rows: any[]; executionTimeMs: number };
    isLoading: boolean;
    pendingSql: string;
    onSqlChange: (sql: string) => void;
    onExecute: () => void;
    tables: TableInfo[];
}) {
    const {
        theme,
        queryHistory,
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
    const history: QueryHistoryEntry[] = queryHistory[fn.connectionId] ?? [];
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
                <Badge variant="secondary" className="h-4 px-1 text-[8px] font-mono">
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
                    {fn.callSignature.slice(fn.prefix.length + 1).replace(/\(.*$/, "")}
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
                            history.map((entry) => (
                                <div
                                    key={entry.id}
                                    onClick={() => {
                                        onSqlChange(entry.sql);
                                        setPanel("editor");
                                    }}
                                    className="border-b border-border px-3 py-2 hover:bg-accent cursor-pointer group transition-colors"
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[9px] font-mono text-muted-foreground/40">
                                            {new Date(
                                                entry.executedAt,
                                            ).toLocaleTimeString()}
                                        </span>
                                        <span className="text-[9px] font-mono text-muted-foreground/30">
                                            {entry.rowCount} rows ·{" "}
                                            {entry.executionTimeMs}ms
                                        </span>
                                    </div>
                                    <pre className="text-[11px] font-mono text-foreground/80 truncate whitespace-pre-wrap line-clamp-2">
                                        {entry.sql}
                                    </pre>
                                </div>
                            ))
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
                                <p className="text-[9px] text-muted-foreground/20">
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
                                                onClick={() => deleteSavedQuery(sq.id)}
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
                                extensions={[sql({ schema: sqlSchema }), fontSizeTheme]}
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
                    {/* Execute + Save bar */}
                    <div className="h-10 bg-background border-t border-border flex items-center justify-between px-3 shrink-0 select-none gap-2">
                        <Button
                            onClick={onExecute}
                            disabled={isLoading || !pendingSql.trim()}
                            variant={isLoading || !pendingSql.trim() ? "outline" : "ghost"}
                            size="sm"
                            className={cn(
                                "h-7 text-[10px] font-black uppercase tracking-[0.15em] gap-2",
                                !isLoading && pendingSql.trim() && "text-accent-green hover:text-accent-green",
                            )}
                        >
                            {isLoading ? (
                                <Loader2 className="size-3 animate-spin" />
                            ) : (
                                <Play size={11} className="fill-current" />
                            )}
                            Execute
                        </Button>
                        {/* Save query inline UI */}
                        <div className="flex items-center gap-1 ml-auto">
                            {saveOpen ? (
                                <>
                                    <Input
                                        ref={saveInputRef}
                                        value={saveName}
                                        onChange={(e) => setSaveName(e.target.value)}
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
                                        disabled={!saveName.trim() || !pendingSql.trim()}
                                        className="size-6 text-accent-green"
                                    >
                                        <Check size={10} />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        onClick={() => { setSaveOpen(false); setSaveName(""); }}
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
                            <div
                                onMouseDown={startDrag}
                                className="h-1.5 bg-border-table hover:bg-primary/40 active:bg-primary/60 cursor-row-resize transition-colors shrink-0 select-none"
                                title="Drag to resize"
                            />
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
                                        <TableHeader className="sticky top-0 z-10 bg-background">
                                            {table
                                                .getHeaderGroups()
                                                .map((hg) => (
                                                    <TableRow
                                                        key={hg.id}
                                                        className="hover:bg-transparent border-none"
                                                    >
                                                        {hg.headers.map((h) => (
                                                            <TableHead
                                                                key={h.id}
                                                                className="h-8 px-4 text-left font-bold text-muted-foreground border-r border-border last:border-r-0 cursor-pointer"
                                                                onClick={h.column.getToggleSortingHandler()}
                                                            >
                                                                {flexRender(
                                                                    h.column
                                                                        .columnDef
                                                                        .header,
                                                                    h.getContext(),
                                                                )}
                                                            </TableHead>
                                                        ))}
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
                                                            row.index % 2 === 0 ? "bg-table-bg" : "bg-row-alt",
                                                        )}
                                                    >
                                                        {row
                                                            .getVisibleCells()
                                                            .map((cell) => (
                                                                <TableCell
                                                                    key={
                                                                        cell.id
                                                                    }
                                                                    className="h-8 px-4 border-r border-border last:border-r-0 text-foreground/90 whitespace-nowrap overflow-hidden text-ellipsis max-w-75"
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
                                <div className="h-8 bg-card border-t border-border flex items-center px-4 shrink-0">
                                    <span className="text-[10px] font-mono text-muted-foreground/40">
                                        {queryResult.rows.length} rows ·{" "}
                                        {queryResult.executionTimeMs}ms
                                    </span>
                                </div>
                            </div>
                        </>
                    )}
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
                    {fn.callSignature.slice(fn.prefix.length + 1).replace(/\(.*$/, "")}
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
                    {fn.callSignature.slice(fn.prefix.length + 1).replace(/\(.*$/, "")}
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
// ─── Tab bar ──────────────────────────────────────────────────────────────────
const TYPE_DOT: Record<string, string> = {
    list: "bg-accent-purple",
    src: "bg-muted-foreground",
    query: "bg-accent-green",
    execute: "bg-accent-orange",
    tbl: "bg-accent-blue",
    table: "bg-accent-blue",
};
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
    useEffect(() => {
        setPage(0);
    }, [activeFunction?.id]);
    const handleExecuteSql = useCallback(async () => {
        if (!activeFunction || !pendingSqlValue.trim()) return;
        await invokeFunction(activeFunction, { sql: pendingSqlValue });
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
                ? activeFunction.callSignature.slice(
                    activeFunction.prefix.length + 1,
                ).replace(/\(.*$/, "")
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
        <div className="h-full flex flex-col overflow-hidden">
            {/* Tab bar — shown when there are 1+ tabs */}
            {tabs.length > 0 && (
                <div className="h-8 bg-sidebar border-b border-border flex items-stretch overflow-x-auto shrink-0">
                    {tabs.map((tab) => (
                        <div
                            key={tab.id}
                            onClick={() => switchToTab(tab.id)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 border-r border-border cursor-pointer shrink-0 select-none group/tab transition-colors",
                                tab.id === activeTabId
                                    ? "bg-background text-foreground"
                                    : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-card",
                            )}
                        >
                            <span
                                className={cn(
                                    "w-1.5 h-1.5 rounded-full shrink-0",
                                    TYPE_DOT[tab.fn.type] ?? "bg-accent-blue",
                                )}
                            />
                            <span className="text-[10px] font-mono max-w-[100px] truncate">
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
                                    className="ml-0.5 size-4 opacity-0 group-hover/tab:opacity-100 text-muted-foreground/40 hover:text-muted-foreground"
                                >
                                    <X size={9} />
                                </Button>
                            )}
                        </div>
                    ))}
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
        </div>
    );
};
export default FunctionOutput;

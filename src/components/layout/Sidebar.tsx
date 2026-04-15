import { useState, useMemo, useEffect } from "react";
import {
    ChevronDown,
    ChevronRight,
    Plus,
    Loader2,
    Plug,
    Search,
    Table2,
    Database,
    Folder,
    FolderOpen,
    Key,
    Clock,
    Hash,
    AlignJustify,
    Braces,
    ToggleLeft,
    CircleDot,
    HardDrive,
    ChevronsDown,
    ChevronsUp,
    RefreshCw,
    TableProperties,
    XCircle,
    Trash2,
    TriangleAlert,
    ArrowUpDown,
    Download,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { DB_LOGO, DB_COLOR } from "@/lib/db-ui";
import { GROUP_PRESETS } from "@/components/layout/ConnectionDialog";
import { ImportExportDialog } from "@/components/layout/ImportExportDialog";
import { DumpDatabaseDialog, type DumpOptions } from "@/components/layout/function-output/table-grid/DumpDatabaseDialog";
import { AddTableDialog } from "@/components/layout/sidebar/AddTableDialog";
import { toast } from "@/components/ui/sonner";
import { tauriApi } from "@/lib/tauri-api";
import { ConnectionConfig, ConnectionFunction, ColumnInfo } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
// ── Column type → icon ─────────────────────────────────────────────────────────
function ColumnIcon({ col }: { col: ColumnInfo }) {
    const t = col.dataType?.toLowerCase() ?? "";
    if (col.isPrimary)
        return <Key size={9} className="shrink-0 text-accent-orange/70" />;
    if (t.includes("timestamp") || t.includes("date") || t.includes("time"))
        return <Clock size={9} className="shrink-0 text-muted-foreground/40" />;
    if (t.includes("int") || t.includes("numeric") || t.includes("float") || t.includes("decimal") || t.includes("serial"))
        return <Hash size={9} className="shrink-0 text-muted-foreground/40" />;
    if (t.includes("bool"))
        return <ToggleLeft size={9} className="shrink-0 text-muted-foreground/40" />;
    if (t.includes("json"))
        return <Braces size={9} className="shrink-0 text-muted-foreground/40" />;
    return <AlignJustify size={9} className="shrink-0 text-muted-foreground/35" />;
}
// ── Column row ─────────────────────────────────────────────────────────────────
function ColumnRow({ col }: { col: ColumnInfo }) {
    return (
        <div className="flex items-center gap-1.5 h-[22px] pl-1 pr-2 text-muted-foreground/55 hover:text-muted-foreground transition-colors">
            <ColumnIcon col={col} />
            <span className="text-[10px] font-mono truncate flex-1">{col.name}</span>
            <span className="text-[9px] font-mono text-muted-foreground/30 shrink-0">
                {col.dataType}
            </span>
        </div>
    );
}
// ── Middle-truncate long table names ──────────────────────────────────────────
function midTruncate(name: string, max = 26): string {
    if (name.length <= max) return name;
    const front = Math.ceil((max - 1) * 0.55);
    const back = Math.floor((max - 1) * 0.45);
    return `${name.slice(0, front)}…${name.slice(-back)}`;
}
// ── Table row ──────────────────────────────────────────────────────────────────
function TableRow({
    fn,
    columns,
    isActive,
    onInvoke,
    forceOpen,
    onLoadColumns,
}: {
    fn: ConnectionFunction;
    columns: ColumnInfo[];
    isActive: boolean;
    onInvoke: (fn: ConnectionFunction) => void;
    forceOpen?: boolean | null;
    onLoadColumns: () => Promise<void>;
}) {
    const [open, setOpen] = useState(false);
    const [loadingCols, setLoadingCols] = useState(false);
    const expandTo = async (next: boolean) => {
        setOpen(next);
        if (next && columns.length === 0) {
            setLoadingCols(true);
            try { await onLoadColumns(); } finally { setLoadingCols(false); }
        }
    };
    useEffect(() => {
        if (forceOpen != null) expandTo(forceOpen);
    }, [forceOpen]);
    return (
        <div className="w-full min-w-0 overflow-hidden">
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={() => onInvoke(fn)}
                        className={cn(
                            "group w-full flex items-center gap-1.5 h-[26px] pr-2 pl-0 transition-colors overflow-hidden",
                            isActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground/70 hover:bg-muted/50 hover:text-foreground",
                        )}
                    >
                        {/* expand chevron — always visible */}
                        <span
                            className="flex items-center justify-center w-5 h-full shrink-0 text-muted-foreground/30 hover:text-muted-foreground/60"
                            onClick={(e) => { e.stopPropagation(); expandTo(!open); }}
                        >
                            {loadingCols
                                ? <Loader2 size={10} className="animate-spin" />
                                : open
                                    ? <ChevronDown size={10} />
                                    : <ChevronRight size={10} />}
                        </span>
                        <Table2
                            size={11}
                            className={cn(
                                "shrink-0",
                                isActive ? "text-primary/80" : "text-blue-400/70",
                            )}
                        />
                        <span
                            className={cn(
                                "text-[11px] font-mono flex-1 text-left min-w-0",
                                isActive && "font-semibold",
                            )}
                        >
                            {midTruncate(fn.tableName ?? "")}
                        </span>
                    </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={6} className="font-mono text-[11px]">
                    {fn.tableName}
                </TooltipContent>
            </Tooltip>
            {/* columns */}
            {open && columns.length > 0 && (
                <div className="pl-7">
                    {columns.map((col) => (
                        <ColumnRow key={col.name} col={col} />
                    ))}
                </div>
            )}
        </div>
    );
}
// ── Schema group ───────────────────────────────────────────────────────────────
function SchemaGroup({
    schema,
    fns,
    tableInfoMap,
    activeFunctionId,
    onInvoke,
    showLabel,
    forceOpen,
    onLoadColumns,
}: {
    schema: string;
    fns: ConnectionFunction[];
    tableInfoMap: Record<string, ColumnInfo[]>;
    activeFunctionId?: string;
    onInvoke: (fn: ConnectionFunction) => void;
    showLabel: boolean;
    forceOpen?: boolean | null;
    onLoadColumns: (tableName: string) => Promise<void>;
}) {
    const [open, setOpen] = useState(true);
    return (
        <div>
            {showLabel && (
                <button
                    onClick={() => setOpen((v) => !v)}
                    className="w-full flex items-center gap-1.5 h-[26px] pl-1 pr-2 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                    <span className="flex items-center justify-center w-4 shrink-0 text-muted-foreground/30">
                        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    </span>
                    {open
                        ? <FolderOpen size={11} className="shrink-0 text-muted-foreground/40" />
                        : <Folder size={11} className="shrink-0 text-muted-foreground/30" />}
                    <span className="text-[10px] font-mono flex-1 text-left">{schema}</span>
                    <span className="text-[9px] font-mono text-muted-foreground/70">{fns.length}</span>
                </button>
            )}
            {open && (
                <div className={cn("w-full min-w-0 overflow-hidden", showLabel ? "pl-4" : "")}>
                    {fns.map((fn) => (
                        <TableRow
                            key={fn.id}
                            fn={fn}
                            columns={tableInfoMap[fn.tableName ?? ""] ?? []}
                            isActive={activeFunctionId === fn.id}
                            onInvoke={onInvoke}
                            forceOpen={forceOpen}
                            onLoadColumns={() => onLoadColumns(fn.tableName ?? "")}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
// ── Database node ──────────────────────────────────────────────────────────────
function DatabaseNode({
    connection,
    isConnected,
    isLoading,
    tableFns,
    tableInfoMap,
    activeFunctionId,
    filter,
    selectedDb,
    onConnect,
    onInvoke,
    onRefreshTables,
    onAddTable,
    onLoadColumns,
}: {
    connection: ConnectionConfig;
    isConnected: boolean;
    isLoading: boolean;
    tableFns: ConnectionFunction[];
    tableInfoMap: Record<string, ColumnInfo[]>;
    activeFunctionId?: string;
    filter: string;
    selectedDb?: string;
    onConnect: () => void;
    onInvoke: (fn: ConnectionFunction) => void;
    onRefreshTables: () => Promise<void>;
    onAddTable: (sql: string) => Promise<void>;
    onLoadColumns: (tableName: string) => Promise<void>;
}) {
    const [open, setOpen] = useState(true);
    // Tables section state
    const [expandAll, setExpandAll] = useState<boolean | null>(null);
    const [isRefreshingTables, setIsRefreshingTables] = useState(false);
    const [addTableOpen, setAddTableOpen] = useState(false);
    // Dump state
    const [showDumpDialog, setShowDumpDialog] = useState(false);
    const [dumpDbLoading, setDumpDbLoading] = useState(false);
    const isRelationalDb =
        connection.type === "mysql" ||
        connection.type === "postgresql" ||
        connection.type === "sqlite";
    const executeDump = async (opts: DumpOptions) => {
        setDumpDbLoading(true);
        const activeDb = selectedDb ?? connection.database ?? "";
        const schemaArg = connection.type === "postgresql" ? opts.schema || "public" : null;
        try {
            const sql = await tauriApi.dumpDatabase(
                connection.id,
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
    };
    const handleRefreshTables = async () => {
        setIsRefreshingTables(true);
        try {
            await Promise.all([onRefreshTables(), new Promise((r) => setTimeout(r, 800))]);
        } finally {
            setIsRefreshingTables(false);
        }
    };
    const Logo = DB_LOGO[connection.type] ?? DB_LOGO.postgresql;
    const logoColor = DB_COLOR[connection.type] ?? "text-muted-foreground";
    // filter tables
    const filtered = useMemo(() => {
        const q = filter.trim().toLowerCase();
        if (!q) return tableFns;
        return tableFns.filter((f) =>
            (f.tableName ?? "").toLowerCase().includes(q),
        );
    }, [tableFns, filter]);
    // group by schema
    const bySchema = useMemo(() => {
        const groups: Record<string, ConnectionFunction[]> = {};
        for (const fn of filtered) {
            const schema = tableInfoMap[fn.tableName ?? ""]
                ? Object.keys(tableInfoMap).length > 0
                    ? (fn as any).schema ?? "public"
                    : "public"
                : "public";
            (groups[schema] ??= []).push(fn);
        }
        return groups;
    }, [filtered, tableInfoMap]);
    const schemaKeys = Object.keys(bySchema);
    const showSchemaLabels = schemaKeys.length > 1 || (schemaKeys.length === 1 && schemaKeys[0] !== "public");
    return (
        <div className="border-b border-border/50">
            {/* DB name row */}
            <button
                onClick={() => isConnected ? setOpen((v) => !v) : onConnect()}
                className={cn(
                    "group w-full flex items-center gap-2 h-8 px-2 transition-colors select-none",
                    "hover:bg-muted/40 text-foreground",
                )}
            >
                <span className="text-muted-foreground/40 shrink-0 w-3">
                    {isConnected
                        ? open ? <ChevronDown size={11} /> : <ChevronRight size={11} />
                        : <ChevronRight size={11} />}
                </span>
                <Logo className={cn("text-[14px] shrink-0", logoColor)} />
                <span className="text-[12px] font-mono font-semibold flex-1 text-left truncate min-w-0">
                    {connection.name}
                </span>
                {connection.group && (() => {
                    const preset = GROUP_PRESETS.find(p => p.id === connection.group);
                    return (
                        <span className={cn(
                            "shrink-0 px-1.5 h-[14px] flex items-center rounded text-[8px] font-bold uppercase tracking-wide border",
                            preset ? preset.activeClass : "bg-muted/50 border-border/50 text-muted-foreground/60"
                        )}>
                            {connection.group}
                        </span>
                    );
                })()}
                {isLoading && <Loader2 size={10} className="animate-spin text-muted-foreground/40 shrink-0" />}
                {!isConnected && !isLoading && (
                    <Plug size={10} className="text-muted-foreground/70 shrink-0 group-hover:text-primary/60 transition-colors" />
                )}
            </button>
            {/* Tables header */}
            {isConnected && open && (
                <div className="flex items-center gap-1 h-7 px-2 border-b border-border/30 shrink-0">
                    <TableProperties size={11} className="shrink-0 text-muted-foreground/30" />
                    <span className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-muted-foreground/35 flex-1">
                        Tables
                    </span>
                    {!isLoading && tableFns.length > 0 && (
                        <span className="text-[9px] font-mono text-muted-foreground/40 tabular-nums mr-0.5">
                            {filter.trim() ? `${filtered.length}/` : ""}{tableFns.length}
                        </span>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={() => setAddTableOpen(true)}
                                className="flex items-center justify-center w-5 h-5 text-muted-foreground/35 hover:text-foreground transition-colors"
                            >
                                <Plus size={11} />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={4}>Add table</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                onClick={handleRefreshTables}
                                disabled={isRefreshingTables}
                                className="flex items-center justify-center w-5 h-5 text-muted-foreground/35 hover:text-foreground transition-colors disabled:opacity-40"
                            >
                                <RefreshCw size={11} className={isRefreshingTables ? "animate-spin" : ""} />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={4}>Refresh tables</TooltipContent>
                    </Tooltip>
                    {tableFns.length > 0 && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => setExpandAll((v) => v === true ? false : true)}
                                    className="flex items-center justify-center w-5 h-5 text-muted-foreground/35 hover:text-foreground transition-colors"
                                >
                                    {expandAll === true ? <ChevronsUp size={11} /> : <ChevronsDown size={11} />}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={4}>
                                {expandAll === true ? "Collapse all" : "Expand all"}
                            </TooltipContent>
                        </Tooltip>
                    )}
                    {isRelationalDb && (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => setShowDumpDialog(true)}
                                    disabled={dumpDbLoading}
                                    className="flex items-center justify-center w-5 h-5 text-muted-foreground/35 hover:text-foreground transition-colors disabled:opacity-40"
                                >
                                    {dumpDbLoading
                                        ? <Loader2 size={11} className="animate-spin" />
                                        : <Download size={11} />}
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={4}>Dump database</TooltipContent>
                        </Tooltip>
                    )}
                </div>
            )}
            {/* Add Table dialog */}
            <AddTableDialog
                open={addTableOpen}
                onOpenChange={setAddTableOpen}
                connectionType={connection.type}
                connectionName={connection.name}
                selectedDb={selectedDb}
                onAddTable={onAddTable}
            />
            {/* Dump Database dialog */}
            <DumpDatabaseDialog
                open={showDumpDialog}
                databaseName={selectedDb ?? connection.database ?? ""}
                dbType={connection.type}
                loading={dumpDbLoading}
                onCancel={() => setShowDumpDialog(false)}
                onConfirm={executeDump}
            />
            {/* Tree */}
            {isConnected && open && (
                <div className="pb-1">
                    {isLoading ? (
                        <div className="flex items-center gap-2 px-4 py-2">
                            <Loader2 size={10} className="animate-spin text-muted-foreground/30" />
                            <span className="text-[10px] font-mono text-muted-foreground/30">Loading…</span>
                        </div>
                    ) : tableFns.length === 0 ? (
                        <p className="px-4 py-2 text-[10px] font-mono text-muted-foreground/30">
                            No tables
                        </p>
                    ) : filtered.length === 0 ? (
                        <p className="px-4 py-2 text-[10px] font-mono text-muted-foreground/30">
                            No match
                        </p>
                    ) : (
                        <div className="pl-2 w-full min-w-0 overflow-hidden">
                            {schemaKeys.map((schema) => (
                                <SchemaGroup
                                    key={schema}
                                    schema={schema}
                                    fns={bySchema[schema]}
                                    tableInfoMap={tableInfoMap}
                                    activeFunctionId={activeFunctionId}
                                    onInvoke={onInvoke}
                                    showLabel={showSchemaLabels}
                                    forceOpen={expandAll}
                                    onLoadColumns={onLoadColumns}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
// ── Main Sidebar ───────────────────────────────────────────────────────────────
const Sidebar = () => {
    const {
        connections,
        connectedIds,
        connectionFunctions,
        connectionTables,
        selectedDatabases,
        openDatabases,
        activeFunction,
        connectAndInit,
        selectDatabase,
        closeOpenDatabase,
        refreshTables,
        refreshDatabases,
        loadTableColumns,
        invokeFunction,
        setActiveFunctionOnly,
        setConnectionDialogOpen,
        setEditingConnection,
        addConnection,
    } = useAppStore();
    const [filter, setFilter] = useState("");
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
    const [importExportOpen, setImportExportOpen] = useState(false);
    const [dbCtxMenu, setDbCtxMenu] = useState<{ db: string; x: number; y: number } | null>(null);
    const [dropDbConfirm, setDropDbConfirm] = useState<string | null>(null);
    const [dropConfirmInput, setDropConfirmInput] = useState("");
    const [droppingDb, setDroppingDb] = useState(false);
    // Close context menu on Escape
    useEffect(() => {
        if (!dbCtxMenu) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDbCtxMenu(null); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [dbCtxMenu]);
    const handleConnect = async (connId: string) => {
        setLoadingIds((prev) => new Set(prev).add(connId));
        try {
            await connectAndInit(connId);
        } finally {
            setLoadingIds((prev) => {
                const next = new Set(prev);
                next.delete(connId);
                return next;
            });
        }
    };
    // active connection: prefer activeFunction's connection, then first connected
    const activeConn = useMemo(() => {
        return (activeFunction
            ? connections.find((c) => c.id === activeFunction.connectionId)
            : null) ?? connections.find((c) => connectedIds.includes(c.id)) ?? null;
    }, [activeFunction, connections, connectedIds]);
    const currentDb = useMemo(() => {
        if (!activeConn) return null;
        return selectedDatabases[activeConn.id] ?? activeConn.database ?? null;
    }, [activeConn, selectedDatabases]);
    const handleInvoke = (fn: ConnectionFunction) => {
        if (fn.type === "query" || fn.type === "execute") {
            setActiveFunctionOnly(fn);
        } else {
            invokeFunction(fn);
        }
    };
    const handleDrop = async () => {
        if (droppingDb || dropConfirmInput !== dropDbConfirm || !dropDbConfirm || !activeConn) return;
        setDroppingDb(true);
        try {
            const dropSql = activeConn.type === "mysql"
                ? `DROP DATABASE \`${dropDbConfirm}\``
                : `DROP DATABASE "${dropDbConfirm}"`;
            await tauriApi.executeQuery(activeConn.id, dropSql);
            closeOpenDatabase(activeConn.id, dropDbConfirm);
            await refreshDatabases(activeConn.id);
            await refreshTables(activeConn.id);
            toast.success(`Database "${dropDbConfirm}" dropped`);
        } catch (e) {
            toast.error(`Drop failed: ${e}`);
        } finally {
            setDroppingDb(false);
            setDropDbConfirm(null);
            setDropConfirmInput("");
        }
    };
    const activeDatabases = activeConn ? (openDatabases[activeConn.id] ?? []) : [];
    const selectedDb = activeConn ? (selectedDatabases[activeConn.id] ?? null) : null;
    return (
        <div className="h-full flex bg-sidebar border-r border-sidebar-border overflow-hidden min-h-0">
            {/* ── Left: open database tabs ── */}
            {activeDatabases.length > 0 && activeConn && (
                <div className="flex flex-col shrink-0 border-r border-border/60 bg-sidebar overflow-y-auto" style={{ width: 72 }}>
                    {activeDatabases.map((db, idx) => {
                        const isActive = db === selectedDb;
                        const DbLogo = DB_LOGO[activeConn.type] ?? DB_LOGO.postgresql;
                        const logoColor = DB_COLOR[activeConn.type] ?? "text-muted-foreground";
                        return (
                            <div key={db} className="flex flex-col">
                                {idx > 0 && (
                                    <div className="mx-3 h-px bg-border/40 shrink-0" />
                                )}
                                <Tooltip delayDuration={600}>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={() => selectDatabase(activeConn.id, db)}
                                            onContextMenu={(e) => {
                                                e.preventDefault();
                                                setDbCtxMenu({ db, x: e.clientX, y: e.clientY });
                                            }}
                                            className={cn(
                                                "group relative flex flex-col items-center gap-1.5 py-3 px-1.5 w-full transition-colors shrink-0",
                                                isActive
                                                    ? "bg-background text-foreground"
                                                    : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/20"
                                            )}
                                        >
                                            {/* Left accent bar */}
                                            <div className={cn(
                                                "absolute left-0 top-3 bottom-3 w-[2px] rounded-r-full transition-opacity",
                                                isActive ? "bg-primary opacity-100" : "opacity-0"
                                            )} />
                                            {/* Icon container */}
                                            <div className={cn(
                                                "flex items-center justify-center w-9 h-9 rounded-lg transition-colors",
                                                isActive
                                                    ? "bg-primary/10 ring-1 ring-primary/20"
                                                    : "group-hover:bg-muted/40"
                                            )}>
                                                <DbLogo className={cn(
                                                    "text-[18px] shrink-0 transition-colors",
                                                    isActive ? logoColor : "text-muted-foreground/35 group-hover:text-muted-foreground/60"
                                                )} />
                                            </div>
                                            {/* DB label */}
                                            <span className={cn(
                                                "text-[8px] font-mono leading-tight text-center w-full px-1 truncate transition-colors",
                                                isActive
                                                    ? "text-foreground/80"
                                                    : "text-muted-foreground/40 group-hover:text-muted-foreground/60"
                                            )}>
                                                {db}
                                            </span>
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right" sideOffset={6} className="font-mono text-[11px]">
                                        {db}
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        );
                    })}
                </div>
            )}
            {/* ── DB tab context menu ── */}
            {dbCtxMenu && activeConn && (() => {
                const menuW = 172;
                const menuH = 160;
                const left = Math.min(dbCtxMenu.x, window.innerWidth - menuW - 8);
                const top = Math.min(dbCtxMenu.y, window.innerHeight - menuH - 8);
                return (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setDbCtxMenu(null)}
                            onContextMenu={(e) => { e.preventDefault(); setDbCtxMenu(null); }}
                        />
                        <div
                            className="fixed z-50 bg-popover border border-border rounded-lg shadow-xl p-1 text-popover-foreground"
                            style={{ top, left, width: menuW }}
                        >
                            <div className="px-2 py-1.5 mb-0.5">
                                <p className="text-[9px] font-mono font-bold uppercase tracking-widest text-muted-foreground/40 truncate max-w-[148px]">
                                    {dbCtxMenu.db}
                                </p>
                            </div>
                            <button
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-[11px] text-foreground/80 hover:bg-muted/40 transition-colors"
                                onClick={() => {
                                    refreshTables(activeConn.id, dbCtxMenu.db);
                                    if (selectedDb !== dbCtxMenu.db) selectDatabase(activeConn.id, dbCtxMenu.db);
                                    setDbCtxMenu(null);
                                }}
                            >
                                <RefreshCw size={11} className="shrink-0 text-muted-foreground/60" />
                                Refresh DB
                            </button>
                            <button
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-[11px] text-foreground/70 hover:bg-muted/40 transition-colors"
                                onClick={() => {
                                    closeOpenDatabase(activeConn.id, dbCtxMenu.db);
                                    setDbCtxMenu(null);
                                }}
                            >
                                <XCircle size={11} className="shrink-0 text-muted-foreground/60" />
                                Close DB
                            </button>
                            <div className="my-1 h-px bg-border/60" />
                            <button
                                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-[11px] text-destructive/80 hover:bg-destructive/10 transition-colors"
                                onClick={() => {
                                    setDropConfirmInput("");
                                    setDropDbConfirm(dbCtxMenu.db);
                                    setDbCtxMenu(null);
                                }}
                            >
                                <Trash2 size={11} className="shrink-0" />
                                Drop Database
                            </button>
                        </div>
                    </>
                );
            })()}
            {/* ── Right: main content ── */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* ── Header ── */}
                <div className="h-10 flex items-center justify-between px-3 border-b border-border shrink-0">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-muted-foreground/40">
                        Explorer
                    </span>
                    <div className="flex items-center gap-1">
                        {loadingIds.size > 0 && (
                            <Loader2 size={10} className="animate-spin text-muted-foreground/40" />
                        )}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() => setImportExportOpen(true)}
                                    className="text-muted-foreground/40 hover:text-foreground"
                                >
                                    <ArrowUpDown size={14} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={4}>Import / Export</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() => {
                                        setEditingConnection(null);
                                        setConnectionDialogOpen(true);
                                    }}
                                    className="text-muted-foreground/40 hover:text-foreground"
                                >
                                    <Plus size={14} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={4}>New connection</TooltipContent>
                        </Tooltip>
                    </div>
                </div>
                {/* ── Filter ── */}
                {connections.length > 0 && (
                    <div className="px-2 py-1.5 border-b border-border shrink-0">
                        <div className="relative">
                            <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/30 pointer-events-none" />
                            <Input
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                placeholder="Filter tables…"
                                className="h-7 pl-6 pr-2 text-[11px] font-mono bg-muted/30 border-border/40 placeholder:text-muted-foreground/30 focus-visible:ring-0 focus-visible:border-primary/40"
                            />
                        </div>
                    </div>
                )}
                {/* ── Tree ── */}
                {connections.length === 0 ? (
                    <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 px-4 pb-10">
                        <div className="size-10 border border-border flex items-center justify-center">
                            <Database size={18} className="text-muted-foreground/70" />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="text-[10px] font-mono font-bold text-muted-foreground/40 uppercase tracking-widest">
                                No connections
                            </p>
                            <p className="text-[9px] font-mono text-muted-foreground/70">
                                Add a database to get started
                            </p>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => { setEditingConnection(null); setConnectionDialogOpen(true); }}
                            className="h-7 text-[10px] font-mono font-bold uppercase tracking-widest gap-1.5"
                        >
                            <Plus size={11} />
                            Add Connection
                        </Button>
                    </div>
                ) : (
                    <ScrollArea className="flex-1 min-h-0">
                        <div className="py-1">
                            {activeConn ? (() => {
                                const conn = activeConn;
                                const fns = connectionFunctions[conn.id] ?? [];
                                const tableFns = fns.filter((f) => f.type === "table");
                                const tables = connectionTables[conn.id] ?? [];
                                const tableInfoMap: Record<string, ColumnInfo[]> =
                                    Object.fromEntries(tables.map((t) => [t.name, t.columns ?? []]));
                                return (
                                    <DatabaseNode
                                        key={conn.id}
                                        connection={conn}
                                        isConnected={connectedIds.includes(conn.id)}
                                        isLoading={loadingIds.has(conn.id)}
                                        tableFns={tableFns}
                                        tableInfoMap={tableInfoMap}
                                        activeFunctionId={activeFunction?.id}
                                        filter={filter}
                                        selectedDb={selectedDatabases[conn.id]}
                                        onConnect={() => handleConnect(conn.id)}
                                        onInvoke={handleInvoke}
                                        onRefreshTables={() => refreshTables(conn.id)}
                                        onAddTable={async (sql) => {
                                            const result = await tauriApi.executeQuery(conn.id, sql);
                                            if (result.error) throw new Error(result.error);
                                            await refreshTables(conn.id);
                                        }}
                                        onLoadColumns={(tableName) => loadTableColumns(conn.id, tableName)}
                                    />
                                );
                            })() : (
                                <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center">
                                    <p className="text-[10px] font-mono text-muted-foreground/40">No active connection</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                )}
                {/* ── Status Footer ── always pinned to bottom */}
                <div className="shrink-0 border-t border-border px-3 h-7 flex items-center gap-2 bg-sidebar overflow-hidden">
                    <CircleDot
                        size={8}
                        className={cn("shrink-0", connectedIds.length > 0 ? "text-primary" : "text-muted-foreground/50")}
                    />
                    <span className="text-[10px] font-mono shrink-0 whitespace-nowrap">
                        <span className={connectedIds.length > 0 ? "text-primary" : "text-muted-foreground/70"}>{connectedIds.length}</span>
                        <span className="text-muted-foreground/60">/{connections.length} conn</span>
                    </span>
                    <span className="text-muted-foreground/40 shrink-0">·</span>
                    <HardDrive size={8} className="shrink-0 text-muted-foreground/50" />
                    <span className="text-[10px] font-mono truncate text-muted-foreground/70 min-w-0">
                        {currentDb ?? <span className="text-muted-foreground/40">no db</span>}
                    </span>
                </div>
            </div>{/* end right content */}
            {importExportOpen && (
                <ImportExportDialog
                    onClose={() => setImportExportOpen(false)}
                    onImportComplete={(newConns) => {
                        newConns.forEach((c) => addConnection(c));
                    }}
                />
            )}
            {dropDbConfirm && activeConn && (
                <Dialog open={!!dropDbConfirm} onOpenChange={(open) => { if (!open) { setDropDbConfirm(null); setDropConfirmInput(""); } }}>
                    <DialogContent className="max-w-sm">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <TriangleAlert size={15} className="text-destructive shrink-0" />
                                Drop database?
                            </DialogTitle>
                            <DialogDescription>
                                This will permanently delete <span className="font-mono font-semibold text-foreground/80">{dropDbConfirm}</span> and all its data. This action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                            <pre className="rounded-md bg-muted px-3 py-2 text-[11px] font-mono text-muted-foreground whitespace-pre-wrap break-all">
                                {activeConn.type === "mysql"
                                    ? `DROP DATABASE \`${dropDbConfirm}\``
                                    : `DROP DATABASE "${dropDbConfirm}"`}
                            </pre>
                            <div className="space-y-1.5">
                                <Label className="text-[11px] text-muted-foreground">
                                    Type <span className="font-mono text-destructive">{dropDbConfirm}</span> to confirm
                                </Label>
                                <Input
                                    autoFocus
                                    value={dropConfirmInput}
                                    placeholder={dropDbConfirm}
                                    className="h-8 text-[11px] font-mono"
                                    onChange={(e) => setDropConfirmInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === "Enter") handleDrop(); }}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" size="sm" onClick={() => { setDropDbConfirm(null); setDropConfirmInput(""); }}>
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                disabled={droppingDb || dropConfirmInput !== dropDbConfirm}
                                onClick={handleDrop}
                            >
                                {droppingDb ? "Dropping..." : "Drop Database"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
};
export default Sidebar;

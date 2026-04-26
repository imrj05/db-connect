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
    PanelLeftClose,
    PanelLeftOpen,
    Pin,
    PinOff,
    Activity,
    ShieldAlert,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { DB_LOGO, DB_COLOR } from "@/lib/db-ui";
import { GROUP_PRESETS } from "@/components/layout/connection-dialog-modal";
import { ImportExportDialog } from "@/components/layout/import-export-dialog";
import { DumpDatabaseDialog, type DumpOptions } from "@/components/layout/function-output/table-grid/dump-database-dialog";
import { AddTableDialog } from "@/components/layout/sidebar/add-table-dialog";
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
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuLabel,
    ContextMenuSeparator,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { ConnectionHealthPanel } from "@/components/layout/connection-health-panel";
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
        <div className="flex h-[22px] items-center gap-2 rounded-[4px] pl-1.5 pr-2.5 text-foreground/62 transition-colors hover:bg-surface-2/72 hover:text-foreground/82">
            <ColumnIcon col={col} />
            <span className="text-[11px] font-mono truncate flex-1">{col.name}</span>
            <span className="text-[11px] font-mono text-foreground/38 shrink-0">
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
    isPinned,
    onPinToggle,
    onTableAction,
}: {
    fn: ConnectionFunction;
    columns: ColumnInfo[];
    isActive: boolean;
    onInvoke: (fn: ConnectionFunction) => void;
    forceOpen?: boolean | null;
    onLoadColumns: () => Promise<void>;
    isPinned?: boolean;
    onPinToggle?: () => void;
    onTableAction?: (action: "rename" | "truncate" | "drop") => void;
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
        <ContextMenu>
        <ContextMenuTrigger asChild>
        <div className="w-full min-w-0 overflow-hidden">
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={() => onInvoke(fn)}
                        className={cn(
                            "group flex h-7 w-full items-center gap-2.5 overflow-hidden rounded-[4px] pl-1.5 pr-2.5 transition-colors",
                            isActive
                                ? "bg-surface-selected/82 text-foreground shadow-xs ring-1 ring-border-subtle"
                                : "text-foreground/72 hover:bg-surface-2 hover:text-foreground",
                        )}
                    >
                        {/* expand chevron — always visible */}
                        <span
                            className="flex items-center justify-center w-5 h-full shrink-0 text-foreground/28 hover:text-foreground/52"
                            onClick={(e) => { e.stopPropagation(); expandTo(!open); }}
                        >
                            {loadingCols
                                ? <Loader2 size={10} className="animate-spin" />
                                : open
                                    ? <ChevronDown size={10} />
                                    : <ChevronRight size={10} />}
                        </span>
                        <Table2
                            size={12}
                            className={cn(
                                "shrink-0",
                                isActive ? "text-primary/72" : "text-blue-400/72",
                            )}
                        />
                        <span
                            className={cn(
                                "text-[12px] font-mono flex-1 text-left min-w-0",
                                isActive && "font-semibold text-foreground",
                            )}
                        >
                            {midTruncate(fn.tableName ?? "")}
                        </span>
                        {onPinToggle && (
                            <span
                                onClick={(e) => { e.stopPropagation(); onPinToggle(); }}
                                className={cn(
                                    "opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded",
                                    isPinned ? "opacity-100 text-primary/70" : "text-foreground/30 hover:text-primary/70"
                                )}
                                title={isPinned ? "Unpin table" : "Pin table"}
                            >
                                {isPinned ? <PinOff size={9} /> : <Pin size={9} />}
                            </span>
                        )}
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
        </ContextMenuTrigger>
        {onTableAction && (
            <ContextMenuContent className="w-44">
                <ContextMenuLabel className="text-[10px] font-mono text-muted-foreground/60 truncate">{fn.tableName}</ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => onTableAction("rename")}>Rename table…</ContextMenuItem>
                <ContextMenuItem onClick={() => onTableAction("truncate")} className="text-orange-400 focus:text-orange-300">Truncate table</ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => onTableAction("drop")} className="text-destructive focus:text-destructive">Drop table</ContextMenuItem>
            </ContextMenuContent>
        )}
        </ContextMenu>
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
    pinnedTableNames,
    onPinToggle,
    onTableAction,
}: {
    schema: string;
    fns: ConnectionFunction[];
    tableInfoMap: Record<string, ColumnInfo[]>;
    activeFunctionId?: string;
    onInvoke: (fn: ConnectionFunction) => void;
    showLabel: boolean;
    forceOpen?: boolean | null;
    onLoadColumns: (tableName: string) => Promise<void>;
    pinnedTableNames?: Set<string>;
    onPinToggle?: (tableName: string) => void;
    onTableAction?: (action: "rename" | "truncate" | "drop", tableName: string) => void;
}) {
    const [open, setOpen] = useState(true);
    return (
        <div>
            {showLabel && (
                <button
                    onClick={() => setOpen((v) => !v)}
                    className="flex h-[26px] w-full items-center gap-2 rounded-[4px] pl-1.5 pr-2.5 text-foreground/60 transition-colors hover:bg-surface-2/72 hover:text-foreground"
                >
                    <span className="flex items-center justify-center w-4 shrink-0 text-foreground/35">
                        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    </span>
                    {open
                        ? <FolderOpen size={11} className="shrink-0 text-foreground/45" />
                        : <Folder size={11} className="shrink-0 text-foreground/38" />}
                    <span className="text-[11px] font-mono flex-1 text-left">{schema}</span>
                    <span className="text-[11px] font-mono text-foreground/45">{fns.length}</span>
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
                            isPinned={pinnedTableNames?.has(fn.tableName ?? "")}
                            onPinToggle={onPinToggle ? () => onPinToggle(fn.tableName ?? "") : undefined}
                            onTableAction={onTableAction ? (action) => onTableAction(action, fn.tableName ?? "") : undefined}
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
    pinnedTableNames,
    onPinToggle,
    latencyMs,
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
    pinnedTableNames?: Set<string>;
    onPinToggle?: (tableName: string) => void;
    latencyMs?: number | null;
}) {
    const [open, setOpen] = useState(true);
    // Tables section state
    const [expandAll, setExpandAll] = useState<boolean | null>(null);
    const [isRefreshingTables, setIsRefreshingTables] = useState(false);
    const [addTableOpen, setAddTableOpen] = useState(false);
    // Dump state
    const [showDumpDialog, setShowDumpDialog] = useState(false);
    const [dumpDbLoading, setDumpDbLoading] = useState(false);
    // Table context menu actions
    const [renameTarget, setRenameTarget] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");
    const [renameLoading, setRenameLoading] = useState(false);
    const [dropTarget, setDropTarget] = useState<string | null>(null);
    const [dropLoading, setDropLoading] = useState(false);
    const qi = (name: string) =>
        connection.type === "mysql" ? `\`${name}\`` : `"${name}"`;
    const handleTableAction = async (action: "rename" | "truncate" | "drop", tableName: string) => {
        if (action === "rename") { setRenameTarget(tableName); setRenameValue(tableName); return; }
        if (action === "drop") { setDropTarget(tableName); return; }
        // truncate
        try {
            const sql = connection.type === "sqlite"
                ? `DELETE FROM ${qi(tableName)}`
                : `TRUNCATE TABLE ${qi(tableName)}`;
            const res = await tauriApi.executeQuery(connection.id, sql);
            if (res.error) toast.error(`Truncate failed: ${res.error}`);
            else toast.success(`Truncated ${tableName}`);
        } catch (e) { toast.error(`Truncate failed: ${e}`); }
    };
    const executeRename = async () => {
        if (!renameTarget || !renameValue.trim()) return;
        setRenameLoading(true);
        try {
            const sql = `ALTER TABLE ${qi(renameTarget)} RENAME TO ${qi(renameValue.trim())}`;
            const res = await tauriApi.executeQuery(connection.id, sql);
            if (res.error) { toast.error(`Rename failed: ${res.error}`); }
            else { toast.success(`Renamed to ${renameValue.trim()}`); setRenameTarget(null); await onRefreshTables(); }
        } catch (e) { toast.error(`Rename failed: ${e}`); }
        finally { setRenameLoading(false); }
    };
    const executeDrop = async () => {
        if (!dropTarget) return;
        setDropLoading(true);
        try {
            const res = await tauriApi.executeQuery(connection.id, `DROP TABLE ${qi(dropTarget)}`);
            if (res.error) { toast.error(`Drop failed: ${res.error}`); }
            else { toast.success(`Dropped ${dropTarget}`); setDropTarget(null); await onRefreshTables(); }
        } catch (e) { toast.error(`Drop failed: ${e}`); }
        finally { setDropLoading(false); }
    };
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
        return tableFns.filter((f) => {
            if ((f.tableName ?? "").toLowerCase().includes(q)) return true;
            // Also match against any already-loaded column names
            const cols = tableInfoMap[f.tableName ?? ""] ?? [];
            return cols.some((c) => c.name.toLowerCase().includes(q));
        });
    }, [tableFns, filter, tableInfoMap]);
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
        <div className="overflow-hidden border border-border-subtle bg-surface-2">
            {/* DB name row */}
            <button
                onClick={() => isConnected ? setOpen((v) => !v) : onConnect()}
                className={cn(
                    "group flex h-9 w-full items-center gap-2.5 px-3 text-foreground transition-colors select-none",
                    "hover:bg-surface-3",
                )}
            >
                <span className="text-foreground/38 shrink-0 w-3">
                    {isConnected
                        ? open ? <ChevronDown size={11} /> : <ChevronRight size={11} />
                        : <ChevronRight size={11} />}
                </span>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center border border-border-subtle bg-surface-3">
                    <Logo className={cn("text-[14px] shrink-0", logoColor)} />
                </div>
                <span className="text-[13px] font-semibold flex-1 text-left truncate min-w-0">
                    {connection.name}
                </span>
                {connection.group && (() => {
                    const preset = GROUP_PRESETS.find(p => p.id === connection.group);
                    return (
                        <span className={cn(
                            "shell-badge shrink-0 px-1.5",
                            preset ? preset.activeClass : "bg-muted/50 border-border/50 text-muted-foreground/60"
                        )}>
                            {connection.group}
                        </span>
                    );
                })()}
                {connection.safetyMode && connection.safetyMode !== "none" && (
                    <span className={cn(
                        "shell-badge shrink-0 px-1.5 flex items-center gap-0.5",
                        connection.safetyMode === "read-only"
                            ? "bg-destructive/12 border-destructive/30 text-destructive"
                            : "bg-accent-orange/12 border-accent-orange/30 text-accent-orange"
                    )}>
                        <ShieldAlert size={9} />
                        {connection.safetyMode === "read-only" ? "RO" : "WARN"}
                    </span>
                )}
                {isLoading && <Loader2 size={10} className="animate-spin text-foreground/40 shrink-0" />}
                {!isConnected && !isLoading && (
                    <Plug size={10} className="text-foreground/56 shrink-0 group-hover:text-primary/70 transition-colors" />
                )}
                {isConnected && !isLoading && latencyMs !== undefined && (
                    <span className={cn(
                        "shrink-0 text-[9px] font-mono tabular-nums px-1 rounded",
                        latencyMs === null
                            ? "text-destructive/70 bg-destructive/10"
                            : latencyMs < 50
                                ? "text-success/80 bg-success/10"
                                : latencyMs < 200
                                    ? "text-warning/80 bg-warning/10"
                                    : "text-destructive/70 bg-destructive/10",
                    )}>
                        {latencyMs === null ? "⚠" : `${latencyMs}ms`}
                    </span>
                )}
            </button>
            {/* Tables header */}
            {isConnected && open && (
                <div className="shell-toolbar flex h-8 shrink-0 items-center gap-1.5 border-y px-2.5">
                    <TableProperties size={12} className="shrink-0 text-foreground/35" />
                    <span className="shell-section-label flex-1 text-foreground/58">
                        Tables
                    </span>
                    {!isLoading && tableFns.length > 0 && (
                        <span className="text-[11px] font-mono text-foreground/42 tabular-nums mr-0.5">
                            {filter.trim() ? `${filtered.length}/` : ""}{tableFns.length}
                        </span>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                aria-label="Add table"
                                onClick={() => setAddTableOpen(true)}
                                className="shell-icon-button flex h-5 w-5 items-center justify-center text-foreground/40 transition-colors hover:bg-surface-3 hover:text-foreground"
                            >
                                <Plus size={11} />
                            </button>
                        </TooltipTrigger>
                        <TooltipContent side="right" sideOffset={4}>Add table</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <button
                                aria-label="Refresh tables"
                                onClick={handleRefreshTables}
                                disabled={isRefreshingTables}
                                className="shell-icon-button flex h-5 w-5 items-center justify-center text-foreground/40 transition-colors hover:bg-surface-3 hover:text-foreground disabled:opacity-40"
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
                                    aria-label={expandAll === true ? "Collapse all" : "Expand all"}
                                    onClick={() => setExpandAll((v) => v === true ? false : true)}
                                    className="shell-icon-button flex h-5 w-5 items-center justify-center text-foreground/40 transition-colors hover:bg-surface-3 hover:text-foreground"
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
                                    aria-label="Dump database"
                                    onClick={() => setShowDumpDialog(true)}
                                    disabled={dumpDbLoading}
                                    className="shell-icon-button flex h-5 w-5 items-center justify-center text-foreground/40 transition-colors hover:bg-surface-3 hover:text-foreground disabled:opacity-40"
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
            {/* Rename table dialog */}
            <Dialog open={!!renameTarget} onOpenChange={(o) => { if (!o) setRenameTarget(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Rename table</DialogTitle></DialogHeader>
                    <Input
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") executeRename(); }}
                        className="mt-2"
                        autoFocus
                    />
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setRenameTarget(null)}>Cancel</Button>
                        <Button size="sm" onClick={executeRename} disabled={renameLoading || !renameValue.trim()}>
                            {renameLoading ? "Renaming…" : "Rename"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Drop table confirm dialog */}
            <Dialog open={!!dropTarget} onOpenChange={(o) => { if (!o) setDropTarget(null); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader><DialogTitle>Drop table?</DialogTitle></DialogHeader>
                    <p className="text-sm text-muted-foreground">
                        This will permanently delete <span className="font-mono font-semibold text-foreground">{dropTarget}</span> and all its data. This action cannot be undone.
                    </p>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setDropTarget(null)}>Cancel</Button>
                        <Button variant="destructive" size="sm" onClick={executeDrop} disabled={dropLoading}>
                            {dropLoading ? "Dropping…" : "Drop table"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* Tree */}
            {isConnected && open && (
                <div className="px-1.5 pb-1.5 pt-1">
                    {isLoading ? (
                        <div className="flex items-center gap-2 px-4 py-2">
                            <Loader2 size={10} className="animate-spin text-foreground/36" />
                            <span className="text-[11px] font-mono text-foreground/45">Loading…</span>
                        </div>
                    ) : tableFns.length === 0 ? (
                        <p className="px-4 py-2 text-[11px] font-mono text-foreground/42">
                            No tables
                        </p>
                    ) : filtered.length === 0 ? (
                        <p className="px-4 py-2 text-[11px] font-mono text-foreground/42">
                            No match
                        </p>
                    ) : (
                        <div className="w-full min-w-0 overflow-hidden px-1 pb-1">
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
                                    pinnedTableNames={pinnedTableNames}
                                    onPinToggle={onPinToggle}
                                    onTableAction={handleTableAction}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
// ── Saved Connections List (shown when activeView === "new-connection") ────────
function SavedConnectionsList({
    connections,
    connectedIds,
    onEditConnection,
}: {
    connections: ConnectionConfig[];
    connectedIds: string[];
    onEditConnection: (conn: ConnectionConfig) => void;
}) {
    return (
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Header */}
            <div className="shell-toolbar flex h-10 shrink-0 items-center border-b px-4">
                <span className="shell-section-label text-foreground/58">Saved Connections</span>
            </div>
            {connections.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4 pb-10 text-center">
                    <p className="text-[11px] font-mono text-foreground/44">No saved connections</p>
                </div>
            ) : (
                <ScrollArea className="flex-1 min-h-0">
                    <div className="px-2 py-2 flex flex-col gap-0.5">
                        {connections.map((conn) => {
                            const isConnected = connectedIds.includes(conn.id);
                            const group = GROUP_PRESETS.find((g) => g.id === conn.group);
                            const DbLogo = DB_LOGO[conn.type] ?? DB_LOGO.postgresql;
                            const logoColor = DB_COLOR[conn.type] ?? "text-muted-foreground";
                            const hostDisplay =
                                conn.type === "sqlite"
                                    ? (conn.database ?? "local.sqlite")
                                    : conn.type === "mongodb"
                                        ? (conn.host
                                            ? `${conn.host}:${conn.port ?? 27017}`
                                            : "localhost:27017")
                                        : conn.type === "redis"
                                            ? `${conn.host ?? "localhost"}:${conn.port ?? 6379}`
                                            : `${conn.host ?? "localhost"}:${conn.port ?? 5432}`;
                            return (
                                <button
                                    key={conn.id}
                                    onClick={() => onEditConnection(conn)}
                                    className="group w-full rounded px-2.5 py-2 text-left transition-colors hover:bg-surface-2 border border-transparent hover:border-border-subtle"
                                >
                                    <div className="flex items-center justify-between gap-1.5 mb-0.5">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <DbLogo className={cn("shrink-0 text-[13px]", logoColor)} />
                                            <span className="text-[12px] font-semibold text-foreground truncate">
                                                {conn.name}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            {isConnected && (
                                                <CircleDot size={7} className="text-primary shrink-0" />
                                            )}
                                            {group && (
                                                <span
                                                    className={cn(
                                                        "text-[9px] font-bold uppercase tracking-[0.08em] px-1 py-0.5 rounded border",
                                                        group.activeClass,
                                                    )}
                                                >
                                                    {group.label.slice(0, 3)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="block truncate font-mono text-[10px] text-foreground/42">
                                        {hostDisplay}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </ScrollArea>
            )}
        </div>
    );
}
// ── Main Sidebar Panel ─────────────────────────────────────────────────────────
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
        setActiveView,
        setEditingConnection,
        setConnectionDialogOpen,
        addConnection,
        activeView,
        dbTabsCollapsed,
        toggleDbTabs,
        pinnedTables,
        pinTable,
        unpinTable,
        connectionLatency,
        pingConnectionHealth,
    } = useAppStore();
    const [filter, setFilter] = useState("");
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
    const [importExportOpen, setImportExportOpen] = useState(false);
    const [healthOpen, setHealthOpen] = useState(false);
    const [dropDbConfirm, setDropDbConfirm] = useState<string | null>(null);
    const [dropConfirmInput, setDropConfirmInput] = useState("");
    const [droppingDb, setDroppingDb] = useState(false);

    // Ping connected connections every 30 seconds for health monitoring
    useEffect(() => {
        if (connectedIds.length === 0) return;
        const run = () => connectedIds.forEach((id) => pingConnectionHealth(id));
        run(); // immediate ping on mount/change
        const interval = setInterval(run, 30_000);
        return () => clearInterval(interval);
    }, [connectedIds, pingConnectionHealth]);
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

    // ── New-connection mode: show saved connections list in sidebar ──
    if (activeView === "new-connection") {
        return (
            <div className="flex h-full min-h-0 overflow-hidden bg-surface-1">
                <SavedConnectionsList
                    connections={connections}
                    connectedIds={connectedIds}
                    onEditConnection={(conn) => {
                        setEditingConnection(conn);
                        setConnectionDialogOpen(true);
                    }}
                />
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 overflow-hidden bg-surface-1">
            {/* ── Left: open database tabs ── */}
            {activeDatabases.length > 0 && activeConn && (
                <div
                    style={{ width: dbTabsCollapsed ? 0 : 88 }}
                    className="shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out"
                >
                    <div className="flex h-full w-[88px] flex-col gap-1.5 overflow-y-auto border-r border-border-subtle bg-surface-1 px-2 py-2">
                    {activeDatabases.map((db) => {
                        const isActive = db === selectedDb;
                        const DbLogo = DB_LOGO[activeConn.type] ?? DB_LOGO.postgresql;
                        const logoColor = DB_COLOR[activeConn.type] ?? "text-muted-foreground";
                        return (
                            <div key={db} className="flex flex-col">
                                <ContextMenu>
                                    <Tooltip delayDuration={600}>
                                        <ContextMenuTrigger asChild>
                                            <TooltipTrigger asChild>
                                                <button
                                                    aria-label={`Select database ${db}`}
                                                    onClick={() => selectDatabase(activeConn.id, db)}
                                                    className={cn(
                                                        "group relative flex w-full shrink-0 flex-col items-center gap-1.5 border px-2 py-3 transition-[color,background-color,border-color]",
                                                        isActive
                                                            ? "border-border-subtle bg-surface-elevated text-foreground"
                                                            : "border-transparent bg-surface-2 text-foreground/50 hover:border-border/55 hover:bg-surface-3 hover:text-foreground/72"
                                                    )}
                                                >
                                                    {/* Icon container */}
                                                    <div className={cn(
                                                        "flex h-8 w-8 items-center justify-center border border-transparent transition-colors",
                                                        isActive
                                                            ? "border-border-subtle bg-surface-2"
                                                            : "bg-transparent group-hover:bg-surface-3"
                                                    )}>
                                                        <DbLogo className={cn(
                                                            "text-[18px] shrink-0 transition-colors",
                                                            isActive ? logoColor : "text-foreground/36 group-hover:text-foreground/56"
                                                        )} />
                                                    </div>
                                                    {/* DB label */}
                                                    <span className={cn(
                                                        "w-full truncate px-1 text-center text-[11px] font-mono leading-tight transition-colors",
                                                        isActive
                                                            ? "text-foreground/82"
                                                            : "text-foreground/42 group-hover:text-foreground/62"
                                                    )}>
                                                        {db}
                                                    </span>
                                                </button>
                                            </TooltipTrigger>
                                        </ContextMenuTrigger>
                                        <TooltipContent side="right" sideOffset={6} className="font-mono text-[11px]">
                                            {db}
                                        </TooltipContent>
                                    </Tooltip>
                                    <ContextMenuContent className="w-44">
                                        <ContextMenuLabel className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground/50 truncate">
                                            {db}
                                        </ContextMenuLabel>
                                        <ContextMenuSeparator />
                                        <ContextMenuItem onSelect={() => {
                                            refreshTables(activeConn.id, db);
                                            if (selectedDb !== db) selectDatabase(activeConn.id, db);
                                        }}>
                                            <RefreshCw size={11} className="shrink-0 text-muted-foreground/60" />
                                            Refresh DB
                                        </ContextMenuItem>
                                        <ContextMenuItem onSelect={() => closeOpenDatabase(activeConn.id, db)}>
                                            <XCircle size={11} className="shrink-0 text-muted-foreground/60" />
                                            Close DB
                                        </ContextMenuItem>
                                        <ContextMenuSeparator />
                                        <ContextMenuItem
                                            variant="destructive"
                                            onSelect={() => {
                                                setDropConfirmInput("");
                                                setDropDbConfirm(db);
                                            }}
                                        >
                                            <Trash2 size={11} className="shrink-0" />
                                            Drop Database
                                        </ContextMenuItem>
                                    </ContextMenuContent>
                                </ContextMenu>
                            </div>
                        );
                    })}
                </div>
                </div>
            )}
            {/* ── Right: main content ── */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {/* ── Header ── */}
                    <div className="shell-toolbar flex h-10 shrink-0 items-center justify-between border-b px-4">
                    <span className="shell-section-label text-foreground/58">
                         Explorer
                     </span>
                    <div className="flex items-center gap-1">
                        {loadingIds.size > 0 && (
                            <Loader2 size={10} className="animate-spin text-foreground/40" />
                        )}
                        {activeDatabases.length > 0 && activeConn && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon-xs"
                                        aria-label={dbTabsCollapsed ? "Show database tabs" : "Hide database tabs"}
                                        onClick={toggleDbTabs}
                                        className="text-foreground/48 hover:text-foreground"
                                    >
                                        {dbTabsCollapsed
                                            ? <PanelLeftOpen size={14} />
                                            : <PanelLeftClose size={14} />
                                        }
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" sideOffset={4}>
                                    {dbTabsCollapsed ? "Show database tabs" : "Hide database tabs"}
                                </TooltipContent>
                            </Tooltip>
                        )}
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    aria-label="Import / Export"
                                    onClick={() => setImportExportOpen(true)}
                                    className="text-foreground/48 hover:text-foreground"
                                >
                                    <ArrowUpDown size={14} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={4}>Import / Export</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setEditingConnection(null);
                                        setActiveView("new-connection");
                                    }}
                                    className="h-7 gap-1.5 rounded-sm border-border-subtle bg-surface-2 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground/72 hover:bg-surface-3 hover:text-foreground"
                                >
                                    <Plus size={12} />
                                    Add
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" sideOffset={4}>New connection</TooltipContent>
                        </Tooltip>
                    </div>
                </div>
                {/* ── Filter ── */}
                {connections.length > 0 && (
                    <div className="shrink-0 border-b border-border-subtle bg-surface-1 px-3 py-2">
                        <div className="relative">
                            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground/36 pointer-events-none" />
                            <Input
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                placeholder="Filter tables…"
                                className="h-8 border-border-subtle bg-surface-2 pl-8 pr-3 text-[12px] font-mono placeholder:text-foreground/38 focus-visible:border-primary/35 focus-visible:ring-0"
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
                            <p className="text-[11px] font-bold text-foreground/50 uppercase tracking-[0.16em]">
                                No connections
                            </p>
                            <p className="text-[11px] text-foreground/62">
                                Add a database to get started
                            </p>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => { setEditingConnection(null); setActiveView("new-connection"); }}
                            className="h-7 text-[11px] font-semibold uppercase tracking-[0.12em] gap-1.5"
                        >
                            <Plus size={11} />
                            Add Connection
                        </Button>
                    </div>
                ) : (
                    <ScrollArea className="flex-1 min-h-0">
                        <div className="px-3 py-3">
                            {activeConn ? (() => {
                                const conn = activeConn;
                                const fns = connectionFunctions[conn.id] ?? [];
                                const tableFns = fns.filter((f) => f.type === "table");
                                const tables = connectionTables[conn.id] ?? [];
                                const tableInfoMap: Record<string, ColumnInfo[]> =
                                    Object.fromEntries(tables.map((t) => [t.name, t.columns ?? []]));
                                const connPinnedNames = new Set(
                                    pinnedTables
                                        .filter((p) => p.connectionId === conn.id)
                                        .map((p) => p.tableName)
                                );
                                return (
                                    <>
                                    {/* Pinned tables section */}
                                    {connPinnedNames.size > 0 && (
                                        <div className="mb-2">
                                            <div className="flex items-center gap-1.5 px-1 pb-1">
                                                <Pin size={9} className="text-primary/50 shrink-0" />
                                                <span className="text-[9px] font-bold uppercase tracking-widest text-foreground/40">Pinned</span>
                                            </div>
                                            <div className="w-full min-w-0 overflow-hidden px-1">
                                                {tableFns
                                                    .filter((f) => connPinnedNames.has(f.tableName ?? ""))
                                                    .map((fn) => (
                                                        <TableRow
                                                            key={`pinned-${fn.id}`}
                                                            fn={fn}
                                                            columns={tableInfoMap[fn.tableName ?? ""] ?? []}
                                                            isActive={activeFunction?.id === fn.id}
                                                            onInvoke={handleInvoke}
                                                            onLoadColumns={() => loadTableColumns(conn.id, fn.tableName ?? "")}
                                                            isPinned={true}
                                                            onPinToggle={() => unpinTable(conn.id, fn.tableName ?? "")}
                                                        />
                                                    ))}
                                            </div>
                                        </div>
                                    )}
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
                                        pinnedTableNames={connPinnedNames}
                                        onPinToggle={(tableName) => {
                                            if (connPinnedNames.has(tableName)) unpinTable(conn.id, tableName);
                                            else pinTable(conn.id, tableName);
                                        }}
                                        latencyMs={connectionLatency[conn.id]}
                                    />
                                    </>
                                );
                            })() : (
                                <div className="flex flex-col items-center justify-center gap-3 py-8 px-4 text-center">
                                    <p className="text-[11px] font-mono text-foreground/44">No active connection</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                )}
                {/* ── Status Footer ── always pinned to bottom */}
                <div className="relative">
                    {healthOpen && <ConnectionHealthPanel onClose={() => setHealthOpen(false)} />}
                    <div className="shell-toolbar flex h-9 shrink-0 items-center gap-2 overflow-hidden border-t px-4">
                        <CircleDot
                            size={8}
                            className={cn("shrink-0", connectedIds.length > 0 ? "text-primary" : "text-foreground/42")}
                        />
                        <span className="text-[11px] font-mono shrink-0 whitespace-nowrap">
                            <span className={connectedIds.length > 0 ? "text-primary" : "text-foreground/58"}>{connectedIds.length}</span>
                            <span className="text-foreground/52">/{connections.length} conn</span>
                        </span>
                        <span className="text-foreground/36 shrink-0">·</span>
                        <HardDrive size={8} className="shrink-0 text-foreground/42" />
                        <span className="text-[11px] font-mono truncate text-foreground/62 min-w-0">
                            {currentDb ?? <span className="text-foreground/38">no db</span>}
                        </span>
                        <button
                            onClick={() => setHealthOpen((v) => !v)}
                            className={cn(
                                "ml-auto shrink-0 rounded p-1 transition-colors",
                                healthOpen
                                    ? "text-primary bg-primary/10"
                                    : "text-foreground/36 hover:text-foreground/70 hover:bg-surface-3",
                            )}
                            title="Connection health"
                        >
                            <Activity size={10} />
                        </button>
                    </div>
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
                                {droppingDb ? "Dropping\u2026" : "Drop Database"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
};
export default Sidebar;

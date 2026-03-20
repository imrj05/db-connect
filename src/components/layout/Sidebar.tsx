import { useState, useMemo } from "react";
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
    ChevronsUpDown,
} from "lucide-react";
import {
    SiPostgresql,
    SiMysql,
    SiSqlite,
    SiMongodb,
    SiRedis,
} from "react-icons/si";
import { useAppStore } from "@/store/useAppStore";
import { ConnectionConfig, ConnectionFunction, ColumnInfo } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// ── DB type logos ──────────────────────────────────────────────────────────────
const DB_LOGO: Record<string, React.FC<{ className?: string }>> = {
    postgresql: ({ className }) => <SiPostgresql className={className} />,
    mysql:      ({ className }) => <SiMysql      className={className} />,
    sqlite:     ({ className }) => <SiSqlite     className={className} />,
    mongodb:    ({ className }) => <SiMongodb    className={className} />,
    redis:      ({ className }) => <SiRedis      className={className} />,
};

const DB_COLOR: Record<string, string> = {
    postgresql: "text-blue-400",
    mysql:      "text-cyan-400",
    sqlite:     "text-slate-400",
    mongodb:    "text-emerald-400",
    redis:      "text-red-400",
};

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

// ── Table row ──────────────────────────────────────────────────────────────────
function TableRow({
    fn,
    columns,
    isActive,
    onInvoke,
}: {
    fn: ConnectionFunction;
    columns: ColumnInfo[];
    isActive: boolean;
    onInvoke: (fn: ConnectionFunction) => void;
}) {
    const [open, setOpen] = useState(false);

    return (
        <div>
            <button
                onClick={() => onInvoke(fn)}
                className={cn(
                    "group w-full flex items-center gap-1.5 h-[26px] pr-2 pl-0 transition-colors",
                    isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground/70 hover:bg-muted/50 hover:text-foreground",
                )}
            >
                {/* expand chevron */}
                <span
                    className="flex items-center justify-center w-5 h-full shrink-0 text-muted-foreground/30 hover:text-muted-foreground/60"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (columns.length > 0) setOpen((v) => !v);
                    }}
                >
                    {columns.length > 0
                        ? open
                            ? <ChevronDown size={10} />
                            : <ChevronRight size={10} />
                        : <span className="w-2" />}
                </span>

                <Table2
                    size={12}
                    className={cn(
                        "shrink-0",
                        isActive ? "text-primary/80" : "text-blue-400/70",
                    )}
                />
                <span
                    className={cn(
                        "text-[11px] font-mono truncate flex-1 text-left",
                        isActive && "font-semibold",
                    )}
                >
                    {fn.tableName}
                </span>
            </button>

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
}: {
    schema: string;
    fns: ConnectionFunction[];
    tableInfoMap: Record<string, ColumnInfo[]>;
    activeFunctionId?: string;
    onInvoke: (fn: ConnectionFunction) => void;
    showLabel: boolean;
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
                        : <Folder     size={11} className="shrink-0 text-muted-foreground/30" />}
                    <span className="text-[10px] font-mono flex-1 text-left">{schema}</span>
                    <span className="text-[9px] font-mono text-muted-foreground/70">{fns.length}</span>
                </button>
            )}

            {open && (
                <div className={showLabel ? "pl-4" : ""}>
                    {fns.map((fn) => (
                        <TableRow
                            key={fn.id}
                            fn={fn}
                            columns={tableInfoMap[fn.tableName ?? ""] ?? []}
                            isActive={activeFunctionId === fn.id}
                            onInvoke={onInvoke}
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
    databases,
    selectedDb,
    onConnect,
    onInvoke,
    onSelectDb,
}: {
    connection: ConnectionConfig;
    isConnected: boolean;
    isLoading: boolean;
    tableFns: ConnectionFunction[];
    tableInfoMap: Record<string, ColumnInfo[]>;
    activeFunctionId?: string;
    filter: string;
    databases: string[];
    selectedDb?: string;
    onConnect: () => void;
    onInvoke: (fn: ConnectionFunction) => void;
    onSelectDb: (db: string) => void;
}) {
    const [open, setOpen] = useState(true);
    const [dbPickerOpen, setDbPickerOpen] = useState(false);
    const [dbSearch, setDbSearch] = useState("");

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
                <span className="text-[12px] font-mono font-semibold flex-1 text-left truncate">
                    {connection.name}
                </span>
                {isLoading && <Loader2 size={10} className="animate-spin text-muted-foreground/40 shrink-0" />}
                {!isConnected && !isLoading && (
                    <Plug size={10} className="text-muted-foreground/70 shrink-0 group-hover:text-primary/60 transition-colors" />
                )}
            </button>

            {/* DB picker */}
            {isConnected && open && databases.length > 0 && (
                <div className="px-2 py-1 border-b border-border/40">
                    <Popover open={dbPickerOpen} onOpenChange={(v) => { setDbPickerOpen(v); if (!v) setDbSearch(""); }}>
                        <PopoverTrigger asChild>
                            <button className={cn(
                                "w-full flex items-center gap-1.5 h-7 px-2.5 text-[11px] font-mono border transition-colors",
                                "bg-background border-border text-foreground/70",
                                "hover:border-primary/60 hover:text-foreground",
                                dbPickerOpen && "border-primary/60 text-foreground",
                            )}>
                                <Database size={10} className="shrink-0 text-muted-foreground/50" />
                                <span className="flex-1 text-left truncate">
                                    {selectedDb
                                        ? <span className="text-foreground">{selectedDb}</span>
                                        : <span className="text-muted-foreground/40">Select database…</span>
                                    }
                                </span>
                                <ChevronsUpDown size={10} className="shrink-0 text-muted-foreground/40" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent
                            side="right"
                            align="start"
                            sideOffset={8}
                            className="w-52 p-0 rounded-none border border-primary/30 bg-card shadow-none ring-0"
                        >
                            {/* search input */}
                            <div className={cn(
                                "flex items-center gap-2 px-3 h-9 border-b border-border",
                                "focus-within:border-primary/50 transition-colors",
                            )}>
                                <Search size={11} className="shrink-0 text-primary/50" />
                                <input
                                    autoFocus
                                    value={dbSearch}
                                    onChange={(e) => setDbSearch(e.target.value)}
                                    placeholder="Search databases…"
                                    className="flex-1 bg-transparent text-[11px] font-mono text-foreground placeholder:text-muted-foreground/35 outline-none caret-primary"
                                />
                            </div>
                            {/* list */}
                            <div className="max-h-52 overflow-y-auto py-1">
                                {databases
                                    .filter((db) => db.toLowerCase().includes(dbSearch.toLowerCase()))
                                    .map((db) => (
                                        <button
                                            key={db}
                                            onClick={() => { onSelectDb(db); setDbPickerOpen(false); setDbSearch(""); }}
                                            className={cn(
                                                "w-full flex items-center gap-2 h-7 px-3 text-[11px] font-mono transition-colors text-left",
                                                db === selectedDb
                                                    ? "bg-primary/10 text-primary"
                                                    : "text-foreground/70 hover:bg-muted/60 hover:text-foreground",
                                            )}
                                        >
                                            {db === selectedDb
                                                ? <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                                : <span className="w-1.5 h-1.5 shrink-0" />
                                            }
                                            <span className="truncate">{db}</span>
                                        </button>
                                    ))}
                                {databases.filter((db) => db.toLowerCase().includes(dbSearch.toLowerCase())).length === 0 && (
                                    <p className="px-3 py-3 text-[10px] font-mono text-muted-foreground/40 text-center">No match</p>
                                )}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
            )}

            {/* Tree */}
            {isConnected && open && (
                <div className="pb-1">
                    {isLoading ? (
                        /* actively connecting — show spinner */
                        <div className="flex items-center gap-2 px-4 py-2">
                            <Loader2 size={10} className="animate-spin text-muted-foreground/30" />
                            <span className="text-[10px] font-mono text-muted-foreground/30">Loading…</span>
                        </div>
                    ) : tableFns.length === 0 ? (
                        /* connected but genuinely no tables */
                        <p className="px-4 py-2 text-[10px] font-mono text-muted-foreground/30">
                            No tables
                        </p>
                    ) : filtered.length === 0 ? (
                        /* tables exist but filter has no match */
                        <p className="px-4 py-2 text-[10px] font-mono text-muted-foreground/30">
                            No match
                        </p>
                    ) : (
                        <div className="pl-2">
                            {schemaKeys.map((schema) => (
                                <SchemaGroup
                                    key={schema}
                                    schema={schema}
                                    fns={bySchema[schema]}
                                    tableInfoMap={tableInfoMap}
                                    activeFunctionId={activeFunctionId}
                                    onInvoke={onInvoke}
                                    showLabel={showSchemaLabels}
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
        connectionDatabases,
        selectedDatabases,
        activeFunction,
        connectAndInit,
        selectDatabase,
        invokeFunction,
        setActiveFunctionOnly,
        setConnectionDialogOpen,
        setEditingConnection,
    } = useAppStore();

    const [filter, setFilter] = useState("");
    const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

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

    // derive current db info from active function
    const activeConn = useMemo(() => {
        if (!activeFunction) return null;
        return connections.find((c) => c.id === activeFunction.connectionId) ?? null;
    }, [activeFunction, connections]);

    const currentDb = useMemo(() => {
        if (!activeFunction) return null;
        return selectedDatabases[activeFunction.connectionId]
            ?? activeConn?.database
            ?? null;
    }, [activeFunction, activeConn, selectedDatabases]);

    const handleInvoke = (fn: ConnectionFunction) => {
        if (fn.type === "query" || fn.type === "execute") {
            setActiveFunctionOnly(fn);
        } else {
            invokeFunction(fn);
        }
    };

    return (
        <div className="h-full flex flex-col bg-sidebar border-r border-sidebar-border overflow-hidden min-h-0">

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
                        {connections.map((conn) => {
                            const fns = connectionFunctions[conn.id] ?? [];
                            const tableFns = fns.filter((f) => f.type === "table");
                            const tables = connectionTables[conn.id] ?? [];

                            // build tableInfoMap: tableName → ColumnInfo[]
                            const tableInfoMap: Record<string, ColumnInfo[]> =
                                Object.fromEntries(
                                    tables.map((t) => [t.name, t.columns ?? []]),
                                );

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
                                    databases={connectionDatabases[conn.id] ?? []}
                                    selectedDb={selectedDatabases[conn.id]}
                                    onConnect={() => handleConnect(conn.id)}
                                    onInvoke={handleInvoke}
                                    onSelectDb={(db) => selectDatabase(conn.id, db)}
                                />
                            );
                        })}
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
        </div>
    );
};

export default Sidebar;

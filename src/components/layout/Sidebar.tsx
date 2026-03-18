import { useState, useMemo } from "react";
import {
    ChevronDown,
    ChevronRight,
    ChevronsUpDown,
    Plus,
    Loader2,
    Plug,
    Unplug,
    Pencil,
    Search,
    Table2,
    Zap,
    Database,
    Check,
    TerminalSquare,
    ListTree,
} from "lucide-react";
import {
    SiPostgresql,
    SiMysql,
    SiSqlite,
    SiMongodb,
    SiRedis,
} from "react-icons/si";
import { useAppStore } from "@/store/useAppStore";
import { ConnectionConfig, ConnectionFunction } from "@/types";
import { cn } from "@/lib/utils";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";

// ── DB type logos ──────────────────────────────────────────────────────────────

const DB_LOGO: Record<string, React.FC<{ className?: string }>> = {
    postgresql: ({ className }) => <SiPostgresql className={className} />,
    mysql:      ({ className }) => <SiMysql      className={className} />,
    sqlite:     ({ className }) => <SiSqlite     className={className} />,
    mongodb:    ({ className }) => <SiMongodb    className={className} />,
    redis:      ({ className }) => <SiRedis      className={className} />,
};

const DB_COLOR: Record<string, string> = {
    postgresql: "text-blue-500",
    mysql:      "text-cyan-500",
    sqlite:     "text-slate-400",
    mongodb:    "text-emerald-500",
    redis:      "text-red-500",
};

// Left-border accent color for expanded tree (per db type)
const DB_TREE_BORDER: Record<string, string> = {
    postgresql: "border-blue-500/30",
    mysql:      "border-cyan-500/30",
    sqlite:     "border-slate-400/30",
    mongodb:    "border-emerald-500/30",
    redis:      "border-red-500/30",
};

// Subtle bg tint for expanded tree
const DB_TREE_BG: Record<string, string> = {
    postgresql: "bg-blue-500/[0.03]",
    mysql:      "bg-cyan-500/[0.03]",
    sqlite:     "bg-slate-400/[0.03]",
    mongodb:    "bg-emerald-500/[0.03]",
    redis:      "bg-red-500/[0.03]",
};

// ── Section label ──────────────────────────────────────────────────────────────

function SectionLabel({ label, count }: { label: string; count?: number }) {
    return (
        <div className="flex items-center gap-2 px-2 pt-2 pb-1">
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground/35">
                {label}
            </span>
            {count !== undefined && (
                <span className="text-[9px] font-mono text-muted-foreground/25">
                    {count}
                </span>
            )}
        </div>
    );
}

// ── Table row (compact, TablePlus style) ───────────────────────────────────────

function TableRow({
    fn,
    isActive,
    onInvoke,
}: {
    fn: ConnectionFunction;
    isActive: boolean;
    onInvoke: (fn: ConnectionFunction) => void;
}) {
    return (
        <button
            onClick={() => onInvoke(fn)}
            className={cn(
                "group w-full flex items-center gap-2 h-6 pl-2 pr-2 transition-colors relative",
                isActive
                    ? "bg-primary/8 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
        >
            <Table2
                size={11}
                className={cn(
                    "shrink-0",
                    isActive ? "text-primary/70" : "text-muted-foreground/40",
                )}
            />
            <span
                className={cn(
                    "text-[11px] font-mono truncate flex-1 text-left",
                    isActive ? "text-primary font-semibold" : "",
                )}
            >
                {fn.tableName}
            </span>
        </button>
    );
}

// ── Quick-access function row (query / execute) ────────────────────────────────

function QuickFnRow({
    fn,
    isActive,
    onInvoke,
}: {
    fn: ConnectionFunction;
    isActive: boolean;
    onInvoke: (fn: ConnectionFunction) => void;
}) {
    const Icon = fn.type === "execute" ? TerminalSquare : Zap;
    const label =
        fn.type === "query"   ? "SQL Query"
      : fn.type === "execute" ? "SQL Execute"
      : fn.name.slice(fn.prefix.length + 1);

    return (
        <button
            onClick={() => onInvoke(fn)}
            className={cn(
                "group w-full flex items-center gap-2 h-6 pl-2 pr-2 transition-colors",
                isActive
                    ? "bg-primary/8 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
        >
            <Icon
                size={11}
                className={cn(
                    "shrink-0",
                    isActive
                        ? "text-primary/70"
                        : fn.type === "execute"
                          ? "text-accent-orange/50"
                          : "text-accent-green/50",
                )}
            />
            <span className="text-[11px] font-mono truncate flex-1 text-left">
                {label}
            </span>
        </button>
    );
}

// ── Database selector ──────────────────────────────────────────────────────────

function DatabaseSelector({
    databases,
    selected,
    onSelect,
}: {
    databases: string[];
    selected: string | undefined;
    onSelect: (db: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const displayDbs =
        databases.length > 0 ? databases : selected ? [selected] : [];
    if (displayDbs.length === 0) return null;
    const current = selected ?? displayDbs[0];

    return (
        <div className="px-2 pt-1.5 pb-1" onClick={(e) => e.stopPropagation()}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button
                        className={cn(
                            "group w-full flex items-center gap-1.5 h-6 px-2 rounded-md transition-colors",
                            "bg-muted/40 hover:bg-muted border border-border/40 hover:border-border/70",
                        )}
                    >
                        <div className="size-1.5 rounded-full bg-primary/50 shrink-0" />
                        <span className="flex-1 text-left text-[10px] font-mono text-muted-foreground/70 truncate">
                            {current}
                        </span>
                        <ChevronsUpDown
                            size={9}
                            className="text-muted-foreground/30 shrink-0 group-hover:text-muted-foreground/50 transition-colors"
                        />
                    </button>
                </PopoverTrigger>

                <PopoverContent
                    align="start"
                    sideOffset={4}
                    className="w-48 p-1 shadow-md"
                >
                    <div className="max-h-48 overflow-y-auto">
                        {displayDbs.map((db) => {
                            const isSelected = db === current;
                            return (
                                <button
                                    key={db}
                                    onClick={() => {
                                        onSelect(db);
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        "w-full flex items-center gap-2 h-7 px-2 rounded-md text-[11px] font-mono transition-colors text-left",
                                        isSelected
                                            ? "bg-primary/8 text-primary font-semibold"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground",
                                    )}
                                >
                                    <Check
                                        size={10}
                                        className={cn(
                                            "shrink-0 transition-opacity",
                                            isSelected ? "opacity-100 text-primary" : "opacity-0",
                                        )}
                                    />
                                    <span className="truncate">{db}</span>
                                </button>
                            );
                        })}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}

// ── Connection node ────────────────────────────────────────────────────────────

function ConnectionNode({
    connection,
    isConnected,
    isExpanded,
    functions,
    databases,
    selectedDatabase,
    activeFunctionId,
    isLoading,
    onToggleExpand,
    onConnect,
    onDisconnect,
    onEdit,
    onInvoke,
    onSelectDatabase,
}: {
    connection: ConnectionConfig;
    isConnected: boolean;
    isExpanded: boolean;
    functions: ConnectionFunction[];
    databases: string[];
    selectedDatabase: string | undefined;
    activeFunctionId?: string;
    isLoading: boolean;
    onToggleExpand: () => void;
    onConnect: () => void;
    onDisconnect: () => void;
    onEdit: () => void;
    onInvoke: (fn: ConnectionFunction) => void;
    onSelectDatabase: (db: string) => void;
}) {
    const [tableFilter, setTableFilter] = useState("");

    const Logo = DB_LOGO[connection.type] ?? DB_LOGO.postgresql;
    const logoColor = DB_COLOR[connection.type] ?? "text-muted-foreground";
    const treeBorder = DB_TREE_BORDER[connection.type] ?? "border-border/30";
    const treeBg = DB_TREE_BG[connection.type] ?? "";

    // Partition functions
    const quickFns = functions.filter(
        (f) => f.type === "query" || f.type === "execute",
    );
    const tableFns = functions.filter((f) => f.type === "table");

    const filteredTables = useMemo(() => {
        const q = tableFilter.trim().toLowerCase();
        if (!q) return tableFns;
        return tableFns.filter((f) =>
            (f.tableName ?? "").toLowerCase().includes(q),
        );
    }, [tableFns, tableFilter]);

    return (
        <div className="border-b border-border/40">
            {/* ── Connection header ── */}
            <div
                role="button"
                onClick={onToggleExpand}
                className={cn(
                    "group relative flex items-center gap-2 h-8 px-2 cursor-pointer select-none transition-colors",
                    isExpanded ? "bg-muted/50" : "hover:bg-muted/40",
                )}
            >
                {/* DB type color stripe on left edge */}
                <span
                    className={cn(
                        "absolute left-0 top-0 bottom-0 w-0.5 rounded-r-full transition-opacity",
                        logoColor.replace("text-", "bg-"),
                        isExpanded ? "opacity-60" : "opacity-0 group-hover:opacity-30",
                    )}
                />

                {/* Expand chevron */}
                <span className="text-muted-foreground/40 shrink-0 w-3 ml-0.5">
                    {isExpanded ? (
                        <ChevronDown size={11} />
                    ) : (
                        <ChevronRight size={11} />
                    )}
                </span>

                {/* DB type logo */}
                <Logo className={cn("text-[14px] shrink-0", logoColor)} />

                {/* Name */}
                <div className="flex-1 min-w-0">
                    <span className="text-[12px] font-semibold text-foreground truncate leading-none block">
                        {connection.name}
                    </span>
                </div>

                {/* Hover actions */}
                <div
                    className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={onEdit}
                                className="size-5 text-muted-foreground/50 hover:text-foreground"
                            >
                                <Pencil size={10} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" sideOffset={4}>Edit</TooltipContent>
                    </Tooltip>

                    {isConnected ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={onDisconnect}
                                    className="size-5 text-muted-foreground/50 hover:text-destructive"
                                >
                                    <Unplug size={10} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" sideOffset={4}>Disconnect</TooltipContent>
                        </Tooltip>
                    ) : (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={onConnect}
                                    className="size-5 text-muted-foreground/50 hover:text-emerald-500"
                                >
                                    <Plug size={10} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top" sideOffset={4}>Connect</TooltipContent>
                        </Tooltip>
                    )}
                </div>

                {/* Status dot */}
                <span
                    className={cn(
                        "size-1.5 rounded-full shrink-0 transition-opacity",
                        isConnected
                            ? "bg-emerald-500 animate-pulse group-hover:opacity-0"
                            : "bg-muted-foreground/20 group-hover:opacity-0",
                    )}
                />
            </div>

            {/* ── Expanded tree ── */}
            {isExpanded && (
                <div className={cn("border-l-2 ml-3", treeBorder, treeBg)}>
                    {isConnected ? (
                        <>
                            {/* Database selector */}
                            <DatabaseSelector
                                databases={databases}
                                selected={selectedDatabase}
                                onSelect={onSelectDatabase}
                            />

                            {/* Quick-access functions (query / execute) */}
                            {quickFns.length > 0 && (
                                <>
                                    <SectionLabel label="Quick Access" />
                                    {quickFns.map((fn) => (
                                        <QuickFnRow
                                            key={fn.id}
                                            fn={fn}
                                            isActive={activeFunctionId === fn.id}
                                            onInvoke={onInvoke}
                                        />
                                    ))}
                                </>
                            )}

                            {/* Tables */}
                            {tableFns.length > 0 && (
                                <>
                                    <SectionLabel
                                        label="Tables"
                                        count={
                                            tableFilter
                                                ? filteredTables.length
                                                : tableFns.length
                                        }
                                    />

                                    {/* Filter input — visible when many tables */}
                                    {tableFns.length >= 5 && (
                                        <div className="px-2 pb-1">
                                            <div className="relative">
                                                <Search
                                                    size={10}
                                                    className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/30 pointer-events-none"
                                                />
                                                <Input
                                                    value={tableFilter}
                                                    onChange={(e) =>
                                                        setTableFilter(e.target.value)
                                                    }
                                                    placeholder="Filter tables..."
                                                    className="h-6 pl-6 pr-2 text-[10px] font-mono bg-muted/40 border-border/50 placeholder:text-muted-foreground/30"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {filteredTables.length === 0 ? (
                                        <p className="px-3 py-2 text-[10px] text-muted-foreground/40 font-mono">
                                            No tables match "{tableFilter}"
                                        </p>
                                    ) : (
                                        <div className="overflow-y-auto max-h-[45vh] pb-1 no-scrollbar">
                                            {filteredTables.map((fn) => (
                                                <TableRow
                                                    key={fn.id}
                                                    fn={fn}
                                                    isActive={activeFunctionId === fn.id}
                                                    onInvoke={onInvoke}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}

                            {/* Loading state while functions populate */}
                            {functions.length === 0 && (
                                <div className="flex items-center gap-2 px-3 py-3">
                                    <Loader2
                                        size={11}
                                        className="animate-spin text-muted-foreground/40"
                                    />
                                    <span className="text-[10px] text-muted-foreground/40 font-mono">
                                        Loading…
                                    </span>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Not connected */
                        <div className="px-3 py-3 space-y-2">
                            <p className="text-[10px] font-mono text-muted-foreground/40">
                                {connection.prefix}_list() …
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onConnect}
                                disabled={isLoading}
                                className="w-full h-7 text-[10px] font-bold uppercase tracking-widest gap-1.5"
                            >
                                {isLoading ? (
                                    <Loader2 size={10} className="animate-spin" />
                                ) : (
                                    <Plug size={10} />
                                )}
                                Connect
                            </Button>
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
        connectionDatabases,
        selectedDatabases,
        expandedConnections,
        activeFunction,
        isLoading,
        connectAndInit,
        disconnectConnection,
        selectDatabase,
        toggleConnectionExpanded,
        invokeFunction,
        setActiveFunctionOnly,
        setConnectionDialogOpen,
        setEditingConnection,
    } = useAppStore();

    const handleInvoke = (fn: ConnectionFunction) => {
        if (fn.type === "query" || fn.type === "execute") {
            setActiveFunctionOnly(fn);
        } else {
            invokeFunction(fn);
        }
    };

    return (
        <div className="h-full flex flex-col bg-sidebar border-r border-sidebar-border overflow-hidden">
            {/* ── Header ── */}
            <div className="h-10 flex items-center justify-between px-3 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                    <ListTree size={14} className="text-muted-foreground/50" />
                    <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground/50">
                        Connections
                    </span>
                </div>

                <div className="flex items-center gap-1">
                    {isLoading && (
                        <Loader2 size={11} className="animate-spin text-muted-foreground/40" />
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
                                className="text-muted-foreground/50 hover:text-foreground"
                            >
                                <Plus size={14} />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" sideOffset={4}>
                            New connection
                        </TooltipContent>
                    </Tooltip>
                </div>
            </div>

            {/* ── Connection list ── */}
            {connections.length === 0 ? (
                /* Empty state */
                <div className="flex-1 flex flex-col items-center justify-center gap-4 pb-10 px-4">
                    <div className="size-12 rounded-xl bg-muted/50 border border-border flex items-center justify-center">
                        <Database size={20} className="text-muted-foreground/30" />
                    </div>
                    <div className="text-center space-y-1">
                        <p className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                            No connections
                        </p>
                        <p className="text-[10px] text-muted-foreground/35">
                            Add your first database to get started
                        </p>
                    </div>
                    <Button
                        size="sm"
                        onClick={() => {
                            setEditingConnection(null);
                            setConnectionDialogOpen(true);
                        }}
                        className="h-7 text-[10px] font-bold uppercase tracking-widest gap-1.5"
                    >
                        <Plus size={11} />
                        Add Connection
                    </Button>
                </div>
            ) : (
                <ScrollArea className="flex-1">
                    <div className="py-1">
                        {connections.map((conn) => (
                            <ConnectionNode
                                key={conn.id}
                                connection={conn}
                                isConnected={connectedIds.includes(conn.id)}
                                isExpanded={expandedConnections.includes(conn.id)}
                                functions={connectionFunctions[conn.id] ?? []}
                                databases={connectionDatabases[conn.id] ?? []}
                                selectedDatabase={selectedDatabases[conn.id]}
                                activeFunctionId={activeFunction?.id}
                                isLoading={isLoading}
                                onToggleExpand={() => toggleConnectionExpanded(conn.id)}
                                onConnect={() => connectAndInit(conn.id)}
                                onDisconnect={() => disconnectConnection(conn.id)}
                                onEdit={() => {
                                    setEditingConnection(conn);
                                    setConnectionDialogOpen(true);
                                }}
                                onInvoke={handleInvoke}
                                onSelectDatabase={(db) => selectDatabase(conn.id, db)}
                            />
                        ))}
                    </div>
                </ScrollArea>
            )}

            {/* ── Footer: connected count ── */}
            {connections.length > 0 && (
                <>
                    <Separator />
                    <div className="h-7 flex items-center justify-between px-3 shrink-0">
                        <span className="text-[9px] font-mono text-muted-foreground/30">
                            {connectedIds.length}/{connections.length} connected
                        </span>
                        <span className="text-[9px] font-mono text-muted-foreground/25">
                            {connections.length === 1
                                ? "1 connection"
                                : `${connections.length} connections`}
                        </span>
                    </div>
                </>
            )}
        </div>
    );
};

export default Sidebar;

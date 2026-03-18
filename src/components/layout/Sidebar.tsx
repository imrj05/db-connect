import { useState } from "react";
import {
    ChevronDown,
    ChevronRight,
    Database,
    Plus,
    Loader2,
    Plug,
    Unplug,
    Pencil,
    ChevronsUpDown,
    Check,
} from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { ConnectionConfig, ConnectionFunction } from "@/types";
import { cn } from "@/lib/utils";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
// ─── Individual function item ─────────────────────────────────────────────────
function FunctionItem({
    fn,
    isActive,
    onInvoke,
}: {
    fn: ConnectionFunction;
    isActive: boolean;
    onInvoke: (fn: ConnectionFunction) => void;
}) {
    const typeColors: Record<string, string> = {
        list: "text-accent-purple",
        src: "text-muted-foreground",
        query: "text-accent-green",
        execute: "text-accent-orange",
        tbl: "text-accent-blue",
        table: "text-accent-blue",
    };
    return (
        <button
            onClick={() => onInvoke(fn)}
            className={cn(
                "w-full text-left flex items-center gap-2 px-2 py-1 rounded-md transition-all group",
                isActive
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-muted-foreground",
            )}
        >
            <span
                className={cn(
                    "w-1.5 h-1.5 rounded-full shrink-0 opacity-50",
                    isActive
                        ? "bg-accent-foreground opacity-100"
                        : "bg-current",
                )}
            />
            <span
                className={cn(
                    "text-[11px] font-mono truncate",
                    isActive
                        ? "text-accent-foreground"
                        : (typeColors[fn.type] ?? "text-muted-foreground"),
                )}
            >
                {fn.type === "table"
                    ? fn.tableName
                    : fn.name.slice(fn.prefix.length + 1)}
            </span>
        </button>
    );
}
// ─── Database selector ────────────────────────────────────────────────────────
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
        <div className="mx-1 mb-1" onClick={(e) => e.stopPropagation()}>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-muted border border-border hover:bg-muted/80 transition-colors">
                        <Database
                            size={10}
                            className="text-muted-foreground/50 shrink-0"
                        />
                        <span className="flex-1 text-left text-[10px] font-mono text-muted-foreground truncate min-w-0">
                            {current}
                        </span>
                        <ChevronsUpDown
                            size={9}
                            className="text-muted-foreground/40 shrink-0"
                        />
                    </button>
                </PopoverTrigger>
                <PopoverContent
                    className="w-48 p-0 bg-card border border-border shadow-xl"
                    align="start"
                    side="right"
                    sideOffset={6}
                >
                    <Command className="bg-transparent">
                        <CommandInput
                            placeholder="Search database..."
                            className="h-8 text-[11px] font-mono border-b border-border bg-transparent text-foreground placeholder:text-muted-foreground/40"
                        />
                        <CommandList className="max-h-52">
                            <CommandEmpty className="py-3 text-center text-[10px] text-muted-foreground/50">
                                No database found
                            </CommandEmpty>
                            <CommandGroup>
                                {displayDbs.map((db) => (
                                    <CommandItem
                                        key={db}
                                        value={db}
                                        onSelect={() => {
                                            onSelect(db);
                                            setOpen(false);
                                        }}
                                        className="flex items-center gap-2  py-1.5 text-[11px] font-mono cursor-pointer aria-selected:bg-muted text-muted-foreground hover:text-foreground"
                                    >
                                        <Check
                                            size={10}
                                            className={cn(
                                                "shrink-0",
                                                db === current
                                                    ? "opacity-100 text-accent-blue"
                                                    : "opacity-0",
                                            )}
                                        />
                                        {db}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}
// ─── Connection node (one per connection) ─────────────────────────────────────
function ConnectionNode({
    connection,
    isConnected,
    isExpanded,
    functions,
    databases,
    selectedDatabase,
    activeFunctionId,
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
    onToggleExpand: () => void;
    onConnect: () => void;
    onDisconnect: () => void;
    onEdit: () => void;
    onInvoke: (fn: ConnectionFunction) => void;
    onSelectDatabase: (db: string) => void;
}) {
    const DB_COLORS: Record<string, string> = {
        postgresql: "bg-chart-1",
        mysql: "bg-chart-1",
        sqlite: "bg-muted",
        mongodb: "bg-chart-3",
        redis: "bg-chart-5",
    };
    const utilityFns = functions.filter((f) => f.type !== "table");
    const tableFns = functions.filter((f) => f.type === "table");
    return (
        <div className="mb-1">
            {/* Connection header row */}
            <div
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted cursor-pointer group transition-all select-none"
                onClick={onToggleExpand}
            >
                {isExpanded ? (
                    <ChevronDown
                        size={12}
                        className="text-muted-foreground/60 shrink-0"
                    />
                ) : (
                    <ChevronRight
                        size={12}
                        className="text-muted-foreground/60 shrink-0"
                    />
                )}
                <div
                    className={cn(
                        "size-5 rounded flex items-center justify-center font-bold text-background text-[9px] shrink-0",
                        DB_COLORS[connection.type] ?? "bg-muted",
                    )}
                >
                    {connection.type.substring(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-bold truncate text-foreground block">
                        {connection.name}
                    </span>
                    <span className="text-[9px] font-mono text-muted-foreground/50 block">
                        {connection.prefix}_
                    </span>
                </div>
                {/* Action buttons (visible on hover) */}
                <div
                    className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        onClick={onEdit}
                        className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="Edit connection"
                    >
                        <Pencil size={10} />
                    </button>
                    {isConnected ? (
                        <button
                            onClick={onDisconnect}
                            className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-accent-red hover:bg-accent transition-colors"
                            title="Disconnect"
                        >
                            <Unplug size={10} />
                        </button>
                    ) : (
                        <button
                            onClick={onConnect}
                            className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-accent-green hover:bg-accent transition-colors"
                            title="Connect"
                        >
                            <Plug size={10} />
                        </button>
                    )}
                </div>
                {/* Connected indicator */}
                {isConnected && (
                    <div className="size-1.5 rounded-full bg-accent-green shrink-0 animate-pulse" />
                )}
            </div>
            {/* Expanded tree */}
            {isExpanded && (
                <div className="ml-4 pl-2 border-l border-border mt-0.5 space-y-0.5">
                    {isConnected ? (
                        <>
                            {/* Database selector (only shown when multiple databases available) */}
                            <DatabaseSelector
                                databases={databases}
                                selected={selectedDatabase}
                                onSelect={onSelectDatabase}
                            />
                            {/* Utility functions: list, src, query, execute, tbl */}
                            {utilityFns.map((fn) => (
                                <FunctionItem
                                    key={fn.id}
                                    fn={fn}
                                    isActive={activeFunctionId === fn.id}
                                    onInvoke={onInvoke}
                                />
                            ))}
                            {/* Tables section */}
                            {tableFns.length > 0 && (
                                <>
                                    <div className="flex items-center gap-2 px-2 py-1 mt-1">
                                        <div className="flex-1 h-px bg-muted" />
                                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/30">
                                            Tables ({tableFns.length})
                                        </span>
                                        <div className="flex-1 h-px bg-muted" />
                                    </div>
                                    {tableFns.map((fn) => (
                                        <FunctionItem
                                            key={fn.id}
                                            fn={fn}
                                            isActive={
                                                activeFunctionId === fn.id
                                            }
                                            onInvoke={onInvoke}
                                        />
                                    ))}
                                </>
                            )}
                        </>
                    ) : (
                        /* Not yet connected */
                        <div className="px-2 py-3 space-y-2">
                            <p className="text-[10px] text-muted-foreground/50 font-mono">
                                {connection.prefix}_list() ...
                            </p>
                            <button
                                onClick={onConnect}
                                className="w-full h-7 bg-accent text-accent-foreground hover:bg-accent/90 rounded text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                            >
                                <Plug size={11} />
                                Connect
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
// ─── Main Sidebar ─────────────────────────────────────────────────────────────
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
        // For query/execute: show editor without running
        if (fn.type === "query" || fn.type === "execute") {
            setActiveFunctionOnly(fn);
        } else {
            invokeFunction(fn);
        }
    };
    return (
        <div className="h-full flex flex-col bg-sidebar border-r border-sidebar-border overflow-hidden w-full">
            {/* Sidebar header */}
            <div className="h-10 px-3 flex items-center justify-between border-b border-border shrink-0">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/50">
                    Connections
                </span>
                <div className="flex items-center gap-1">
                    {isLoading && (
                        <Loader2
                            size={12}
                            className="animate-spin text-accent-blue"
                        />
                    )}
                    <button
                        onClick={() => {
                            setEditingConnection(null);
                            setConnectionDialogOpen(true);
                        }}
                        className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="New connection"
                    >
                        <Plus size={14} />
                    </button>
                </div>
            </div>
            {/* Connection list */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-0.5">
                {connections.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 pb-8">
                        <Database
                            size={24}
                            className="text-muted-foreground opacity-20"
                        />
                        <p className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest text-center">
                            No connections
                        </p>
                        <button
                            onClick={() => {
                                setEditingConnection(null);
                                setConnectionDialogOpen(true);
                            }}
                            className="px-4 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-bold text-[10px] transition-all active:scale-95"
                        >
                            Add Connection
                        </button>
                    </div>
                ) : (
                    connections.map((conn) => (
                        <ConnectionNode
                            key={conn.id}
                            connection={conn}
                            isConnected={connectedIds.includes(conn.id)}
                            isExpanded={expandedConnections.includes(conn.id)}
                            functions={connectionFunctions[conn.id] ?? []}
                            databases={connectionDatabases[conn.id] ?? []}
                            selectedDatabase={selectedDatabases[conn.id]}
                            activeFunctionId={activeFunction?.id}
                            onToggleExpand={() =>
                                toggleConnectionExpanded(conn.id)
                            }
                            onConnect={() => connectAndInit(conn.id)}
                            onDisconnect={() => disconnectConnection(conn.id)}
                            onEdit={() => {
                                setEditingConnection(conn);
                                setConnectionDialogOpen(true);
                            }}
                            onInvoke={handleInvoke}
                            onSelectDatabase={(db) =>
                                selectDatabase(conn.id, db)
                            }
                        />
                    ))
                )}
            </div>
        </div>
    );
};
export default Sidebar;

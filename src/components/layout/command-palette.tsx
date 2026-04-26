import * as React from "react";
import {
    Moon, Sun, Plus,
    List, Info, Code2, Zap, Table2, LayoutGrid,
    Database, Settings, Pin, Bookmark, Search, Columns3,
} from "lucide-react";
import {
    Command,
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandFooter,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useAppStore } from "@/store/useAppStore";
import { ConnectionFunction } from "@/types";
import { filterFunctions } from "@/lib/db-functions";
import { DB_LOGO as DB_ICON, DB_COLOR } from "@/lib/db-ui";
// Unique icon + color per function type
const TYPE_ICON: Record<string, { icon: React.FC<{ size?: number; className?: string }>; color: string }> = {
    list: { icon: List, color: "text-accent-purple/70" },
    src: { icon: Info, color: "text-muted-foreground/40" },
    query: { icon: Code2, color: "text-primary/70" },
    execute: { icon: Zap, color: "text-accent-orange/70" },
    tbl: { icon: Table2, color: "text-accent-blue/70" },
    table: { icon: LayoutGrid, color: "text-accent-blue/60" },
};
export function CommandPalette() {
    const {
        theme,
        setTheme,
        commandPaletteOpen,
        setCommandPaletteOpen,
        connectionFunctions,
        connections,
        connectedIds,
        connectionTables,
        invokeFunction,
        setActiveFunctionOnly,
        setActiveView,
        setEditingConnection,
        pinnedTables,
        savedQueries,
    } = useAppStore();
    const [query, setQuery] = React.useState("");

    // Schema search mode: triggered by leading "@"
    const isSchemaSearch = query.startsWith("@");
    const schemaQuery = isSchemaSearch ? query.slice(1).toLowerCase().trim() : "";
    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setCommandPaletteOpen(!useAppStore.getState().commandPaletteOpen);
            }
        };
        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, [setCommandPaletteOpen]);
    React.useEffect(() => {
        if (!commandPaletteOpen) setQuery("");
    }, [commandPaletteOpen]);
    const allFunctions = React.useMemo(
        () => Object.values(connectionFunctions).flatMap((dbMap) => Object.values(dbMap).flat()),
        [connectionFunctions],
    );
    const filteredFunctions = React.useMemo(
        () => filterFunctions(allFunctions, query),
        [allFunctions, query],
    );
    const grouped = React.useMemo(() => {
        const map = new Map<string, ConnectionFunction[]>();
        for (const fn of filteredFunctions) {
            const existing = map.get(fn.prefix) ?? [];
            map.set(fn.prefix, [...existing, fn]);
        }
        return map;
    }, [filteredFunctions]);

    // Pinned tables: find their table functions
    const filteredPinnedFunctions = React.useMemo(() => {
        if (!query) return allFunctions.filter((fn) =>
            pinnedTables.some((p) =>
                p.connectionId === fn.connectionId && p.tableName === fn.tableName
            )
        );
        return allFunctions.filter((fn) =>
            pinnedTables.some((p) =>
                p.connectionId === fn.connectionId && p.tableName === fn.tableName
            ) && fn.tableName?.toLowerCase().includes(query.toLowerCase())
        );
    }, [allFunctions, pinnedTables, query]);

    // Saved queries: filter by name
    const filteredSavedQueries = React.useMemo(() => {
        if (!query) return savedQueries.slice(0, 8);
        return savedQueries.filter((sq) =>
            sq.name.toLowerCase().includes(query.toLowerCase()) ||
            sq.sql.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 8);
    }, [savedQueries, query]);

    // Schema search results (when query starts with "@")
    type SchemaHit = { type: "table" | "column"; connId: string; tableName: string; columnName?: string; dataType?: string; };
    const schemaHits = React.useMemo<SchemaHit[]>(() => {
        if (!isSchemaSearch || !schemaQuery) return [];
        const hits: SchemaHit[] = [];
        for (const [connId, dbMap] of Object.entries(connectionTables)) {
            for (const tables of Object.values(dbMap)) {
            for (const table of tables) {
                if (table.name.toLowerCase().includes(schemaQuery)) {
                    hits.push({ type: "table", connId, tableName: table.name });
                }
                for (const col of table.columns ?? []) {
                    if (col.name.toLowerCase().includes(schemaQuery) || col.dataType?.toLowerCase().includes(schemaQuery)) {
                        hits.push({ type: "column", connId, tableName: table.name, columnName: col.name, dataType: col.dataType });
                    }
                }
            }
            }
        }
        return hits.slice(0, 30);
    }, [isSchemaSearch, schemaQuery, connectionTables]);

    const handleSelect = (fn: ConnectionFunction) => {
        setCommandPaletteOpen(false);
        if (fn.type === "query" || fn.type === "execute") {
            setActiveFunctionOnly(fn);
        } else {
            invokeFunction(fn);
        }
    };
    const toggleTheme = () => {
        setTheme(theme === "dark" ? "light" : "dark");
        setCommandPaletteOpen(false);
    };

    const showPinned = filteredPinnedFunctions.length > 0 && (!query || filteredPinnedFunctions.length > 0);
    const showSaved = filteredSavedQueries.length > 0;

    return (
        <CommandDialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen} className="sm:max-w-sm" width="min(28rem, 92vw)">
            <Command shouldFilter={false}>
                <CommandInput
                    placeholder={isSchemaSearch ? "Search tables and columns across all databases…" : "Search functions, tables, queries, commands…"}
                    value={query}
                    onValueChange={setQuery}
                />
                <CommandList>
                    <CommandEmpty>
                        {isSchemaSearch
                            ? schemaQuery
                                ? `No schema matches for "${schemaQuery}"`
                                : "Type to search tables and columns…"
                            : query ? `No results for "${query}"` : "No results found."}
                    </CommandEmpty>

                    {/* ── Schema Search Mode ── */}
                    {isSchemaSearch && schemaHits.length > 0 && (
                        <>
                            <CommandGroup heading={
                                <span className="flex items-center gap-1.5">
                                    <Search size={11} className="text-foreground/42" />
                                    Schema ({schemaHits.length} matches)
                                </span>
                            }>
                                {schemaHits.map((hit, i) => {
                                    const conn = connections.find((c) => c.id === hit.connId);
                                    const tableFn = Object.values(connectionFunctions).flatMap((dbMap) => Object.values(dbMap).flat()).find(
                                        (fn) => fn.connectionId === hit.connId && fn.tableName === hit.tableName && fn.type === "table"
                                    );
                                    return (
                                        <CommandItem
                                            key={`schema-${i}`}
                                            value={`schema-${hit.connId}-${hit.tableName}-${hit.columnName ?? ""}`}
                                            onSelect={() => {
                                                if (tableFn) { setCommandPaletteOpen(false); invokeFunction(tableFn); }
                                            }}
                                        >
                                            {hit.type === "table"
                                                ? <Table2 size={13} className="shrink-0 text-accent-blue/70" />
                                                : <Columns3 size={13} className="shrink-0 text-foreground/40" />
                                            }
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className="text-[13px] font-medium leading-tight">
                                                    {hit.type === "column"
                                                        ? <><span className="text-foreground/50">{hit.tableName}.</span>{hit.columnName}</>
                                                        : hit.tableName
                                                    }
                                                </span>
                                                <span className="text-[11px] text-foreground/42 leading-tight">
                                                    {hit.type === "column" ? hit.dataType : conn?.name}
                                                </span>
                                            </div>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                            <CommandSeparator />
                        </>
                    )}

                    {/* ── Pinned Tables ── */}
                    {!isSchemaSearch && showPinned && (
                        <>
                            <CommandGroup heading={
                                <span className="flex items-center gap-1.5">
                                    <Pin size={11} className="text-foreground/42" />
                                    Pinned Tables
                                </span>
                            }>
                                {filteredPinnedFunctions.map((fn) => {
                                    const conn = connections.find((c) => c.id === fn.connectionId);
                                    const Icon = conn ? DB_ICON[conn.type] : undefined;
                                    const iconColor = conn ? DB_COLOR[conn.type] : "";
                                    return (
                                        <CommandItem
                                            key={fn.id}
                                            value={`pinned-${fn.id}`}
                                            onSelect={() => handleSelect(fn)}
                                        >
                                            {Icon ? (
                                                <Icon className={`shrink-0 w-[13px] h-[13px] ${iconColor}`} />
                                            ) : (
                                                <Table2 size={13} className="shrink-0 text-accent-blue/60" />
                                            )}
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className="text-[14px] font-semibold leading-tight tracking-tight">
                                                    {fn.tableName}
                                                </span>
                                                {conn && (
                                                    <span className="text-[12px] text-foreground/52 mt-0.5 leading-tight truncate">
                                                        {conn.name}
                                                    </span>
                                                )}
                                            </div>
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                            <CommandSeparator />
                        </>
                    )}

                    {/* ── Saved Queries ── */}
                    {!isSchemaSearch && showSaved && (
                        <>
                            <CommandGroup heading={
                                <span className="flex items-center gap-1.5">
                                    <Bookmark size={11} className="text-foreground/42" />
                                    Saved Queries
                                </span>
                            }>
                                {filteredSavedQueries.map((sq) => {
                                    // Find a matching query function to load the query into
                                    const queryFn = sq.connectionId
                                        ? allFunctions.find(
                                            (f) => f.connectionId === sq.connectionId && f.type === "query"
                                        )
                                        : allFunctions.find((f) => f.type === "query");

                                    return (
                                        <CommandItem
                                            key={sq.id}
                                            value={`saved-${sq.id}`}
                                            onSelect={() => {
                                                setCommandPaletteOpen(false);
                                                if (queryFn) {
                                                    setActiveFunctionOnly(queryFn);
                                                    // Dispatch a custom event to load SQL into editor
                                                    window.dispatchEvent(
                                                        new CustomEvent("palette-load-sql", {
                                                            detail: { sql: sq.sql, connectionId: sq.connectionId },
                                                        })
                                                    );
                                                }
                                            }}
                                        >
                                            <Bookmark size={13} className="shrink-0 text-foreground/42" />
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className="text-[14px] font-semibold leading-tight tracking-tight">
                                                    {sq.name}
                                                </span>
                                                <span className="text-[12px] text-foreground/52 mt-0.5 leading-tight truncate font-mono">
                                                    {sq.sql.slice(0, 60)}
                                                </span>
                                            </div>
                                            {sq.folder && (
                                                <span className="shrink-0 text-[10px] text-muted-foreground/40 font-medium">
                                                    {sq.folder}
                                                </span>
                                            )}
                                        </CommandItem>
                                    );
                                })}
                            </CommandGroup>
                            <CommandSeparator />
                        </>
                    )}

                    {/* ── Connection functions ── */}
                    {!isSchemaSearch && Array.from(grouped.entries()).map(([prefix, fns], groupIdx) => {
                        const conn = connections.find((c) => c.prefix === prefix);
                        const Icon = conn ? DB_ICON[conn.type] : undefined;
                        const iconColor = conn ? DB_COLOR[conn.type] : "";
                        return (
                            <React.Fragment key={prefix}>
                                {groupIdx > 0 && <CommandSeparator />}
                                <CommandGroup heading={
                                    <span className="flex items-center gap-2 text-foreground/68">
                                        {Icon && <Icon className={`size-3 ${iconColor}`} />}
                                        {conn?.name ?? prefix}
                                    </span>
                                }>
                                    {fns.map((fn) => {
                                        const name =
                                            fn.type === "table"
                                                ? fn.tableName!
                                                : fn.callSignature
                                                    .slice(fn.prefix.length + 1)
                                                    .replace(/\(.*$/, "");
                                        const typeEntry = TYPE_ICON[fn.type];
                                        const TypeIcon = typeEntry?.icon;
                                        return (
                                            <CommandItem
                                                key={fn.id}
                                                value={fn.callSignature}
                                                onSelect={() => handleSelect(fn)}
                                            >
                                                {TypeIcon && (
                                                    <TypeIcon
                                                        size={13}
                                                        className={`shrink-0 ${typeEntry.color}`}
                                                    />
                                                )}
                                                <div className="flex flex-col flex-1 min-w-0">
                                                    <span className="text-[14px] font-semibold leading-tight tracking-tight">
                                                        {name}
                                                    </span>
                                                    {fn.description && (
                                                        <span className="text-[12px] text-foreground/52 mt-0.5 leading-tight truncate">
                                                            {fn.description}
                                                        </span>
                                                    )}
                                                </div>
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            </React.Fragment>
                        );
                    })}
                    {allFunctions.length === 0 && connectedIds.length === 0 && (
                        <>
                            <CommandSeparator />
                            <CommandGroup heading={
                                <span className="flex items-center gap-1.5">
                                    <Database size={11} className="text-foreground/42" />
                                    Connections
                                </span>
                            }>
                                <CommandItem
                                    onSelect={() => {
                                        setEditingConnection(null);
                                        setActiveView("new-connection");
                                        setCommandPaletteOpen(false);
                                    }}
                                >
                                    <Plus size={13} className="text-foreground/42 shrink-0" />
                                    <div className="flex flex-col flex-1">
                                        <span className="text-[14px] font-semibold">Add New Connection</span>
                                        <span className="text-[12px] text-foreground/52">Connect to a database</span>
                                    </div>
                                </CommandItem>
                            </CommandGroup>
                        </>
                    )}
                    <CommandSeparator />
                    {!isSchemaSearch && (
                    <CommandGroup heading={
                        <span className="flex items-center gap-1.5">
                            <Settings size={11} className="text-foreground/42" />
                            Actions
                        </span>
                    }>
                        <CommandItem
                            onSelect={() => {
                                setEditingConnection(null);
                                setActiveView("new-connection");
                                setCommandPaletteOpen(false);
                            }}
                        >
                            <Plus size={13} className="text-foreground/42 shrink-0" />
                            <div className="flex flex-col flex-1">
                                <span className="text-[14px] font-semibold">New Connection</span>
                                <span className="text-[12px] text-foreground/52">Add a new database connection</span>
                            </div>
                            <KbdGroup>
                                <Kbd>⌘</Kbd>
                                <Kbd>N</Kbd>
                            </KbdGroup>
                        </CommandItem>
                        <CommandItem
                            onSelect={() => {
                                setActiveView("settings");
                                setCommandPaletteOpen(false);
                            }}
                        >
                            <Settings size={13} className="text-foreground/42 shrink-0" />
                            <div className="flex flex-col flex-1">
                                <span className="text-[14px] font-semibold">Open Settings</span>
                                <span className="text-[12px] text-foreground/52">App preferences and configuration</span>
                            </div>
                            <KbdGroup>
                                <Kbd>⌘</Kbd>
                                <Kbd>,</Kbd>
                            </KbdGroup>
                        </CommandItem>
                        <CommandItem onSelect={toggleTheme}>
                            {theme === "dark"
                                ? <Sun size={13} className="text-foreground/42 shrink-0" />
                                : <Moon size={13} className="text-foreground/42 shrink-0" />
                            }
                            <div className="flex flex-col flex-1">
                                <span className="text-[14px] font-semibold">
                                    Switch to {theme === "dark" ? "Light" : "Dark"} Mode
                                </span>
                                <span className="text-[12px] text-foreground/52">Toggle the app theme</span>
                            </div>
                        </CommandItem>
                    </CommandGroup>
                    )}
                </CommandList>
                <CommandFooter>
                    {isSchemaSearch ? (
                        <span className="flex items-center gap-1.5 text-foreground/52 text-[12px]">
                            <Search size={11} />
                            Searching tables &amp; columns — type after <Kbd>@</Kbd>
                        </span>
                    ) : (
                        <span className="text-foreground/42 text-[12px]">
                            Tip: type <Kbd>@</Kbd> to search schema
                        </span>
                    )}
                    <span className="flex items-center gap-1.5">
                        <KbdGroup>
                            <Kbd>↑</Kbd>
                            <Kbd>↓</Kbd>
                        </KbdGroup>
                        navigate
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Kbd>↵</Kbd>
                        select
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Kbd>Esc</Kbd>
                        close
                    </span>
                </CommandFooter>
            </Command>
        </CommandDialog>
    );
}

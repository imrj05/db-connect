import * as React from "react";
import {
    Moon, Sun, Plus,
    List, Info, Code2, Zap, Table2, LayoutGrid,
    Database, Settings,
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
        invokeFunction,
        setActiveFunctionOnly,
        setConnectionDialogOpen,
        setEditingConnection,
    } = useAppStore();
    const [query, setQuery] = React.useState("");
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
        () => Object.values(connectionFunctions).flat(),
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
    return (
        <CommandDialog className="w-[30vw]!" open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
            <Command shouldFilter={false}>
                <CommandInput
                    placeholder="Search functions, tables, commands…"
                    value={query}
                    onValueChange={setQuery}
                />
                <CommandList>
                    <CommandEmpty>
                        {query ? `No results for "${query}"` : "No results found."}
                    </CommandEmpty>
                    {Array.from(grouped.entries()).map(([prefix, fns], groupIdx) => {
                        const conn = connections.find((c) => c.prefix === prefix);
                        const Icon = conn ? DB_ICON[conn.type] : undefined;
                        const iconColor = conn ? DB_COLOR[conn.type] : "";
                        return (
                            <React.Fragment key={prefix}>
                                {groupIdx > 0 && <CommandSeparator />}
                                <CommandGroup heading={
                                    <span className="flex items-center gap-1.5">
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
                                                    <span className="text-[13px] font-medium leading-tight">
                                                        {name}
                                                    </span>
                                                    {fn.description && (
                                                        <span className="text-xs text-muted-foreground/40 mt-0.5 leading-tight truncate">
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
                                    <Database size={11} className="text-muted-foreground/50" />
                                    Connections
                                </span>
                            }>
                                <CommandItem
                                    onSelect={() => {
                                        setEditingConnection(null);
                                        setConnectionDialogOpen(true);
                                        setCommandPaletteOpen(false);
                                    }}
                                >
                                    <Plus size={13} className="text-muted-foreground/50 shrink-0" />
                                    <div className="flex flex-col flex-1">
                                        <span className="text-[13px] font-medium">Add New Connection</span>
                                        <span className="text-xs text-muted-foreground/40">Connect to a database</span>
                                    </div>
                                </CommandItem>
                            </CommandGroup>
                        </>
                    )}
                    <CommandSeparator />
                    <CommandGroup heading={
                        <span className="flex items-center gap-1.5">
                            <Settings size={11} className="text-muted-foreground/50" />
                            General
                        </span>
                    }>
                        <CommandItem
                            onSelect={() => {
                                setEditingConnection(null);
                                setConnectionDialogOpen(true);
                                setCommandPaletteOpen(false);
                            }}
                        >
                            <Plus size={13} className="text-muted-foreground/50 shrink-0" />
                            <div className="flex flex-col flex-1">
                                <span className="text-[13px] font-medium">New Connection</span>
                                <span className="text-xs text-muted-foreground/40">Add a new database connection</span>
                            </div>
                            <KbdGroup>
                                <Kbd>⌘</Kbd>
                                <Kbd>N</Kbd>
                            </KbdGroup>
                        </CommandItem>
                        <CommandItem onSelect={toggleTheme}>
                            {theme === "dark"
                                ? <Sun size={13} className="text-muted-foreground/50 shrink-0" />
                                : <Moon size={13} className="text-muted-foreground/50 shrink-0" />
                            }
                            <div className="flex flex-col flex-1">
                                <span className="text-[13px] font-medium">
                                    Switch to {theme === "dark" ? "Light" : "Dark"} Mode
                                </span>
                                <span className="text-xs text-muted-foreground/40">Toggle the app theme</span>
                            </div>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
                <CommandFooter>
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

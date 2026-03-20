import * as React from "react";
import { Moon, Sun, Plus } from "lucide-react";
import {
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

const TYPE_LABEL: Record<string, string> = {
    list:    "list",
    src:     "src",
    query:   "query",
    execute: "exec",
    tbl:     "tbl",
    table:   "table",
};

// Neon color per function type
const TYPE_COLOR: Record<string, string> = {
    list:    "text-accent-purple/70 border-accent-purple/20",
    src:     "text-muted-foreground/40 border-border",
    query:   "text-primary/80 border-primary/25",
    execute: "text-accent-orange/80 border-accent-orange/25",
    tbl:     "text-accent-blue/80 border-accent-blue/25",
    table:   "text-accent-blue/80 border-accent-blue/25",
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
                setCommandPaletteOpen(!commandPaletteOpen);
            }
        };
        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, [commandPaletteOpen, setCommandPaletteOpen]);

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
        <CommandDialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
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
                    return (
                        <React.Fragment key={prefix}>
                            {groupIdx > 0 && <CommandSeparator />}
                            <CommandGroup heading={conn?.name ?? prefix}>
                                {fns.map((fn) => {
                                    const name =
                                        fn.type === "table"
                                            ? fn.tableName!
                                            : fn.callSignature
                                                  .slice(fn.prefix.length + 1)
                                                  .replace(/\(.*$/, "");
                                    return (
                                        <CommandItem
                                            key={fn.id}
                                            value={fn.callSignature}
                                            onSelect={() => handleSelect(fn)}
                                            className="border-border bg-card"
                                        >
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className="text-[12px] font-sans font-medium text-foreground leading-tight">
                                                    {name}
                                                </span>
                                                {fn.description && (
                                                    <span className="text-[10px] font-sans text-muted-foreground/40 mt-0.5 leading-tight truncate">
                                                        {fn.description}
                                                    </span>
                                                )}
                                            </div>
                                            <span className={`text-[9px] font-label font-bold uppercase tracking-widest shrink-0 px-1.5 py-0.5 border ${TYPE_COLOR[fn.type] ?? "text-muted-foreground/30 border-border"}`}>
                                                {TYPE_LABEL[fn.type] ?? fn.type}
                                            </span>
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
                        <CommandGroup heading="Connections">
                            <CommandItem
                                onSelect={() => {
                                    setEditingConnection(null);
                                    setConnectionDialogOpen(true);
                                    setCommandPaletteOpen(false);
                                }}
                                className="border-border bg-card"
                            >
                                <Plus size={12} className="text-primary/60 shrink-0" />
                                <div className="flex flex-col flex-1">
                                    <span className="text-[12px] font-sans font-medium">Add New Connection</span>
                                    <span className="text-[10px] font-sans text-muted-foreground/40">Connect to a database</span>
                                </div>
                            </CommandItem>
                        </CommandGroup>
                    </>
                )}

                <CommandSeparator />

                <CommandGroup heading="General">
                    <CommandItem
                        onSelect={() => {
                            setEditingConnection(null);
                            setConnectionDialogOpen(true);
                            setCommandPaletteOpen(false);
                        }}
                        className="border-border bg-card"
                    >
                        <Plus size={12} className="text-primary/60 shrink-0" />
                        <div className="flex flex-col flex-1">
                            <span className="text-[12px] font-sans font-medium">New Connection</span>
                            <span className="text-[10px] font-sans text-muted-foreground/40">Add a new database connection</span>
                        </div>
                        <KbdGroup>
                            <Kbd>⌘</Kbd>
                            <Kbd>N</Kbd>
                        </KbdGroup>
                    </CommandItem>
                    <CommandItem onSelect={toggleTheme} className="border-border bg-card">
                        {theme === "dark"
                            ? <Sun size={12} className="text-primary/60 shrink-0" />
                            : <Moon size={12} className="text-primary/60 shrink-0" />
                        }
                        <div className="flex flex-col flex-1">
                            <span className="text-[12px] font-sans font-medium">
                                Switch to {theme === "dark" ? "Light" : "Dark"} Mode
                            </span>
                            <span className="text-[10px] font-sans text-muted-foreground/40">Toggle the app theme</span>
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
        </CommandDialog>
    );
}

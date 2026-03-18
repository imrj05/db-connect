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
                placeholder="Search commands..."
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
                                        >
                                            <div className="flex flex-col flex-1 min-w-0">
                                                <span className="text-[13px] font-medium text-foreground leading-tight">
                                                    {name}
                                                </span>
                                                {fn.description && (
                                                    <span className="text-[11px] text-muted-foreground/50 mt-0.5 leading-tight truncate">
                                                        {fn.description}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[10px] font-mono text-muted-foreground/30 uppercase tracking-wider shrink-0">
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
                            >
                                <Plus size={13} className="text-muted-foreground/50 shrink-0" />
                                <div className="flex flex-col flex-1">
                                    <span className="text-[13px] font-medium">Add New Connection</span>
                                    <span className="text-[11px] text-muted-foreground/50">Connect to a database</span>
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
                    >
                        <Plus size={13} className="text-muted-foreground/50 shrink-0" />
                        <div className="flex flex-col flex-1">
                            <span className="text-[13px] font-medium">New Connection</span>
                            <span className="text-[11px] text-muted-foreground/50">Add a new database connection</span>
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
                            <span className="text-[11px] text-muted-foreground/50">Toggle the app theme</span>
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

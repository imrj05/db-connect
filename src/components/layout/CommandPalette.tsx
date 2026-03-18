import * as React from "react";
import {
    Moon,
    Sun,
    Plus,
} from "lucide-react";
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
    CommandFooter,
} from "@/components/ui/command";
import { useAppStore } from "@/store/useAppStore";
import { ConnectionFunction } from "@/types";
import { filterFunctions } from "@/lib/db-functions";

// Colour map for function type indicator dots
const TYPE_COLOR: Record<string, string> = {
    list: "bg-accent-purple",
    src: "bg-muted-foreground",
    query: "bg-accent-green",
    execute: "bg-accent-orange",
    tbl: "bg-accent-blue",
    table: "bg-accent-blue",
};

// Single keyboard key badge
function KbdKey({ children }: { children: React.ReactNode }) {
    return (
        <kbd className="flex h-7 min-w-7 items-center justify-center rounded-full border border-border bg-muted px-1.5 text-[11px] font-mono text-muted-foreground/70">
            {children}
        </kbd>
    );
}

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

    // ⌘K toggle
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

    // Reset query when palette closes
    React.useEffect(() => {
        if (!commandPaletteOpen) setQuery("");
    }, [commandPaletteOpen]);

    // Build all available functions from all connected connections
    const allFunctions = React.useMemo(
        () => Object.values(connectionFunctions).flat(),
        [connectionFunctions],
    );

    const filteredFunctions = React.useMemo(
        () => filterFunctions(allFunctions, query),
        [allFunctions, query],
    );

    // Group filtered functions by connection prefix
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
        <CommandDialog
            open={commandPaletteOpen}
            onOpenChange={setCommandPaletteOpen}
        >
            <CommandInput
                placeholder="Search commands..."
                value={query}
                onValueChange={setQuery}
            />
            <CommandList>
                <CommandEmpty>
                    {query
                        ? `No results for "${query}"`
                        : "No results found."}
                </CommandEmpty>

                {/* Per-connection function groups */}
                {Array.from(grouped.entries()).map(
                    ([prefix, fns], groupIdx) => {
                        const conn = connections.find(
                            (c) => c.prefix === prefix,
                        );
                        return (
                            <React.Fragment key={prefix}>
                                {groupIdx > 0 && <CommandSeparator />}
                                <CommandGroup
                                    heading={conn?.name ?? prefix}
                                >
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
                                                <span
                                                    className={`size-1.5 rounded-full shrink-0 mt-0.5 ${TYPE_COLOR[fn.type] ?? "bg-muted-foreground"}`}
                                                />
                                                <div className="flex flex-col flex-1 min-w-0">
                                                    <span className="font-bold text-[13px] text-foreground leading-tight">
                                                        {name}
                                                    </span>
                                                    {fn.description && (
                                                        <span className="text-[11px] text-muted-foreground/60 mt-0.5 leading-tight">
                                                            {fn.description}
                                                        </span>
                                                    )}
                                                </div>
                                                <CommandShortcut>
                                                    <KbdKey>{fn.type}</KbdKey>
                                                </CommandShortcut>
                                            </CommandItem>
                                        );
                                    })}
                                </CommandGroup>
                            </React.Fragment>
                        );
                    },
                )}

                {/* Show "no connected" message if no functions available */}
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
                                <Plus size={13} className="text-muted-foreground shrink-0" />
                                <div className="flex flex-col flex-1">
                                    <span className="font-bold text-[13px]">Add New Connection</span>
                                    <span className="text-[11px] text-muted-foreground/60">Connect to a database</span>
                                </div>
                            </CommandItem>
                        </CommandGroup>
                    </>
                )}

                <CommandSeparator />

                {/* General actions */}
                <CommandGroup heading="General">
                    <CommandItem
                        onSelect={() => {
                            setEditingConnection(null);
                            setConnectionDialogOpen(true);
                            setCommandPaletteOpen(false);
                        }}
                    >
                        <Plus size={14} className="text-muted-foreground shrink-0" />
                        <div className="flex flex-col flex-1">
                            <span className="font-bold text-[13px]">New Connection</span>
                            <span className="text-[11px] text-muted-foreground/60">Add a new database connection</span>
                        </div>
                        <CommandShortcut>
                            <KbdKey>⌘</KbdKey>
                            <KbdKey>N</KbdKey>
                        </CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={toggleTheme}>
                        {theme === "dark" ? (
                            <Sun size={14} className="text-muted-foreground shrink-0" />
                        ) : (
                            <Moon size={14} className="text-muted-foreground shrink-0" />
                        )}
                        <div className="flex flex-col flex-1">
                            <span className="font-bold text-[13px]">
                                Switch to {theme === "dark" ? "Light" : "Dark"} Mode
                            </span>
                            <span className="text-[11px] text-muted-foreground/60">Toggle the app theme</span>
                        </div>
                    </CommandItem>
                </CommandGroup>
            </CommandList>
            <CommandFooter>
                <span className="flex items-center gap-1.5">
                    <KbdKey>↑↓</KbdKey>
                    navigate
                </span>
                <span className="flex items-center gap-1.5">
                    <KbdKey>↵</KbdKey>
                    select
                </span>
                <span className="flex items-center gap-1.5">
                    <KbdKey>Esc</KbdKey>
                    close
                </span>
            </CommandFooter>
        </CommandDialog>
    );
}

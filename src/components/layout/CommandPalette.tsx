import * as React from "react";
import { Moon, Sun, Plus, Database, List, Search, Play, Settings2, Hash, Table2 } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useAppStore } from "@/store/useAppStore";
import { ConnectionFunction } from "@/types";
import { filterFunctions } from "@/lib/db-functions";

// Icon map for function types
const TYPE_ICONS: Record<string, React.ReactNode> = {
  list: <List size={13} className="text-violet-400" />,
  src: <Database size={13} className="text-slate-400" />,
  query: <Play size={13} className="text-emerald-400" />,
  execute: <Settings2 size={13} className="text-amber-400" />,
  tbl: <Search size={13} className="text-cyan-400" />,
  table: <Table2 size={13} className="text-blue-400" />,
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
    <CommandDialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <CommandInput
        placeholder="Search functions or tables..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {query ? `No functions matching "${query}"` : "No results found."}
        </CommandEmpty>

        {/* Per-connection function groups */}
        {Array.from(grouped.entries()).map(([prefix, fns], groupIdx) => {
          const conn = connections.find((c) => c.prefix === prefix);
          return (
            <React.Fragment key={prefix}>
              {groupIdx > 0 && <CommandSeparator />}
              <CommandGroup
                heading={
                  <span className="flex items-center gap-2">
                    <Hash size={10} className="opacity-50" />
                    <span>{conn?.name ?? prefix}</span>
                    {conn && (
                      <span className="text-[9px] opacity-40 uppercase tracking-widest">
                        {conn.type}
                      </span>
                    )}
                  </span>
                }
              >
                {fns.map((fn) => (
                  <CommandItem
                    key={fn.id}
                    value={fn.callSignature}
                    onSelect={() => handleSelect(fn)}
                    className="flex items-center gap-2"
                  >
                    {TYPE_ICONS[fn.type] ?? <Database size={13} />}
                    <span className="font-mono text-[12px]">
                      {fn.type === "table" ? fn.tableName : fn.callSignature.slice(fn.prefix.length + 1)}
                    </span>
                    <span className="text-text-muted/50 text-[10px] ml-1 hidden sm:inline">
                      {fn.description}
                    </span>
                    <CommandShortcut>
                      {fn.type === "table" ? "table" : fn.type}
                    </CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            </React.Fragment>
          );
        })}

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
                <Plus size={13} />
                <span>Add New Connection</span>
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
            <Plus size={13} />
            <span>New Connection</span>
            <CommandShortcut>⌘N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={toggleTheme}>
            {theme === "dark" ? <Sun size={13} /> : <Moon size={13} />}
            <span>Switch to {theme === "dark" ? "Light" : "Dark"} Mode</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

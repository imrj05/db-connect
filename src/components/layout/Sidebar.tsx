import { ChevronDown, ChevronRight, Database, Plus, Loader2, Plug, Unplug, Pencil, ChevronsUpDown } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { ConnectionConfig, ConnectionFunction } from "@/types";
import { cn } from "@/lib/utils";

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
    list: "text-violet-400",
    src: "text-slate-400",
    query: "text-emerald-400",
    execute: "text-amber-400",
    tbl: "text-cyan-400",
    table: "text-blue-400",
  };

  return (
    <button
      onClick={() => onInvoke(fn)}
      className={cn(
        "w-full text-left flex items-center gap-2 px-2 py-1 rounded-md transition-all group",
        isActive
          ? "bg-blue-500/15 text-blue-300"
          : "hover:bg-white/5 text-text-muted hover:text-text-secondary",
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0 opacity-50",
          isActive ? "bg-blue-400 opacity-100" : "bg-current",
        )}
      />
      <span
        className={cn(
          "text-[11px] font-mono truncate",
          isActive ? "text-blue-300" : typeColors[fn.type] ?? "text-text-muted",
        )}
      >
        {fn.type === "table" ? fn.tableName : fn.name.slice(fn.prefix.length + 1)}
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
  // Build the list to display: use fetched databases, or fall back to just the selected one
  const displayDbs = databases.length > 0
    ? databases
    : selected
    ? [selected]
    : [];

  if (displayDbs.length === 0) return null;

  return (
    <div className="relative mx-1 mb-1">
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-white/5 border border-white/8 hover:bg-white/8 transition-colors">
        <Database size={10} className="text-text-muted/50 shrink-0" />
        <select
          value={selected ?? displayDbs[0] ?? ""}
          onChange={(e) => onSelect(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 bg-transparent text-[10px] font-mono text-text-secondary appearance-none cursor-pointer outline-none min-w-0 truncate"
        >
          {displayDbs.map((db) => (
            <option key={db} value={db} className="bg-zinc-900 text-text-primary">
              {db}
            </option>
          ))}
        </select>
        <ChevronsUpDown size={9} className="text-text-muted/40 shrink-0 pointer-events-none" />
      </div>
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
    postgresql: "bg-blue-600",
    mysql: "bg-cyan-600",
    sqlite: "bg-slate-600",
    mongodb: "bg-emerald-600",
    redis: "bg-red-600",
  };

  const utilityFns = functions.filter((f) => f.type !== "table");
  const tableFns = functions.filter((f) => f.type === "table");

  return (
    <div className="mb-1">
      {/* Connection header row */}
      <div
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 cursor-pointer group transition-all select-none"
        onClick={onToggleExpand}
      >
        {isExpanded ? (
          <ChevronDown size={12} className="text-text-muted/60 shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-text-muted/60 shrink-0" />
        )}

        <div
          className={cn(
            "size-5 rounded flex items-center justify-center font-bold text-white text-[9px] shrink-0",
            DB_COLORS[connection.type] ?? "bg-zinc-600",
          )}
        >
          {connection.type.substring(0, 2).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-bold truncate text-text-primary block">
            {connection.name}
          </span>
          <span className="text-[9px] font-mono text-text-muted/50 block">
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
            className="size-5 flex items-center justify-center rounded text-text-muted hover:text-white hover:bg-white/10 transition-colors"
            title="Edit connection"
          >
            <Pencil size={10} />
          </button>
          {isConnected ? (
            <button
              onClick={onDisconnect}
              className="size-5 flex items-center justify-center rounded text-text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Disconnect"
            >
              <Unplug size={10} />
            </button>
          ) : (
            <button
              onClick={onConnect}
              className="size-5 flex items-center justify-center rounded text-text-muted hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
              title="Connect"
            >
              <Plug size={10} />
            </button>
          )}
        </div>

        {/* Connected indicator */}
        {isConnected && (
          <div className="size-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
        )}
      </div>

      {/* Expanded tree */}
      {isExpanded && (
        <div className="ml-4 pl-2 border-l border-white/5 mt-0.5 space-y-0.5">
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
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-text-muted/30">
                      Tables ({tableFns.length})
                    </span>
                    <div className="flex-1 h-px bg-white/5" />
                  </div>
                  {tableFns.map((fn) => (
                    <FunctionItem
                      key={fn.id}
                      fn={fn}
                      isActive={activeFunctionId === fn.id}
                      onInvoke={onInvoke}
                    />
                  ))}
                </>
              )}
            </>
          ) : (
            /* Not yet connected */
            <div className="px-2 py-3 space-y-2">
              <p className="text-[10px] text-text-muted/50 font-mono">
                {connection.prefix}_list() ...
              </p>
              <button
                onClick={onConnect}
                className="w-full h-7 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
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
    <div className="h-full flex flex-col bg-sidebar-bg border-r border-border-sidebar overflow-hidden w-full">
      {/* Sidebar header */}
      <div className="h-10 px-3 flex items-center justify-between border-b border-border-sidebar shrink-0">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text-muted/50">
          Connections
        </span>
        <div className="flex items-center gap-1">
          {isLoading && <Loader2 size={12} className="animate-spin text-blue-500" />}
          <button
            onClick={() => {
              setEditingConnection(null);
              setConnectionDialogOpen(true);
            }}
            className="size-6 flex items-center justify-center rounded text-text-muted hover:text-white hover:bg-white/10 transition-colors"
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
            <Database size={24} className="text-text-muted opacity-20" />
            <p className="text-[10px] font-bold text-text-muted/50 uppercase tracking-widest text-center">
              No connections
            </p>
            <button
              onClick={() => {
                setEditingConnection(null);
                setConnectionDialogOpen(true);
              }}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-[10px] transition-all active:scale-95"
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
          ))
        )}
      </div>
    </div>
  );
};

export default Sidebar;

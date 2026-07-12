import type { StateCreator } from "zustand";
import { toast } from "sonner";
import type {
  ConnectionConfig,
  ConnectionFunction,
  FunctionInvocationResult,
  ResultTab,
  TableInfo,
} from "@/types";
import { EncryptionUtils } from "@/lib/encryption";
import { buildConnectionFunctions, suggestPrefix } from "@/lib/db-functions";
import { tauriApi } from "@/lib/tauri-api";
import {
  LEGACY_CONNECTIONS_KEY,
  LEGACY_QUERIES_KEY,
  createDefaultFilter,
} from "../lib/persistence";
import type { AppState } from "../useAppStore";
import type { WorkspaceSnapshot, SavedQuery } from "@/types";

export interface ConnectionSlice {
  // ---- Connection list (persisted) ----
  connections: ConnectionConfig[];

  // ---- Live connection state ----
  connectedIds: string[]; // IDs with active Rust driver in REGISTRY
  connectionFunctions: Record<string, Record<string, ConnectionFunction[]>>; // connectionId → database → generated fns
  connectionTables: Record<string, Record<string, TableInfo[]>>; // connectionId → database → discovered tables
  connectionDatabases: Record<string, string[]>; // connectionId → available user databases
  selectedDatabases: Record<string, string>; // connectionId → currently selected database
  openDatabases: Record<string, string[]>; // connectionId → explicitly opened databases (shown as tabs)
  connectionLatency: Record<string, number | null>; // connectionId → last ping ms (null = unknown)
  connectionConnectedAt: Record<string, number>; // connectionId → timestamp (ms) when connected

  // ---- Actions: persistence ----
  loadConnections: () => Promise<void>;
  addConnection: (connection: ConnectionConfig) => void;
  updateConnection: (connection: ConnectionConfig) => void;
  setConnections: (connections: ConnectionConfig[]) => void;
  deleteConnection: (id: string) => void;

  // ---- Actions: connection lifecycle ----
  connectAndInit: (connectionId: string, options?: { isCancelled?: () => boolean }) => Promise<boolean>;
  disconnectConnection: (connectionId: string) => Promise<void>;
  selectDatabase: (connectionId: string, database: string) => Promise<void>;
  closeOpenDatabase: (connectionId: string, database: string) => Promise<void>;
  refreshDatabases: (connectionId: string) => Promise<void>;
  refreshTables: (connectionId: string, database?: string) => Promise<void>;
  loadTableColumns: (connectionId: string, tableName: string) => Promise<void>;
  pingConnectionHealth: (connectionId: string) => Promise<void>;
}

export const createConnectionSlice: StateCreator<AppState, [], [], ConnectionSlice> = (set, get) => ({
  connections: [],
  connectedIds: [],
  connectionFunctions: {},
  connectionTables: {},
  connectionDatabases: {},
  selectedDatabases: {},
  openDatabases: {},
  connectionLatency: {},
  connectionConnectedAt: {},

  // ---- Persistence ----

  loadConnections: async () => {
    try {
      // Load from SQLite (primary)
      let connections = await tauriApi.storageLoadConnections();

      // One-time migration from legacy localStorage (v3 key)
      if (connections.length === 0) {
        const encrypted = localStorage.getItem(LEGACY_CONNECTIONS_KEY);
        if (encrypted) {
          const decrypted = EncryptionUtils.tryMigrateLegacy(encrypted);
          if (Array.isArray(decrypted) && decrypted.length > 0) {
            const migrated = (decrypted as ConnectionConfig[]).map((c) => ({
              ...c,
              prefix: c.prefix || suggestPrefix(c.name),
            }));
            for (const conn of migrated) {
              await tauriApi.storageSaveConnection(conn);
            }
            localStorage.removeItem(LEGACY_CONNECTIONS_KEY);
            localStorage.removeItem("db_connections_v2");
            connections = migrated;
          }
        }
      }

      // Load saved queries from SQLite (primary)
      let savedQueries = await tauriApi.storageLoadQueries();

      // One-time migration for saved queries
      if (savedQueries.length === 0) {
        try {
          const raw = localStorage.getItem(LEGACY_QUERIES_KEY);
          if (raw) {
            const parsed: SavedQuery[] = JSON.parse(raw);
            for (const q of parsed) {
              await tauriApi.storageSaveQuery(q);
            }
            localStorage.removeItem(LEGACY_QUERIES_KEY);
            savedQueries = parsed;
          }
        } catch {
          // ignore corrupted legacy data
        }
      }

      const queryHistory = await tauriApi.storageLoadHistory();
      const userSnippets = await tauriApi.storageLoadSnippets();

      // Load workspace snapshot — will be applied after connections are established
      let pendingWorkspaceSnapshot: WorkspaceSnapshot | null = null;
      try {
        const raw = await tauriApi.storageLoadWorkspace();
        if (raw) pendingWorkspaceSnapshot = JSON.parse(raw) as WorkspaceSnapshot;
      } catch { /* ignore parse errors */ }

      set({ connections, savedQueries, queryHistory, userSnippets, _pendingWorkspaceSnapshot: pendingWorkspaceSnapshot });
    } catch (e) {
      console.error("Failed to load from storage:", e);
    }
  },

  addConnection: (connection) => {
    set((state) => ({ connections: [...state.connections, connection] }));
    tauriApi.storageSaveConnection(connection).catch(console.error);
  },

  updateConnection: (connection) => {
    set((state) => ({
      connections: state.connections.map((c) =>
        c.id === connection.id ? connection : c,
      ),
    }));
    tauriApi.storageSaveConnection(connection).catch(console.error);
  },

  setConnections: (connections) => {
    set({ connections });
    // Sync all to SQLite — clear removed ones by reloading after a tick
    connections.forEach((c) => tauriApi.storageSaveConnection(c).catch(console.error));
  },

  deleteConnection: (id) => {
    tauriApi.storageDeleteConnection(id).catch(console.error);
    set((state) => {
      const newConnections = state.connections.filter((c) => c.id !== id);
      const { [id]: _fns, ...restFns } = state.connectionFunctions;
      const { [id]: _tables, ...restTables } = state.connectionTables;
      const { [id]: _dbs, ...restDbs } = state.connectionDatabases;
      const { [id]: _sel, ...restSel } = state.selectedDatabases;
      return {
        connections: newConnections,
        connectedIds: state.connectedIds.filter((cid) => cid !== id),
        connectionFunctions: restFns,
        connectionTables: restTables,
        connectionDatabases: restDbs,
        selectedDatabases: restSel,
        activeFunction:
          state.activeFunction?.connectionId === id
            ? null
            : state.activeFunction,
        invocationResult:
          state.invocationResult?.fn.connectionId === id
            ? null
            : state.invocationResult,
      };
    });
  },

  // ---- Connection lifecycle ----

  connectAndInit: async (connectionId, options) => {
    const { connections } = get();
    const config = connections.find((c) => c.id === connectionId);
    if (!config) return false;

    const cleanupCancelledConnection = async () => {
      try {
        await tauriApi.disconnect(connectionId);
      } catch {
        // Ignore cleanup errors: cancellation should not surface as a connection failure.
      }
    };

    const isCancelled = () => options?.isCancelled?.() ?? false;

    try {
      // Establish Rust driver connection
      await tauriApi.connect(config);

      if (isCancelled()) {
        await cleanupCancelledConnection();
        return false;
      }

      // Fetch available user databases (filtered from system DBs)
      let userDbs: string[] = [];
      try {
        userDbs = await tauriApi.getUserDatabases(connectionId);
      } catch {
        // Some drivers (SQLite, Redis) may not support listing databases
      }

      // Auto-select: prefer configured DB, then first available
      const autoSelected = config.database ?? userDbs[0] ?? undefined;

      if (isCancelled()) {
        await cleanupCancelledConnection();
        return false;
      }

      // Discover tables for the selected database
      const tables = await tauriApi.listAllTables(connectionId, autoSelected);

      if (isCancelled()) {
        await cleanupCancelledConnection();
        return false;
      }

      // Build dbcooper-style function registry
      const fns = buildConnectionFunctions(config, tables);

      set((state) => ({
        connectedIds: state.connectedIds.includes(connectionId)
          ? state.connectedIds
          : [...state.connectedIds, connectionId],
        connectionConnectedAt: state.connectionConnectedAt[connectionId]
          ? state.connectionConnectedAt
          : { ...state.connectionConnectedAt, [connectionId]: Date.now() },
        connectionTables: { ...state.connectionTables, [connectionId]: { ...(state.connectionTables[connectionId] ?? {}), [autoSelected ?? ""]: tables } },
        connectionFunctions: {
          ...state.connectionFunctions,
          [connectionId]: { ...(state.connectionFunctions[connectionId] ?? {}), [autoSelected ?? ""]: fns },
        },
        connectionDatabases: { ...state.connectionDatabases, [connectionId]: userDbs },
        selectedDatabases: autoSelected
          ? { ...state.selectedDatabases, [connectionId]: autoSelected }
          : state.selectedDatabases,
        openDatabases: autoSelected
          ? { ...state.openDatabases, [connectionId]: [autoSelected] }
          : state.openDatabases,
        expandedConnections: state.expandedConnections.includes(connectionId)
          ? state.expandedConnections
          : [...state.expandedConnections, connectionId],
        activeConnectionId: connectionId,
      }));

      toast.success(`Connected: ${config.prefix}_list() and ${tables.length} table functions ready`);

      // Restore workspace snapshot for this connection (if any)
      const { _pendingWorkspaceSnapshot } = get();
      if (_pendingWorkspaceSnapshot && _pendingWorkspaceSnapshot.activeConnectionId === connectionId) {
        const snapshot = _pendingWorkspaceSnapshot;
        const allFns = fns; // already built above
        const restoredTabs: ResultTab[] = snapshot.tabs
          .map((t) => {
            const fn = allFns.find((f) => f.id === t.fnId);
            if (!fn) return null;
            const result: FunctionInvocationResult = { fn, outputType: fn.type === "query" || fn.type === "execute" ? "sql-editor" : "idle", isLoading: false, invokedAt: Date.now() };
            return { id: t.id, fn, result, pendingSql: t.pendingSql, pendingEdits: [], undoHistory: [], label: t.label, filters: [createDefaultFilter()], filteredResult: null, filtersActive: false } as ResultTab;
          })
          .filter((t): t is ResultTab => t !== null);
        if (restoredTabs.length > 0) {
          const activeTab = restoredTabs.find((t) => t.id === snapshot.activeTabId) ?? restoredTabs[restoredTabs.length - 1];
          set((s) => ({
            tabs: [...s.tabs, ...restoredTabs],
            activeTabId: activeTab.id,
            activeFunction: activeTab.fn,
            invocationResult: activeTab.result,
            pendingSqlValue: activeTab.pendingSql,
            _pendingWorkspaceSnapshot: null,
            selectedDatabases: { ...s.selectedDatabases, ...snapshot.selectedDatabases },
          }));

          // Re-invoke non-SQL tabs so their data is actually loaded (table/list/src tabs show nothing without this)
          const tabsToLoad = restoredTabs.filter((t) => t.fn.type !== "query" && t.fn.type !== "execute");
          for (const tab of tabsToLoad) {
            await get().invokeFunction(tab.fn);
          }

          // Restore focus to the originally active tab after all invocations
          const finalActiveTab = restoredTabs.find((t) => t.id === snapshot.activeTabId) ?? restoredTabs[restoredTabs.length - 1];
          set((s) => ({
            activeTabId: finalActiveTab.id,
            activeFunction: finalActiveTab.fn,
            invocationResult: s.tabs.find((t) => t.id === finalActiveTab.id)?.result ?? finalActiveTab.result,
            pendingSqlValue: finalActiveTab.pendingSql,
          }));
        } else {
          set({ _pendingWorkspaceSnapshot: null });
        }
      }

      // If the user triggered connect while on the new-connection page (either
      // from the page-mode dialog or from the edit modal opened via the sidebar),
      // navigate back to the main view so the page hides automatically.
      if (get().activeView === "new-connection") {
        set({ activeView: "main" });
      }

      return true;
    } catch (error) {
      if (isCancelled()) return false;
      toast.error(`Connection failed: ${String(error)}`);
      return false;
    }
  },

  disconnectConnection: async (connectionId) => {
    try {
      await tauriApi.disconnect(connectionId);
    } catch {
      // Ignore disconnect errors
    }
    set((state) => {
      const { [connectionId]: _fns, ...restFns } = state.connectionFunctions;
      const { [connectionId]: _tables, ...restTables } = state.connectionTables;
      const { [connectionId]: _dbs, ...restDbs } = state.connectionDatabases;
      const { [connectionId]: _sel, ...restSel } = state.selectedDatabases;
      const { [connectionId]: _open, ...restOpen } = state.openDatabases;
      const { [connectionId]: _lat, ...restLat } = state.connectionLatency;
      const { [connectionId]: _cat, ...restCat } = state.connectionConnectedAt;
      const newTabs = state.tabs.filter((t) => t.fn.connectionId !== connectionId);
      const activeBelongsToConn = state.activeFunction?.connectionId === connectionId;
      const newActiveTab = activeBelongsToConn ? newTabs[newTabs.length - 1] ?? null : null;
      return {
        connectedIds: state.connectedIds.filter((id) => id !== connectionId),
        connectionFunctions: restFns,
        connectionTables: restTables,
        connectionDatabases: restDbs,
        selectedDatabases: restSel,
        openDatabases: restOpen,
        connectionLatency: restLat,
        connectionConnectedAt: restCat,
        tabs: newTabs,
        activeTabId: activeBelongsToConn ? (newActiveTab?.id ?? null) : state.activeTabId,
        activeFunction: activeBelongsToConn ? (newActiveTab?.fn ?? null) : state.activeFunction,
        invocationResult: activeBelongsToConn ? (newActiveTab?.result ?? null) : state.invocationResult,
      };
    });
    toast.success("Disconnected");
  },

  selectDatabase: async (connectionId, database) => {
    const { connections } = get();
    const config = connections.find((c) => c.id === connectionId);
    if (!config) return;

    set({ isLoading: true });
    try {
      await tauriApi.switchDatabase(connectionId, database);
      const tables = await tauriApi.listAllTables(connectionId, database);
      const fns = buildConnectionFunctions(config, tables);

      set((state) => ({
        selectedDatabases: { ...state.selectedDatabases, [connectionId]: database },
        connectionTables: { ...state.connectionTables, [connectionId]: { ...(state.connectionTables[connectionId] ?? {}), [database]: tables } },
        connectionFunctions: { ...state.connectionFunctions, [connectionId]: { ...(state.connectionFunctions[connectionId] ?? {}), [database]: fns } },
        openDatabases: {
          ...state.openDatabases,
          [connectionId]: state.openDatabases[connectionId]?.includes(database)
            ? state.openDatabases[connectionId]
            : [...(state.openDatabases[connectionId] ?? []), database],
        },
        // If active function belonged to this connection, point it to the new fn list
        // (keeps the connection "active" in the titlebar after a DB switch)
        activeFunction:
          state.activeFunction?.connectionId === connectionId
            ? (fns[0] ?? null)
            : state.activeFunction,
        invocationResult:
          state.invocationResult?.fn.connectionId === connectionId
            ? null
            : state.invocationResult,
      }));

      toast.success(`Switched to ${database}: ${tables.length} tables`);
    } catch (error) {
      toast.error(`Failed to switch database: ${String(error)}`);
    } finally {
      set({ isLoading: false });
    }
  },

  closeOpenDatabase: async (connectionId, database) => {
    const { openDatabases, selectedDatabases, selectDatabase } = get();
    const remaining = (openDatabases[connectionId] ?? []).filter((db) => db !== database);
    set((state) => ({
      openDatabases: { ...state.openDatabases, [connectionId]: remaining },
    }));
    // If we closed the currently selected DB, switch to another open one
    if (selectedDatabases[connectionId] === database && remaining.length > 0) {
      await selectDatabase(connectionId, remaining[remaining.length - 1]);
    }
  },

  refreshDatabases: async (connectionId) => {
    try {
      const userDbs = await tauriApi.getUserDatabases(connectionId);
      set((state) => ({
        connectionDatabases: { ...state.connectionDatabases, [connectionId]: userDbs },
      }));
    } catch (error) {
      toast.error(`Failed to refresh databases: ${String(error)}`);
    }
  },

  refreshTables: async (connectionId, database) => {
    const { connections, selectedDatabases } = get();
    const config = connections.find((c) => c.id === connectionId);
    if (!config) return;
    const db = database ?? selectedDatabases[connectionId];
    try {
      const tables = await tauriApi.listAllTables(connectionId, db);
      const fns = buildConnectionFunctions(config, tables);
      const dbKey = db ?? "";
      set((state) => ({
        connectionTables: { ...state.connectionTables, [connectionId]: { ...(state.connectionTables[connectionId] ?? {}), [dbKey]: tables } },
        connectionFunctions: { ...state.connectionFunctions, [connectionId]: { ...(state.connectionFunctions[connectionId] ?? {}), [dbKey]: fns } },
      }));
      toast.success(`${tables.length} tables loaded`);
    } catch (error) {
      toast.error(`Failed to refresh tables: ${String(error)}`);
    }
  },

  loadTableColumns: async (connectionId, tableName) => {
    const { selectedDatabases } = get();
    const database = selectedDatabases[connectionId];
    if (!database) return;
    try {
      const tableSchema = (get().connectionTables[connectionId]?.[database] ?? []).find((t) => t.name === tableName)?.schema;
      const structure = await tauriApi.getTableStructure(connectionId, database, tableName, tableSchema);
      set((state) => {
        const dbTables = state.connectionTables[connectionId] ?? {};
        const tables = dbTables[database] ?? [];
        const updated = tables.map((t) =>
          t.name === tableName ? { ...t, columns: structure.columns } : t,
        );
        return { connectionTables: { ...state.connectionTables, [connectionId]: { ...dbTables, [database]: updated } } };
      });
    } catch {
      // silently ignore — no columns shown
    }
  },

  pingConnectionHealth: async (connectionId) => {
    try {
      const latencyMs = await tauriApi.pingConnection(connectionId);
      set((s) => ({ connectionLatency: { ...s.connectionLatency, [connectionId]: latencyMs } }));
    } catch {
      set((s) => ({ connectionLatency: { ...s.connectionLatency, [connectionId]: null } }));
    }
  },
});
